"""
Provide the head of a (potentially gzipped) file in S3. Stream to limit
disk and RAM pressure.

Lambda functions can have up to 3GB of RAM and only 512MB of disk.
"""

import io
import os
import re
import warnings
import zlib
from io import BytesIO
from urllib.parse import urlparse

import requests

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.utils import get_default_origins, make_json_response

# Number of bytes for read routines like decompress() and
# response.content.iter_content()
CHUNK = 1024 * 8
# We can pump a max of 6MB out of Lambda
LAMBDA_MAX_OUT = 6_000_000
MIN_VCF_COLS = 8  # per 4.2 spec on header and data lines

S3_DOMAIN_SUFFIX = '.amazonaws.com'

FILE_EXTENSIONS = ["csv", "excel", "fcs", "ipynb", "parquet", "vcf"]
# BED https://genome.ucsc.edu/FAQ/FAQformat.html#format1
TEXT_TYPES = ["bed", "txt"]
FILE_EXTENSIONS.extend(TEXT_TYPES)

EXTRACT_PARQUET_MAX_BYTES = 10_000

# Keep the text/VCF paths independent of t4_lambda_shared.preview. That module
# loads pandas/numpy/flowio for richer previews, and a bad native wheel should
# not prevent plain text fallback from serving.
CATALOG_LIMIT_BYTES = 1024*1024
CATALOG_LIMIT_LINES = 512
TRUNCATED = (
    'Rows and columns truncated for preview. '
    'S3 object may contain more data than shown.'
)

# How many bytes of the head to scan for binary signatures.
BINARY_SNIFF_BYTES = 8 * 1024

# Magic bytes -> human-readable label.
BINARY_MAGIC_SIGNATURES = (
    (b'\x89HDF\r\n\x1a\n', 'hdf5'),
    (b'\x1f\x8b', 'gzip'),
    (b'PK\x03\x04', 'zip'),
    (b'%PDF', 'pdf'),
)


class BinaryContentError(Exception):
    """Raised when text extraction detects binary content."""

    def __init__(self, detected: str):
        super().__init__(f'binary content detected: {detected}')
        self.detected = detected


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
            break


def get_preview_lines(chunk_iterator, compression, max_lines, max_bytes):
    buffer = []
    size = 0
    line_count = 0

    for chunk in decompress_stream(chunk_iterator, compression):
        buffer.append(chunk)
        size += len(chunk)
        line_count += chunk.count(b'\n')

        if size > max_bytes or line_count > max_lines:
            break

    lines = b''.join(buffer).splitlines()

    if size > max_bytes and len(lines) > 1:
        lines.pop()

    del lines[max_lines:]

    return [line.decode('utf-8', 'ignore') for line in lines]


def get_bytes(chunk_iterator, compression):
    buffer = BytesIO()
    buffer.writelines(decompress_stream(chunk_iterator, compression))
    buffer.seek(0)
    return buffer


def remove_pandas_footer(html: str) -> str:
    return re.sub(
        r'(</table>\n<p>)\d+ rows × \d+ columns(</p>\n</div>)$',
        r'\1\2',
        html,
    )


def _sniff_binary(sample: bytes, skip_labels=()):
    """Return a label string if `sample` looks binary, else None.

    `skip_labels` suppresses specific magic-byte and heuristic checks, by
    label: pass 'gzip' to skip the gzip magic prefix, 'nul-byte' to skip the
    embedded-NUL heuristic, etc. Callers that have declared
    `compression='gz'` should pass both (the preamble is the raw gzipped
    stream, which routinely contains NUL bytes throughout).
    """
    for magic, label in BINARY_MAGIC_SIGNATURES:
        if label in skip_labels:
            continue
        if sample.startswith(magic):
            return label
    if 'nul-byte' not in skip_labels and b'\x00' in sample[:BINARY_SNIFF_BYTES]:
        return 'nul-byte'
    return None

SCHEMA = {
    'type': 'object',
    'properties': {
        'url': {'type': 'string'},
        # separator for CSV files
        'sep': {'minLength': 1, 'maxLength': 1},
        'max_bytes': {
            'type': 'string',
        },
        # line_count used to be an integer with a max and min, which is more correct
        # nevertheless, request.args has it as a string, even if
        # the request specifies it as an integer
        'line_count': {
            'type': 'string',
        },
        'input': {'enum': FILE_EXTENSIONS},
        'exclude_output': {'enum': ['true', 'false']},
        'compression': {'enum': ['gz']},
    },
    'required': ['url', 'input'],
    'additionalProperties': False,
}


def _is_valid_source_url(url: str) -> bool:
    parsed_url = urlparse(url, allow_fragments=False)
    return (
        parsed_url.scheme == 'https' and
        parsed_url.netloc.endswith(S3_DOMAIN_SUFFIX) and
        parsed_url.username is None and
        parsed_url.password is None
    )


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    """
    dynamically handle preview requests for bytes in S3
    caller must specify input_type (since there may be no file extension)

    Returns:
        JSON response
    """
    url = request.args['url']
    input_type = request.args.get('input')
    compression = request.args.get('compression')
    separator = request.args.get('sep') or ','
    exclude_output = request.args.get('exclude_output') == 'true'
    try:
        max_bytes = int(request.args.get('max_bytes', CATALOG_LIMIT_BYTES))
    except ValueError as error:
        return make_json_response(400, {'title': 'Unexpected max_bytes= value', 'detail': str(error)})

    if not _is_valid_source_url(url):
        return make_json_response(400, {
            'title': 'Invalid url=. Expected S3 virtual-host URL.'
        })

    try:
        line_count = _str_to_line_count(request.args.get('line_count', str(CATALOG_LIMIT_LINES)))
    except ValueError as error:
        # format https://jsonapi.org/format/1.1/#error-objects
        return make_json_response(400, {'title': 'Unexpected line_count= value', 'detail': str(error)})

    # stream=True saves memory almost equal to file size
    resp = requests.get(url, stream=True)
    if resp.ok:
        content_iter = resp.iter_content(CHUNK)
        # For text-mode inputs, sniff the raw (still possibly compressed) bytes
        # for binary signatures before lossy UTF-8 decoding strips NUL bytes.
        binary_preamble = b''
        if input_type in TEXT_TYPES:
            try:
                first_chunk = next(content_iter)
            except StopIteration:
                first_chunk = b''
            binary_preamble = first_chunk[:BINARY_SNIFF_BYTES]

            def _prepend(chunk, rest):
                if chunk:
                    yield chunk
                yield from rest

            content_iter = _prepend(first_chunk, content_iter)
        if input_type == 'csv':
            html, info = extract_csv(get_preview_lines(content_iter, compression, line_count, max_bytes), separator)
        elif input_type == 'excel':
            from t4_lambda_shared.preview import extract_excel

            html, info = extract_excel(get_bytes(content_iter, compression))
        elif input_type == 'fcs':
            from t4_lambda_shared.preview import extract_fcs

            html, info = extract_fcs(get_bytes(content_iter, compression))
        elif input_type == 'ipynb':
            html, info = extract_ipynb(get_bytes(content_iter, compression), exclude_output)
        elif input_type == 'parquet':
            from t4_lambda_shared.preview import extract_parquet

            # TODO: shouldn't we pass max_bytes variable as max_bytes parameter?
            html, info = extract_parquet(get_bytes(content_iter, compression), max_bytes=EXTRACT_PARQUET_MAX_BYTES)
        elif input_type == 'vcf':
            html, info = extract_vcf(get_preview_lines(content_iter, compression, line_count, max_bytes))
        elif input_type in TEXT_TYPES:
            html, info = extract_txt(
                get_preview_lines(content_iter, compression, line_count, max_bytes)
            )
        else:
            assert False, f'unexpected input_type: {input_type}'

        assert isinstance(html, str), 'expected html parameter as string'
        assert isinstance(info, dict), 'expected info metadata to be a dict'

        ret_val = {
            'info': info,
            'html': html,
        }
    else:
        ret_val = {
            'error': resp.reason,
            'text': resp.text,
        }

    return make_json_response(resp.status_code, ret_val)


def extract_csv(head, separator):
    """
    csv file => data frame => html
    Args:
        file_ - file-like object opened in binary mode, pointing to .csv
    Returns:
        html - html version of *first sheet only* in workbook
        info - metadata
    """
    import pandas

    pandas.set_option('min_rows', 50)
    warnings_ = []
    # this shouldn't balloon memory because head is limited in size by get_preview_lines
    try:
        data = pandas.read_csv(io.StringIO('\n'.join(head)), sep=separator)

    except pandas.errors.ParserError:
        with warnings.catch_warnings(record=True, category=pandas.errors.ParserWarning) as warnings_:
            data = pandas.read_csv(
                io.StringIO('\n'.join(head)),
                on_bad_lines="warn",
                # sep=None is slower (doesn't use C), deduces the separator
                sep=None,
            )

    html = remove_pandas_footer(data._repr_html_())  # pylint: disable=protected-access

    return html, {'note': TRUNCATED, 'warnings': "\n".join(map(str, warnings_))}


def extract_ipynb(file_, exclude_output: bool):
    """
    parse and extract ipynb files

    Args:
        file_ - file-like object opened in binary mode (+b)

    Returns:
        html - html version of notebook
        info - unmodified (is also passed in)
    """
    # local import reduces amortized latency, saves memory
    import nbformat
    from nbconvert import HTMLExporter

    # get the file size
    file_.seek(0, os.SEEK_END)
    size = file_.tell()
    if size > LAMBDA_MAX_OUT:
        exclude_output = True
    # rewind
    file_.seek(0, os.SEEK_SET)

    info = {}
    if exclude_output:
        info['warnings'] = "Omitted cell outputs to reduce notebook size"

    html_exporter = HTMLExporter(template_name="basic", exclude_output=exclude_output)

    notebook = nbformat.read(file_, 4)
    html, _ = html_exporter.from_notebook_node(notebook)

    return html, info


def extract_vcf(head):
    """
    Pull summary info from VCF: meta-information, header line, and data lines
    VCF file format: https://github.com/samtools/hts-specs/blob/master/VCFv4.3.pdf

    Args:
        array of first few lines of file
    Returns:
        dict
    """
    meta = []
    header = None
    data = []
    variants = []
    limit = MIN_VCF_COLS + 1  # +1 to get the FORMAT column
    for line in head:
        if line.startswith('##'):
            meta.append(line)
        elif line.startswith('#'):
            if header:
                print('Unexpected multiple headers:', header)
            header = line
            columns = header.split()  # VCF is tab-delimited
            # only grab first "limit"-many rows
            header = columns[:limit]
            variants = columns[limit:]
        elif line:
            columns = line.split()[:limit]
            data.append(columns)
    info = {
        'data': {'meta': meta, 'header': header, 'data': data},
        'metadata': {'variants': variants, 'variant_count': len(variants)},
    }

    return '', info


def extract_txt(head, raw_preamble: bytes, skip_sniff_labels=()):
    """
    dummy formatting function

    Raises BinaryContentError if `raw_preamble` looks like binary content:
    NUL byte anywhere in the first 8 KB, or known binary magic bytes at the
    start (HDF5/gzip/zip/PDF). `raw_preamble` is required because sniffing
    already-decoded text would only catch surviving NUL bytes; the magic-
    byte checks need the undecoded stream.

    `skip_sniff_labels` lets callers suppress specific magic-byte / heuristic
    checks (e.g. 'gzip' and 'nul-byte' when gzip compression was explicitly
    declared and the preamble is the raw gzipped stream).
    """
    sample = raw_preamble[:BINARY_SNIFF_BYTES]
    detected = _sniff_binary(sample, skip_labels=skip_sniff_labels)
    if detected is not None:
        raise BinaryContentError(detected)

    info = {
        'data': {
            'head': list(head),
            # retain tail for backwards compatibility with client
            'tail': [],
        }
    }

    return '', info


def _str_to_line_count(int_string, lower=1, upper=CATALOG_LIMIT_LINES):
    """
    validates an integer string

    Raises: ValueError
    """
    integer = int(int_string)
    if integer < lower or integer > upper:
        raise ValueError(f'{integer} out of range: [{lower}, {upper}]')

    return integer
