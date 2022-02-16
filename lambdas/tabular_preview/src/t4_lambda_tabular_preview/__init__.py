import gzip
import io
import json
import urllib.request
from urllib.parse import urlparse

import fsspec
import pyarrow
import pyarrow.csv
import pyarrow.json
import pyarrow.parquet

from t4_lambda_shared.decorator import api, validate, QUILT_INFO_HEADER
from t4_lambda_shared.utils import get_default_origins, make_json_response

# We can pump a max of 6MB out of Lambda
LAMBDA_MAX_OUT = 6_000_000
LAMBDA_MAX_OUT_BINARY = 4_000_000

# TODO: comment about batch_size.
OUT_BATCH_SIZE = 100
CSV_OUT_BATCH_SIZE = 100
PYARROW_CSV_WRITE_OPTIONS = pyarrow.csv.WriteOptions(batch_size=CSV_OUT_BATCH_SIZE)

S3_DOMAIN_SUFFIX = ".amazonaws.com"

OUTPUT_SIZES = {
    "small": 100_000,
    "medium": 500_000,
    "large": None,
}

def urlopen_seekable(url):
    return fsspec.open(url).open()


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
                    buf.tell() + batch_size > LAMBDA_MAX_OUT_BINARY
                ):
                    truncated = True
                    break
                writer.write(batch)

    return memoryview(buf.getvalue()), truncated


def write_pandas_as_csv(df, out):
    with out:
        try:
            # pyarrow.csv.write_csv(pyarrow.Table.from_pandas(df), ...) works faster,
            # but conversion to pyarrow.Table fails for some files.
            df.to_csv(out, chunksize=CSV_OUT_BATCH_SIZE, index=False)
        except out.Full:
            truncated = True

    return truncated


def preview_csv(src, out):
    truncated = False
    # TODO: rework this `+ 1_000_000` hack needed for `truncated` flag.
    max_input_size = out.max_size + 1_000_000 if out.max_size else 150_000_000
    with src:
        # TODO: comment about max_size.
        reader = pyarrow.csv.open_csv(
            src,
            read_options=pyarrow.csv.ReadOptions(block_size=max_input_size)
        )
        batch = next(iter(reader), None)

    t = pyarrow.Table.from_batches((batch,))
    data, truncated = write_data_as_arrow(t, t.schema, 10_000_000)

    return data, {
        "truncated": truncated,
    }


def preview_excel(src, out):
    # Importing pandas here, because it's quite slow (150-200 msec when benchmarked locally).
    import pandas

    with src:
        data = src.read()
    df = pandas.read_excel(data)
    truncated = write_pandas_as_csv(df, out)

    return {
        "truncated": truncated,
    }


def preview_parquet(src, out):
    with src:
        parquet_file = pyarrow.parquet.ParquetFile(src)
        meta = parquet_file.metadata
        with out:
            data, truncated = write_data_as_arrow(parquet_file.iter_batches(OUT_BATCH_SIZE), parquet_file.schema_arrow)

    return {
        "truncated": truncated,
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


def read_lines(src, max_bytes):
    data = src.read(max_bytes)
    next_byte = src.read(1)
    if not next_byte:
        return data, False
    data = data.rpartition(b'\n')[0]
    return data, True


def preview_jsonl(src, out):
    import pandas

    with src:
        # TODO:
        data, truncated = read_lines(src, out.max_size + out.max_size // 2)
    df = pandas.read_json(io.BytesIO(data), lines=True)
    truncated = truncated or write_pandas_as_csv(df, out)
    return data, {
        "truncated": truncated,
    }


handlers = {
    "csv": (urllib.request.urlopen, preview_csv),
    "excel": (urllib.request.urlopen, preview_excel),
    "parquet": (urlopen_seekable, preview_parquet),
    "jsonl": (urllib.request.urlopen, preview_jsonl),
}


# handlers = {
#     "csv": preview_csv,
#     "excel": preview_excel,
#     "parquet": preview_parquet,
#     "jsonl": preview_jsonl,
# }

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
            "enum": ["gz"]
        },
        "size": {
            "enum": list(OUTPUT_SIZES),
        },
    },
    "required": ["url", "input"],
    "additionalProperties": False
}


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    url = request.args["url"]
    input_type = request.args.get("input")
    output_size = request.args.get("size", "small")
    compression = request.args.get("compression")

    parsed_url = urlparse(url, allow_fragments=False)
    if not (parsed_url.scheme == "https" and
            parsed_url.netloc.endswith(S3_DOMAIN_SUFFIX) and
            parsed_url.username is None and
            parsed_url.password is None):
        return make_json_response(400, {
            "title": "Invalid url=. Expected S3 virtual-host URL."
        })

    urlopener, handler = handlers[input_type]
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
    data, info = handler(src, out)

    return 200, data, {
        "Content-Type": "application/vnd.apache.arrow.file",
        "Content-Encoding": "gzip",
        QUILT_INFO_HEADER: json.dumps(info),
    }
