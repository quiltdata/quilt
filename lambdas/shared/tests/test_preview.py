"""
Preview helper functions
"""
import pathlib
from unittest import TestCase
from unittest.mock import patch

import pyarrow.parquet as pq

from t4_lambda_shared.preview import (
    extract_parquet,
    get_bytes,
    get_preview_lines
)


BASE_DIR = pathlib.Path(__file__).parent / 'data'


def iterate_chunks(file_obj, chunk_size=4096):
    return iter(lambda: file_obj.read(chunk_size), b'')


class TestPreview(TestCase):
    """Tests the preview functions"""
    # 15_000 is magic = exact number of cells (cols*rows) in test file
    def test_extract_parquet(self):
        file = BASE_DIR / 'amazon-reviews-1000.snappy.parquet'
        # test giant files
        with patch('t4_lambda_shared.preview.MAX_LOAD_CELLS', 14_999):
            with open(file, mode='rb') as parquet:
                body, info = extract_parquet(parquet)
                assert all(bracket in body for bracket in ('<', '>'))
                assert body.count('<') == body.count('>'), \
                    'expected matching HTML tags'
                assert '(Rows not loaded to conserve memory)' in body

        with open(file, mode='rb') as parquet:
            body, info = extract_parquet(parquet, as_html=False)
            assert all(bracket not in body for bracket in ('<', '>')), \
                'did not expect HTML'
            assert '(Rows not loaded to conserve memory)' not in body
            parquet_file = pq.ParquetFile(file)
            assert all(
                column in info['schema']['names']
                for column in parquet_file.schema.names
            )
            assert [
                parquet_file.metadata.num_rows, parquet_file.metadata.num_columns
            ] == info['shape'], 'Unexpected number of rows or columns'

    def test_long(self):
        """test a text file with lots of lines"""
        txt = BASE_DIR / 'long.txt'
        max_lines = 500
        max_bytes = 10000
        with open(txt, 'rb') as file_obj:
            lines = get_preview_lines(iterate_chunks(file_obj), None, max_lines, max_bytes)

        assert len(lines) == max_lines, 'unexpected number of lines'
        assert lines[0] == 'Line 1', 'unexpected first line'
        assert lines[-1] == f'Line {max_lines}', 'unexpected last line'

    def test_long_gz(self):
        """test a gzipped text file with lots of lines"""
        txt = BASE_DIR / 'long.txt.gz'
        max_lines = 500
        max_bytes = 10000
        with open(txt, 'rb') as file_obj:
            lines = get_preview_lines(iterate_chunks(file_obj), 'gz', max_lines, max_bytes)

        assert len(lines) == max_lines, 'unexpected number of lines'
        assert lines[0] == 'Line 1', 'unexpected first line'
        assert lines[-1] == f'Line {max_lines}', 'unexpected last line'

    def test_txt_max_bytes(self):
        """test truncation to CATALOG_LIMIT_BYTES"""
        txt = BASE_DIR / 'two-line.txt'
        max_lines = 500
        max_bytes = 5
        with open(txt, 'rb') as file_obj:
            lines = get_preview_lines(iterate_chunks(file_obj), None, max_lines, max_bytes)
        assert len(lines) == 1, 'failed to truncate bytes'
        assert lines[0] == '1234😊', 'failed to truncate bytes'

    def test_txt_max_bytes_one_line(self):
        """test truncation to CATALOG_LIMIT_BYTES"""
        txt = BASE_DIR / 'one-line.txt'
        max_lines = 500
        max_bytes = 8
        chunk_size = 10
        with open(txt, 'rb') as file_obj:
            lines = get_preview_lines(
                iterate_chunks(file_obj, chunk_size),
                None,
                max_lines,
                max_bytes
            )
        assert len(lines) == 1, 'failed to truncate bytes'
        assert lines[0] == '🚷🚯', 'failed to truncate bytes'

    def test_bytes(self):
        txt = BASE_DIR / 'long.txt.gz'
        with open(txt, 'rb') as file_obj:
            buffer = get_bytes(file_obj, 'gz')
        lines = buffer.getvalue().splitlines()
        assert lines[0] == b'Line 1'
        assert lines[-1] == b'Line 999'
