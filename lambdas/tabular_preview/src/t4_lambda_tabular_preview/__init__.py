import errno
import functools
import gzip
import io
import json
import os
import tempfile
import urllib.request
from urllib.parse import urlparse

import anndata
import fsspec
import h5py
import pandas
import pyarrow
import pyarrow.csv
import pyarrow.json
import pyarrow.parquet
import scanpy as sc

from t4_lambda_shared.decorator import QUILT_INFO_HEADER, api, validate
from t4_lambda_shared.utils import (
    get_default_origins,
    get_quilt_logger,
    make_json_response,
)

H5AD_META_ONLY_SIZE = int(os.getenv("H5AD_META_ONLY_SIZE", 1_000_000))


logger = get_quilt_logger()


class FileTooLargeError(Exception):
    """Raised when a file is too large to process in the lambda environment"""
    pass


class InsufficientStorageError(Exception):
    """Raised when there's insufficient temporary storage space"""
    pass


class TempStorageError(Exception):
    """Raised when there's an error with temporary file operations"""
    pass


def handle_exceptions(*exception_types):
    """Decorator to catch specific exceptions and return structured JSON responses"""
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            try:
                return f(*args, **kwargs)
            except exception_types as e:
                return make_json_response(500, {'error': str(e)})
        return wrapper
    return decorator


# Lambda's response must fit into 6 MiB, binary data must be encoded
# with base64 (4.5 MiB limit). It's rounded down to leave some space for headers
# and non-flushed gzip buffers.
MAX_OUT = 4_000_000

MAX_CSV_INPUT = 150_000_000

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
    if compression == "gz":
        compression = "gzip"
    # urllib's urlopen() works faster than fsspec, but is not seekable.
    if seekable:
        return fsspec.open(url, compression=compression).open()
    fileobj = urllib.request.urlopen(url)  # pylint: disable=consider-using-with
    if compression is not None:
        fileobj = pyarrow.CompressedInputStream(fileobj, compression)
    return fileobj


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
        if (
            (self.max_size is not None and self.size + len(data) > self.max_size) or
            # We don't know exact size of compressed data before real compression occurs,
            # so this assumes we can fit compressed data if there is enough space for uncompressed data.
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
                    # See a similar comment in GzipOutputBuffer.write().
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


def preview_csv(url, compression, max_out_size, *, delimiter: str = ","):
    # This function reads the same amount of data as expected for output, parses this
    # data as Arrow table and serializes it in Arrow IPC format.
    # Other approaches were tried:
    # * use streaming CSV reader see (pyarrow.csv.open_csv()) -- this approach was rejected
    #   because ArrowInvalid is raised if types inferred from the following chunks differ
    #   from types inferred from the first chunk.
    # * read/write data line by line -- iterating through file line by line in Python is slower
    #   than parsing the same file with pyarrow, writing to output without batching also seems
    #   to cause slowdown.
    # TODO: Possible optimization: output smaller data that fits into response without compression
    #       as is (without parsing).

    rows_skipped = 0

    def invalid_row_handler(row: pyarrow.csv.InvalidRow) -> str:
        nonlocal rows_skipped
        logger.debug("Skip invalid CSV row: %s", row)
        rows_skipped += 1
        return "skip"

    with urlopen(url, compression=compression) as src:
        max_input_size = max_out_size or MAX_CSV_INPUT
        input_data, input_truncated = read_lines(src, max_input_size)

    t = pyarrow.csv.read_csv(
        pyarrow.BufferReader(input_data),
        parse_options=pyarrow.csv.ParseOptions(
            delimiter=delimiter,
            invalid_row_handler=invalid_row_handler,
        ),
    )
    output_data, output_truncated = write_data_as_arrow(t, t.schema, None)

    return 200, output_data, {
        "Content-Type": "application/vnd.apache.arrow.file",
        "Content-Encoding": "gzip",
        QUILT_INFO_HEADER: json.dumps({
            "truncated": input_truncated or output_truncated,
            "rows_skipped": rows_skipped,
        }),
    }


def preview_jsonl(url, compression, max_out_size):
    # This mostly works the same as preview_csv() but tries to take into
    # account that JSONL is more verbose than CSV.
    with urlopen(url, compression=compression) as src:
        max_input_size = int((max_out_size or MAX_CSV_INPUT) * 1.5)
        input_data, input_truncated = read_lines(src, max_input_size)
    df = pandas.read_json(io.BytesIO(input_data), lines=True)
    output_data, output_truncated = write_pandas_as_csv(df, max_out_size)

    return 200, output_data, {
        "Content-Type": "text/csv",
        "Content-Encoding": "gzip",
        QUILT_INFO_HEADER: json.dumps({
            "truncated": input_truncated or output_truncated,
        }),
    }


def preview_excel(url, compression, max_out_size):
    with urlopen(url, compression=compression) as src:
        data = src.read()
    df = pandas.read_excel(data)
    output_data, output_truncated = write_pandas_as_csv(df, max_out_size)

    return 200, output_data, {
        "Content-Type": "text/csv",
        "Content-Encoding": "gzip",
        QUILT_INFO_HEADER: json.dumps({
            "truncated": output_truncated,
        }),
    }


def preview_parquet(url, compression, max_out_size):
    with urlopen(url, compression=compression, seekable=True) as src:
        parquet_file = pyarrow.parquet.ParquetFile(src, pre_buffer=True)
        meta = parquet_file.metadata
        df = parquet_file.read().to_pandas()

    output_data, output_truncated = write_pandas_as_csv(df, max_out_size)

    return (
        200,
        output_data,
        {
            "Content-Type": "text/csv",
            "Content-Encoding": "gzip",
            QUILT_INFO_HEADER: json.dumps(
                {
                    "truncated": output_truncated,
                    "meta": {
                        "created_by": meta.created_by,
                        "format_version": meta.format_version,
                        "num_row_groups": meta.num_row_groups,
                        "schema": {"names": meta.schema.names},
                        "serialized_size": meta.serialized_size,
                        "shape": (meta.num_rows, meta.num_columns),
                    },
                }
            ),
        },
    )


def preview_h5ad(url, compression, max_out_size):
    with urlopen(url, compression=compression, seekable=True) as src:
        with h5py.File(src, "r") as h5py_file:
            adata = anndata.experimental.read_lazy(h5py_file)

            # Get matrix dimensions to decide processing strategy
            n_obs, n_vars = adata.shape

            if (meta_only := n_obs * n_vars) >= H5AD_META_ONLY_SIZE:
                # For large files, skip intensive QC calculation that requires loading full matrix
                logger.warning(f"Getting only meta for large matrix ({n_obs} x {n_vars}) to avoid OOM/timeout")

                # Create empty dataframe
                var_df = pandas.DataFrame(columns=list(adata.var.keys()))
            else:
                adata = anndata.read_h5ad(src)
                # For smaller matrices, calculate full QC metrics using scanpy
                sc.pp.calculate_qc_metrics(adata, percent_top=None, log1p=False, inplace=True)
                var_df = adata.var.copy()

            # Add gene expression statistics from the QC metrics
            # These columns are added by calculate_qc_metrics:
            # - total_counts: total UMI counts for this gene across all cells
            # - n_cells_by_counts: number of cells with non-zero counts for this gene
            # - mean_counts: mean counts per cell for this gene
            # - pct_dropout_by_counts: percentage of cells with zero counts

            # Reset index to include gene IDs as a regular column
            var_df_with_index = var_df.reset_index()
            # XXX: doesn't that change the original column name?
            var_df_with_index = var_df_with_index.rename(columns={"index": "gene_id"})

            # Convert to Arrow table and write as Arrow format
            table = pyarrow.Table.from_pandas(var_df_with_index, preserve_index=False)
            output_data, output_truncated = write_data_as_arrow(table, table.schema, max_out_size)

    return (
        200,
        output_data,
        {
            "Content-Type": "application/vnd.apache.arrow.file",
            "Content-Encoding": "gzip",
            QUILT_INFO_HEADER: json.dumps(
                {
                    "truncated": output_truncated,
                    "meta_only": meta_only,
                    # H5AD-specific metadata format
                    "meta": {
                        "schema": {"names": list(var_df_with_index.columns)},
                        # H5AD-specific metadata with descriptive names
                        "h5ad_obs_keys": list(adata.obs.columns),
                        "h5ad_var_keys": list(adata.var.columns),
                        "h5ad_uns_keys": list(adata.uns.keys()),
                        "h5ad_obsm_keys": list(adata.obsm.keys()),
                        "h5ad_varm_keys": list(adata.varm.keys()),
                        "h5ad_layers_keys": list(adata.layers.keys()),
                        # Additional biological context
                        "anndata_version": getattr(adata, "__version__", None),
                        "n_cells": adata.n_obs,
                        "n_genes": adata.n_vars,
                        "matrix_type": "sparse" if hasattr(adata.X, "nnz") else "dense",
                        "has_raw": adata.raw is not None,
                    },
                }
            ),
        },
    )


handlers = {
    "csv": functools.partial(preview_csv, delimiter=","),
    "tsv": functools.partial(preview_csv, delimiter="\t"),
    "excel": preview_excel,
    "parquet": preview_parquet,
    "jsonl": preview_jsonl,
    "h5ad": preview_h5ad,
}

SCHEMA = {
    "type": "object",
    "properties": {
        "url": {"type": "string"},
        "input": {
            "enum": list(handlers),
        },
        "compression": {"enum": ["gz", "bz2"]},
        "size": {
            "enum": list(OUTPUT_SIZES),
        },
    },
    "required": ["url", "input"],
    "additionalProperties": False,
}


def is_s3_url(url: str) -> bool:
    parsed_url = urlparse(url, allow_fragments=False)
    return (
        parsed_url.scheme == "https"
        and parsed_url.netloc.endswith(S3_DOMAIN_SUFFIX)
        and parsed_url.username is None
        and parsed_url.password is None
    )


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
@handle_exceptions(FileTooLargeError, InsufficientStorageError, TempStorageError)
def lambda_handler(request):
    url = request.args["url"]
    input_type = request.args.get("input")
    output_size = request.args.get("size", "small")
    compression = request.args.get("compression")

    if not is_s3_url(url):
        return make_json_response(400, {"title": "Invalid url=. Expected S3 virtual-host URL."})

    handler = handlers[input_type]
    return handler(url, compression, OUTPUT_SIZES[output_size])
