""" Testing for data_transfer.py """

### Python imports

# Backports
try: import pathlib2 as pathlib
except ImportError: import pathlib

try: import unittest.mock as mock
except ImportError: import mock

### Third-party imports
from botocore.stub import ANY
import pandas as pd
import pytest

### Project imports
from quilt import data_transfer

from .utils import QuiltTestCase

### Code

# parquet test moved to test_formats.py

DATA_DIR = pathlib.Path(__file__).parent / 'data'


class DataTransferTest(QuiltTestCase):
    def test_select(self):
        # Note: The boto3 Stubber doesn't work properly with s3_client.select_object_content().
        #       The return value expects a dict where an iterable is in the actual results.
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
            'Bucket': 'foo',
            'Key': 'bar/baz.json',
            'Expression': 'select * from S3Object',
            'ExpressionType': 'SQL',
            'InputSerialization': {
                'CompressionType': 'NONE',
                'JSON': {'Type': 'DOCUMENT'}
                },
            'OutputSerialization': {'JSON': {}},
            }
        boto_return_val = {'Payload': iter(records)}
        patched_s3 = mock.patch.object(
            data_transfer.s3_client,
            'select_object_content',
            return_value=boto_return_val,
            autospec=True,
        )
        with patched_s3 as patched:
            result = data_transfer.select('s3://foo/bar/baz.json', 'select * from S3Object')

            patched.assert_called_once_with(**expected_args)
            assert result.equals(expected_result)

        # test no format specified
        patched_s3 = mock.patch.object(
            data_transfer.s3_client,
            'select_object_content',
            autospec=True,
        )
        with patched_s3:
            # No format determined.
            with pytest.raises(data_transfer.QuiltException):
                result = data_transfer.select('s3://foo/bar/baz', 'select * from S3Object')

        # test format-specified in metadata
        expected_args = {
            'Bucket': 'foo',
            'Key': 'bar/baz',
            'Expression': 'select * from S3Object',
            'ExpressionType': 'SQL',
            'InputSerialization': {
                'CompressionType': 'NONE',
                'JSON': {'Type': 'DOCUMENT'}
            },
            'OutputSerialization': {'JSON': {}},
        }

        boto_return_val = {'Payload': iter(records)}
        patched_s3 = mock.patch.object(
            data_transfer.s3_client,
            'select_object_content',
            return_value=boto_return_val,
            autospec=True,
        )
        with patched_s3 as patched:
            result = data_transfer.select('s3://foo/bar/baz', 'select * from S3Object', meta={'target': 'json'})
            assert result.equals(expected_result)
            patched.assert_called_once_with(**expected_args)

        # test compression is specified
        expected_args = {
            'Bucket': 'foo',
            'Key': 'bar/baz.json.gz',
            'Expression': 'select * from S3Object',
            'ExpressionType': 'SQL',
            'InputSerialization': {
                'CompressionType': 'GZIP',
                'JSON': {'Type': 'DOCUMENT'}
                },
            'OutputSerialization': {'JSON': {}},
            }
        boto_return_val = {'Payload': iter(records)}
        patched_s3 = mock.patch.object(
            data_transfer.s3_client,
            'select_object_content',
            return_value=boto_return_val,
            autospec=True,
        )
        with patched_s3 as patched:
            # result ignored -- returned data isn't compressed, and this has already been tested.
            data_transfer.select('s3://foo/bar/baz.json.gz', 'select * from S3Object')
            patched.assert_called_once_with(**expected_args)

    def test_get_size_and_meta_no_version(self):
        response = {
            'ETag': '12345',
            'VersionId': '1.0',
            'ContentLength': 123,
            'Metadata': {}
        }
        expected_params = {
            'Bucket': 'my_bucket',
            'Key': 'my_obj',
        }
        self.s3_stubber.add_response('head_object', response, expected_params)

        # Verify the verion is present
        assert data_transfer.get_size_and_meta('s3://my_bucket/my_obj')[2] == '1.0'

    def test_list_local_url(self):
        dir_path = DATA_DIR / 'dir'
        contents = set(list(data_transfer.list_url(dir_path.as_uri())))
        assert contents == set([
            ('foo.txt', 4),
            ('x/blah.txt', 6)
        ])

    def test_etag(self):
        assert data_transfer._calculate_etag(DATA_DIR / 'small_file.csv') == '"0bec5bf6f93c547bc9c6774acaf85e1a"'
        assert data_transfer._calculate_etag(DATA_DIR / 'buggy_parquet.parquet') == '"dfb5aca048931d396f4534395617363f"'


    def test_simple_upload(self):
        path = DATA_DIR / 'small_file.csv'

        # Unversioned bucket
        self.s3_stubber.add_response(
            method='put_object',
            service_response={
                'VersionId': 'null'
            },
            expected_params={
                'Body': ANY,
                'Bucket': 'example',
                'Key': 'foo.csv',
                'Metadata': {'helium': '{}'}
            }
        )

        data_transfer.copy_file(path.as_uri(), 's3://example/foo.csv')

    def test_multi_upload(self):
        path1 = DATA_DIR / 'small_file.csv'
        path2 = DATA_DIR / 'dir/foo.txt'

        # Unversioned bucket
        self.s3_stubber.add_response(
            method='put_object',
            service_response={
                'VersionId': 'null'
            },
            expected_params={
                'Body': ANY,
                'Bucket': 'example1',
                'Key': 'foo.csv',
                'Metadata': {'helium': '{}'}
            }
        )

        # Versioned bucket
        self.s3_stubber.add_response(
            method='put_object',
            service_response={
                'VersionId': 'v123'
            },
            expected_params={
                'Body': ANY,
                'Bucket': 'example2',
                'Key': 'foo.txt',
                'Metadata': {'helium': '{"foo": "bar"}'}
            }
        )

        # stubber expects responses in order, so disable multi-threading.
        with mock.patch('quilt.data_transfer.s3_threads', 1):
            urls = data_transfer.copy_file_list([
                (path1.as_uri(), 's3://example1/foo.csv', path1.stat().st_size, None),
                (path2.as_uri(), 's3://example2/foo.txt', path2.stat().st_size, {'foo': 'bar'}),
            ])

            assert urls[0] == 's3://example1/foo.csv'
            assert urls[1] == 's3://example2/foo.txt?versionId=v123'


    def test_upload_large_file(self):
        path = DATA_DIR / 'large_file.npy'

        self.s3_stubber.add_client_error(
            method='head_object',
            http_status_code=404,
            expected_params={
                'Bucket': 'example',
                'Key': 'large_file.npy',
            }
        )

        self.s3_stubber.add_response(
            method='put_object',
            service_response={
                'VersionId': 'v1'
            },
            expected_params={
                'Body': ANY,
                'Bucket': 'example',
                'Key': 'large_file.npy',
                'Metadata': {'helium': '{}'}
            }
        )

        urls = data_transfer.copy_file_list([
            (path.as_uri(), 's3://example/large_file.npy', path.stat().st_size, None),
        ])
        assert urls[0] == 's3://example/large_file.npy?versionId=v1'


    def test_upload_large_file_etag_match(self):
        path = DATA_DIR / 'large_file.npy'

        self.s3_stubber.add_response(
            method='head_object',
            service_response={
                'ContentLength': path.stat().st_size,
                'ETag': data_transfer._calculate_etag(path),
                'VersionId': 'v1',
                'Metadata': {}
            },
            expected_params={
                'Bucket': 'example',
                'Key': 'large_file.npy',
            }
        )

        urls = data_transfer.copy_file_list([
            (path.as_uri(), 's3://example/large_file.npy', path.stat().st_size, None),
        ])
        assert urls[0] == 's3://example/large_file.npy?versionId=v1'


    def test_upload_large_file_etag_mismatch(self):
        path = DATA_DIR / 'large_file.npy'

        self.s3_stubber.add_response(
            method='head_object',
            service_response={
                'ContentLength': path.stat().st_size,
                'ETag': '"123"',
                'VersionId': 'v1',
                'Metadata': {}
            },
            expected_params={
                'Bucket': 'example',
                'Key': 'large_file.npy',
            }
        )

        self.s3_stubber.add_response(
            method='put_object',
            service_response={
                'VersionId': 'v2'
            },
            expected_params={
                'Body': ANY,
                'Bucket': 'example',
                'Key': 'large_file.npy',
                'Metadata': {'helium': '{}'}
            }
        )

        urls = data_transfer.copy_file_list([
            (path.as_uri(), 's3://example/large_file.npy', path.stat().st_size, None),
        ])
        assert urls[0] == 's3://example/large_file.npy?versionId=v2'


    def test_upload_large_file_etag_match_metadata_match(self):
        path = DATA_DIR / 'large_file.npy'
        etag = data_transfer._calculate_etag(path)

        self.s3_stubber.add_response(
            method='head_object',
            service_response={
                'ContentLength': path.stat().st_size,
                'ETag': etag,
                'VersionId': 'v1',
                'Metadata': {'helium': '{"foo": "bar"}'}
            },
            expected_params={
                'Bucket': 'example',
                'Key': 'large_file.npy',
            }
        )

        urls = data_transfer.copy_file_list([
            (path.as_uri(), 's3://example/large_file.npy', path.stat().st_size, {'foo': 'bar'}),
        ])
        assert urls[0] == 's3://example/large_file.npy?versionId=v1'


    def test_upload_large_file_etag_match_metadata_mismatch(self):
        path = DATA_DIR / 'large_file.npy'
        etag = data_transfer._calculate_etag(path)

        self.s3_stubber.add_response(
            method='head_object',
            service_response={
                'ContentLength': path.stat().st_size,
                'ETag': etag,
                'VersionId': 'v1',
                'Metadata': {}
            },
            expected_params={
                'Bucket': 'example',
                'Key': 'large_file.npy',
            }
        )

        self.s3_stubber.add_response(
            method='copy_object',
            service_response={
                'VersionId': 'v2'
            },
            expected_params={
                'CopySource': {
                    'Bucket': 'example',
                    'Key': 'large_file.npy',
                    'VersionId': 'v1'
                },
                'CopySourceIfMatch': etag,
                'Bucket': 'example',
                'Key': 'large_file.npy',
                'Metadata': {'helium': '{"foo": "bar"}'},
                'MetadataDirective': 'REPLACE'
            }
        )

        urls = data_transfer.copy_file_list([
            (path.as_uri(), 's3://example/large_file.npy', path.stat().st_size, {'foo': 'bar'}),
        ])
        assert urls[0] == 's3://example/large_file.npy?versionId=v2'


    def test_multipart_upload(self):
        path = DATA_DIR / 'large_file.npy'

        self.s3_stubber.add_client_error(
            method='head_object',
            http_status_code=404,
            expected_params={
                'Bucket': 'example',
                'Key': 'large_file.npy',
            }
        )

        self.s3_stubber.add_response(
            method='create_multipart_upload',
            service_response={
                'UploadId': '123'
            },
            expected_params={
                'Bucket': 'example',
                'Key': 'large_file.npy',
                'Metadata': {'helium': '{}'}
            }
        )

        with open(path, 'rb') as fd:
            for part_num in range(1, 6):
                self.s3_stubber.add_response(
                    method='upload_part',
                    service_response={
                        'ETag': 'etag%d' % part_num
                    },
                    expected_params={
                        'Bucket': 'example',
                        'Key': 'large_file.npy',
                        'UploadId': '123',
                        'Body': fd.read(2048),
                        'PartNumber': part_num
                    }
                )

        self.s3_stubber.add_response(
            method='complete_multipart_upload',
            service_response={},
            expected_params={
                'Bucket': 'example',
                'Key': 'large_file.npy',
                'UploadId': '123',
                'MultipartUpload': {
                    'Parts': [{
                        'ETag': 'etag%d' % i,
                        'PartNumber': i
                    } for i in range(1, 6)]
                }
            }
        )

        with mock.patch.object(data_transfer.s3_transfer_config, 'multipart_threshold', 4096), \
             mock.patch.object(data_transfer.s3_transfer_config, 'multipart_chunksize', 2048), \
             mock.patch('quilt.data_transfer.s3_threads', 1):
            data_transfer.copy_file_list([
                (path.as_uri(), 's3://example/large_file.npy', path.stat().st_size, None),
            ])


    def test_multipart_copy(self):
        file_size = 5000

        self.s3_stubber.add_response(
            method='head_object',
            service_response={
                'Metadata': {'helium': '{"foo": "bar"}'}
            },
            expected_params={
                'Bucket': 'example1',
                'Key': 'large_file1.npy',
            }
        )

        self.s3_stubber.add_response(
            method='create_multipart_upload',
            service_response={
                'UploadId': '123'
            },
            expected_params={
                'Bucket': 'example2',
                'Key': 'large_file2.npy',
                'Metadata': {'helium': '{"foo": "bar"}'}
            }
        )

        for part_num in range(1, 4):
            self.s3_stubber.add_response(
                method='upload_part_copy',
                service_response={
                    'CopyPartResult': {
                        'ETag': 'etag%d' % part_num
                    }
                },
                expected_params={
                    'Bucket': 'example2',
                    'Key': 'large_file2.npy',
                    'UploadId': '123',
                    'PartNumber': part_num,
                    'CopySource': {
                        'Bucket': 'example1',
                        'Key': 'large_file1.npy'
                    },
                    'CopySourceRange': 'bytes=%d-%d' % (
                        (part_num-1) * 2048,
                        min(part_num * 2048, file_size) - 1
                    )
                }
            )

        self.s3_stubber.add_response(
            method='complete_multipart_upload',
            service_response={},
            expected_params={
                'Bucket': 'example2',
                'Key': 'large_file2.npy',
                'UploadId': '123',
                'MultipartUpload': {
                    'Parts': [{
                        'ETag': 'etag%d' % i,
                        'PartNumber': i
                    } for i in range(1, 4)]
                }
            }
        )

        with mock.patch.object(data_transfer.s3_transfer_config, 'multipart_threshold', 4096), \
             mock.patch.object(data_transfer.s3_transfer_config, 'multipart_chunksize', 2048), \
             mock.patch('quilt.data_transfer.s3_threads', 1):
            data_transfer.copy_file_list([
                ('s3://example1/large_file1.npy', 's3://example2/large_file2.npy', file_size, None),
            ])
