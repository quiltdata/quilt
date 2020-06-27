"""
Shared helper functions for generating previews for the preview lambda and the ES indexer.
"""
from io import BytesIO
import math
import os
import zlib

# CATALOG_LIMIT_BYTES is bytes scanned, so acts as an upper bound on bytes returned
# we need a largish number for things like VCF where we will discard many bytes
# Only applied to _from_stream() types. _to_memory types are size limited either
# by pandas or by exclude_output='true'
CATALOG_LIMIT_BYTES = 1024*1024
CATALOG_LIMIT_LINES = 512  # must be positive int
# number of bytes we take from each document before sending to elastic-search
# DOC_LIMIT_BYTES is the legacy variable name; leave as-is for now; requires
# change to CloudFormation templates to use the new name
ELASTIC_LIMIT_BYTES = int(os.getenv('DOC_LIMIT_BYTES') or 10_000)
ELASTIC_LIMIT_LINES = 100_000
# this is a heuristic we use to only deserialize parquet when lambda (at 3008MB)
# can hold the result in memory
MAX_LOAD_CELLS = 400_000_000
MAX_PREVIEW_ROWS = 1_000


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

    pf = pq.ParquetFile(file_)

    meta = pf.metadata

    info = {}
    info['created_by'] = meta.created_by
    info['format_version'] = meta.format_version
    info['num_row_groups'] = meta.num_row_groups
    # in previous versions (git blame) we sent a lot more schema information
    # but it's heavy on the browser and low information; just send column names
    info['schema'] = {
        'names': meta.schema.names
    }
    info['serialized_size'] = meta.serialized_size
    info['shape'] = [meta.num_rows, meta.num_columns]
    # avoid flooding memory
    # it's possible to have a row_group without rows, so don't fill a bunch
    # of garbage into the slice
    if meta.num_row_groups:
        # guess because we meta doesn't reveal how many rows in first group
        num_rows_guess = math.ceil(meta.num_rows/meta.num_row_groups)
        if (num_rows_guess * meta.num_columns) > MAX_LOAD_CELLS:
            import pandas
            # minimal dataframe with all columns and one row
            dataframe = pandas.DataFrame(columns=meta.schema.names).append(
                {meta.schema.names[0]: '(Rows not loaded to conserve memory)'},
                ignore_index=True
            )
        else:
            dataframe = pf.read_row_group(0)[0:MAX_PREVIEW_ROWS].to_pandas()
    # sometimes there are neither rows nor row_groups, just columns
    # therefore we do not call read_row_group because (with 0 row_groups)
    # it would barf
    else:
        # :0 is a safety valve but there really should be no rows in this case
        dataframe = pf.read()[:0].to_pandas()
    if as_html:
        body = dataframe._repr_html_()  # pylint: disable=protected-access
    else:
        buffer = []
        size = 0
        done = False
        for _, row in dataframe.iterrows():
            for column in row.astype(str):
                encoded = column.encode()
                # +1 for \t
                encoded_size = len(encoded) + 1
                if (size + encoded_size) < ELASTIC_LIMIT_BYTES:
                    buffer.append(encoded)
                    buffer.append(b"\t")
                    size += encoded_size
                else:
                    done = True
                    break
            buffer.append(b"\n")
            size += 1
            if done:
                break
        body = b"".join(buffer).decode()

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

    return [line.decode('utf-8', 'ignore') for line in lines]


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
