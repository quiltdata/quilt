"""
Preview helper functions
"""
import json
import os
import pathlib
from unittest import TestCase

from t4_lambda_shared.preview import get_preview_lines

BASE_DIR = pathlib.Path(__file__).parent / 'data'


def iterate_chunks(file_obj, chunk_size=4096):
    return iter(lambda: file_obj.read(chunk_size), b'')


class TestPreview(TestCase):
    """Tests the preview functions"""

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
        """test truncation to MAX_BYTES"""
        txt = BASE_DIR / 'two-line.txt'
        max_lines = 500
        max_bytes = 5
        with open(txt, 'rb') as file_obj:
            lines = get_preview_lines(iterate_chunks(file_obj), None, max_lines, max_bytes)
        assert len(lines) == 1, 'failed to truncate bytes'
        assert lines[0] == '1234😊', 'failed to truncate bytes'

    def test_txt_max_bytes_one_line(self):
        """test truncation to MAX_BYTES"""
        txt = BASE_DIR / 'one-line.txt'
        max_lines = 500
        max_bytes = 8
        chunk_size = 10
        with open(txt, 'rb') as file_obj:
            lines = get_preview_lines(iterate_chunks(file_obj, chunk_size), None, max_lines, max_bytes)
        assert len(lines) == 1, 'failed to truncate bytes'
        assert lines[0] == '🚷🚯', 'failed to truncate bytes'
