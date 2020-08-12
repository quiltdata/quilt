"""
Test functions for pkgselect endpoint
"""

import json
import os
from unittest import TestCase
from unittest.mock import patch

import boto3
from botocore.stub import Stubber
import pandas as pd
import responses

from t4_lambda_shared.utils import buffer_s3response, read_body

from ..index import (
    file_list_to_folder,
    lambda_handler
)


class TestPackageSelect(TestCase):
    """
    Unit tests for the PackageSelect API endpoint.
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
        entries = []
        for key in logical_keys:
            entry = dict(
                logical_key=key,
                physical_key=f"{key}?versionid=1234",
                size=100
            )
            entries.append(json.dumps(entry))
        jsonl = "\n".join(entries)
        print(jsonl)
        streambytes = jsonl.encode()

        manifest_row = dict(
            logical_key="bar/file1.txt",
            physical_keys=["s3://test-bucket/bar/file1.txt"],
            size=1234,
            hash={"type": "SHA256", "value": "0123456789ABCDEF"},
            meta={}
        )
        detailbytes = json.dumps(manifest_row).encode()
        self.s3response_detail = {
            'Payload': [
                {
                    'Records': {
                        'Payload': detailbytes
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

    def test_browse_top_level(self):
        """
        Test that the S3 Select response is parsed
        into the correct top-level folder view.
        """
        df = pd.read_json(buffer_s3response(self.s3response), lines=True)
        assert isinstance(df, pd.DataFrame)

        folder = file_list_to_folder(df)
        assert len(folder['prefixes']) == 1
        assert len(folder['objects']) == 1
        assert folder['objects'][0]['logical_key'] == 'foo.csv'
        assert folder['prefixes'][0]['logical_key'] == 'bar/'

    def test_browse_subfolder(self):
        """
        Test that the S3 Select response is parsed
        into the correct sub-folder view.
        """
        prefix = "bar/"
        df = pd.read_json(buffer_s3response(self.s3response), lines=True)
        assert isinstance(df, pd.DataFrame)
        filtered_df = df[df['logical_key'].str.startswith(prefix)]
        stripped = filtered_df['logical_key'].str.slice(start=len(prefix))
        stripped_df = stripped.to_frame('logical_key')
        s3_df = pd.concat(
            [stripped_df['logical_key'], filtered_df['size'], filtered_df['physical_key']],
            axis=1,
            keys=['logical_key', 'size', 'physical_key']
        )

        folder = file_list_to_folder(s3_df)
        assert len(folder['prefixes']) == 1
        assert len(folder['objects']) == 2
        object_keys = [obj['logical_key'] for obj in folder['objects']]
        assert "file1.txt" in object_keys
        assert "file2.txt" in object_keys
        assert folder['prefixes'][0]['logical_key'] == "baz/"

    def test_browse_subsubfolder(self):
        """
        Test that the S3 Select response is parsed
        into the correct sub-sub-folder view.
        """
        prefix = "bar/baz/"
        df = pd.read_json(buffer_s3response(self.s3response), lines=True)
        assert isinstance(df, pd.DataFrame)
        filtered_df = df[df['logical_key'].str.startswith(prefix)]
        stripped = filtered_df['logical_key'].str.slice(start=len(prefix))
        stripped_df = stripped.to_frame('logical_key')
        s3_df = pd.concat(
            [stripped_df['logical_key'], filtered_df['size'], filtered_df['physical_key']],
            axis=1,
            keys=['logical_key', 'size', 'physical_key']
        )
        folder = file_list_to_folder(s3_df)
        assert "objects" in folder
        assert "prefixes" in folder
        assert not folder['prefixes']
        assert len(folder['objects']) == 2
        object_keys = [obj['logical_key'] for obj in folder['objects']]
        assert "file3.txt" in object_keys
        assert "file4.txt" in object_keys

    def test_folder_view(self):
        """
        End-to-end test (folder view without a prefix)
        """
        bucket = "bucket"
        key = ".quilt/packages/manifest_hash"
        params = dict(
            bucket=bucket,
            manifest=key,
            access_key="TESTKEY",
            secret_key="TESTSECRET",
            session_token="TESTSESSION"
        )

        expected_args = {
            'Bucket': bucket,
            'Key': key,
            'Expression': "SELECT SUBSTRING(s.logical_key, 1) AS logical_key FROM s3object s",
            'ExpressionType': 'SQL',
            'InputSerialization': {
                'CompressionType': 'NONE',
                'JSON': {'Type': 'LINES'}
                },
            'OutputSerialization': {'JSON': {'RecordDelimiter': '\n'}},
        }

        mock_s3 = boto3.client('s3')
        client_patch = patch.object(
            mock_s3,
            'select_object_content',
            return_value=self.s3response
        )
        client_patch.start()
        with patch('boto3.Session.client', return_value=mock_s3):
            response = lambda_handler(self._make_event(params), None)
            print(response)
            assert response['statusCode'] == 200
            folder = json.loads(read_body(response))['contents']
            assert len(folder['prefixes']) == 1
            assert len(folder['objects']) == 1
            assert folder['objects'][0]['logical_key'] == 'foo.csv'
            assert folder['prefixes'][0]['logical_key'] == 'bar/'
        client_patch.stop()

    def test_detail_view(self):
        """
        End-to-end test (detail view)
        """
        bucket = "bucket"
        key = ".quilt/packages/manifest_hash"
        logical_key = "bar/file1.txt"
        params = dict(
            bucket=bucket,
            manifest=key,
            logical_key=logical_key,
            access_key="TESTKEY",
            secret_key="TESTSECRET",
            session_token="TESTSESSION"
        )

        expected_sql = "SELECT s.* FROM s3object s WHERE s.logical_key = 'bar/file1.txt' LIMIT 1"
        expected_args = {
            'Bucket': bucket,
            'Key': key,
            'Expression': "SELECT SUBSTRING(s.logical_key, 1) AS logical_key FROM s3object s",
            'ExpressionType': 'SQL',
            'InputSerialization': {
                'CompressionType': 'NONE',
                'JSON': {'Type': 'LINES'}
                },
            'OutputSerialization': {'JSON': {'RecordDelimiter': '\n'}},
        }

        mock_s3 = boto3.client('s3')
        client_patch = patch.object(
            mock_s3,
            'select_object_content',
            return_value=self.s3response_detail
        )
        client_patch.start()
        with patch('boto3.Session.client', return_value=mock_s3):
            response = lambda_handler(self._make_event(params), None)
            print(response)
            assert response['statusCode'] == 200
            json.loads(read_body(response))['contents']
        client_patch.stop()

    def test_incomplete_credentials(self):
        """
        Verify that a call with incomplete credentials fails.
        """
        bucket = "bucket"
        key = ".quilt/packages/manifest_hash"
        logical_key = "bar/file1.txt"
        params = dict(
            bucket=bucket,
            manifest=key,
            logical_key=logical_key,
            access_key="TESTKEY",
            secret_key="TESTSECRET",
        )

        response = lambda_handler(self._make_event(params), None)
        assert response['statusCode'] == 401

    def test_blocked_anon_access(self):
        """
        Verify that an anonymous call fails if ALLOW_ANONYMOUS_ACCESS
        is not set.
        """
        bucket = "bucket"
        key = ".quilt/packages/manifest_hash"
        logical_key = "bar/file1.txt"
        params = dict(
            bucket=bucket,
            manifest=key,
            logical_key=logical_key,
        )

        response = lambda_handler(self._make_event(params), None)
        assert response['statusCode'] == 401

    def test_anon_access(self):
        """
        Test anonymous call w/ ALLOW_ANONYMOUS_ACCESS
        """
        bucket = "bucket"
        key = ".quilt/packages/manifest_hash"
        params = dict(
            bucket=bucket,
            manifest=key,
        )

        expected_args = {
            'Bucket': bucket,
            'Key': key,
            'Expression': "SELECT SUBSTRING(s.logical_key, 1) AS logical_key FROM s3object s",
            'ExpressionType': 'SQL',
            'InputSerialization': {
                'CompressionType': 'NONE',
                'JSON': {'Type': 'LINES'}
                },
            'OutputSerialization': {'JSON': {'RecordDelimiter': '\n'}},
        }

        env_patcher = patch.dict(os.environ, {
            'AWS_ACCESS_KEY_ID': 'test_key',
            'AWS_SECRET_ACCESS_KEY': 'test_secret',
            'ALLOW_ANONYMOUS_ACCESS': '1'
        })
        env_patcher.start()

        mock_s3 = boto3.client('s3')
        client_patch = patch.object(
            mock_s3,
            'select_object_content',
            return_value=self.s3response
        )
        client_patch.start()
        response = {
            'ETag': '12345',
            'VersionId': '1.0',
            'ContentLength': 123,
        }
        expected_params = {
            'Bucket': bucket,
            'Key': key,
        }
        s3_stubber = Stubber(mock_s3)
        s3_stubber.activate()
        s3_stubber.add_response('head_object', response, expected_params)
        with patch('boto3.Session.client', return_value=mock_s3):
            response = lambda_handler(self._make_event(params), None)
            print(response)
            assert response['statusCode'] == 200
            folder = json.loads(read_body(response))['contents']
            print(folder)
            assert len(folder['prefixes']) == 1
            assert len(folder['objects']) == 1
            assert folder['objects'][0]['logical_key'] == 'foo.csv'
            assert folder['prefixes'][0]['logical_key'] == 'bar/'
        s3_stubber.deactivate()
        client_patch.stop()
        env_patcher.stop()
