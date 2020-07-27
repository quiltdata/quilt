"""
Test functions for package endpoint
"""

import os
from unittest import TestCase
from unittest.mock import patch

import boto3
import pandas as pd
import responses

from ..index import call_s3_select, get_logical_key_folder_view, load_df, IncompleteResultException


class TestPackageBrowse(TestCase):
    """
    Unit tests for the Package API endpoint.
    """
    def setUp(self):
        """
        Mocks to tests calls to S3 Select
        """

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
        print(jsonl)
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

        requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        requests_mock.start()
        self.addCleanup(requests_mock.stop)

        env_patcher = patch.dict(os.environ, {
            'AWS_ACCESS_KEY_ID': 'test_key',
            'AWS_SECRET_ACCESS_KEY': 'test_secret',
        })
        env_patcher.start()
        self.addCleanup(env_patcher.stop)

    @classmethod
    def _make_event(cls, params, headers=None):
        return {
            'httpMethod': 'POST',
            'path': '/foo',
            'pathParameters': {},
            'queryStringParameters': params or None,
            'headers': headers or None,
            'body': None,
            'isBase64Encoded': False,
        }

    def test_call_s3select_top_level(self):
        """
        Test that parameters are correctly passed to
        S3 Select (without a prefix)
        """
        bucket = "bucket"
        key = ".quilt/packages/manifest_hash"

        expected_args = {
            'Bucket': bucket,
            'Key': key,
            'Expression': "SELECT SUBSTRING(s.logical_key, 1) AS logical_key FROM s3object s",
            'ExpressionType': 'SQL',
            'InputSerialization': {
                'CompressionType': 'NONE',
                'JSON': {'Type': 'DOCUMENT'}
                },
            'OutputSerialization': {'JSON': {'RecordDelimiter': '\n'}},
        }

        mock_s3 = boto3.client('s3')
        with patch.object(
                mock_s3,
                'select_object_content',
                return_value=self.s3response_incomplete
        ) as patched:
            call_s3_select(mock_s3, bucket, key, "")
            patched.assert_called_once_with(**expected_args)

    def test_call_s3select_prefix(self):
        """
        Test that parameters are correctly passed to
        S3 Select (with a prefix)
        """
        bucket = "bucket"
        key = ".quilt/packages/manifest_hash"
        prefix = "bar/"

        expected_sql = "SELECT SUBSTRING(s.logical_key, 5) AS logical_key FROM s3object s"
        expected_sql += f" WHERE SUBSTRING(s.logical_key, 1, 4) = '{prefix}'"
        expected_args = {
            'Bucket': bucket,
            'Key': key,
            'Expression': expected_sql,
            'ExpressionType': 'SQL',
            'InputSerialization': {
                'CompressionType': 'NONE',
                'JSON': {'Type': 'DOCUMENT'}
                },
            'OutputSerialization': {'JSON': {'RecordDelimiter': '\n'}},
        }

        mock_s3 = boto3.client('s3')
        with patch.object(
                mock_s3,
                'select_object_content',
                return_value=self.s3response
        ) as patched:
            call_s3_select(mock_s3, bucket, key, prefix)
            patched.assert_called_once_with(**expected_args)

    def test_incomplete_response(self):
        """
        Test that an incomplete response from S3 Select is
        detected and an exception is raised.
        """
        with self.assertRaises(IncompleteResultException):
            _, _ = load_df(self.s3response_incomplete)  # pylint: disable=invalid-name

    def test_browse_top_level(self):
        """
        Test that the S3 Select response is parsed
        into the correct top-level folder view.
        """
        df, _ = load_df(self.s3response)  # pylint: disable=invalid-name
        assert isinstance(df, pd.DataFrame)

        folder = get_logical_key_folder_view(df)
        assert len(folder) == 2
        assert 'foo.csv' in folder
        assert 'bar/' in folder

    def test_browse_subfolder(self):
        """
        Test that the S3 Select response is parsed
        into the correct sub-folder view.
        """
        prefix = "bar/"
        df, _ = load_df(self.s3response)  # pylint: disable=invalid-name
        assert isinstance(df, pd.DataFrame)

        filtered_df = df[df['logical_key'].str.startswith(prefix)]
        stripped = filtered_df['logical_key'].str.slice(start=len(prefix))
        folder = get_logical_key_folder_view(stripped.to_frame('logical_key'))
        print(folder)
        assert len(folder) == 3
        assert "file1.txt" in folder
        assert "file2.txt" in folder
        assert "baz/" in folder

    def test_browse_subsubfolder(self):
        """
        Test that the S3 Select response is parsed
        into the correct sub-sub-folder view.
        """
        prefix = "bar/baz/"
        df, _ = load_df(self.s3response)  # pylint: disable=invalid-name
        assert isinstance(df, pd.DataFrame)
        filtered_df = df[df['logical_key'].str.startswith(prefix)]
        stripped = filtered_df['logical_key'].str.slice(start=len(prefix))
        folder = get_logical_key_folder_view(stripped.to_frame('logical_key'))
        assert len(folder) == 2
        assert "file3.txt" in folder
        assert "file4.txt" in folder
