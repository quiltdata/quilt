import gzip
import io
import json
import pathlib
from unittest import mock

import pyarrow
import pytest

import t4_lambda_tabular_preview
from t4_lambda_shared.decorator import QUILT_INFO_HEADER


def patch_urlopen(data: bytes):
    return mock.patch("t4_lambda_tabular_preview.urlopen", return_value=io.BytesIO(data))


@pytest.mark.parametrize(
    "data, handler_name",
    [
        (
            (
                b"a,b\n"
                b"1,2\n"
                b"x,y\n"
            ),
            "csv",
        ),
        (
            (
                b"a\tb\n"
                b"1\t2\n"
                b"x\ty\n"
            ),
            "tsv",
        ),
    ]
)
def test_preview_csv(handler_name, data):
    with patch_urlopen(data) as urlopen_mock:
        code, body, headers = t4_lambda_tabular_preview.handlers[handler_name](
            url=mock.sentinel.URL,
            compression=mock.sentinel.COMPRESSION,
            max_out_size=None,
        )

        urlopen_mock.assert_called_once_with(mock.sentinel.URL, compression=mock.sentinel.COMPRESSION)

        assert code == 200
        assert headers == {
            "Content-Type": "application/vnd.apache.arrow.file",
            "Content-Encoding": "gzip",
            QUILT_INFO_HEADER: json.dumps({
                "truncated": False,
                "rows_skipped": 0,
            }),
        }
        with pyarrow.ipc.open_file(io.BytesIO(gzip.decompress(body))) as reader:
            t = reader.read_all()
        assert t.column_names == ["a", "b"]
        assert t.to_pylist() == [
            {"a": "1", "b": "2"},
            {"a": "x", "b": "y"},
        ]


@pytest.mark.parametrize(
    "filename, handler_name",
    [
        ("simple/test.xls", "excel"),
        ("simple/test.xlsx", "excel"),
        ("simple/test.jsonl", "jsonl"),
    ]
)
def test_preview_simple(filename, handler_name):
    data = (pathlib.Path(__file__).parent / "data" / filename).read_bytes()
    with patch_urlopen(data) as urlopen_mock:
        code, body, headers = t4_lambda_tabular_preview.handlers[handler_name](
            url=mock.sentinel.URL,
            compression=mock.sentinel.COMPRESSION,
            max_out_size=None,
        )

        urlopen_mock.assert_called_once_with(mock.sentinel.URL, compression=mock.sentinel.COMPRESSION)

        assert code == 200
        assert headers == {
            "Content-Type": "text/csv",
            "Content-Encoding": "gzip",
            QUILT_INFO_HEADER: json.dumps({
                "truncated": False,
            }),
        }
        assert gzip.decompress(body) == (
            b"a,b\n"
            b"1,2\n"
            b"x,y\n"
        )


@pytest.mark.parametrize(
    "basic_info_only",
    [False, True],
)
def test_preview_h5ad(mocker, basic_info_only):
    if basic_info_only:
        mocker.patch(
            "t4_lambda_tabular_preview.H5AD_META_ONLY_SIZE",
            0,  # Force providing only meta
        )
        calculate_qc_metrics_mock = mocker.patch("t4_lambda_tabular_preview.sc.pp.calculate_qc_metrics")

    code, body, headers = t4_lambda_tabular_preview.handlers["h5ad"](
        url=str(pathlib.Path(__file__).parent / "data" / "simple/test.h5ad"),
        compression=None,
        max_out_size=None,
    )

    # urlopen_mock.assert_called_once_with(mock.sentinel.URL, compression=mock.sentinel.COMPRESSION)

    assert code == 200
    assert headers["Content-Type"] == "application/vnd.apache.arrow.file"
    assert headers["Content-Encoding"] == "gzip"

    # Parse the QUILT_INFO_HEADER to check metadata
    info = json.loads(headers[QUILT_INFO_HEADER])
    assert "truncated" in info
    assert "meta" in info
    # Check H5AD-specific metadata format
    assert "h5ad_obs_keys" in info["meta"]  # H5AD-specific fields
    assert "h5ad_var_keys" in info["meta"]
    # Check new H5AD-specific fields
    assert info["meta"]["n_cells"] == 2  # 2 cells in test data
    assert info["meta"]["n_genes"] == 2  # 2 genes in test data
    assert "matrix_type" in info["meta"]  # sparse or dense
    assert "has_raw" in info["meta"]  # boolean indicating raw data presence

    # Check that the Arrow data can be read and contains expected content
    with pyarrow.ipc.open_file(io.BytesIO(gzip.decompress(body))) as reader:
        table = reader.read_all()

    # Convert back to pandas to check content
    df = table.to_pandas()

    # Should have gene-level QC metrics instead of expression matrix
    assert "gene_id" in df.columns
    assert "highly_variable" in df.columns
    if not basic_info_only:
        assert "ENSG001" in df["gene_id"].values
        assert "ENSG002" in df["gene_id"].values

    # Should have QC metric columns added by scanpy
    expected_qc_columns = ["total_counts", "n_cells_by_counts", "mean_counts", "pct_dropout_by_counts"]
    if basic_info_only:
        calculate_qc_metrics_mock.assert_not_called()
        for col in expected_qc_columns:
            assert col not in df.columns, f"Unexpected QC column {col} found in {df.columns.tolist()}"
    else:
        for col in expected_qc_columns:
            assert col in df.columns, f"Expected QC column {col} not found in {df.columns.tolist()}"

    # Check that we have the right number of genes (rows)
    if basic_info_only:
        assert len(df) == 0  # no tabular data
    else:
        assert len(df) == 2  # Should have 2 genes from our test data


def test_preview_simple_parquet():
    data = (pathlib.Path(__file__).parent / "data" / "simple/test.parquet").read_bytes()
    with patch_urlopen(data) as urlopen_mock:
        code, body, headers = t4_lambda_tabular_preview.handlers["parquet"](
            url=mock.sentinel.URL,
            compression=mock.sentinel.COMPRESSION,
            max_out_size=None,
        )

        urlopen_mock.assert_called_once_with(mock.sentinel.URL, compression=mock.sentinel.COMPRESSION, seekable=True)

        assert code == 200
        assert headers == {
            "Content-Type": "text/csv",
            "Content-Encoding": "gzip",
            QUILT_INFO_HEADER: json.dumps({
                "truncated": False,
                "meta": {
                    "created_by": "parquet-cpp-arrow version 7.0.0",
                    "format_version": "1.0",
                    "num_row_groups": 1,
                    "schema": {"names": ["a", "b"]},
                    "serialized_size": 456,
                    "shape": (2, 2),
                },
            }),
        }
        assert gzip.decompress(body) == (
            b"a,b\n"
            b"1,2\n"
            b"x,y\n"
        )
