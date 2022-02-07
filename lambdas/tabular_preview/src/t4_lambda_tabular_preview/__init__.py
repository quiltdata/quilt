import csv
import gzip
import io
import os
import urllib.request
from contextlib import redirect_stderr
from urllib.parse import urlparse

import fsspec

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.preview import (
    CATALOG_LIMIT_BYTES,
    CATALOG_LIMIT_LINES,
    TRUNCATED,
    extract_excel,
    extract_fcs,
    extract_parquet,
    get_bytes,
    get_preview_lines,
    remove_pandas_footer,
)
from t4_lambda_shared.utils import get_default_origins, make_json_response

import pyarrow
import pyarrow.json
import pyarrow.csv
import pyarrow.parquet


# Number of bytes for read routines like decompress() and
# response.content.iter_content()
CHUNK = 1024*8
# We can pump a max of 6MB out of Lambda
LAMBDA_MAX_OUT = 6_000_000
MIN_VCF_COLS = 8  # per 4.2 spec on header and data lines

S3_DOMAIN_SUFFIX = '.amazonaws.com'

FILE_EXTENSIONS = ["csv", "excel", "fcs", "ipynb", "parquet", "vcf"]
# BED https://genome.ucsc.edu/FAQ/FAQformat.html#format1
TEXT_TYPES = ["bed", "txt"]
FILE_EXTENSIONS.extend(TEXT_TYPES)

EXTRACT_PARQUET_MAX_BYTES = 10_000

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
        'max_bytes': {
            'type': 'string',
        },
        # line_count used to be an integer with a max and min, which is more correct
        # nevertheless, request.args has it as a string, even if
        # the request specifies it as an integer
        'line_count': {
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


LAMBDA_MAX_OUT_BINARY = 4_000_000


class CSVFormatter:
    """
    `csv` module doesn't provide anything like that ¯\_(ツ)_/¯.
    """
    def __init__(self, **fmtparams):
        self._buf = io.StringIO()
        self._writer = csv.writer(self._buf, **fmtparams)

    def format(self, row):
        self._writer.writerow(row)
        formatted = self._buf.getvalue().encode()
        self._buf.seek(0)
        self._buf.truncate()
        return formatted


class GzipOutputBuffer(gzip.GzipFile):
    class Overflow(Exception):
        pass

    def __init__(self, max_size: int, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_size = max_size

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.max_size = None
        super().__exit__(exc_type, exc_val, exc_tb)

    def write(self, data):
        # TODO: left a comment
        if self.max_size is not None and self.fileobj.tell() + len(data) > self.max_size:
            raise self.Overflow
        return super().write(data)


def write_csv(rows):
    # TODO: fmt paramste
    formatter = CSVFormatter()
    buf = io.BytesIO()
    with gzip.open(buf, 'wb') as out:
        for row in map(formatter.format, rows):
            # TODO: left a comment
            if buf.tell() + len(row) > LAMBDA_MAX_OUT_BINARY:
                break
            out.write(row)

    return buf.getvalue()


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

    parsed_url = urlparse(url, allow_fragments=False)
    if not (parsed_url.scheme == 'https' and
            parsed_url.netloc.endswith(S3_DOMAIN_SUFFIX) and
            parsed_url.username is None and
            parsed_url.password is None):
        return make_json_response(400, {
            'title': 'Invalid url=. Expected S3 virtual-host URL.'
        })

    src = urllib.request.urlopen(url)
    if compression == "gz":
        src = pyarrow.CompressedInputStream(src, "gzip")
    with src:
        # reader = pyarrow.csv.open_csv(src)
        # batch = next(iter(reader))
        batch = pyarrow.csv.read_csv(src)
        buf = io.BytesIO()
        with GzipOutputBuffer(max_size=LAMBDA_MAX_OUT_BINARY, fileobj=buf, mode="wb") as out:
            try:
                pyarrow.csv.write_csv(
                    batch,
                    out,
                    # FIXME: comment re batch_size
                    write_options=pyarrow.csv.WriteOptions(batch_size=64),
                )
            except out.Overflow:
                pass

    return 200, buf.getvalue(), {
        "Content-Type": "text/csv",
        "Content-Encoding": "gzip",
    }


def extract_csv(head, separator):
    """
    csv file => data frame => html
    Args:
        file_ - file-like object opened in binary mode, pointing to .csv
    Returns:
        html - html version of *first sheet only* in workbook
        info - metadata
    """
    warnings_ = io.StringIO()
    # this shouldn't balloon memory because head is limited in size by get_preview_lines
    try:
        data = pandas.read_csv(
            io.StringIO('\n'.join(head)),
            sep=separator
        )

    except pandas.errors.ParserError:
        # temporarily redirect stderr to capture warnings (usually errors)
        with redirect_stderr(warnings_):
            data = pandas.read_csv(
                io.StringIO('\n'.join(head)),
                error_bad_lines=False,
                warn_bad_lines=True,
                # sep=None is slower (doesn't use C), deduces the separator
                sep=None
            )

    html = remove_pandas_footer(data._repr_html_())  # pylint: disable=protected-access

    return html, {
        'note': TRUNCATED,
        'warnings': warnings_.getvalue()
    }


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


def _str_to_line_count(int_string, lower=1, upper=CATALOG_LIMIT_LINES):
    """
    validates an integer string

    Raises: ValueError
    """
    integer = int(int_string)
    if integer < lower or integer > upper:
        raise ValueError(f'{integer} out of range: [{lower}, {upper}]')

    return integer
