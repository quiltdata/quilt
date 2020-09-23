"""
Preview helper functions
"""
import os
import pathlib
from unittest import TestCase
from unittest.mock import patch

import pyarrow.parquet as pq

from t4_lambda_shared.preview import (
    extract_fcs,
    extract_parquet,
    get_bytes,
    get_preview_lines,
)


BASE_DIR = pathlib.Path(__file__).parent / 'data'


def iterate_chunks(file_obj, chunk_size=4096):
    return iter(lambda: file_obj.read(chunk_size), b'')


class TestPreview(TestCase):
    """Tests the preview functions"""
    # 15_000 is magic = exact number of cells (cols*rows) in test file
    def test_extract_parquet(self):
        file = BASE_DIR / 'amazon-reviews-1000.snappy.parquet'
        cell_value = '<td>TSD Airsoft/Paintball Full-Face Mask, Goggle Lens</td>'

        with patch('t4_lambda_shared.preview.get_available_memory') as mem_mock:
            mem_mock.return_value = 1
            with open(file, mode='rb') as parquet:
                body, info = extract_parquet(parquet)
                assert all(bracket in body for bracket in ('<', '>'))
                assert body.count('<') == body.count('>'), \
                    'expected matching HTML tags'
                assert cell_value not in body, 'only expected columns'
                assert 'skipped rows' in info['warnings']

        with open(file, mode='rb') as parquet:
            body, info = extract_parquet(parquet, as_html=True)
            assert cell_value in body, 'missing expected HTML cell'

        with open(file, mode='rb') as parquet:
            body, info = extract_parquet(parquet, skip_rows=True)
            assert 'skipped rows' in info['warnings']
            assert cell_value not in body, 'only expected columns'

        with open(file, mode='rb') as parquet:
            body, info = extract_parquet(parquet, as_html=False)
            assert all(bracket not in body for bracket in ('<', '>')), \
                'did not expect HTML'
            parquet_file = pq.ParquetFile(file)
            assert all(
                column in info['schema']['names']
                for column in parquet_file.schema.names
            )
            assert [
                parquet_file.metadata.num_rows, parquet_file.metadata.num_columns
            ] == info['shape'], 'Unexpected number of rows or columns'

    def test_fcs(self):
        """test FCS parsing"""
        # store test files and expectations
        test_files = {
            'normal.fcs': {
                'columns_string': 'FSC-A,SSC-A,FL1-A,FL2-A,FL3-A,FL4-A,FSC-H,SSC-H,FL1-H,FL2-H,FL3-H,FL4-H,Width,Time',
                'in_body': '<th>FL3-H</th>',
                'in_meta_keys': '#P1MaxUsefulDataChannel',
                'in_meta_values': '491519',
                'has_warnings': False,
            },
            'meta_only.fcs': {
                'in_meta_keys': '_channel_names_',
                'in_meta_values': 'Compensation Controls_G710 Stained Control.fcs',
                'has_warnings': True,
            },
        }
        for file in test_files:
            in_file = os.path.join(BASE_DIR, 'fcs', file)

            with open(in_file, mode='rb') as fcs:
                body, info = extract_fcs(fcs)
                if body != "":
                    assert test_files[file]['in_body'] in body
                    assert not test_files[file].get('has_warnings')
                else:
                    assert test_files[file]['has_warnings']
                    assert info['warnings']
                assert test_files[file]['in_meta_keys'] in info['metadata'].keys()
                assert test_files[file]['in_meta_values'] in info['metadata'].values()
                # when there's a body, check if columns only works
                if test_files[file].get('in_body'):
                    # move to start so we can use the file-like a second time
                    fcs.seek(0)
                    body, info = extract_fcs(fcs, as_html=False)
                    assert body == test_files[file]['columns_string']

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
