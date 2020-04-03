""" Testing for data_transfer.py """

### Python imports
import io
import pathlib
import time
from contextlib import redirect_stderr

from unittest import mock

### Third-party imports
from botocore.stub import ANY
from botocore.exceptions import ClientError, ReadTimeoutError
import pandas as pd
import pytest

### Project imports
from quilt3 import data_transfer
from quilt3.util import PhysicalKey

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
        with mock.patch.object(self.s3_client, 'select_object_content', return_value=boto_return_val) as patched:
            result = data_transfer.select(PhysicalKey.from_url('s3://foo/bar/baz.json'), 'select * from S3Object')

            patched.assert_called_once_with(**expected_args)
            assert result.equals(expected_result)

        with mock.patch.object(self.s3_client, 'select_object_content'):
            # No format determined.
            with pytest.raises(data_transfer.QuiltException):
                result = data_transfer.select(PhysicalKey.from_url('s3://foo/bar/baz'), 'select * from S3Object')

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
        with mock.patch.object(self.s3_client, 'select_object_content', return_value=boto_return_val) as patched:
            result = data_transfer.select(PhysicalKey.from_url('s3://foo/bar/baz'), 'select * from S3Object', meta={'target': 'json'})
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
        with mock.patch.object(self.s3_client, 'select_object_content', return_value=boto_return_val) as patched:
            # result ignored -- returned data isn't compressed, and this has already been tested.
            data_transfer.select(PhysicalKey.from_url('s3://foo/bar/baz.json.gz'), 'select * from S3Object')
            patched.assert_called_once_with(**expected_args)

    def test_get_size_and_version(self):
        response = {
            'ETag': '12345',
            'VersionId': '1.0',
            'ContentLength': 123,
        }
        expected_params = {
            'Bucket': 'my_bucket',
            'Key': 'my_obj',
        }
        self.s3_stubber.add_response('head_object', response, expected_params)

        # Verify the verion is present
        assert data_transfer.get_size_and_version(PhysicalKey.from_url('s3://my_bucket/my_obj'))[1] == '1.0'

    def test_list_local_url(self):
        dir_path = DATA_DIR / 'dir'
        contents = set(list(data_transfer.list_url(PhysicalKey.from_path(dir_path))))
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
            },
            expected_params={
                'Body': ANY,
                'Bucket': 'example',
                'Key': 'foo.csv',
            }
        )

        data_transfer.copy_file(PhysicalKey.from_path(path), PhysicalKey.from_url('s3://example/foo.csv'))

    def test_multi_upload(self):
        path1 = DATA_DIR / 'small_file.csv'
        path2 = DATA_DIR / 'dir/foo.txt'

        # Unversioned bucket
        self.s3_stubber.add_response(
            method='put_object',
            service_response={
            },
            expected_params={
                'Body': ANY,
                'Bucket': 'example1',
                'Key': 'foo.csv',
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
            }
        )

        # stubber expects responses in order, so disable multi-threading.
        with mock.patch('quilt3.data_transfer.s3_transfer_config.max_request_concurrency', 1):
            urls = data_transfer.copy_file_list([
                (PhysicalKey.from_path(path1), PhysicalKey.from_url('s3://example1/foo.csv'), path1.stat().st_size),
                (PhysicalKey.from_path(path2), PhysicalKey.from_url('s3://example2/foo.txt'), path2.stat().st_size),
            ])

            assert urls[0] == PhysicalKey.from_url('s3://example1/foo.csv')
            assert urls[1] == PhysicalKey.from_url('s3://example2/foo.txt?versionId=v123')

    @pytest.mark.skip(reason="Broken due to S3ClientProvider")
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
            }
        )

        urls = data_transfer.copy_file_list([
            (PhysicalKey.from_path(path), PhysicalKey.from_url('s3://example/large_file.npy'), path.stat().st_size),
        ])
        assert urls[0] == PhysicalKey.from_url('s3://example/large_file.npy?versionId=v1')


    def test_upload_large_file_etag_match(self):
        path = DATA_DIR / 'large_file.npy'

        self.s3_stubber.add_response(
            method='head_object',
            service_response={
                'ContentLength': path.stat().st_size,
                'ETag': data_transfer._calculate_etag(path),
                'VersionId': 'v1',
            },
            expected_params={
                'Bucket': 'example',
                'Key': 'large_file.npy',
            }
        )

        urls = data_transfer.copy_file_list([
            (PhysicalKey.from_path(path), PhysicalKey.from_url('s3://example/large_file.npy'), path.stat().st_size),
        ])
        assert urls[0] == PhysicalKey.from_url('s3://example/large_file.npy?versionId=v1')


    def test_upload_large_file_etag_mismatch(self):
        path = DATA_DIR / 'large_file.npy'

        self.s3_stubber.add_response(
            method='head_object',
            service_response={
                'ContentLength': path.stat().st_size,
                'ETag': '"123"',
                'VersionId': 'v1',
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
            }
        )

        urls = data_transfer.copy_file_list([
            (PhysicalKey.from_path(path), PhysicalKey.from_url('s3://example/large_file.npy'), path.stat().st_size),
        ])
        assert urls[0] == PhysicalKey.from_url('s3://example/large_file.npy?versionId=v2')

    @pytest.mark.skip(reason="Broken due to S3ClientProvider")
    def test_multipart_upload(self):
        name = 'very_large_file.bin'
        path = pathlib.Path(name)

        size = 30 * 1024 * 1024
        chunksize = 8 * 1024 * 1024

        chunks = -(-size // chunksize)

        # Create an empty 30MB file; shouldn't take up any actual space on any reasonable filesystem.
        with open(path, 'wb') as fd:
            fd.seek(size - 1)
            fd.write(b'!')

        self.s3_stubber.add_client_error(
            method='head_object',
            http_status_code=404,
            expected_params={
                'Bucket': 'example',
                'Key': name,
            }
        )

        self.s3_stubber.add_response(
            method='create_multipart_upload',
            service_response={
                'UploadId': '123'
            },
            expected_params={
                'Bucket': 'example',
                'Key': name,
            }
        )

        for part_num in range(1, chunks+1):
            self.s3_stubber.add_response(
                method='upload_part',
                service_response={
                    'ETag': 'etag%d' % part_num
                },
                expected_params={
                    'Bucket': 'example',
                    'Key': name,
                    'UploadId': '123',
                    'Body': ANY,
                    'PartNumber': part_num
                }
            )

        self.s3_stubber.add_response(
            method='complete_multipart_upload',
            service_response={},
            expected_params={
                'Bucket': 'example',
                'Key': name,
                'UploadId': '123',
                'MultipartUpload': {
                    'Parts': [{
                        'ETag': 'etag%d' % i,
                        'PartNumber': i
                    } for i in range(1, chunks+1)]
                }
            }
        )

        with mock.patch('quilt3.data_transfer.s3_transfer_config.max_request_concurrency', 1):
            data_transfer.copy_file_list([
                (PhysicalKey.from_path(path), PhysicalKey.from_url(f's3://example/{name}'), path.stat().st_size),
            ])

    def test_multipart_copy(self):
        size = 100 * 1024 * 1024 * 1024

        # size / 8MB would give us 12501 chunks - but the maximum allowed is 10000,
        # so we should end with 16MB chunks instead.
        chunksize = 8 * 1024 * 1024
        assert size / chunksize > 10000
        chunksize *= 2

        chunks = -(-size // chunksize)
        assert chunks <= 10000

        self.s3_stubber.add_response(
            method='create_multipart_upload',
            service_response={
                'UploadId': '123'
            },
            expected_params={
                'Bucket': 'example2',
                'Key': 'large_file2.npy',
            }
        )

        for part_num in range(1, chunks+1):
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
                        (part_num-1) * chunksize,
                        min(part_num * chunksize, size) - 1
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
                    } for i in range(1, chunks+1)]
                }
            }
        )

        with mock.patch('quilt3.data_transfer.s3_transfer_config.max_request_concurrency', 1):
            stderr = io.StringIO()

            with redirect_stderr(stderr), mock.patch('quilt3.data_transfer.DISABLE_TQDM', False):
                data_transfer.copy_file_list([
                    (PhysicalKey.from_url('s3://example1/large_file1.npy'), PhysicalKey.from_url('s3://example2/large_file2.npy'), size),
                ])
            assert stderr.getvalue()

    def test_calculate_sha256_read_timeout(self):
        bucket = 'test-bucket'
        key = 'dir/a'
        vid = 'a1234'

        a_contents = b'a' * 10

        pk = PhysicalKey(bucket, key, vid)
        with mock.patch('botocore.client.BaseClient._make_api_call',
                        side_effect=ReadTimeoutError('Error Uploading', endpoint_url="s3://foobar")):
            results = data_transfer.calculate_sha256([pk], [len(a_contents)])
            assert list(results) == [None]

    def test_copy_file_list_retry(self):
        bucket = 'test-bucket'
        other_bucket = f'{bucket}-other'
        key = 'dir/a'
        vid = None

        src = PhysicalKey(bucket, key, vid)
        dst = PhysicalKey(other_bucket, key, vid)

        with mock.patch('botocore.client.BaseClient._make_api_call',
                        side_effect=ClientError({}, 'CopyObject')) as mocked_api_call:
            with pytest.raises(ClientError):
                data_transfer.copy_file_list([(src, dst, 1)])
            self.assertEqual(mocked_api_call.call_count, data_transfer.MAX_COPY_FILE_LIST_RETRIES)

    def test_copy_file_list_retry_non_client_error(self):
        """
        copy_file_list() is not retrying on random exceptions.
        """
        bucket = 'test-bucket'
        other_bucket = f'{bucket}-other'
        key = 'dir/a'
        vid = None

        src = PhysicalKey(bucket, key, vid)
        dst = PhysicalKey(other_bucket, key, vid)

        with mock.patch('botocore.client.BaseClient._make_api_call',
                        side_effect=Exception('test exception')) as mocked_api_call:
            with pytest.raises(Exception, match='test exception'):
                data_transfer.copy_file_list([(src, dst, 1)])
            assert mocked_api_call.call_count == 1

    def test_copy_file_list_multipart_retry(self):
        bucket = 'test-bucket'
        other_bucket = f'{bucket}-other'
        key = 'dir/a'
        vid = None

        src = PhysicalKey(bucket, key, vid)
        dst = PhysicalKey(other_bucket, key, vid)
        parts = 2 * data_transfer.s3_transfer_config.max_request_concurrency
        size = parts * data_transfer.s3_transfer_config.multipart_threshold

        def side_effect(operation_name, *args, **kwargs):
            if operation_name == 'CreateMultipartUpload':
                return {'UploadId': '123'}
            time.sleep(0.1)
            raise ClientError({}, 'CopyObject')

        with mock.patch('botocore.client.BaseClient._make_api_call', side_effect=side_effect):
            with pytest.raises(ClientError):
                data_transfer.copy_file_list([(src, dst, size)])
