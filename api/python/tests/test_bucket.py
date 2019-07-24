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

    def test_bucket_meta(self):
        test_meta = {
            'helium': json.dumps({'target': 'json'})
        }
        response = {
            'Metadata': test_meta,
            'ContentLength': 123
        }
        params = {
            'Bucket': 'test-bucket',
            'Key': 'test'
        }
        self.s3_stubber.add_response('head_object', response, params)
        bucket = Bucket('s3://test-bucket')
        meta = bucket.get_meta('test')
        assert meta == {'target': 'json'}


        head_meta = {
            'helium': json.dumps({"target": "json"})
        }
        head_response = {
            'Metadata': head_meta,
            'ContentLength': 123
        }
        head_params = {
            'Bucket': 'test-bucket',
            'Key': 'test'
        }
        self.s3_stubber.add_response('head_object', head_response, head_params)
        new_test_meta = {
            'helium': json.dumps({
                'target': 'json',
                'user_meta': {}
            })
        }
        response = {}
        params = {
            'CopySource': {
                'Bucket': 'test-bucket',
                'Key': 'test'
            },
            'Bucket': 'test-bucket',
            'Key': 'test',
            'Metadata': new_test_meta,
            'MetadataDirective': 'REPLACE'
        }
        self.s3_stubber.add_response('copy_object', response, params)
        bucket.set_meta('test', {})

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
            'Key': 'test',
            'Expression': 'select * from S3Object',
            'ExpressionType': 'SQL',
            'InputSerialization': {
                'CompressionType': 'NONE',
                'JSON': {'Type': 'DOCUMENT'}
                },
            'OutputSerialization': {'JSON': {}},
            }

        test_meta = {
            'helium': json.dumps({'target': 'json'})
        }
        response = {
            'Metadata': test_meta,
            'ContentLength': 123
        }
        params = {
            'Bucket': 'test-bucket',
            'Key': 'test'
        }

        self.s3_stubber.add_response('head_object', response, params)

        boto_return_val = {'Payload': iter(records)}
        with patch.object(self.s3_client, 'select_object_content', return_value=boto_return_val) as patched:
            bucket = Bucket('s3://test-bucket')

            result = bucket.select('test', 'select * from S3Object')

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

            copy_mock.reset_mock()
            test_meta = {'asdf': 'jkl;'}
            expected_meta = {
                'user_meta': test_meta
            }
            bucket.put_file(key='README.md', path='./README', meta=test_meta)
            (src, dest, meta) = copy_mock.call_args_list[0][0]
            assert meta == expected_meta

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

    @patch('quilt3.bucket.find_bucket_config')
    @patch('quilt3.bucket.get_from_config')
    def test_bucket_config(self, config_mock, bucket_config_mock):
        bucket_config_mock.return_value = {
            'name': 'test-bucket',
            'title': 'Test Bucket',
            'icon': 'url',
            'description': 'description',
            'searchEndpoint': 'https://foo.bar/search'
        }
        config_mock.return_value = 'https://foo.bar'
        b = Bucket('s3://test-bucket')
        b.config()
        assert b._search_endpoint == 'https://foo.bar/search'
        config_mock.assert_called_once_with('navigator_url')
        bucket_config_mock.assert_called_once_with('test-bucket', 'https://foo.bar/config.json')

        config_mock.reset_mock()
        bucket_config_mock.reset_mock()

        b.config('https://bar.foo/config.json')
        assert not config_mock.called
        bucket_config_mock.assert_called_once_with('test-bucket', 'https://bar.foo/config.json')

    # further testing in test_search.py
    @patch('quilt3.bucket.search')
    @patch('quilt3.bucket.get_from_config')
    def test_search_bucket(self, config_mock, search_mock):
        config_mock.return_value = 'https://foo.bar'
        content = {
            'federations': ['/federation.json'],
        }
        federations = {
            "buckets": [
                {
                    "name": "quilt-testing-fake",
                    "searchEndpoint": "https://es-fake.endpoint",
                    "region": "us-meow"
                },
            ]
        }
        self.requests_mock.add(responses.GET, 'https://foo.bar/config.json', json=content, status=200)
        self.requests_mock.add(responses.GET, 'https://foo.bar/federation.json', json=federations, status=200)
        b = Bucket('s3://quilt-testing-fake')
        b.search('blah', limit=1)

        config_mock.assert_called_once_with('navigator_url')
        search_mock.assert_called_once_with('blah',
                                            'https://es-fake.endpoint',
                                            limit=1,
                                            aws_region='us-meow',
                                            bucket='quilt-testing-fake')

    @patch('quilt3.bucket.put_bytes')
    def test_bucket_put_ext(self, put_bytes):
        # This just ensures the bucket is calling serialize() correctly.
        obj = 'just a string..'
        b = Bucket('s3://quilt-testing-fake')
        b.put('foo.json', obj)

        assert put_bytes.called
        assert len(put_bytes.call_args_list) == 1

        args, kwargs = put_bytes.call_args
        # avoid args[n] call if put_bytes was called w/kwarg arguments
        data = kwargs['data'] if 'data' in kwargs else args[0]
        dest = kwargs['dest'] if 'dest' in kwargs else args[1]
        meta = kwargs['meta'] if 'meta' in kwargs else args[2]

        assert json.loads(data) == obj
        assert dest == 's3://quilt-testing-fake/foo.json'
        assert meta.get('format', {}).get('name') == 'json'
