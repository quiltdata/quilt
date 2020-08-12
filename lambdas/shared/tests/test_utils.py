"""
Misc helper functions
"""
import json
import logging
import os
from unittest import TestCase
from unittest.mock import patch

import boto3
import pytest
from testfixtures import LogCapture

from t4_lambda_shared.utils import (
    query_manifest_content,
    separated_env_to_iter,
    get_default_origins,
    logger,
    make_json_response,
    IncompleteResultException
)


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

        self.s3response = {
            'Payload': [
                {
                    'Records': {
                        'Payload': streambytes
                    }
                },
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

    def test_call_s3select(self):
        """
        Test that parameters are correctly passed to
        S3 Select (without a prefix)
        """
        bucket = "bucket"
        key = ".quilt/packages/manifest_hash"

        expected_sql = "SELECT SUBSTRING(s.logical_key, 1) AS logical_key FROM s3object s"
        expected_args = {
            'Bucket': bucket,
            'Key': key,
            'Expression': expected_sql,
            'ExpressionType': 'SQL',
            'InputSerialization': {
                'CompressionType': 'NONE',
                'JSON': {'Type': 'LINES'}
                },
            'OutputSerialization': {'JSON': {'RecordDelimiter': '\n'}},
        }

        mock_s3 = boto3.client('s3')
        with patch.object(
                mock_s3,
                'select_object_content',
                return_value=self.s3response
        ) as patched:
            query_manifest_content(
                mock_s3,
                bucket=bucket,
                key=key,
                sql_stmt=expected_sql)
            patched.assert_called_once_with(**expected_args)

    def test_call_s3select_incomplete_response(self):
        """
        Test that an incomplete response from S3 Select is
        detected and an exception is raised.
        """
        bucket = "bucket"
        key = ".quilt/packages/manifest_hash"

        expected_sql = "SELECT SUBSTRING(s.logical_key, 1) AS logical_key FROM s3object s"
        expected_args = {
            'Bucket': bucket,
            'Key': key,
            'Expression': expected_sql,
            'ExpressionType': 'SQL',
            'InputSerialization': {
                'CompressionType': 'NONE',
                'JSON': {'Type': 'LINES'}
                },
            'OutputSerialization': {'JSON': {'RecordDelimiter': '\n'}},
        }

        mock_s3 = boto3.client('s3')
        with patch.object(
                mock_s3,
                'select_object_content',
                return_value=self.s3response_incomplete
        ) as patched:
            with self.assertRaises(IncompleteResultException):
                query_manifest_content(
                    mock_s3,
                    bucket=bucket,
                    key=key,
                    sql_stmt=expected_sql
                )
                patched.assert_called_once_with(**expected_args)


@pytest.mark.parametrize(
    "level, call, message, expected",
    [
        (logging.WARNING, "debug", "IGNORE", ""),
        (logging.DEBUG, "debug", "HEARME", "HEARME"),
        (logging.DEBUG, "info", "HEARME", "HEARME"),
    ],
)
@logger()
def test_logger(level: int, message: str, call: str, expected: str, **kwargs):
    """test logging decorator"""
    assert isinstance(kwargs['logger'], logging.Logger)
    with LogCapture(level=level) as buffer:
        logger_mock = logging.getLogger('fake')
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
