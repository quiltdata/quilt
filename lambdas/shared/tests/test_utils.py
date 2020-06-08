"""
Misc helper functions
"""
import json
import os
from unittest import TestCase
from unittest.mock import patch

from t4_lambda_shared.utils import (
    separated_env_to_iter,
    get_default_origins,
    make_json_response
)


class TestUtils(TestCase):
    """Tests the helper functions"""
    def test_separated_env_to_iter(self):
        """ensure the function that infers overrides from the env works:
            always returns a valid set(), perhaps empty, lowercases extensions
        """
        with patch.dict(os.environ, {'CONTENT_INDEX_EXTS': '.txt'}):
            assert separated_env_to_iter('CONTENT_INDEX_EXTS') == {'.txt'}
        with patch.dict(os.environ, {'CONTENT_INDEX_EXTS': ' .tXt   '}):
            assert separated_env_to_iter('CONTENT_INDEX_EXTS') == {'.txt'}
        with patch.dict(os.environ, {'CONTENT_INDEX_EXTS': ' garbage  gar.bage  '}):
            assert separated_env_to_iter(
                'CONTENT_INDEX_EXTS',
                predicate=lambda x: x.startswith('.')
            ) == set()
        with patch.dict(os.environ, {'CONTENT_INDEX_EXTS': ' .Parquet, .csv, .tsv'}):
            assert separated_env_to_iter('CONTENT_INDEX_EXTS') == {'.parquet', '.csv', '.tsv'}
        with patch.dict(os.environ, {'CONTENT_INDEX_EXTS': ''}):
            assert not separated_env_to_iter('CONTENT_INDEX_EXTS') == True, \
                "Invalid sets should be empty and falsy"


    def test_origins(self):
        """
        Test get_default_origins()
        """
        with patch.dict(os.environ, {'WEB_ORIGIN': 'https://example.com'}):
            assert get_default_origins() == ['http://localhost:3000', 'https://example.com']

    def test_json_response(self):
        """
        Test make_json_response()
        """
        status, body, headers = make_json_response(400, {'foo': 'bar'})
        assert status == 400
        assert json.loads(body) == {'foo': 'bar'}
        assert headers == {'Content-Type': 'application/json'}

        status, body, headers = make_json_response(200, {'foo': 'bar'}, {'Content-Length': '123'})
        assert status == 200
        assert json.loads(body) == {'foo': 'bar'}
        assert headers == {'Content-Type': 'application/json', 'Content-Length': '123'}
