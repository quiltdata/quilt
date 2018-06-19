"""
High-level helper functions for uploading and downloading fragments.
"""

from __future__ import print_function
import gzip
import os
import re
from shutil import copyfileobj, move
import tempfile
from threading import Thread, Lock

import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
from six import iteritems, itervalues
from tqdm import tqdm

from .hashing import digest_file
from .util import FileWithReadProgress, get_free_space


PARALLEL_UPLOADS = 20
PARALLEL_DOWNLOADS = 20

S3_CONNECT_TIMEOUT = 30
S3_READ_TIMEOUT = 30
S3_TIMEOUT_RETRIES = 3

CONTENT_RANGE_RE = re.compile(r'^bytes (\d+)-(\d+)/(\d+)$')

CHUNK_SIZE = 4096

ZLIB_LEVEL = 2


# pyOpenSSL and S3 don't play well together. pyOpenSSL is completely optional, but gets enabled by requests.
# So... We disable it. That's what boto does.
# https://github.com/boto/botocore/issues/760
# https://github.com/boto/botocore/pull/803
try:
    from urllib3.contrib import pyopenssl
    pyopenssl.extract_from_urllib3()
except ImportError:
    pass


def create_s3_session():
    """
    Creates a session with automatic retries on 5xx errors.
    """
    sess = requests.Session()
    retries = Retry(total=3,
                    backoff_factor=.5,
                    status_forcelist=[500, 502, 503, 504])
    sess.mount('https://', HTTPAdapter(max_retries=retries))
    return sess

def download_fragments(store, obj_urls, obj_sizes):
    assert len(obj_urls) == len(obj_sizes)

    obj_queue = sorted(iteritems(obj_urls), reverse=True)
    total = len(obj_queue)
    # Some objects might be missing a size; ignore those for now.
    total_bytes = sum(size or 0 for size in itervalues(obj_sizes))

    # Check if we have enough disk space. There's no way to check reliably because we also need
    # space for the temporary gzip'ed files, but that's better than nothing.
    free_space = get_free_space(store.object_path('.'))
    if total_bytes > free_space:
        print("Error: Insufficient space for install. Required: %d, available: %d" % (total_bytes, free_space))
        return False

    downloaded = []
    lock = Lock()

    print("Downloading %d fragments (%d bytes before compression)..." % (total, total_bytes))

    with tqdm(total=total_bytes, unit='B', unit_scale=True) as progress:
        def _worker_thread():
            with create_s3_session() as s3_session:
                while True:
                    with lock:
                        if not obj_queue:
                            break
                        obj_hash, url = obj_queue.pop()
                        original_size = obj_sizes[obj_hash] or 0  # If the size is unknown, just treat it as 0.

                    success = False

                    temp_path_gz = store.temporary_object_path(obj_hash + '.gz')
                    with open(temp_path_gz, 'ab') as output_file:
                        original_last_update = 0
                        for attempt in range(S3_TIMEOUT_RETRIES):
                            try:
                                existing_file_size = output_file.tell()

                                # Use the Range header to resume downloads.
                                # Weird corner case: if the file is already completely downloaded, we will
                                # get a RANGE_NOT_SATISFIABLE, and not get the Content-Encoding header.
                                # So, always download at least one byte.
                                range_start = max(existing_file_size - 1, 0)

                                response = s3_session.get(
                                    url,
                                    headers={
                                        'Range': 'bytes=%d-' % range_start
                                    },
                                    stream=True,
                                    timeout=(S3_CONNECT_TIMEOUT, S3_READ_TIMEOUT)
                                )

                                if not response.ok:
                                    message = "Download failed for %s:\nURL: %s\nStatus code: %s\nResponse: %r\n" % (
                                        obj_hash, response.request.url, response.status_code, response.text
                                    )
                                    with lock:
                                        tqdm.write(message)
                                    break

                                # Prevent requests from processing 'Content-Encoding: gzip' automatically.
                                encoding = response.raw.headers.pop('Content-Encoding', None)

                                # Make sure we're getting the expected range.
                                content_range = response.headers.get('Content-Range', '')
                                match = CONTENT_RANGE_RE.match(content_range)
                                if not match or not int(match.group(1)) == range_start:
                                    with lock:
                                        tqdm.write("Unexpected Content-Range: %s" % content_range)
                                    break

                                compressed_size = int(match.group(3))

                                # We may have started with a partially-downloaded file, so update the progress bar.
                                compressed_read = existing_file_size
                                original_read = compressed_read * original_size // compressed_size
                                with lock:
                                    progress.update(original_read - original_last_update)
                                original_last_update = original_read

                                # If we've downloaded an extra byte, skip it.
                                skip_bytes = existing_file_size - range_start
                                assert 0 <= skip_bytes <= 1
                                response.raw.read(skip_bytes)

                                # Do the actual download.
                                for chunk in response.iter_content(CHUNK_SIZE):
                                    output_file.write(chunk)
                                    compressed_read += len(chunk)
                                    original_read = compressed_read * original_size // compressed_size
                                    with lock:
                                        progress.update(original_read - original_last_update)
                                    original_last_update = original_read

                                assert output_file.tell() == compressed_read

                                success = True
                                break  # Done!
                            except requests.exceptions.ConnectionError as ex:
                                if attempt < S3_TIMEOUT_RETRIES - 1:
                                    with lock:
                                        tqdm.write("Download for %s timed out; retrying..." % obj_hash)
                                else:
                                    with lock:
                                        tqdm.write("Download failed for %s: %s" % (obj_hash, ex))
                                    break

                    if not success:
                        # We've already printed an error, so not much to do - just move on to the next object.
                        continue

                    if encoding == 'gzip':
                        # Ungzip the downloaded fragment.
                        temp_path = store.temporary_object_path(obj_hash)
                        try:
                            with gzip.open(temp_path_gz, 'rb') as f_in, open(temp_path, 'wb') as f_out:
                                copyfileobj(f_in, f_out)
                        finally:
                            # Delete the file unconditionally - in case it's corrupted and cannot be ungzipped.
                            os.remove(temp_path_gz)
                    elif encoding is None:
                        # The object is not actually compressed.
                        temp_path = temp_path_gz
                    else:
                        tqdm.write("Unexpected encoding for %s: %r" % (obj_hash, encoding))
                        continue

                    # Check the hash of the result.
                    file_hash = digest_file(temp_path)
                    if file_hash != obj_hash:
                        os.remove(temp_path)
                        with lock:
                            tqdm.write("Fragment hashes do not match: expected %s, got %s." %
                                       (obj_hash, file_hash))
                            continue

                    local_filename = store.object_path(obj_hash)
                    move(temp_path, local_filename)

                    # Success.
                    with lock:
                        downloaded.append(obj_hash)

        threads = [
            Thread(target=_worker_thread, name="download-worker-%d" % i)
            for i in range(PARALLEL_DOWNLOADS)
        ]
        for thread in threads:
            thread.daemon = True
            thread.start()
        for thread in threads:
            thread.join()

    return len(downloaded) == total


def upload_fragments(store, obj_urls, obj_sizes, reupload=False):
    assert len(obj_urls) == len(obj_sizes)

    obj_queue = sorted(iteritems(obj_urls), reverse=True)
    total = len(obj_queue)

    total_bytes = sum(itervalues(obj_sizes))

    uploaded = []
    lock = Lock()

    print("Uploading %d fragments (%d bytes)..." % (total, total_bytes))

    with tqdm(total=total_bytes, unit='B', unit_scale=True) as progress:
        def _worker_thread():
            with create_s3_session() as s3_session:
                while True:
                    with lock:
                        if not obj_queue:
                            break
                        obj_hash, obj_urls = obj_queue.pop()
                        original_size = obj_sizes[obj_hash]

                    try:
                        if reupload or not s3_session.head(obj_urls['head']).ok:
                            with FileWithReadProgress(store.object_path(obj_hash), progress.update) as fd:
                                url = obj_urls['put']
                                # Work around a `requests` bug: it treats size 0 as "unknown" and
                                # uses chunked encoding - which S3 doesn't support.
                                data = fd if original_size > 0 else b''
                                response = s3_session.put(url, data=data)
                                response.raise_for_status()
                        else:
                            with lock:
                                tqdm.write("Fragment %s already uploaded; skipping." % obj_hash)
                                progress.update(original_size)

                        with lock:
                            uploaded.append(obj_hash)
                    except requests.exceptions.RequestException as ex:
                        message = "Upload failed for %s:\n" % obj_hash
                        if ex.response is not None:
                            message += "URL: %s\nStatus code: %s\nResponse: %r\n" % (
                                ex.request.url, ex.response.status_code, ex.response.text
                            )
                        else:
                            message += "%s\n" % ex

                        with lock:
                            tqdm.write(message)

        threads = [
            Thread(target=_worker_thread, name="upload-worker-%d" % i)
            for i in range(PARALLEL_UPLOADS)
        ]
        for thread in threads:
            thread.daemon = True
            thread.start()
        for thread in threads:
            thread.join()

    return len(uploaded) == total
