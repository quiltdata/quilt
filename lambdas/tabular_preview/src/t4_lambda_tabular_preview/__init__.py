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

from t4_lambda_shared.decorator import QUILT_INFO_HEADER, api, validate
from t4_lambda_shared.utils import get_default_origins, make_json_response

# Lambda's response must fit into 6 MiB, binary data must be encoded
# with base64 (4.5 MiB limit). It's rounded down to leave some space for headers
# and non-flushed gzip buffers.
MAX_OUT = 4_000_000

MAX_INPUT_CSV = 150_000_000

# How many output rows are written at time, greater numbers are better for
# performance, but if batch can't fully fit into output, we stop writing.
OUT_BATCH_SIZE = 100

S3_DOMAIN_SUFFIX = ".amazonaws.com"

OUTPUT_SIZES = {
    "small": 100_000,
    "medium": 500_000,
    "large": None,
}


def urlopen(url: str, *, compression: str, seekable: bool = False):
    # urllib's urlopen() works faster than fsspec, but is not seekable.
    raw = fsspec.open(url).open() if seekable else urllib.request.urlopen(url)  # pylint: disable=consider-using-with
    if compression is None:
        uncompressed = raw
    else:
        if compression == "gz":
            compression = "gzip"
        uncompressed = pyarrow.CompressedInputStream(raw, compression)

    return uncompressed


def read_lines(src, max_bytes: int):
    """
    Read full lines that not exceeds `max_bytes`.
    """
    data = src.read(max_bytes)
    next_byte = src.read(1)
    if not next_byte:
        return data, False
    data = data.rpartition(b'\n')[0]
    return data, True


class GzipOutputBuffer(gzip.GzipFile):
    class Full(Exception):
        pass

    def __init__(self, compressed_max_size: int, max_size: int, *args, **kwargs):
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
                    (max_size is not None and sink.tell() + batch_size > max_size) or
                    # TODO: comment
                    buf.tell() + batch_size > MAX_OUT
                ):
                    truncated = True
                    break
                writer.write(batch)

    return memoryview(buf.getvalue()), truncated


def write_pandas_as_csv(df, max_size):
    truncated = False
    buf = io.BytesIO()
    with GzipOutputBuffer(
        compressed_max_size=MAX_OUT,
        max_size=max_size,
        fileobj=buf,
        mode="wb",
    ) as out:
        try:
            # pyarrow.csv.write_csv(pyarrow.Table.from_pandas(df), ...) works faster,
            # but conversion to pyarrow.Table fails for some files.
            df.to_csv(out, chunksize=OUT_BATCH_SIZE, index=False)
        except out.Full:
            truncated = True

    return buf.getvalue(), truncated


def preview_csv(url, compression, max_out_size):
    with urlopen(url, compression=compression) as src:
        max_input_size = max_out_size or MAX_INPUT_CSV
        input_data, input_truncated = read_lines(src, max_input_size)

    t = pyarrow.csv.read_csv(pyarrow.BufferReader(input_data))
    output_data, output_truncated = write_data_as_arrow(t, t.schema, max_out_size)

    return 200, output_data, {
        "Content-Type": "application/vnd.apache.arrow.file",
        "Content-Encoding": "gzip",
        QUILT_INFO_HEADER: json.dumps(
            {
                "truncated": input_truncated or output_truncated,
            }
        ),
    }


def preview_jsonl(url, compression, max_out_size):
    with urlopen(url, compression=compression) as src:
        # TODO: comment
        max_input_size = int((max_out_size or MAX_INPUT_CSV) * 1.5)
        input_data, input_truncated = read_lines(src, max_input_size)
    df = pandas.read_json(io.BytesIO(input_data), lines=True)
    output_data, output_truncated = write_pandas_as_csv(df, max_out_size)

    return 200, output_data, {
        "Content-Type": "text/csv",
        "Content-Encoding": "gzip",
        QUILT_INFO_HEADER: json.dumps(
            {
                "truncated": input_truncated or output_truncated,
            }
        ),
    }


def preview_excel(url, compression, max_out_size):
    with urlopen(url, compression=compression) as src:
        data = src.read()
    df = pandas.read_excel(data)
    output_data, output_truncated = write_pandas_as_csv(df, max_out_size)

    return 200, output_data, {
        "Content-Type": "text/csv",
        "Content-Encoding": "gzip",
        QUILT_INFO_HEADER: json.dumps(
            {
                "truncated": output_truncated,
            }
        ),
    }


def preview_parquet(url, compression, max_out_size):
    with urlopen(url, compression=compression, seekable=True) as src:
        parquet_file = pyarrow.parquet.ParquetFile(src)
        meta = parquet_file.metadata
        df = parquet_file.read().to_pandas()

    output_data, output_truncated = write_pandas_as_csv(df, max_out_size)

    return 200, output_data, {
        "Content-Type": "text/csv",
        "Content-Encoding": "gzip",
        QUILT_INFO_HEADER: json.dumps(
            {
                "truncated": output_truncated,
                "meta": {
                    "created_by": meta.created_by,
                    "format_version": meta.format_version,
                    "num_row_groups": meta.num_row_groups,
                    "schema": {
                        "names": meta.schema.names
                    },
                    "serialized_size": meta.serialized_size,
                    "shape": (meta.num_rows, meta.num_columns),
                }
            }
        ),
    }


handlers = {
    "csv": preview_csv,
    "excel": preview_excel,
    "parquet": preview_parquet,
    "jsonl": preview_jsonl,
}

SCHEMA = {
    "type": "object",
    "properties": {
        "url": {
            "type": "string"
        },
        "input": {
            "enum": list(handlers),
        },
        "compression": {
            "enum": ["gz", "bz2"]
        },
        "size": {
            "enum": list(OUTPUT_SIZES),
        },
    },
    "required": ["url", "input"],
    "additionalProperties": False
}


def is_s3_url(url: str) -> bool:
    parsed_url = urlparse(url, allow_fragments=False)
    return (
        parsed_url.scheme == "https" and
        parsed_url.netloc.endswith(S3_DOMAIN_SUFFIX) and
        parsed_url.username is None and
        parsed_url.password is None
    )


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    url = request.args["url"]
    input_type = request.args.get("input")
    output_size = request.args.get("size", "small")
    compression = request.args.get("compression")

    if not is_s3_url(url):
        return make_json_response(400, {
            "title": "Invalid url=. Expected S3 virtual-host URL."
        })

    handler = handlers[input_type]
    return handler(url, compression, OUTPUT_SIZES[output_size])
