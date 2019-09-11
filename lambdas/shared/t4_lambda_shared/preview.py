"""
Shared helper functions for generating previews for the preview lambda and the ES indexer.
"""
from io import BytesIO
import os
import json
import zlib

# CATALOG_LIMIT_BYTES is bytes scanned, so acts as an upper bound on bytes returned
# we need a largish number for things like VCF where we will discard many bytes
# Only applied to _from_stream() types. _to_memory types are size limited either
# by pandas or by exclude_output='true'
CATALOG_LIMIT_BYTES = 1024*1024
CATALOG_LIMIT_LINES = 512 # must be positive int
# number of bytes we take from each document before sending to elastic-search
# DOC_LIMIT_BYTES is the legacy variable name; leave as-is for now; requires
# change to CloudFormation templates to use the new name
ELASTIC_LIMIT_BYTES = int(os.getenv('DOC_LIMIT_BYTES') or 10_000)
ELASTIC_LIMIT_LINES = 100_000



class NoopDecompressObj():
    @property
    def eof(self):
        return False

    def decompress(self, chunk):
        return chunk


def decompress_stream(chunk_iterator, compression):
    if compression is None:
        dec = NoopDecompressObj()
    elif compression == 'gz':
        dec = zlib.decompressobj(zlib.MAX_WBITS + 32)
    else:
        raise ValueError('Only gzip compression is supported')

    for chunk in chunk_iterator:
        yield dec.decompress(chunk)
        if dec.eof:
            # gzip'ed files can contain arbitrary data after the end of the archive,
            # so we might be done early.
            break


def extract_parquet(file_, as_html=True):
    """
    parse and extract key metadata from parquet files

    Args:
        file_ - file-like object opened in binary mode (+b)

    Returns:
        dict
            body - summary of main contents (if applicable)
            info - metdata for user consumption
    """
    # TODO: generalize to datasets, multipart files
    # As written, only works for single files, and metadata
    # is slanted towards the first row_group

    # local import reduces amortized latency, saves memory
    import pyarrow.parquet as pq

    meta = pq.read_metadata(file_)

    info = {}
    info['created_by'] = meta.created_by
    info['format_version'] = meta.format_version
    info['metadata'] = {
        # seems silly but sets up a simple json.dumps(info) below
        k.decode():json.loads(meta.metadata[k])
        for k in meta.metadata
    } if meta.metadata is not None else {}
    info['num_row_groups'] = meta.num_row_groups
    info['schema'] = {
        name: {
            'logical_type': meta.schema.column(i).logical_type,
            'max_definition_level': meta.schema.column(i).max_definition_level,
            'max_repetition_level': meta.schema.column(i).max_repetition_level,
            'path': meta.schema.column(i).path,
            'physical_type': meta.schema.column(i).physical_type,
        }
        for i, name in enumerate(meta.schema.names)
    }
    info['serialized_size'] = meta.serialized_size
    info['shape'] = [meta.num_rows, meta.num_columns]

    file_.seek(0)
    # TODO: make this faster with n_threads > 1?
    row_group = pq.ParquetFile(file_).read_row_group(0)
    # convert to str since FileMetaData is not JSON.dumps'able (below)
    dataframe = row_group.to_pandas()
    if as_html:
        body = dataframe._repr_html_()# pylint: disable=protected-access
    else:
        body = trim_to_bytes(dataframe.to_string(), ELASTIC_LIMIT_BYTES)

    return body, info


def get_preview_lines(chunk_iterator, compression, max_lines, max_bytes):
    """
    Read a (possibly compressed) text file, and return up to `max_lines` lines and `max_bytes` bytes.
    """
    buffer = []
    size = 0
    line_count = 0

    for chunk in decompress_stream(chunk_iterator, compression):
        buffer.append(chunk)
        size += len(chunk)
        line_count += chunk.count(b'\n')

        # not >= since we might get lucky and complete a line if we wait
        if size > max_bytes or line_count > max_lines:
            break

    lines = b''.join(buffer).splitlines()

    # If we stopped because of max_bytes, then drop the last, possibly incomplete line -
    # as long as we have more than one line.
    if size > max_bytes and len(lines) > 1:
        lines.pop()

    # Drop any lines over the max.
    del lines[max_lines:]

    # We may still be over max_bytes at this point, up to max_bytes + CHUNK,
    # but we don't really care.

    return [l.decode('utf-8', 'ignore') for l in lines]

def get_bytes(chunk_iterator, compression):
    """
    Read a (possibly compressed) file and return a BytesIO object with the contents.
    """
    buffer = BytesIO()

    for chunk in decompress_stream(chunk_iterator, compression):
        buffer.write(chunk)

    buffer.seek(0)
    return buffer

def trim_to_bytes(string, limit):
    """trim string to specified number of bytes"""
    encoded = string.encode("utf-8")
    size = len(encoded)
    if size <= limit:
        return string
    return encoded[:limit].decode("utf-8", "ignore")
