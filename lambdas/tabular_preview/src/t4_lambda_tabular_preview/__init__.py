import csv
import gzip
import io
import os
import urllib.request
from contextlib import redirect_stderr
from urllib.parse import urlparse

import fsspec
import pandas
import pyarrow
import pyarrow.csv
import pyarrow.json
import pyarrow.parquet

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

LAMBDA_MAX_OUT_BINARY = 4_000_000
OUTPUT_SIZES = {
    "small": 1_000_000,
    "medium": 5_000_000,
    "large": 150_000_000,
}

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
        'compression': {
            'enum': ['gz']
        },
        "size": {
            "enum": list(OUTPUT_SIZES),
        },
    },
    'required': ['url', 'input'],
    'additionalProperties': False
}


# TODO: remove
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


def urlopen_seekable(url):
    return fsspec.open(url).open()


class GzipOutputBuffer(gzip.GzipFile):
    class Full(Exception):
        pass

    def __init__(self, compressed_max_size: int, max_size:int, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.compressed_max_size = compressed_max_size
        self.max_size = max_size

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.compressed_max_size = None
        super().__exit__(exc_type, exc_val, exc_tb)

    def write(self, data):
        # TODO: left a comment
        if (
            (self.max_size is not None and self.size + len(data) > self.max_size) or
            (self.compressed_max_size is not None and self.fileobj.tell() + len(data) > self.compressed_max_size)
        ):
            raise self.Full
        return super().write(data)


# TODO: remove
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


PYARROW_WRITE_OPTIONS = pyarrow.csv.WriteOptions(batch_size=100)


def preview_csv(src, out):
    with src:
        # TODO: comment about max_size.
        reader = pyarrow.csv.open_csv(src, read_options=pyarrow.csv.ReadOptions(block_size=out.max_size))
        batch = next(iter(reader), None)
    with out:
        if batch:
            try:
                pyarrow.csv.write_csv(batch, out, write_options=PYARROW_WRITE_OPTIONS)
            except out.Full:
                pass


def preview_excel(src, out):
    with src:
        df = pandas.read_excel(io.BytesIO(src.read()), sheet_name=0)
    with out:
        try:
            df.to_csv(out)
        except out.Full:
            pass


def preview_parquet(src, out):
    with src:
        parquet_file = pyarrow.parquet.ParquetFile(src)
        with out:
            for batch in parquet_file.iter_batches():
                try:
                    pyarrow.csv.write_csv(batch, out, write_options=PYARROW_WRITE_OPTIONS)
                except out.Full:
                    pass


handlers = {
    "csv": (urllib.request.urlopen, preview_csv),
    "excel": (urllib.request.urlopen, preview_excel),
    "parquet": (urlopen_seekable, preview_parquet),
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
    url = request.args["url"]
    input_type = request.args.get("input")
    output_size = request.args.get("size", "small")
    compression = request.args.get("compression")
    separator = request.args.get("sep") or ","

    parsed_url = urlparse(url, allow_fragments=False)
    if not (parsed_url.scheme == "https" and
            parsed_url.netloc.endswith(S3_DOMAIN_SUFFIX) and
            parsed_url.username is None and
            parsed_url.password is None):
        return make_json_response(400, {
            "title": "Invalid url=. Expected S3 virtual-host URL."
        })

    urlopener, handler = handlers[input_type]
    # TODO: urllib.request.urlopen() seems to be faster for per-line reading for CSV.
    # src = urllib.request.urlopen(url)
    src = urlopener(url)
    if compression == "gz":
        src = pyarrow.CompressedInputStream(src, "gzip")
    buf = io.BytesIO()
    out = GzipOutputBuffer(
        compressed_max_size=LAMBDA_MAX_OUT_BINARY,
        max_size=OUTPUT_SIZES[output_size],
        fileobj=buf,
        mode="wb",
    )
    handler(src, out)

    return 200, buf.getvalue(), {
        "Content-Type": "text/csv",
        "Content-Encoding": "gzip",
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
