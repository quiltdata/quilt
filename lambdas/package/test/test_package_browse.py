"""
Test functions for package endpoint
"""

import json
import os
from unittest import TestCase
from unittest.mock import patch

import pandas as pd
import responses

from ..index import get_logical_key_folder_view, lambda_handler, load_df

class TestPackageBrowse(TestCase):

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
    
    def test_call_s3select(self):
        pass

    def test_browse_no_prefix(self):
        df, stats = load_df(self.s3response)
        assert isinstance(df, pd.DataFrame)

        folder = get_logical_key_folder_view(df)
        assert len(folder) == 2
        assert 'foo.csv' in folder
        assert 'bar/' in folder

    def test_browse_subfolder(self):
        prefix = "bar/"
        df, stats = load_df(self.s3response)
        assert isinstance(df, pd.DataFrame)

        filtered_df = df[df['logical_key'].str.startswith(prefix)]
        folder = get_logical_key_folder_view(filtered_df, prefix)
        assert len(folder) == 3
        assert "file1.txt" in folder
        assert "file2.txt" in folder
        assert "baz/" in folder

    def test_browse_subsubfolder(self):
        prefix = "bar/baz/"
        df, stats = load_df(self.s3response)
        assert isinstance(df, pd.DataFrame)

        filtered_df = df[df['logical_key'].str.startswith(prefix)]
        folder = get_logical_key_folder_view(filtered_df, prefix)
        assert len(folder) == 2
        assert "file3.txt" in folder
        assert "file4.txt" in folder

    def test_browse_bad_manifest(self):
        pass

        
