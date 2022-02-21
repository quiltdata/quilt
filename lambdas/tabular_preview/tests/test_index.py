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
