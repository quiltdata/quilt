import json
from unittest.mock import patch
import pathlib
from urllib.parse import urlparse

from botocore.stub import Stubber
import pandas as pd
import pytest
import responses

from quilt3 import Bucket, data_transfer, config
from quilt3.util import QuiltException

from .utils import QuiltTestCase


class TestBucket(QuiltTestCase):
    def test_bucket_construct(self):
        Bucket('s3://test-bucket')

    def test_bucket_fetch(self):
        response = {
            'IsTruncated': False
        }
        params = {
            'Bucket': 'test-bucket',
            'Prefix': 'does/not/exist/'
        }
        self.s3_stubber.add_response('list_objects_v2', response, params)
        with pytest.raises(QuiltException):
            Bucket('s3://test-bucket').fetch('does/not/exist/', './')


    def test_bucket_select(self):
        # Stubber doesn't have an accurate shape for the results of select_object_content
        chunks = [
            b'{"foo": ',
            b'9, "b',
            b'ar": 3',
            b'}\n{"foo"',
            b': 9, "bar": 1}\n{"foo": 6, "bar": 9}\n{"foo":',
            b' 1, "bar": 7}\n{"foo":',
            b' 6, "bar": 1}\n{"foo": 6, "bar": 6}',
            b'\n{"foo": 9, "bar": 6}',
            b'\n{"foo": 6, "bar": 4}\n',
            b'{"foo": 2, "bar": 0}',
            b'\n{"foo": 2, "bar": 0}\n',
            ]
        records = [{'Records': {'Payload': chunk}} for chunk in chunks]
        # noinspection PyTypeChecker
        records.append({'Stats': {
            'BytesScanned': 100,
            'BytesProcessed': 100,
            'BytesReturned': 210,
            }})
        records.append({'End': {}})

        expected_result = pd.DataFrame.from_records([
            {'foo': 9, 'bar': 3},
            {'foo': 9, 'bar': 1},
            {'foo': 6, 'bar': 9},
            {'foo': 1, 'bar': 7},
            {'foo': 6, 'bar': 1},
            {'foo': 6, 'bar': 6},
            {'foo': 9, 'bar': 6},
            {'foo': 6, 'bar': 4},
            {'foo': 2, 'bar': 0},
            {'foo': 2, 'bar': 0},
            ])

        # test normal use from extension
        expected_args = {
            'Bucket': 'test-bucket',
            'Key': 'test.json',
            'Expression': 'select * from S3Object',
            'ExpressionType': 'SQL',
            'InputSerialization': {
                'CompressionType': 'NONE',
                'JSON': {'Type': 'DOCUMENT'}
                },
            'OutputSerialization': {'JSON': {}},
            }

        boto_return_val = {'Payload': iter(records)}
        with patch.object(self.s3_client, 'select_object_content', return_value=boto_return_val) as patched:
            bucket = Bucket('s3://test-bucket')

            result = bucket.select('test.json', 'select * from S3Object')

            patched.assert_called_once_with(**expected_args)
            assert result.equals(expected_result)

    # Further testing specific to select() is in test_data_transfer


    def test_bucket_put_file(self):
        with patch("quilt3.bucket.copy_file") as copy_mock:
            bucket = Bucket('s3://test-bucket')
            bucket.put_file(key='README.md', path='./README') # put local file to bucket
            copy_src = copy_mock.call_args_list[0][0][0]
            assert urlparse(copy_src).scheme == 'file'
            copy_dest = copy_mock.call_args_list[0][0][1]
            assert urlparse(copy_dest).scheme == 's3'

    def test_bucket_put_dir(self):
        path = pathlib.Path(__file__).parent / 'data'
        bucket = Bucket('s3://test-bucket')

        with patch("quilt3.bucket.copy_file") as copy_mock:
            bucket.put_dir('test', path)
            copy_mock.assert_called_once_with(path.as_uri() + '/', 's3://test-bucket/test/')

        with patch("quilt3.bucket.copy_file") as copy_mock:
            bucket.put_dir('test/', path)
            copy_mock.assert_called_once_with(path.as_uri() + '/', 's3://test-bucket/test/')

        with patch("quilt3.bucket.copy_file") as copy_mock:
            bucket.put_dir('', path)
            copy_mock.assert_called_once_with(path.as_uri() + '/', 's3://test-bucket/')

    def test_remote_delete(self):
        self.s3_stubber.add_response(
            method='head_object',
            service_response={},
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'file.json',
            }
        )
        self.s3_stubber.add_response(
            method='delete_object',
            service_response={},
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'file.json',
            }
        )

        bucket = Bucket('s3://test-bucket')
        bucket.delete('file.json')

        with pytest.raises(QuiltException):
            bucket.delete('s3://test-bucket/dir/')


    def test_remote_delete_dir(self):
        self.s3_stubber.add_response(
            method='list_objects_v2',
            service_response={
                'IsTruncated': False,
                'Contents': [{'Key': 'a'}, {'Key': 'b'}],
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Prefix': 's3://test-bucket/dir/'
            }
        )
        self.s3_stubber.add_response(
            method='head_object',
            service_response={},
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'a'
            }
        )
        self.s3_stubber.add_response(
            method='delete_object',
            service_response={},
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'a'
            }
        )
        self.s3_stubber.add_response(
            method='head_object',
            service_response={},
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'b'
            }
        )
        self.s3_stubber.add_response(
            method='delete_object',
            service_response={},
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'b'
            }
        )

        bucket = Bucket('s3://test-bucket')
        bucket.delete_dir('s3://test-bucket/dir/')

        with pytest.raises(ValueError):
            bucket.delete_dir('s3://test-bucket/dir')
