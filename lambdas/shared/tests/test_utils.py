"""
Misc helper functions
"""
import json
import logging
import os
import sys
from unittest import TestCase
from unittest.mock import MagicMock, patch

import pytest
from testfixtures import LogCapture

from t4_lambda_shared.utils import (
    get_available_memory,
    get_default_origins,
    make_json_response,
    separated_env_to_iter,
    set_soft_mem_limit,
)


def test_get_available_memory():
    mem = get_available_memory()
    assert isinstance(mem, int), "Expected an int"
    assert mem > 1, "Expected some memory"


class TestUtils(TestCase):
    """Tests the helper functions"""
    def setUp(self):
        logical_keys = [
            "foo.csv",
            "bar/file1.txt",
            "bar/file2.txt",
            "bar/baz/file3.txt",
            "bar/baz/file4.txt"
        ]
        jsonl = ""
        for key in logical_keys:
            jsonl += "{\"logical_key\": \"%s\"}\n" % key
        streambytes = jsonl.encode()
        records_unicode = '{"logical_key": "💩"}\n'.encode()
        records_unicode = (records_unicode[:-4], records_unicode[-4:])

        self.s3response = {
            'Payload': [
                *[
                    {
                        'Records': {
                            'Payload': payload
                        }
                    }
                    for payload in (streambytes, *records_unicode)
                ],
                {
                    'Progress': {
                        'Details': {
                            'BytesScanned': 123,
                            'BytesProcessed': 123,
                            'BytesReturned': 123
                        }
                    }
                },
                {
                    'Stats': {
                        'Details': {
                            'BytesScanned': 123,
                            'BytesProcessed': 123,
                            'BytesReturned': 123
                        }
                    }
                },
                {
                    'End': {}
                }
            ]
        }

        self.s3response_incomplete = {
            'Payload': [
                {
                    'Records': {
                        'Payload': streambytes
                    }
                },
                {
                    'Stats': {
                        'Details': {
                            'BytesScanned': 123,
                            'BytesProcessed': 123,
                            'BytesReturned': 123
                        }
                    }
                }
            ]
        }

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
            assert separated_env_to_iter('CONTENT_INDEX_EXTS') == set(), \
                "Empty string should yield empty set"
        with patch.dict(os.environ, {'CONTENT_INDEX_EXTS': '     '}):
            assert separated_env_to_iter('CONTENT_INDEX_EXTS') == set(), \
                "All spaces should yield empty set"
        with patch.dict(os.environ, {'CONTENT_INDEX_EXTS': '\t\n'}):
            assert separated_env_to_iter('CONTENT_INDEX_EXTS') == set(), \
                "Tab and newline should be empty and falsy"

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


@pytest.mark.parametrize(
    "level, call, message, expected, name",
    [
        (logging.WARNING, "debug", "IGNORE", "", "fake"),
        (logging.DEBUG, "debug", "HEARME", "HEARME", "fake"),
        (logging.DEBUG, "info", "HEARME", "HEARME", "fake"),
        pytest.param(
            logging.INFO, "info", "HEARME", "HEARME", "quilt-lambda",
            marks=pytest.mark.xfail(
                raises=AssertionError,
                reason="unclear but logger from @logger doesn't get patched?"
            )
        )
    ]
)
def test_logger(level: int, message: str, call: str, expected: str, name: str):
    """test logging decorator"""
    with LogCapture(level=level) as buffer:
        logger_mock = logging.getLogger(name)
        if call == "debug":
            logger_mock.debug(message)
        elif call == "info":
            logger_mock.info(message)
        else:
            raise ValueError("Unexpected call type")

        if expected:
            buffer.check(('fake', call.upper(), expected))
        else:
            buffer.check()


@pytest.mark.skipif(sys.platform != "Linux", reason="does't work at least on macOS")
def test_set_soft_mem_limit():
    mock_context = MagicMock()
    mock_context.memory_limit_in_mb = "1024"

    # just smoke test it
    with set_soft_mem_limit(mock_context):
        pass
