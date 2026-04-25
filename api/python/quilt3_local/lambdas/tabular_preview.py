from __future__ import annotations

import functools
import gzip
import io
import json
import urllib.request
from urllib.parse import urlparse

import fsspec
import pandas
import pyarrow
import pyarrow.csv
import pyarrow.json
import pyarrow.parquet

from .. import settings
from .shared.decorator import QUILT_INFO_HEADER, api, validate
from .shared.utils import get_default_origins, get_quilt_logger, make_json_response

logger = get_quilt_logger()

MAX_OUT = 4_000_000
MAX_CSV_INPUT = 150_000_000
OUT_BATCH_SIZE = 100
S3_DOMAIN_SUFFIX = ".amazonaws.com"
OUTPUT_SIZES = {"small": 100_000, "medium": 500_000, "large": None}


def _is_valid_source_url(url: str) -> bool:
    parsed_url = urlparse(url, allow_fragments=False)
    if settings.is_local_proxy_url(url):
        return True
    return parsed_url.scheme == "https" and parsed_url.netloc.endswith(S3_DOMAIN_SUFFIX)


def urlopen(url: str, *, compression: str, seekable: bool = False):
    if compression == "gz":
        compression = "gzip"
    if seekable:
        return fsspec.open(url, compression=compression).open()
    fileobj = urllib.request.urlopen(url)
    if compression is not None:
        fileobj = pyarrow.CompressedInputStream(fileobj, compression)
    return fileobj


def read_lines(src, max_bytes: int):
    data = src.read(max_bytes)
    next_byte = src.read(1)
    if not next_byte:
        return data, False
    data = data.rpartition(b"\n")[0]
    return data, True


class GzipOutputBuffer(gzip.GzipFile):
    class Full(Exception):
        pass

    def __init__(self, compressed_max_size: int, max_size: int | None, *, fileobj: io.BytesIO, mode: str):
        super().__init__(fileobj=fileobj, mode=mode)
        self.compressed_max_size = compressed_max_size
        self.max_size = max_size
        self._fileobj = fileobj
        self._uncompressed_size = 0

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.compressed_max_size = None
        super().__exit__(exc_type, exc_val, exc_tb)

    def write(self, data) -> int:
        if (
            (self.max_size is not None and self._uncompressed_size + len(data) > self.max_size)
            or (self.compressed_max_size is not None and self._fileobj.tell() + len(data) > self.compressed_max_size)
        ):
            raise self.Full
        written = super().write(data)
        self._uncompressed_size += len(data)
        return written


def write_data_as_arrow(data, schema, max_size):
    if isinstance(data, pyarrow.Table):
        data = data.to_batches(OUT_BATCH_SIZE)

    truncated = False
    buf = pyarrow.BufferOutputStream()
    with pyarrow.CompressedOutputStream(buf, "gzip") as sink:
        with pyarrow.ipc.new_file(sink, schema) as writer:
            for batch in data:
                batch_size = pyarrow.ipc.get_record_batch_size(batch)
                if (
                    (max_size is not None and sink.tell() + batch_size > max_size)
                    or buf.tell() + batch_size > MAX_OUT
                ):
                    truncated = True
                    break
                writer.write(batch)
    return memoryview(buf.getvalue()), truncated


def write_pandas_as_csv(df, max_size):
    truncated = False
    buf = io.BytesIO()
    with GzipOutputBuffer(compressed_max_size=MAX_OUT, max_size=max_size, fileobj=buf, mode="wb") as out:
        try:
            df.to_csv(out, chunksize=OUT_BATCH_SIZE, index=False)
        except out.Full:
            truncated = True
    return buf.getvalue(), truncated


def preview_csv(url, compression, max_out_size, *, delimiter: str = ","):
    rows_skipped = 0

    def invalid_row_handler(row: pyarrow.csv.InvalidRow) -> str:
        nonlocal rows_skipped
        logger.debug("Skip invalid CSV row: %s", row)
        rows_skipped += 1
        return "skip"

    with urlopen(url, compression=compression) as src:
        max_input_size = max_out_size or MAX_CSV_INPUT
        input_data, input_truncated = read_lines(src, max_input_size)

    table = pyarrow.csv.read_csv(
        pyarrow.BufferReader(input_data),
        parse_options=pyarrow.csv.ParseOptions(delimiter=delimiter, invalid_row_handler=invalid_row_handler),
    )
    output_data, output_truncated = write_data_as_arrow(table, table.schema, None)
    return 200, output_data, {
        "Content-Type": "application/vnd.apache.arrow.file",
        "Content-Encoding": "gzip",
        QUILT_INFO_HEADER: json.dumps({"truncated": input_truncated or output_truncated, "rows_skipped": rows_skipped}),
    }


def preview_jsonl(url, compression, max_out_size):
    with urlopen(url, compression=compression) as src:
        max_input_size = int((max_out_size or MAX_CSV_INPUT) * 1.5)
        input_data, input_truncated = read_lines(src, max_input_size)
    df = pandas.read_json(io.BytesIO(input_data), lines=True)
    output_data, output_truncated = write_pandas_as_csv(df, max_out_size)
    return 200, output_data, {
        "Content-Type": "text/csv",
        "Content-Encoding": "gzip",
        QUILT_INFO_HEADER: json.dumps({"truncated": input_truncated or output_truncated}),
    }


def preview_excel(url, compression, max_out_size):
    with urlopen(url, compression=compression) as src:
        data = src.read()
    df = pandas.read_excel(data)
    output_data, output_truncated = write_pandas_as_csv(df, max_out_size)
    return 200, output_data, {
        "Content-Type": "text/csv",
        "Content-Encoding": "gzip",
        QUILT_INFO_HEADER: json.dumps({"truncated": output_truncated}),
    }


def preview_parquet(url, compression, max_out_size):
    with urlopen(url, compression=compression, seekable=True) as src:
        parquet_file = pyarrow.parquet.ParquetFile(src, pre_buffer=True)
        df = parquet_file.read().to_pandas()
    output_data, output_truncated = write_pandas_as_csv(df, max_out_size)
    return 200, output_data, {
        "Content-Type": "text/csv",
        "Content-Encoding": "gzip",
        QUILT_INFO_HEADER: json.dumps({"truncated": output_truncated}),
    }


SCHEMA = {
    "type": "object",
    "properties": {
        "url": {"type": "string"},
        "input": {"enum": ["csv", "jsonl", "excel", "parquet"]},
        "compression": {"enum": ["gz", None]},
        "output": {"enum": list(OUTPUT_SIZES)},
        "delimiter": {"type": "string", "minLength": 1, "maxLength": 1},
    },
    "required": ["url", "input"],
    "additionalProperties": False,
}


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    url = request.args["url"]
    if not _is_valid_source_url(url):
        return make_json_response(400, {"title": "Invalid url=. Expected S3 virtual-host URL or local object proxy URL."})

    input_type = request.args["input"]
    compression = request.args.get("compression")
    output_size = OUTPUT_SIZES[request.args.get("output", "small")]

    handlers = {
        "csv": functools.partial(preview_csv, delimiter=request.args.get("delimiter", ",")),
        "jsonl": preview_jsonl,
        "excel": preview_excel,
        "parquet": preview_parquet,
    }
    return handlers[input_type](url, compression, output_size)
