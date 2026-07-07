"""
Shared helper functions for generating previews for the preview lambda and the ES indexer.
"""

import re
import tempfile
import zlib
from io import BytesIO
from typing import Tuple

import fcsparser
import pandas
from xlrd.biffh import XLRDError

from .utils import get_available_memory, get_quilt_logger

# CATALOG_LIMIT_BYTES is bytes scanned, so acts as an upper bound on bytes returned
# we need a largish number for things like VCF where we will discard many bytes
# Only applied to _from_stream() types. _to_memory types are size limited either
# by pandas or by exclude_output='true'
CATALOG_LIMIT_BYTES = 1024 * 1024
CATALOG_LIMIT_LINES = 512  # must be positive int
ELASTIC_LIMIT_LINES = 100_000
READ_CHUNK = 1024
FCS_SCATTER_LIMIT = 50_000
FCS_SCATTER_RANDOM_SEED = 0
SKIPPED = "Skipped rows; insufficient memory"
# common string used to explain truncation to user
TRUNCATED = 'Rows and columns truncated for preview. S3 object may contain more data than shown.'


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
    # fcsparser only takes paths, so we need to write to disk; OK because
    # FCS files typically < 500MB (Lambda disk)
    # per Lambda docs we can use tmp/*, OK to overwrite
    with tempfile.NamedTemporaryFile() as tmp:
        chunk = file_.read(READ_CHUNK)
        while chunk:
            tmp.write(chunk)
            chunk = file_.read(READ_CHUNK)
        tmp.flush()

        try:
            meta, data = fcsparser.parse(tmp.name, reformat_meta=True)
        # ValueError from fcsparser, TypeError from numpy
        except (ValueError, TypeError, fcsparser.api.ParserFeatureNotImplementedError) as first:
            try:
                meta = fcsparser.parse(tmp.name, reformat_meta=True, meta_data_only=True)
                info['warnings'] = f"Metadata only. Parse exception: {first}"
            except (ValueError, fcsparser.api.ParserFeatureNotImplementedError) as second:
                info['warnings'] = f"Unable to parse data or metadata: {second}"

    if data is not None:
        assert isinstance(data, pandas.DataFrame)
        vega_lite = _build_fcs_scatter_spec(data, channel_markers=_fcs_channel_markers(meta))
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


def _keep_marker(marker):
    """A marker is meaningful only if non-empty and not a null-ish sentinel."""
    marker = str(marker).strip() if marker is not None else ''
    if marker and marker.lower() not in ('none', 'nan'):
        return marker
    return ''


def _fcs_channel_markers(meta):
    """Map detector name ($PnN, e.g. 'FL1-A') -> marker label ($PnS, e.g. 'CD3').

    FCS keywords are $P<idx>N (detector/channel name) and $P<idx>S (the
    biological marker/fluorophore the operator assigned); the marker is optional
    and often blank. fcsparser's ``reformat_meta=True`` collapses the per-channel
    keywords into a ``_channels_`` DataFrame (with ``$PnN``/``$PnS`` columns) and
    drops the flat ``$P<idx>N`` keys, so read that first. Fall back to the flat
    keys (raw fcsparser, or lower-cased ``p<idx>n`` from other parsers) so the
    labels still work whichever metadata shape we are handed.
    """
    if not meta:
        return {}

    markers = {}

    channels = meta.get('_channels_')
    if (
        channels is not None
        and hasattr(channels, 'columns')
        and '$PnN' in channels.columns
        and '$PnS' in channels.columns
    ):
        for name, marker in zip(channels['$PnN'], channels['$PnS']):
            if name is None:
                continue
            marker = _keep_marker(marker)
            if marker:
                markers[str(name)] = marker
        if markers:
            return markers

    idx = 1
    while True:
        name = meta.get(f'$P{idx}N') or meta.get(f'p{idx}n')
        if name is None:
            break
        marker = _keep_marker(meta.get(f'$P{idx}S') or meta.get(f'p{idx}s'))
        if marker:
            markers[str(name)] = marker
        idx += 1
    return markers


def _axis_label(channel, channel_markers):
    """Prefer the biological marker (e.g. 'CD3 (FL1-A)'); fall back to the channel.

    Skip the marker when it just duplicates the channel name (some instruments
    set $PnS == $PnN), which would otherwise render 'FSC-A (FSC-A)'.
    """
    marker = (channel_markers or {}).get(channel)
    if marker and marker != channel:
        return f'{marker} ({channel})'
    return channel


# Canonical flow-cytometry gating panels, in workflow order: cells (size vs
# granularity), singlet discrimination, then fluorescence marker pairs. Only
# panels whose BOTH channels exist in the file are emitted.
FCS_GATING_PANELS = [
    ('FSC-A', 'SSC-A', 'Cells'),
    ('FSC-H', 'FSC-A', 'Singlets'),
    ('SSC-H', 'SSC-A', 'Singlets (SSC)'),
    ('FL1-A', 'FL2-A', None),
    ('FL3-A', 'FL4-A', None),
    ('FL1-A', 'FL3-A', None),
    ('FL2-A', 'FL4-A', None),
]
FCS_MAX_PANELS = 6
FCS_PANEL_COLUMNS = 2
# explicit px: Vega-Lite ignores `container` width inside a concat
FCS_GRID_PANEL_SIZE = 300
FCS_GRID_SPACING = 48
FCS_SINGLE_PANEL_HEIGHT = 360


def _select_fcs_panels(columns):
    """Pick the canonical gating panels present in the file, capped at FCS_MAX_PANELS.

    Falls back to the first two columns if none of the canonical pairs match, so
    arbitrary/non-standard FCS files still get a plot.
    """
    column_set = set(columns)
    panels = [(x, y, label) for x, y, label in FCS_GATING_PANELS if x in column_set and y in column_set]
    if not panels and len(columns) >= 2:
        panels = [(columns[0], columns[1], None)]
    return panels[:FCS_MAX_PANELS]


def _build_fcs_panel(data, x_axis, y_axis, label, channel_markers, *, limit):
    import numpy
    import pandas

    sampled = data[[x_axis, y_axis]].copy()
    sampled[x_axis] = pandas.to_numeric(sampled[x_axis], errors='coerce')
    sampled[y_axis] = pandas.to_numeric(sampled[y_axis], errors='coerce')
    finite_mask = numpy.isfinite(sampled[x_axis].to_numpy()) & numpy.isfinite(sampled[y_axis].to_numpy())
    sampled = sampled[finite_mask]

    if sampled.empty:
        return None

    downsampled = len(sampled) > limit
    if downsampled:
        sampled = sampled.sample(n=limit, random_state=FCS_SCATTER_RANDOM_SEED)

    values = [{'x': x_value, 'y': y_value} for x_value, y_value in sampled.itertuples(index=False, name=None)]
    x_title = _axis_label(x_axis, channel_markers)
    y_title = _axis_label(y_axis, channel_markers)
    title = f'{label} — {x_axis} vs {y_axis}' if label else f'{x_axis} vs {y_axis}'

    return {
        'title': {'text': title, 'subtitle': f'{len(values)} events' + (' (downsampled)' if downsampled else '')},
        'data': {'values': values},
        'mark': {'type': 'point', 'filled': True, 'size': 14},
        'encoding': {
            'x': {'field': 'x', 'type': 'quantitative', 'title': x_title},
            'y': {'field': 'y', 'type': 'quantitative', 'title': y_title},
            'opacity': {'value': 0.4},
            'color': {'value': '#0f766e'},
            'tooltip': [
                {'field': 'x', 'type': 'quantitative', 'title': x_title, 'format': '.4g'},
                {'field': 'y', 'type': 'quantitative', 'title': y_title, 'format': '.4g'},
            ],
        },
    }


def _build_fcs_scatter_spec(data, *, limit=FCS_SCATTER_LIMIT, channel_markers=None):
    if data.shape[1] < 2:
        return None

    panels = _select_fcs_panels(list(data.columns))
    sub_specs = [
        spec
        for x, y, label in panels
        if (spec := _build_fcs_panel(data, x, y, label, channel_markers, limit=limit)) is not None
    ]
    if not sub_specs:
        return None

    base = {
        '$schema': 'https://vega.github.io/schema/vega-lite/v5.json',
        'description': 'FCS gating preview',
        'config': {'view': {'stroke': 'transparent'}},
    }

    # A single panel keeps the brush-select interaction and stays responsive.
    if len(sub_specs) == 1:
        spec = sub_specs[0]
        spec['width'] = 'container'
        spec['height'] = FCS_SINGLE_PANEL_HEIGHT
        spec['params'] = [{'name': 'brush', 'select': 'interval'}]
        enc = spec['encoding']
        enc['color'] = {'condition': {'param': 'brush', 'value': '#0f766e'}, 'value': '#94a3b8'}
        enc['opacity'] = {'condition': {'param': 'brush', 'value': 0.85}, 'value': 0.18}
        return {**base, **spec}

    # Multiple panels become a small-multiples gating grid with explicit cell sizes.
    for spec in sub_specs:
        spec['width'] = FCS_GRID_PANEL_SIZE
        spec['height'] = FCS_GRID_PANEL_SIZE

    return {
        **base,
        'columns': FCS_PANEL_COLUMNS,
        'spacing': FCS_GRID_SPACING,
        'concat': sub_specs,
        'resolve': {'scale': {'x': 'independent', 'y': 'independent'}},
    }


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
    if (available < 10e6) or skip_rows:
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
    return re.sub(r'(</table>\n<p>)\d+ rows × \d+ columns(</p>\n</div>)$', r'\1\2', html)


def trim_to_bytes(string, limit):
    """trim string to specified number of bytes"""
    encoded = string.encode("utf-8")
    size = len(encoded)
    if size <= limit:
        return string
    return encoded[:limit].decode("utf-8", "ignore")
