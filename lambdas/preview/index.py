"""
Provide the head of a (potentially gzipped) file in S3. Stream to limit
disk and RAM pressure.

Lambda functions can have up to 3GB of RAM and only 512MB of disk.
"""
import io
from urllib.parse import urlparse

import requests

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.preview import (
    CATALOG_LIMIT_BYTES,
    CATALOG_LIMIT_LINES,
    extract_parquet,
    get_bytes,
    get_preview_lines
)
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
    max_bytes = request.args.get('max_bytes', CATALOG_LIMIT_BYTES)


    parsed_url = urlparse(url, allow_fragments=False)
    if not (parsed_url.scheme == 'https' and
            parsed_url.netloc.endswith(S3_DOMAIN_SUFFIX) and
            parsed_url.username is None and
            parsed_url.password is None):
        return make_json_response(400, {
            'title': 'Invalid url=. Expected S3 virtual-host URL.'
        })

    try:
        line_count = _str_to_line_count(request.args.get('line_count', str(CATALOG_LIMIT_LINES)))
    except ValueError as error:
        # format https://jsonapi.org/format/1.1/#error-objects
        return make_json_response(400, {
            'title': f'Unexpected line_count= value',
            'detail': str(error)
        })

    # stream=True saves memory almost equal to file size
    resp = requests.get(url, stream=True)
    if resp.ok:
        content_iter = resp.iter_content(CHUNK)
        if input_type == 'csv':
            html, info = extract_csv(
                get_preview_lines(content_iter, compression, line_count, max_bytes),
                separator
            )
        elif input_type == 'excel':
            html, info = extract_excel(get_bytes(content_iter, compression))
        elif input_type == 'ipynb':
            html, info = extract_ipynb(get_bytes(content_iter, compression), exclude_output)
        elif input_type == 'parquet':
            html, info = extract_parquet(get_bytes(content_iter, compression))
        elif input_type == 'vcf':
            html, info = extract_vcf(
                get_preview_lines(content_iter, compression, line_count, max_bytes)
            )
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
    dummy formatting function
    """
    info = {
        'data': {
            'head': head,
            # retain tail for backwards compatibility with client
            'tail': []
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
