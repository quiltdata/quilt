"""
Unittest setup
"""
from unittest import mock, TestCase

import boto3
from botocore import UNSIGNED
from botocore.client import Config
from botocore.stub import Stubber
import responses


class QuiltTestCase(TestCase):
    """
    Base class for unittests.
    - Creates a test client
    - Mocks requests
    """
    def setUp(self):
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
