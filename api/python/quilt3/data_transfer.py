from collections import deque
from codecs import iterdecode
from concurrent.futures import ThreadPoolExecutor
import hashlib
import pathlib
import shutil
from threading import Lock
from typing import List, Tuple
import warnings

from botocore import UNSIGNED
from botocore.client import Config
from botocore.exceptions import ClientError
import boto3
from boto3.s3.transfer import TransferConfig
from s3transfer.utils import ChunksizeAdjuster, OSUtils, signal_transferring, signal_not_transferring

import jsonlines
from tqdm import tqdm

from .session import create_botocore_session
from .util import PhysicalKey, QuiltException


def create_s3_client():
    botocore_session = create_botocore_session()
    boto_session = boto3.Session(botocore_session=botocore_session)

    # Check whether credentials are present
    if boto_session.get_credentials() is None:
        # Use unsigned boto if credentials aren't present
        s3_client = boto_session.client('s3', config=Config(signature_version=UNSIGNED))
    else:
        # Use normal boto
        s3_client = boto_session.client('s3')

    # Enable/disable file read callbacks when uploading files.
    # Copied from https://github.com/boto/s3transfer/blob/develop/s3transfer/manager.py#L501
    event_name = 'request-created.s3'
    s3_client.meta.events.register_first(
        event_name, signal_not_transferring,
        unique_id='datatransfer-not-transferring')
    s3_client.meta.events.register_last(
        event_name, signal_transferring,
        unique_id='datatransfer-transferring')

    return s3_client


s3_transfer_config = TransferConfig()

# When uploading files at least this size, compare the ETags first and skip the upload if they're equal;
# copy the remote file onto itself if the metadata changes.
UPLOAD_ETAG_OPTIMIZATION_THRESHOLD = 1024


def _copy_local_file(ctx, size, src_path, dest_path):
    pathlib.Path(dest_path).parent.mkdir(parents=True, exist_ok=True)

    # TODO(dima): More detailed progress.
    shutil.copyfile(src_path, dest_path)
    ctx.progress(size)
    shutil.copymode(src_path, dest_path)

    ctx.done(PhysicalKey.from_path(dest_path))


def _upload_file(ctx, size, src_path, dest_bucket, dest_key):
    s3_client = ctx.s3_client

    if size < s3_transfer_config.multipart_threshold:
        with OSUtils().open_file_chunk_reader(src_path, 0, size, [ctx.progress]) as fd:
            resp = s3_client.put_object(
                Body=fd,
                Bucket=dest_bucket,
                Key=dest_key,
            )

        version_id = resp.get('VersionId')  # Absent in unversioned buckets.
        ctx.done(PhysicalKey(dest_bucket, dest_key, version_id))
    else:
        resp = s3_client.create_multipart_upload(
            Bucket=dest_bucket,
            Key=dest_key,
        )
        upload_id = resp['UploadId']

        adjuster = ChunksizeAdjuster()
        chunksize = adjuster.adjust_chunksize(s3_transfer_config.multipart_chunksize, size)

        chunk_offsets = list(range(0, size, chunksize))

        lock = Lock()
        remaining = len(chunk_offsets)
        parts = [None] * remaining

        def upload_part(i, start, end):
            nonlocal remaining
            part_id = i + 1
            with OSUtils().open_file_chunk_reader(src_path, start, end-start, [ctx.progress]) as fd:
                part = s3_client.upload_part(
                    Body=fd,
                    Bucket=dest_bucket,
                    Key=dest_key,
                    UploadId=upload_id,
                    PartNumber=part_id
                )
            with lock:
                parts[i] = {"PartNumber": part_id, "ETag": part["ETag"]}
                remaining -= 1
                done = remaining == 0

            if done:
                resp = s3_client.complete_multipart_upload(
                    Bucket=dest_bucket,
                    Key=dest_key,
                    UploadId=upload_id,
                    MultipartUpload={"Parts": parts}
                )
                version_id = resp.get('VersionId')  # Absent in unversioned buckets.
                ctx.done(PhysicalKey(dest_bucket, dest_key, version_id))

        for i, start in enumerate(chunk_offsets):
            end = min(start + chunksize, size)
            ctx.run(upload_part, i, start, end)


def _download_file(ctx, src_bucket, src_key, src_version, dest_path):
    dest_file = pathlib.Path(dest_path)
    if dest_file.is_reserved():
        raise ValueError("Cannot download to %r: reserved file name" % dest_path)

    s3_client = ctx.s3_client

    dest_file.parent.mkdir(parents=True, exist_ok=True)

    params = dict(Bucket=src_bucket, Key=src_key)
    if src_version is not None:
        params.update(dict(VersionId=src_version))
    resp = s3_client.get_object(**params)

    body = resp['Body']
    with open(dest_path, 'wb') as fd:
        while True:
            chunk = body.read(64 * 1024)
            if not chunk:
                break
            fd.write(chunk)
            ctx.progress(len(chunk))

    ctx.done(PhysicalKey.from_path(dest_path))


def _copy_remote_file(ctx, size, src_bucket, src_key, src_version,
                      dest_bucket, dest_key, extra_args=None):
    src_params = dict(
        Bucket=src_bucket,
        Key=src_key
    )
    if src_version is not None:
        src_params.update(
            VersionId=src_version
        )

    s3_client = ctx.s3_client

    if size < s3_transfer_config.multipart_threshold:
        params = dict(
            CopySource=src_params,
            Bucket=dest_bucket,
            Key=dest_key,
        )

        if extra_args:
            params.update(extra_args)

        resp = s3_client.copy_object(**params)
        ctx.progress(size)
        version_id = resp.get('VersionId')  # Absent in unversioned buckets.
        ctx.done(PhysicalKey(dest_bucket, dest_key, version_id))
    else:
        resp = s3_client.create_multipart_upload(
            Bucket=dest_bucket,
            Key=dest_key,
        )
        upload_id = resp['UploadId']

        adjuster = ChunksizeAdjuster()
        chunksize = adjuster.adjust_chunksize(s3_transfer_config.multipart_chunksize, size)

        chunk_offsets = list(range(0, size, chunksize))

        lock = Lock()
        remaining = len(chunk_offsets)
        parts = [None] * remaining

        def upload_part(i, start, end):
            nonlocal remaining
            part_id = i + 1
            part = s3_client.upload_part_copy(
                CopySource=src_params,
                CopySourceRange=f'bytes={start}-{end-1}',
                Bucket=dest_bucket,
                Key=dest_key,
                UploadId=upload_id,
                PartNumber=part_id
            )
            with lock:
                parts[i] = {"PartNumber": part_id, "ETag": part["CopyPartResult"]["ETag"]}
                remaining -= 1
                done = remaining == 0

            ctx.progress(end - start)

            if done:
                resp = s3_client.complete_multipart_upload(
                    Bucket=dest_bucket,
                    Key=dest_key,
                    UploadId=upload_id,
                    MultipartUpload={"Parts": parts}
                )
                version_id = resp.get('VersionId')  # Absent in unversioned buckets.
                ctx.done(PhysicalKey(dest_bucket, dest_key, version_id))

        for i, start in enumerate(chunk_offsets):
            end = min(start + chunksize, size)
            ctx.run(upload_part, i, start, end)


def _upload_or_copy_file(ctx, size, src_path, dest_bucket, dest_path):
    s3_client = ctx.s3_client

    # Optimization: check if the remote file already exists and has the right ETag,
    # and skip the upload.
    if size >= UPLOAD_ETAG_OPTIMIZATION_THRESHOLD:
        try:
            resp = s3_client.head_object(Bucket=dest_bucket, Key=dest_path)
        except ClientError:
            # Destination doesn't exist, so fall through to the normal upload.
            pass
        else:
            # Check the ETag.
            dest_size = resp['ContentLength']
            dest_etag = resp['ETag']
            dest_version_id = resp.get('VersionId')
            if size == dest_size:
                src_etag = _calculate_etag(src_path)
                if src_etag == dest_etag:
                    # Nothing more to do. We should not attempt to copy the object because
                    # that would cause the "copy object to itself" error.
                    ctx.progress(size)
                    ctx.done(PhysicalKey(dest_bucket, dest_path, dest_version_id))
                    return  # Optimization succeeded.

    # If the optimization didn't happen, do the normal upload.
    _upload_file(ctx, size, src_path, dest_bucket, dest_path)


class WorkerContext(object):
    def __init__(self, s3_client, progress, done, run):
        self.s3_client = s3_client
        self.progress = progress
        self.done = done
        self.run = run


def _copy_file_list_internal(s3_client, file_list, callback):
    """
    Takes a list of tuples (src, dest, size) and copies the data in parallel.
    Returns versioned URLs for S3 destinations and regular file URLs for files.
    """
    total_size = sum(size for _, _, size in file_list)

    lock = Lock()
    futures = deque()
    results = [None] * len(file_list)

    stopped = False

    with tqdm(desc="Copying", total=total_size, unit='B', unit_scale=True) as progress, \
         ThreadPoolExecutor(s3_transfer_config.max_request_concurrency) as executor:

        def progress_callback(bytes_transferred):
            if stopped:
                raise Exception("Interrupted")
            with lock:
                progress.update(bytes_transferred)

        def run_task(func, *args):
            future = executor.submit(func, *args)
            with lock:
                futures.append(future)

        def worker(idx, src, dest, size):
            if stopped:
                raise Exception("Interrupted")

            def done_callback(value):
                assert value is not None
                with lock:
                    assert results[idx] is None
                    results[idx] = value
                if callback is not None:
                    callback(src, dest, size)

            ctx = WorkerContext(s3_client=s3_client, progress=progress_callback, done=done_callback, run=run_task)

            if dest.version_id:
                raise ValueError("Cannot set VersionId on destination")

            if src.is_local():
                if dest.is_local():
                    _copy_local_file(ctx, size, src.path, dest.path)
                else:
                    if dest.version_id:
                        raise ValueError("Cannot set VersionId on destination")
                    _upload_or_copy_file(ctx, size, src.path, dest.bucket, dest.path)
            else:
                if dest.is_local():
                    _download_file(ctx, src.bucket, src.path, src.version_id, dest.path)
                else:
                    _copy_remote_file(ctx, size, src.bucket, src.path, src.version_id,
                                      dest.bucket, dest.path)

        try:
            for idx, args in enumerate(file_list):
                run_task(worker, idx, *args)

            # ThreadPoolExecutor does not appear to have a way to just wait for everything to complete.
            # Shutting it down will cause it to wait - but will prevent any new tasks from starting.
            # So, manually wait for all tasks to complete.
            # This will also raise any exception that happened in a worker thread.
            while True:
                with lock:
                    if not futures:
                        break
                    future = futures.popleft()
                future.result()
        finally:
            # Make sure all tasks exit quickly if the main thread exits before they're done.
            stopped = True

    assert all(results)

    return results


def _calculate_etag(file_path):
    """
    Attempts to calculate a local file's ETag the way S3 does:
    - Normal uploads: MD5 of the file
    - Multi-part uploads: MD5 of the (binary) MD5s of the parts, dash, number of parts
    We can't know how the file was actually uploaded - but we're assuming it was done using
    the default settings, which we get from `s3_transfer_config`.
    """
    size = pathlib.Path(file_path).stat().st_size
    with open(file_path, 'rb') as fd:
        if size <= s3_transfer_config.multipart_threshold:
            contents = fd.read()
            etag = hashlib.md5(contents).hexdigest()
        else:
            adjuster = ChunksizeAdjuster()
            chunksize = adjuster.adjust_chunksize(s3_transfer_config.multipart_chunksize, size)

            hashes = []
            while True:
                contents = fd.read(chunksize)
                if not contents:
                    break
                hashes.append(hashlib.md5(contents).digest())
            etag = '%s-%d' % (hashlib.md5(b''.join(hashes)).hexdigest(), len(hashes))
    return '"%s"' % etag


def delete_object(bucket, key):
    s3_client = create_s3_client()

    s3_client.head_object(Bucket=bucket, Key=key)  # Make sure it exists
    s3_client.delete_object(Bucket=bucket, Key=key)  # Actually delete it


def list_object_versions(bucket, prefix, recursive=True):
    if prefix and not prefix.endswith('/'):
        raise ValueError("Prefix must end with /")

    list_obj_params = dict(Bucket=bucket,
                           Prefix=prefix
                          )
    if not recursive:
        # Treat '/' as a directory separator and only return one level of files instead of everything.
        list_obj_params.update(dict(Delimiter='/'))

    # TODO: make this a generator?
    versions = []
    delete_markers = []
    prefixes = []

    s3_client = create_s3_client()
    paginator = s3_client.get_paginator('list_object_versions')

    for response in paginator.paginate(**list_obj_params):
        versions += response.get('Versions', [])
        delete_markers += response.get('DeleteMarkers', [])
        prefixes += response.get('CommonPrefixes', [])

    if recursive:
        return versions, delete_markers
    else:
        return prefixes, versions, delete_markers


def list_objects(bucket, prefix, recursive=True):
    if prefix and not prefix.endswith('/'):
        raise ValueError("Prefix must end with /")

    objects = []
    prefixes = []
    list_obj_params = dict(Bucket=bucket,
                           Prefix=prefix)
    if not recursive:
        # Treat '/' as a directory separator and only return one level of files instead of everything.
        list_obj_params.update(dict(Delimiter='/'))

    s3_client = create_s3_client()
    paginator = s3_client.get_paginator('list_objects_v2')

    for response in paginator.paginate(**list_obj_params):
        objects += response.get('Contents', [])
        prefixes += response.get('CommonPrefixes', [])

    if recursive:
        return objects
    else:
        return prefixes, objects


def _looks_like_dir(pk: PhysicalKey):
    return pk.basename() == ''


def list_url(src: PhysicalKey):
    if src.is_local():
        src_file = pathlib.Path(src.path)

        for f in src_file.rglob('*'):
            try:
                if f.is_file():
                    size = f.stat().st_size
                    yield f.relative_to(src_file).as_posix(), size
            except FileNotFoundError:
                # If a file does not exist, is it really a file?
                pass
    else:
        if src.version_id is not None:
            raise ValueError(f"Directories cannot have version IDs: {src}")
        src_path = src.path
        if not _looks_like_dir(src):
            src_path += '/'
        s3_client = create_s3_client()
        paginator = s3_client.get_paginator('list_objects_v2')
        for response in paginator.paginate(Bucket=src.bucket, Prefix=src_path):
            for obj in response.get('Contents', []):
                key = obj['Key']
                if not key.startswith(src_path):
                    raise ValueError("Unexpected key: %r" % key)
                yield key[len(src_path):], obj['Size']


def delete_url(src: PhysicalKey):
    """Deletes the given URL.
    Follows S3 semantics even for local files:
    - If the URL does not exist, it's a no-op.
    - If it's a non-empty directory, it's also a no-op.
    """
    if src.is_local():
        src_file = pathlib.Path(src.path)

        if src_file.is_dir():
            try:
                src_file.rmdir()
            except OSError:
                # Ignore non-empty directories, for consistency with S3
                pass
        else:
            try:
                src_file.unlink()
            except FileExistsError:
                pass
    else:
        s3_client = create_s3_client()
        s3_client.delete_object(Bucket=src.bucket, Key=src.path)


def copy_file_list(file_list, callback=None):
    """
    Takes a list of tuples (src, dest, size) and copies them in parallel.
    URLs must be regular files, not directories.
    Returns versioned URLs for S3 destinations and regular file URLs for files.
    """
    for src, dest, _ in file_list:
        if _looks_like_dir(src) or _looks_like_dir(dest):
            raise ValueError("Directories are not allowed")

    s3_client = create_s3_client()
    return _copy_file_list_internal(s3_client, file_list, callback)


def copy_file(src: PhysicalKey, dest: PhysicalKey, size=None, callback=None):
    """
    Copies a single file or directory.
    If src is a file, dest can be a file or a directory.
    If src is a directory, dest must be a directory.
    """
    def sanity_check(rel_path):
        for part in rel_path.split('/'):
            if part in ('', '.', '..'):
                raise ValueError("Invalid relative path: %r" % rel_path)

    url_list = []
    if _looks_like_dir(src):
        if not _looks_like_dir(dest):
            raise ValueError("Destination path must end in /")
        if size is not None:
            raise ValueError("`size` does not make sense for directories")

        for rel_path, size in list_url(src):
            sanity_check(rel_path)
            url_list.append((src.join(rel_path), dest.join(rel_path), size))
        if not url_list:
            raise QuiltException("No objects to download.")
    else:
        if _looks_like_dir(dest):
            dest = dest.join(src.basename())
        if size is None:
            size, _ = get_size_and_version(src)
        url_list.append((src, dest, size))

    s3_client = create_s3_client()
    _copy_file_list_internal(s3_client, url_list, callback)


def put_bytes(data: bytes, dest: PhysicalKey):
    if _looks_like_dir(dest):
        raise ValueError("Invalid path: %r" % dest.path)

    if dest.is_local():
        dest_file = pathlib.Path(dest.path)
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        dest_file.write_bytes(data)
    else:
        if dest.version_id is not None:
            raise ValueError("Cannot set VersionId on destination")
        s3_client = create_s3_client()
        s3_client.put_object(
            Bucket=dest.bucket,
            Key=dest.path,
            Body=data,
        )

def get_bytes(src: PhysicalKey):
    if src.is_local():
        src_file = pathlib.Path(src.path)
        data = src_file.read_bytes()
    else:
        params = dict(Bucket=src.bucket, Key=src.path)
        if src.version_id is not None:
            params.update(dict(VersionId=src.version_id))
        s3_client = create_s3_client()
        resp = s3_client.get_object(**params)
        data = resp['Body'].read()
    return data

def get_size_and_version(src: PhysicalKey):
    """
    Gets size and version for the object at a given URL.

    Returns:
        size, version(str)
    """
    if _looks_like_dir(src):
        raise QuiltException("Invalid path: %r; cannot be a directory" % src.path)

    version = None
    if src.is_local():
        src_file = pathlib.Path(src.path)
        if not src_file.is_file():
            raise QuiltException("Not a file: %r" % str(src_file))
        size = src_file.stat().st_size
    else:
        params = dict(
            Bucket=src.bucket,
            Key=src.path
        )
        if src.version_id is not None:
            params.update(dict(VersionId=src.version_id))
        s3_client = create_s3_client()
        resp = s3_client.head_object(**params)
        size = resp['ContentLength']
        version = resp.get('VersionId')
    return size, version

def calculate_sha256(src_list: List[PhysicalKey], sizes: List[int]):
    assert len(src_list) == len(sizes)

    total_size = sum(sizes)
    lock = Lock()

    with tqdm(desc="Hashing", total=total_size, unit='B', unit_scale=True) as progress:
        def _process_url(src, size):
            hash_obj = hashlib.sha256()
            if src.is_local():
                with open(src.path, 'rb') as fd:
                    while True:
                        chunk = fd.read(64 * 1024)
                        if not chunk:
                            break
                        hash_obj.update(chunk)
                        with lock:
                            progress.update(len(chunk))

                    current_file_size = fd.tell()
                    if current_file_size != size:
                        warnings.warn(
                            f"Expected the package entry at {src!r} to be {size} B in size, but "
                            f"found an object which is {current_file_size} B instead. This "
                            f"indicates that the content of the file changed in between when you "
                            f"included this  entry in the package (via set or set_dir) and now. "
                            f"This should be avoided if possible."
                        )

            else:
                params = dict(Bucket=src.bucket, Key=src.path)
                if src.version_id is not None:
                    params.update(dict(VersionId=src.version_id))
                s3_client = create_s3_client()
                resp = s3_client.get_object(**params)
                body = resp['Body']
                for chunk in body:
                    hash_obj.update(chunk)
                    with lock:
                        progress.update(len(chunk))
            return hash_obj.hexdigest()

        with ThreadPoolExecutor() as executor:
            results = executor.map(_process_url, src_list, sizes)

    return results


def select(src, query, meta=None, raw=False, **kwargs):
    """Perform an S3 Select SQL query, return results as a Pandas DataFrame

    The data returned by Boto3 for S3 Select is fairly convoluted, to say the
    least.  This function returns the result as a dataframe instead.  It also
    performs the following actions, for convenience:

    * If quilt metadata is given, necessary info to handle the select query is
      pulled from the format metadata.
    * If no metadata is present, but the URL indicates an object with a known
      extension, the file format (and potentially compression) are determeined
      by that extension.
      * Extension may include a compresssion extension in cases where that is
        supported by AWS -- I.e, for queries on JSON or CSV files, .bz2 and
        .gz are supported.
      * Parquet files must not be compressed as a whole, and should not have
        a compression extension.  However, columnar GZIP and Snappy are
        transparently supported.

    Args:
        src(PhysicalKey):  S3 PhysicalKey of the object to query
        query(str): An SQL query using the 'SELECT' directive. See examples at
            https://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectSELECTContent.html
        meta: Quilt Object Metadata
        raw(bool):  True to return the raw Boto3 response object
        **kwargs:  s3_client.select() kwargs override.
            All kwargs specified passed to S3 client directly, overriding
            matching default/generated kwargs for `select_object_content()`.
            Note that this will also override the bucket and key specified in
            the URL if `Bucket` and `Key` are passed as kwargs.

    Returns: pandas.DataFrame | dict
        dict is returned if 'raw' is True or if OutputSerialization is set to
            something other than JSON Lines.

    """
    # We don't process any other kind of response at this time.
    output_serialization = {'JSON': {}}
    query_type = "SQL"  # AWS S3 doesn't currently support anything else.
    meta = meta if meta is not None else {}

    # Internal Format Name <--> S3 Format Name
    valid_s3_select_formats = {
        'parquet': 'Parquet',
        'json': 'JSON',
        'jsonl': 'JSON',
        'csv': 'CSV',
        }
    # S3 Format Name <--> S3-Acceptable compression types
    format_compression = {
        'Parquet': ['NONE'],  # even if column-level compression has been used.
        'JSON': ['NONE', 'BZIP2', 'GZIP'],
        'CSV': ['NONE', 'BZIP2', 'GZIP'],
        }
    # File extension <--> S3-Acceptable compression type
    # For compression type, when not specified in metadata.  Guess by extension.
    accepted_compression = {
        '.bz2': 'BZIP2',
        '.gz': 'GZIP'
        }
    # Extension <--> Internal Format Name
    # For file type, when not specified in metadata. Guess by extension.
    ext_formats = {
        '.parquet': 'parquet',
        '.json': 'json',
        '.jsonl': 'jsonl',
        '.csv': 'csv',
        '.tsv': 'csv',
        '.ssv': 'csv',
        }
    delims = {'.tsv': '\t', '.ssv': ';'}

    assert not src.is_local(), "src must be an S3 URL"

    # TODO: what about version_id???

    # TODO: Use formats lib for this stuff
    # use metadata to get format and compression
    compression = None
    format = meta.get('target')
    if format is None:
        format = meta.get('format', {}).get('name')
        if format in ('bzip2', 'gzip'):
            compression = format.upper()
            format = meta.get('format', {}).get('contained_format', {}).get('name')

    # use file extensions to get compression info, if none is present
    exts = pathlib.Path(src.path).suffixes  # last of e.g. ['.periods', '.in', '.name', '.json', '.gz']
    if exts and not compression:
        if exts[-1].lower() in accepted_compression:
            compression = accepted_compression[exts.pop(-1)]   # remove e.g. '.gz'
    compression = compression if compression else 'NONE'

    # use remaining file extensions to get format info, if none is present
    csv_delim = None
    if exts and not format:
        ext = exts[-1].lower()    # last of e.g. ['.periods', '.in', '.name', '.json']
        if ext in ext_formats:
            format = ext_formats[ext]
            csv_delim = delims.get(ext)
            s3_format = valid_s3_select_formats[format]
            ok_compression = format_compression[s3_format]
            if compression not in ok_compression:
                raise QuiltException("Compression {!r} not valid for select on format {!r}: "
                                     "Expected {!r}".format(compression, s3_format, ok_compression))
    if not format:
        raise QuiltException("Unable to discover format for select on {}".format(src))

    # At this point, we have a known format and enough information to use it.
    s3_format = valid_s3_select_formats[format]

    # Create InputSerialization section if not user-specified.
    input_serialization = None
    if 'InputSerialization' not in kwargs:
        input_serialization = {'CompressionType': compression}
        format_spec = input_serialization.setdefault(s3_format, {})

        if s3_format == 'JSON':
            format_spec['Type'] = "LINES" if format == 'jsonl' else "DOCUMENT"
        elif s3_format == 'CSV':
            if csv_delim is not None:
                format_spec['FieldDelimiter'] = csv_delim

    # These are processed and/or default args.
    select_kwargs = dict(
        Bucket=src.bucket,
        Key=src.path,
        Expression=query,
        ExpressionType=query_type,
        InputSerialization=input_serialization,
        OutputSerialization=output_serialization,
    )
    # Include user-specified passthrough options, overriding other options
    select_kwargs.update(kwargs)

    s3_client = create_s3_client()
    response = s3_client.select_object_content(**select_kwargs)

    # we don't want multiple copies of large chunks of data hanging around.
    # ..iteration ftw.  It's what we get from amazon, anyways..
    def iter_chunks(resp):
        for item in resp['Payload']:
            chunk = item.get('Records', {}).get('Payload')
            if chunk is None:
                continue
            yield chunk

    def iter_lines(resp, delimiter):
        # S3 may break chunks off at any point, so we need to find line endings and handle
        # line breaks manually.
        # Note: this isn't reliable for CSV, because CSV may have a quoted line ending,
        # whereas line endings in JSONLines content will be encoded cleanly.
        lastline = ''
        for chunk in iterdecode(iter_chunks(resp), 'utf-8'):
            lines = chunk.split(delimiter)
            lines[0] = lastline + lines[0]
            lastline = lines.pop(-1)
            for line in lines:
                yield line + delimiter
        yield lastline

    if not raw:
        # JSON used for processed content as it doesn't have the ambiguity of CSV.
        if 'JSON' in select_kwargs["OutputSerialization"]:
            delimiter = select_kwargs['OutputSerialization']['JSON'].get('RecordDelimiter', '\n')
            reader = jsonlines.Reader(line.strip() for line in iter_lines(response, delimiter)
                                      if line.strip())
            # noinspection PyPackageRequirements
            from pandas import DataFrame   # Lazy import for slow module
            # !! if this response type is modified, update related docstrings on Bucket.select().
            return DataFrame.from_records(x for x in reader)
        # If there's some need, we could implement some other OutputSerialization format here.
        # If they've specified an OutputSerialization key we don't handle, just give them the
        # raw response.
    # !! if this response type is modified, update related docstrings on Bucket.select().
    return response
