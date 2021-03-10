import pathlib
from io import BytesIO
from unittest.mock import patch

import pandas as pd
import pytest

from quilt3 import Bucket
from quilt3.util import PhysicalKey, QuiltException

from .utils import QuiltTestCase


class TestBucket(QuiltTestCase):
    def test_bucket_construct(self):
        Bucket('s3://test-bucket')

    def test_bucket_fetch(self):
        bucket = Bucket('s3://test-bucket')

        a_contents = b'a' * 10
        b_contents = b'b' * 20

        # Fetch a directory.

        self.s3_stubber.add_response(
            method='list_objects_v2',
            service_response={
                'IsTruncated': False,
                'Contents': [
                    {'Key': 'dir/a', 'Size': len(a_contents)},
                    {'Key': 'dir/foo/b', 'Size': len(b_contents)}
                ],
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Prefix': 'dir/'
            }
        )
        self.s3_stubber.add_response(
            method='get_object',
            service_response={
                'ContentLength': len(a_contents),
                'Body': BytesIO(a_contents)
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'dir/a'
            }
        )
        self.s3_stubber.add_response(
            method='get_object',
            service_response={
                'ContentLength': len(b_contents),
                'Body': BytesIO(b_contents)
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'dir/foo/b'
            }
        )

        with patch('quilt3.data_transfer.MAX_CONCURRENCY', 1):
            bucket.fetch('dir/', './')

        assert pathlib.Path('a').read_bytes() == a_contents
        assert pathlib.Path('foo/b').read_bytes() == b_contents

        # Fetch a single file.

        self.s3_stubber.add_response(
            method='head_object',
            service_response={
                'ContentLength': len(b_contents),
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'dir/foo/b'
            }
        )

        self.s3_stubber.add_response(
            method='get_object',
            service_response={
                'ContentLength': len(b_contents),
                'Body': BytesIO(b_contents)
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'dir/foo/b'
            }
        )

        bucket.fetch('dir/foo/b', './blah/')
        assert pathlib.Path('blah/b').read_bytes() == b_contents

        # Fetch a non-existent directory.

        self.s3_stubber.add_response(
            method='list_objects_v2',
            service_response={
                'IsTruncated': False
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Prefix': 'does/not/exist/'
            }
        )
        with pytest.raises(QuiltException):
            bucket.fetch('does/not/exist/', './')

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
            bucket.put_file(key='README.md', path='./README')  # put local file to bucket

            copy_mock.assert_called_once_with(
                PhysicalKey.from_path('README'), PhysicalKey.from_url('s3://test-bucket/README.md'))

    def test_bucket_put_dir(self):
        path = pathlib.Path(__file__).parent / 'data'
        bucket = Bucket('s3://test-bucket')

        with patch("quilt3.bucket.copy_file") as copy_mock:
            bucket.put_dir('test', path)
            copy_mock.assert_called_once_with(
                PhysicalKey.from_path(str(path) + '/'), PhysicalKey.from_url('s3://test-bucket/test/'))

        with patch("quilt3.bucket.copy_file") as copy_mock:
            bucket.put_dir('test/', path)
            copy_mock.assert_called_once_with(
                PhysicalKey.from_path(str(path) + '/'), PhysicalKey.from_url('s3://test-bucket/test/'))

        with patch("quilt3.bucket.copy_file") as copy_mock:
            bucket.put_dir('', path)
            copy_mock.assert_called_once_with(
                PhysicalKey.from_path(str(path) + '/'), PhysicalKey.from_url('s3://test-bucket/'))

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
            bucket.delete('dir/')

    def test_remote_delete_dir(self):
        self.s3_stubber.add_response(
            method='list_objects_v2',
            service_response={
                'IsTruncated': False,
                'Contents': [{'Key': 'dir/a'}, {'Key': 'dir/b'}],
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Prefix': 'dir/'
            }
        )
        self.s3_stubber.add_response(
            method='head_object',
            service_response={},
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'dir/a'
            }
        )
        self.s3_stubber.add_response(
            method='delete_object',
            service_response={},
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'dir/a'
            }
        )
        self.s3_stubber.add_response(
            method='head_object',
            service_response={},
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'dir/b'
            }
        )
        self.s3_stubber.add_response(
            method='delete_object',
            service_response={},
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'dir/b'
            }
        )

        bucket = Bucket('s3://test-bucket')
        bucket.delete_dir('dir/')

        with pytest.raises(ValueError):
            bucket.delete_dir('dir')
