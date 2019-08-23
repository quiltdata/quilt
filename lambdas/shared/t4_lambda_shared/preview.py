"""
Shared helper functions for generating previews for the preview lambda and the ES indexer.
"""
import zlib

# MAX_BYTES is bytes scanned, so functions as an upper bound on bytes returned
# in practice we will hit MAX_LINES first
# we need a largish number for things like VCF where we will discard many bytes
# Only applied to _from_stream() types. _to_memory types are size limited either
# by pandas or by exclude_output='true'
MAX_BYTES = 1024*1024
MAX_LINES = 512 # must be positive int


def get_preview_lines(chunk_iterator, compression, max_lines, max_bytes):
    """
    Read a (possibly compressed) text file, and return up to `max_lines` lines and `max_bytes` bytes.
    """
    buffer = []
    size = 0
    line_count = 0

    if compression:
        assert compression == 'gz', 'only gzip compression is supported'
        dec = zlib.decompressobj(zlib.MAX_WBITS + 32)
    else:
        dec = None

    for chunk in chunk_iterator:
        if dec:
            chunk = dec.decompress(chunk)

        buffer.append(chunk)
        size += len(chunk)
        line_count += chunk.count(b'\n')

        # TODO why are we hitting dec.eof after ~65kb of large gz files?
        # not >= since we might get lucky and complete a line if we wait
        if size > max_bytes or line_count > max_lines or (dec and dec.eof):
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
