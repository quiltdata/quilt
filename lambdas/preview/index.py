"""
Provide the head of a (potentially gzipped) file in S3. Stream to limit
disk and RAM pressure.

Lambda functions can have up to 3GB of RAM and only 512MB of disk.
"""
import io
import json
from urllib.parse import urlparse
import zlib

import requests

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.preview import get_preview_lines, MAX_BYTES, MAX_LINES
from t4_lambda_shared.utils import get_default_origins, make_json_response

# Number of bytes for read routines like decompress() and
# response.content.iter_content()
CHUNK = 1024*8
MIN_VCF_COLS = 8 # per 4.2 spec on header and data lines

S3_DOMAIN_SUFFIX = '.amazonaws.com'

FILE_EXTENSIONS = ["csv", "excel", "ipynb", "parquet", "vcf"]
# BED https://genome.ucsc.edu/FAQ/FAQformat.html#format1
TEXT_TYPES = ["bed", "txt"]
FILE_EXTENSIONS.extend(TEXT_TYPES)

SCHEMA = {
    'type': 'object',
    'properties': {
        'url': {
            'type': 'string'
        },
        # separator for CSV files
        'sep': {
            'minLength': 1,
            'maxLength': 1
        },
        'max_bytes' : {
            'type': 'string',
        },
        # line_count used to be an integer with a max and min, which is more correct
        # nevertheless, request.args has it as a string, even if
        # the request specifies it as an integer
        'line_count' : {
            'type': 'string',
        },
        'input': {
            'enum': FILE_EXTENSIONS
        },
        'exclude_output': {
            'enum': ['true', 'false']
        },
        'compression': {
            'enum': ['gz']
        }
    },
    'required': ['url', 'input'],
    'additionalProperties': False
}

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
    max_bytes = request.args.get('max_bytes', MAX_BYTES)

    parsed_url = urlparse(url, allow_fragments=False)
    if not (parsed_url.scheme == 'https' and
            parsed_url.netloc.endswith(S3_DOMAIN_SUFFIX) and
            parsed_url.username is None and
            parsed_url.password is None):
        return make_json_response(400, {
            'title': 'Invalid url=. Expected S3 virtual-host URL.'
        })

    try:
        line_count = _str_to_line_count(request.args.get('line_count', str(MAX_LINES)))
    except ValueError as error:
        # format https://jsonapi.org/format/1.1/#error-objects
        return make_json_response(400, {
            'title': f'Unexpected line_count= value',
            'detail': str(error)
        })

    # stream=True saves memory almost equal to file size
    resp = requests.get(url, stream=True)
    if resp.ok:
        if input_type == 'csv':
            html, info = extract_csv(
                get_preview_lines(resp.iter_content(CHUNK), compression, line_count, max_bytes),
                separator
            )
        elif input_type == 'excel':
            html, info = extract_excel(_to_memory(resp, compression))
        elif input_type == 'ipynb':
            html, info = extract_ipynb(_to_memory(resp, compression), exclude_output)
        elif input_type == 'parquet':
            html, info = extract_parquet(_to_memory(resp, compression))
        elif input_type == 'vcf':
            html, info = extract_vcf(get_preview_lines(resp.iter_content(CHUNK), compression, line_count, max_bytes))
        elif input_type in TEXT_TYPES:
            html, info = extract_txt(get_preview_lines(resp.iter_content(CHUNK), compression, line_count, max_bytes))
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
            'error': resp.reason
        }

    return make_json_response(200, ret_val)

def extract_csv(head, separator):
    """
    csv file => data frame => html
    Args:
        file_ - file-like object opened in binary mode, pointing to .csv
    Returns:
        html - html version of *first sheet only* in workbook
        info - metadata
    """
    # doing this locally because it might be slow
    import pandas
    import re
    # this shouldn't balloon memory because head is limited in size by get_preview_lines
    try:
        data = pandas.read_csv(
            io.StringIO('\n'.join(head)),
            sep=separator
        )
    # ParserError happens when TSVs are labeled CSVs and/or columns have mixed types
    except pandas.errors.ParserError:
        data = pandas.read_csv(
            io.StringIO('\n'.join(head)),
            # this slower (doesn't use C) but deduces the separator
            sep=None
        )

    html = data._repr_html_() # pylint: disable=protected-access
    html = re.sub(
        r'(</table>\n<p>)\d+ rows × \d+ columns(</p>\n</div>)$',
        r'\1\2',
        html
    )
    return html, {
        'note': (
            'Object truncated for preview. Row count may be smaller than expected. '
            'S3 data remain intact, full length.'
        )
    }


def extract_excel(file_):
    """
    excel file => data frame => html
    Args:
        file_ - file-like object opened in binary mode, pointing to XLS or XLSX
    Returns:
        html - html version of *first sheet only* in workbook
        info - metadata
    """
    # doing this locally because it might be slow
    import pandas

    first_sheet = pandas.read_excel(file_, sheet_name=0)
    html = first_sheet._repr_html_() # pylint: disable=protected-access
    return html, {}

def extract_ipynb(file_, exclude_output):
    """
    parse and extract ipynb files

    Args:
        file_ - file-like object opened in binary mode (+b)

    Returns:
        html - html version of notebook
        info - unmodified (is also passed in)
    """
    # local import reduces amortized latency, saves memory
    from nbconvert import HTMLExporter
    import nbformat

    html_exporter = HTMLExporter()
    html_exporter.template_file = 'basic'
    html_exporter.exclude_output = exclude_output

    notebook = nbformat.read(file_, 4)
    html, _ = html_exporter.from_notebook_node(notebook)

    return html, {}

def extract_parquet(file_):
    """
    parse and extract key metadata from parquet files

    Args:
        file_ - file-like object opened in binary mode (+b)

    Returns:
        dict
            html - html summary of main contents (if applicable)
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
    html = row_group.to_pandas()._repr_html_() # pylint: disable=protected-access

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
    limit = MIN_VCF_COLS + 1 # +1 to get the FORMAT column
    for line in head:
        if line.startswith('##'):
            meta.append(line)
        elif line.startswith('#'):
            if header:
                print('Unexpected multiple headers:', header)
            header = line
            columns = header.split() # VCF is tab-delimited
            # only grab first "limit"-many rows
            header = columns[:limit]
            variants = columns[limit:]
        elif line:
            columns = line.split()[:limit]
            data.append(columns)
    info = {
        'data': {
            'meta': meta,
            'header': header,
            'data': data
        },
        'metadata': {
            'variants': variants,
            'variant_count': len(variants)
        }
    }

    return '', info

def extract_txt(head):
    """
    Display first N lines of a potentially large file.

    Args:
        file_ - file-like object opened in binary mode (+b)
    Returns:
        dict - head and tail. tail may be empty. returns at most MAX_LINES
        lines that occupy a total of MAX_BYTES bytes.
    """
    info = {
        'data': {
            'head': head,
            # retain tail for backwards compatibility with client
            'tail': []
        }
    }

    return '', info

def _str_to_line_count(int_string, lower=1, upper=MAX_LINES):
    """
    validates an integer string

    Raises: ValueError
    """
    integer = int(int_string)
    if integer < lower or integer > upper:
        raise ValueError(f'{integer} out of range: [{lower}, {upper}]')

    return integer

def _to_memory(response, compression):
    """
    for file-types where we don't support streaming read;
    drop the entire file into memory
    """
    if compression:
        assert compression == 'gz', 'only gzip compression is supported'
        # +32 => automatically accepts zlib or gzip
        # https://docs.python.org/2/library/zlib.html#zlib.decompress
        return io.BytesIO(zlib.decompress(response.content, zlib.MAX_WBITS + 32))
    return io.BytesIO(response.content)
