"""
Unittest setup
"""
import contextlib
import io
import pathlib
import time
from unittest import TestCase, mock

import boto3
import responses
from botocore import UNSIGNED
from botocore.client import Config
from botocore.response import StreamingBody
from botocore.stub import Stubber

import quilt3
from quilt3.util import CONFIG_PATH


class QuiltTestCase(TestCase):
    """
    Base class for unittests.
    - Creates a mock config
    - Creates a test client
    - Mocks requests
    """
    def setUp(self):
        # Verify that CONFIG_PATH is in the test dir (patched by conftest.py).
        assert 'pytest' in str(CONFIG_PATH)

        quilt3.config(
            navigator_url='https://example.com',
            apiGatewayEndpoint='https://xyz.execute-api.us-east-1.amazonaws.com/prod',
            binaryApiGatewayEndpoint='https://xyz.execute-api.us-east-1.amazonaws.com/prod',
            default_local_registry=pathlib.Path('.').resolve().as_uri() + '/local_registry',
            default_remote_registry='s3://example/',
            default_install_location=None,
            defaultBucket='test-bucket',
            registryUrl='https://registry.example.com',
            s3Proxy='open-s3-proxy.quiltdata.com'
        )

        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        self.requests_mock.start()
        self.addCleanup(self.requests_mock.stop)

        # Create a dummy S3 client that (hopefully) can't do anything.
        boto_client = boto3.client('s3', config=Config(signature_version=UNSIGNED))
        self.s3_client = boto_client

        self.s3_client_patcher = mock.patch.multiple(
            'quilt3.data_transfer.S3ClientProvider',
            standard_client=boto_client,
            find_correct_client=lambda *args, **kwargs: boto_client,
        )
        self.s3_client_patcher.start()
        self.addCleanup(self.s3_client_patcher.stop)

        self.s3_stubber = Stubber(self.s3_client)
        self.s3_stubber.activate()
        self.addCleanup(self.s3_stubber.deactivate)

    def tearDown(self):
        self.s3_stubber.assert_no_pending_responses()

    def s3_streaming_body(self, data):
        return StreamingBody(io.BytesIO(data), len(data))

    @contextlib.contextmanager
    def s3_test_multi_thread_download(self, bucket, key, data, *, threshold, chunksize):
        """
        Helper for testing multi-thread download of a single file.

        data is either a bytes object if a single-request download is expected,
        or a mapping like this:
        {
            'bytes=0-4': b'part1',
            'bytes=5-9': b'part2',
            ...
        }
        """
        is_single_request = isinstance(data, bytes)
        num_parts = 1 if is_single_request else len(data)
        expected_params = {
            'Bucket': bucket,
            'Key': key,
        }

        def side_effect(*args, **kwargs):
            body = self.s3_streaming_body(data if is_single_request else data[kwargs['Range']])
            if not is_single_request:
                # This ensures that we have concurrent calls to get_object().
                time.sleep(0.1 * (1 - list(data).index(kwargs['Range']) / len(data)))
            return {
                'VersionId': 'v1',
                'Body': body,
            }

        with mock.patch('quilt3.data_transfer.s3_transfer_config.multipart_threshold', threshold), \
             mock.patch('quilt3.data_transfer.s3_transfer_config.multipart_chunksize', chunksize), \
             mock.patch.object(self.s3_client, 'get_object', side_effect=side_effect) as get_object_mock:
            yield

            if is_single_request:
                get_object_mock.assert_called_once_with(**expected_params)
            else:
                assert get_object_mock.call_count == num_parts
                get_object_mock.assert_has_calls([
                    mock.call(**expected_params, Range=r)
                    for r in data
                ], any_order=True)
