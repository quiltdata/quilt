"""
Unittest setup
"""
import pathlib
from unittest import mock, TestCase

import boto3
from botocore import UNSIGNED
from botocore.client import Config
from botocore.stub import Stubber
import responses

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

        # Create a dummy S3 client that (hopefully) can't do anything.
        boto_client = boto3.client('s3', config=Config(signature_version=UNSIGNED))
        self.s3_client = boto_client


        class DummyS3Provider:
            def __init__(self, *args, **kwargs):
                pass

            @property
            def standard_client(self):
                return boto_client

            def find_correct_client(self, *args, **kwargs):
                return boto_client


        self.s3_client_patcher = mock.patch('quilt3.data_transfer.S3ClientProvider', return_value=DummyS3Provider())
        self.s3_client_patcher.start()

        self.s3_stubber = Stubber(self.s3_client)
        self.s3_stubber.activate()

    def tearDown(self):
        self.s3_stubber.assert_no_pending_responses()
        self.s3_stubber.deactivate()
        self.s3_client_patcher.stop()
        self.requests_mock.stop()
