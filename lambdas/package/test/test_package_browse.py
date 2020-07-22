"""
Test functions for package endpoint
"""

import os
from unittest import TestCase
from unittest.mock import patch

import boto3
import pandas as pd
import responses

from ..index import call_s3_select, get_logical_key_folder_view, load_df

class TestPackageBrowse(TestCase):
    """
    Unit tests for thhe Package API endpoint.
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
        streambytes = jsonl.encode('utf-8')

        self.s3response = {
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
                },
                {
                    'Progress': {
                        'Details': {
                            'BytesScanned': 123,
                            'BytesProcessed': 123,
                            'BytesReturned': 123
                        }
                    }
                }
            ]
        }

        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        self.requests_mock.start()

        self.env_patcher = patch.dict(os.environ, {
            'AWS_ACCESS_KEY_ID': 'test_key',
            'AWS_SECRET_ACCESS_KEY': 'test_secret',
        })
        self.env_patcher.start()

    def tearDown(self):
        self.env_patcher.stop()
        self.requests_mock.stop()


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

    def test_call_s3select_no_prefix(self):
        """
        Test that parameters are correctly passed to
        S3 Select (without a prefix)
        """
        bucket = "bucket"
        key = ".quilt/packages/manifest_hash"

        expected_args = {
            'Bucket': bucket,
            'Key': key,
            'Expression': "SELECT s.logical_key from s3object s",
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

        expected_sql = "SELECT s.logical_key from s3object s"
        expected_sql += f" WHERE s.logical_key LIKE ('{prefix}%')"
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

    def test_browse_top_level(self):
        """
        Test that the S3 Select response is parsed
        into the correct top-level folder view.
        """
        df, _ = load_df(self.s3response) #pylint: disable=invalid-name
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
        df, _ = load_df(self.s3response) #pylint: disable=invalid-name
        assert isinstance(df, pd.DataFrame)

        filtered_df = df[df['logical_key'].str.startswith(prefix)]
        folder = get_logical_key_folder_view(filtered_df, prefix)
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
        df, _ = load_df(self.s3response) #pylint: disable=invalid-name
        assert isinstance(df, pd.DataFrame)

        filtered_df = df[df['logical_key'].str.startswith(prefix)]
        folder = get_logical_key_folder_view(filtered_df, prefix)
        assert len(folder) == 2
        assert "file3.txt" in folder
        assert "file4.txt" in folder
