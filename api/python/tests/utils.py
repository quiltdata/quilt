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
        assert any(d.name == 'pytest' for d in CONFIG_PATH.parents)

        quilt3.config(
            navigator_url='https://example.com',
            elastic_search_url='https://es.example.com/',
            default_local_registry=pathlib.Path('.').resolve().as_uri() + '/local_registry',
            default_remote_registry='s3://example/',
            default_install_location=None,
            registryUrl='https://registry.example.com'
        )

        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        self.requests_mock.start()

        # Create a dummy S3 client that (hopefully) can't do anything.
        self.s3_client = boto3.client('s3', config=Config(signature_version=UNSIGNED))

        self.s3_client_patcher = mock.patch('quilt3.data_transfer.create_s3_client', return_value=self.s3_client)
        self.s3_client_patcher.start()

        self.s3_stubber = Stubber(self.s3_client)
        self.s3_stubber.activate()

    def tearDown(self):
        self.s3_stubber.assert_no_pending_responses()
        self.s3_stubber.deactivate()
        self.s3_client_patcher.stop()
        self.requests_mock.stop()
