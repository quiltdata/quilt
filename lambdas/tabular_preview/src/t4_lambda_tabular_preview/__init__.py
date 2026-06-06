import errno
import functools
import gzip
import io
import json
import os
import tempfile
import urllib.request
from urllib.parse import urlparse

import pandas
import pyarrow
import pyarrow.csv
import pyarrow.json
import pyarrow.parquet

from t4_lambda_shared.decorator import QUILT_INFO_HEADER, api, validate
from t4_lambda_shared.utils import (
    get_default_origins,
    get_quilt_logger,
    make_json_response,
)

H5AD_META_ONLY_SIZE = int(os.getenv("H5AD_META_ONLY_SIZE", 1_000_000))


logger = get_quilt_logger()


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
        import fsspec

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
            (self.max_size is not None and self.size + len(data) > self.max_size)
            or
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
                    (max_size is not None and sink.tell() + batch_size > max_size)
                    or
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

    return (
        200,
        output_data,
        {
            "Content-Type": "application/vnd.apache.arrow.file",
            "Content-Encoding": "gzip",
            QUILT_INFO_HEADER: json.dumps(
                {
                    "truncated": input_truncated or output_truncated,
                    "rows_skipped": rows_skipped,
                }
            ),
        },
    )


def preview_jsonl(url, compression, max_out_size):
    # This mostly works the same as preview_csv() but tries to take into
    # account that JSONL is more verbose than CSV.
    with urlopen(url, compression=compression) as src:
        max_input_size = int((max_out_size or MAX_CSV_INPUT) * 1.5)
        input_data, input_truncated = read_lines(src, max_input_size)
    df = pandas.read_json(io.BytesIO(input_data), lines=True)
    output_data, output_truncated = write_pandas_as_csv(df, max_out_size)

    return (
        200,
        output_data,
        {
            "Content-Type": "text/csv",
            "Content-Encoding": "gzip",
            QUILT_INFO_HEADER: json.dumps(
                {
                    "truncated": input_truncated or output_truncated,
                }
            ),
        },
    )


def preview_excel(url, compression, max_out_size):
    with urlopen(url, compression=compression) as src:
        data = src.read()
    df = pandas.read_excel(io.BytesIO(data))
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
                }
            ),
        },
    )


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


class _ReadCounter:
    """Wrap a seekable byte-stream so we can count reads.

    Used as telemetry to confirm that h5py/anndata pull only ranges of a
    remote file (S3 via fsspec) rather than downloading the full object.
    All attribute access falls through to the wrapped file; we only
    intercept read()/readinto() to measure.
    """

    def __init__(self, inner):
        self._inner = inner
        self.range_request_count = 0
        self.total_bytes_read = 0
        self.max_single_read = 0

    def _record(self, n: int):
        self.range_request_count += 1
        self.total_bytes_read += max(n, 0)
        if n > self.max_single_read:
            self.max_single_read = n

    def read(self, size=-1):
        if size is None or size < 0:
            raise ValueError(
                "_ReadCounter.read() requires an explicit size; unbounded reads "
                "would mask whether the underlying stream pulled ranges."
            )
        data = self._inner.read(size)
        self._record(len(data) if data is not None else 0)
        return data

    def readinto(self, buf):
        n = self._inner.readinto(buf)
        self._record(n or 0)
        return n

    def __getattr__(self, name):
        return getattr(self._inner, name)

    def stats(self):
        return {
            "range_request_count": self.range_request_count,
            "total_bytes_read": self.total_bytes_read,
            "max_single_read": self.max_single_read,
        }


def _extract_matrix_preview(adata, *, rows: int = 5, cols: int = 5):
    """Return a bounded preview of adata.X as a JSON-safe dict, or None
    with an error reason on failure. Never raises.
    """
    try:
        X = adata.X
        if X is None:
            return None, "no matrix"
        try:
            shape = tuple(X.shape)
        except Exception:  # pragma: no cover - defensive
            shape = None
        sample = X[:rows, :cols]
        if hasattr(sample, "toarray"):
            sample = sample.toarray()
        # adata.experimental.read_lazy may return dask-backed arrays.
        if hasattr(sample, "compute"):
            sample = sample.compute()
        try:
            import numpy
            arr = numpy.asarray(sample)
            dtype = str(arr.dtype)
            if numpy.issubdtype(arr.dtype, numpy.integer):
                values = arr.astype(int, copy=False).tolist()
            elif numpy.issubdtype(arr.dtype, numpy.floating):
                values = arr.astype(float, copy=False).tolist()
            elif numpy.issubdtype(arr.dtype, numpy.bool_):
                values = arr.astype(bool, copy=False).tolist()
            else:
                values = arr.tolist()
        except Exception:
            dtype = str(getattr(sample, "dtype", "unknown"))
            values = list(sample)
        return {
            "shape": list(shape) if shape is not None else None,
            "dtype": dtype,
            "values": values,
        }, None
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"


def _h5ad_error_response(exc: BaseException, telemetry: dict, url: str):
    err_type = type(exc).__name__
    # Strip presigned-URL query string to keep signatures/credentials out of logs.
    safe_url = str(url).split("?", 1)[0]
    logger.warning(
        "h5ad preview failed: %s: %s (url=%s)",
        err_type, exc, safe_url,
    )
    return (
        200,
        b"",
        {
            "Content-Type": "application/octet-stream",
            QUILT_INFO_HEADER: json.dumps({
                "truncated": False,
                "meta_only": True,
                "meta": {
                    "error": {
                        "type": err_type,
                        "message": str(exc),
                    },
                },
                "telemetry": telemetry,
            }),
        },
    )


def _calculate_h5ad_qc_metrics(adata):
    import scanpy as sc

    sc.pp.calculate_qc_metrics(adata, percent_top=None, log1p=False, inplace=True)


# Errors worth retrying once: torn HTTP reads (OSError from h5py) and
# transport-level failures from fsspec/aiohttp/urllib. Structural problems
# (bad h5ad, missing groups) raise ValueError/KeyError and are not retried.
_H5AD_RETRYABLE = (OSError,)


def preview_h5ad(url, compression, max_out_size):
    last_exc: BaseException | None = None
    last_counter = None
    for attempt in range(2):
        try:
            return _preview_h5ad_once(url, compression, max_out_size)
        except _H5AD_RETRYABLE as exc:
            last_exc = exc
            last_counter = getattr(exc, "_h5ad_counter", None)
            logger.warning(
                "h5ad preview attempt %d failed: %s: %s",
                attempt + 1, type(exc).__name__, exc,
            )
            continue
        except Exception as exc:  # noqa: BLE001 - non-retryable; fall through to error envelope
            last_exc = exc
            last_counter = getattr(exc, "_h5ad_counter", None)
            break
    telemetry = last_counter.stats() if last_counter is not None else {
        "range_request_count": 0,
        "total_bytes_read": 0,
        "max_single_read": 0,
    }
    return _h5ad_error_response(last_exc, telemetry, url)


def _preview_h5ad_once(url, compression, max_out_size):
    import anndata
    import h5py

    counter = None
    try:
        with urlopen(url, compression=compression, seekable=True) as raw_src:
            counter = _ReadCounter(raw_src)
            with h5py.File(counter, "r") as h5py_file:
                adata = anndata.experimental.read_lazy(h5py_file)
                n_obs, n_vars = adata.shape

                if meta_only := (n_obs * n_vars >= H5AD_META_ONLY_SIZE):
                    logger.warning(
                        "Getting only meta for large matrix (%d x %d) to avoid OOM/timeout",
                        n_obs, n_vars,
                    )
                    var_df = pandas.DataFrame(columns=list(adata.var.keys()))
                else:
                    adata = anndata.read_h5ad(counter)
                    _calculate_h5ad_qc_metrics(adata)
                    var_df = adata.var.copy()

                var_df_with_index = var_df.reset_index().rename(
                    columns={"index": "gene_id"}
                )
                table = pyarrow.Table.from_pandas(var_df_with_index, preserve_index=False)
                output_data, output_truncated = write_data_as_arrow(
                    table, table.schema, max_out_size
                )

                matrix_preview, matrix_preview_error = _extract_matrix_preview(adata)

                # Materialize every adata attribute while the h5py file is still
                # open — adata.experimental.read_lazy returns lazy views that
                # raise once the underlying file handle is closed.
                info = {
                    "truncated": output_truncated,
                    "meta_only": meta_only,
                    "meta": {
                        "schema": {"names": list(var_df_with_index.columns)},
                        "h5ad_obs_keys": list(adata.obs.columns),
                        "h5ad_var_keys": list(adata.var.columns),
                        "h5ad_uns_keys": list(adata.uns.keys()),
                        "h5ad_obsm_keys": list(adata.obsm.keys()),
                        "h5ad_varm_keys": list(adata.varm.keys()),
                        "h5ad_layers_keys": list(adata.layers.keys()),
                        "anndata_version": getattr(adata, "__version__", None),
                        "n_cells": adata.n_obs,
                        "n_genes": adata.n_vars,
                        "matrix_type": "sparse" if hasattr(adata.X, "nnz") else "dense",
                        "has_raw": adata.raw is not None,
                        "matrix_preview": matrix_preview,
                    },
                }
                if matrix_preview is None and matrix_preview_error is not None:
                    info["meta"]["matrix_preview_error"] = matrix_preview_error
    except Exception as exc:
        # Attach the counter so the retry/error wrapper can read telemetry
        # even though the with-block has already torn down `raw_src`.
        if counter is not None:
            exc._h5ad_counter = counter  # type: ignore[attr-defined]
        raise

    info["telemetry"] = counter.stats()

    logger.info(
        "h5ad preview telemetry: range_request_count=%d total_bytes_read=%d max_single_read=%d",
        counter.range_request_count,
        counter.total_bytes_read,
        counter.max_single_read,
    )

    return (
        200,
        output_data,
        {
            "Content-Type": "application/vnd.apache.arrow.file",
            "Content-Encoding": "gzip",
            QUILT_INFO_HEADER: json.dumps(info),
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
def lambda_handler(request):
    url = request.args["url"]
    input_type = request.args.get("input")
    output_size = request.args.get("size", "small")
    compression = request.args.get("compression")

    if not is_s3_url(url):
        return make_json_response(400, {"title": "Invalid url=. Expected S3 virtual-host URL."})

    handler = handlers[input_type]
    return handler(url, compression, OUTPUT_SIZES[output_size])
