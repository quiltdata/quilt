"""
Shared helper functions for generating previews for the preview lambda and the ES indexer.
"""
import re
import tempfile
import zlib
from io import BytesIO
from math import isfinite
from typing import Tuple

import pandas
from flowio import FlowData
from xlrd.biffh import XLRDError

from .utils import get_available_memory, get_quilt_logger

# CATALOG_LIMIT_BYTES is bytes scanned, so acts as an upper bound on bytes returned
# we need a largish number for things like VCF where we will discard many bytes
# Only applied to _from_stream() types. _to_memory types are size limited either
# by pandas or by exclude_output='true'
CATALOG_LIMIT_BYTES = 1024*1024
CATALOG_LIMIT_LINES = 512  # must be positive int
ELASTIC_LIMIT_LINES = 100_000
READ_CHUNK = 1024
FCS_SCATTER_LIMIT = 50_000
FCS_SCATTER_RANDOM_SEED = 0
SKIPPED = "Skipped rows; insufficient memory"
# common string used to explain truncation to user
TRUNCATED = (
    'Rows and columns truncated for preview. '
    'S3 object may contain more data than shown.'
)


class NoopDecompressObj:
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


def extract_excel(file_, as_html=True):
    """
    excel file => data frame => html
    Args:
        file_ - file-like object opened in binary mode, pointing to XLS or XLSX
    Returns:
        body - html or text version of *first sheet only* in workbook
        info - metadata
    """
    try:
        first_sheet = pandas.read_excel(file_, sheet_name=0)
    except XLRDError:
        first_sheet = pandas.read_excel(file_, sheet_name=0, engine='openpyxl')

    if as_html:
        html = remove_pandas_footer(first_sheet._repr_html_())  # pylint: disable=protected-access
        return html, {}

    return first_sheet.to_string(index=False), {}


def extract_fcs(file_, as_html=True):
    """
    parse and extract key metadata from parquet files

    Args:
        file_ - file-like object opened in binary mode (+b)

    Returns:
        dict
            body - summary of main contents (if applicable)
            info - metdata for user consumption
    """
    meta = {}
    data = None
    body = ""
    info = {}
    # FlowData takes paths, so we need to write to disk; OK because
    # FCS files typically < 500MB (Lambda disk)
    # per Lambda docs we can use tmp/*, OK to overwrite
    with tempfile.NamedTemporaryFile() as tmp:

        chunk = file_.read(READ_CHUNK)
        while chunk:
            tmp.write(chunk)
            chunk = file_.read(READ_CHUNK)
        tmp.flush()

        parse_exceptions = []

        try:
            meta, data = _parse_fcs_flowio_full(tmp.name)
        except Exception as err:  # noqa: BLE001 - we need robust parser fallback behavior
            parse_exceptions.append(err)

        if data is None:
            try:
                meta = _parse_fcs_flowio_meta(tmp.name)
                info['warnings'] = f"Metadata only. Parse exception: {parse_exceptions[0]}"
            except Exception as err:  # noqa: BLE001 - we need robust parser fallback behavior
                parse_exceptions.append(err)
                info['warnings'] = f"Unable to parse data or metadata: {parse_exceptions[-1]}"

    if data is not None:
        assert isinstance(data, pandas.DataFrame)
        vega_lite = _build_fcs_scatter_spec(data)
        if vega_lite is not None:
            info['vegaLite'] = vega_lite
        # preview
        if as_html:
            body = remove_pandas_footer(data._repr_html_())  # pylint: disable=protected-access
        # indexing
        else:
            body = ",".join(data.columns)

    if meta:
        # make sure all the things are string so that json.dumps succeeds
        info['metadata'] = {str(k): str(v) for k, v in meta.items()}

    return body, info


def _parse_fcs_flowio_full(path):
    fd = FlowData(path, ignore_offset_discrepancy=True, ignore_offset_error=True)
    channel_names = []
    for idx in range(1, fd.channel_count + 1):
        channel = fd.channels.get(idx, {})
        name = channel.get('pnn') or channel.get('pns') or f'channel_{idx}'
        channel_names.append(name)

    expected_values = fd.event_count * fd.channel_count
    values = list(fd.events)
    if len(values) < expected_values:
        raise ValueError('FCS data is truncated or malformed')

    rows = [
        values[offset:offset + fd.channel_count]
        for offset in range(0, expected_values, fd.channel_count)
    ]
    data = pandas.DataFrame(rows, columns=channel_names)

    metadata = {str(k): str(v) for k, v in fd.text.items()}
    metadata.setdefault('_channel_names_', ','.join(channel_names))
    return metadata, data


def _parse_fcs_flowio_meta(path):
    try:
        fd = FlowData(
            path,
            only_text=True,
            ignore_offset_discrepancy=True,
            ignore_offset_error=True,
        )
        metadata = {str(k): str(v) for k, v in fd.text.items()}
    except Exception:  # noqa: BLE001 - fallback to raw TEXT parsing for malformed DATA sections
        metadata = _parse_fcs_text_segment(path)

    channel_names = _extract_fcs_channel_names(metadata)
    if channel_names:
        metadata.setdefault('_channel_names_', channel_names)
    return metadata


def _parse_fcs_text_segment(path):
    with open(path, 'rb') as handle:
        header = handle.read(58)
        if len(header) < 58:
            raise ValueError('FCS header is truncated')

        text_start = int(header[10:18].decode('ascii').strip())
        text_end = int(header[18:26].decode('ascii').strip())
        if text_end < text_start:
            raise ValueError('FCS TEXT segment offsets are invalid')

        handle.seek(text_start)
        text_bytes = handle.read(text_end - text_start + 1)

    if not text_bytes:
        raise ValueError('FCS TEXT segment is empty')

    delimiter = chr(text_bytes[0])
    text = text_bytes[1:].decode('latin-1')
    tokens = _split_fcs_text_tokens(text, delimiter)
    if len(tokens) < 2:
        raise ValueError('FCS TEXT segment does not contain metadata pairs')

    metadata = {}
    for key, value in zip(tokens[0::2], tokens[1::2], strict=False):
        metadata[key.strip()] = value.strip()
    return metadata


def _split_fcs_text_tokens(text, delimiter):
    tokens = []
    current = []
    idx = 0

    while idx < len(text):
        char = text[idx]
        if char == delimiter:
            if idx + 1 < len(text) and text[idx + 1] == delimiter:
                current.append(delimiter)
                idx += 2
                continue
            tokens.append(''.join(current))
            current = []
            idx += 1
            continue

        current.append(char)
        idx += 1

    if current:
        tokens.append(''.join(current))

    return [token for token in tokens if token]


def _extract_fcs_channel_names(metadata):
    try:
        channel_count = int(metadata.get('$PAR', '0').strip())
    except ValueError:
        channel_count = 0

    channel_names = []
    for idx in range(1, channel_count + 1):
        name = metadata.get(f'$P{idx}N') or metadata.get(f'$P{idx}S')
        if name:
            channel_names.append(name)

    return ','.join(channel_names)


def _build_fcs_scatter_spec(data, *, limit=FCS_SCATTER_LIMIT):
    if data.shape[1] < 2:
        return None

    x_axis, y_axis = _select_fcs_scatter_axes(list(data.columns))
    sampled = data[[x_axis, y_axis]].copy()
    sampled[x_axis] = pandas.to_numeric(sampled[x_axis], errors='coerce')
    sampled[y_axis] = pandas.to_numeric(sampled[y_axis], errors='coerce')
    sampled = sampled[sampled[x_axis].notna() & sampled[y_axis].notna()]
    sampled = sampled[
        sampled[x_axis].map(isfinite) & sampled[y_axis].map(isfinite)
    ]

    if sampled.empty:
        return None

    downsampled = len(sampled) > limit
    if downsampled:
        sampled = sampled.sample(n=limit, random_state=FCS_SCATTER_RANDOM_SEED)

    values = [
        {'x': x_value, 'y': y_value}
        for x_value, y_value in sampled.itertuples(index=False, name=None)
    ]

    return {
        '$schema': 'https://vega.github.io/schema/vega-lite/v5.json',
        'description': 'FCS scatter plot preview',
        'title': {
            'text': f'{x_axis} vs {y_axis}',
            'subtitle': (
                f'Downsampled to {len(values)} events'
                if downsampled else
                f'Showing {len(values)} events'
            ),
        },
        'width': 'container',
        'height': 320,
        'data': {'values': values},
        'params': [{'name': 'brush', 'select': 'interval'}],
        'mark': {'type': 'point', 'filled': True, 'size': 18},
        'encoding': {
            'x': {'field': 'x', 'type': 'quantitative', 'title': x_axis},
            'y': {'field': 'y', 'type': 'quantitative', 'title': y_axis},
            'color': {
                'condition': {'param': 'brush', 'value': '#0f766e'},
                'value': '#94a3b8',
            },
            'opacity': {
                'condition': {'param': 'brush', 'value': 0.85},
                'value': 0.18,
            },
            'tooltip': [
                {'field': 'x', 'type': 'quantitative', 'title': x_axis, 'format': '.4g'},
                {'field': 'y', 'type': 'quantitative', 'title': y_axis, 'format': '.4g'},
            ],
        },
        'config': {'view': {'stroke': 'transparent'}},
    }


def _select_fcs_scatter_axes(columns):
    preferred_pairs = [
        ('FSC-A', 'SSC-A'),
        ('FSC-H', 'SSC-H'),
        ('FSC-A', 'FL1-A'),
        ('SSC-A', 'FL1-A'),
    ]

    column_set = set(columns)
    for x_axis, y_axis in preferred_pairs:
        if x_axis in column_set and y_axis in column_set:
            return x_axis, y_axis

    return columns[0], columns[1]


def extract_parquet(file_, as_html=True, skip_rows: bool = False, *, max_bytes: int) -> Tuple[str, str]:
    """
    parse and extract key metadata from parquet files

    Args:
        file_ - file-like object opened in binary mode (+b)

    Observations & assumptions:
        * ParquetFile and iter_batches sizes in memory are negligible in practice
        * Deserializing and converting batches to dataframes and strings consumes the most memory
        * First row group contains more than enough data for search, preview
        * This function will hit system bytes limits (DOC_LIMIT_BYTES, etc.) long
            before it runs out of RAM (except maybe for pathologically large rows)

    Returns:
        tuple
            body - summary of main contents (if applicable)
            info - metadata for user consumption
    """
    logger_ = get_quilt_logger()
    import pyarrow.parquet as pq  # pylint: disable=C0415

    pf = pq.ParquetFile(file_)
    meta = pf.metadata

    body = ""
    info = {}
    info['created_by'] = meta.created_by
    info['format_version'] = meta.format_version
    info['note'] = TRUNCATED
    info['num_row_groups'] = meta.num_row_groups
    # in previous versions (git blame) we sent a lot more schema information
    # but it's heavy on the browser and low information; just send column names
    info['schema'] = {'names': meta.schema.names}
    info['serialized_size'] = meta.serialized_size  # footer serialized size
    info['shape'] = [meta.num_rows, meta.num_columns]

    available = get_available_memory()
    iter_batches = None
    # 10MB heuristic; should never happen, e.g. with current default of 512MB
    if (available < 10E6) or skip_rows:
        logger_.warning("Insufficient memory to index parquet file: %s", info)
        info['warnings'] = SKIPPED
    elif meta.num_rows and meta.num_row_groups:
        iter_batches = pf.iter_batches(batch_size=128, row_groups=[0])
    else:
        logger_.warning("Parquet file with no rows: %s", info)
    if iter_batches:
        buffer = []
        size = 0
        done = False
        for batch in iter_batches:
            if done:
                break
            df = batch.to_pandas()
            if as_html:
                body = remove_pandas_footer(df._repr_html_())
                return body, info
            for _, row in df.iterrows():
                for column in row.astype(str):
                    encoded = column.encode()
                    encoded_size = len(encoded) + 1  # +1 for \t
                    if (size + encoded_size) < max_bytes:
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
    elif as_html:
        body = remove_pandas_footer(pandas.DataFrame(columns=meta.schema.names)._repr_html_())

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
    buffer.writelines(decompress_stream(chunk_iterator, compression))
    buffer.seek(0)
    return buffer


def remove_pandas_footer(html: str) -> str:
    """don't include table dimensions in footer as it's confusing to the user,
    since preview dimensions may be much smaller than file shape"""
    return re.sub(
        r'(</table>\n<p>)\d+ rows × \d+ columns(</p>\n</div>)$',
        r'\1\2',
        html
    )


def trim_to_bytes(string, limit):
    """trim string to specified number of bytes"""
    encoded = string.encode("utf-8")
    size = len(encoded)
    if size <= limit:
        return string
    return encoded[:limit].decode("utf-8", "ignore")
