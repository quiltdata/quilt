"""
Unittest setup
"""
from unittest import TestCase

from botocore.stub import Stubber
import responses

from t4.data_transfer import s3_client


class QuiltTestCase(TestCase):
    """
    Base class for unittests.
    - Creates a test client
    - Mocks requests
    """
    def setUp(self):
        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        self.requests_mock.start()

        self.s3_stubber = Stubber(s3_client)
        self.s3_stubber.activate()

    def tearDown(self):
        self.s3_stubber.assert_no_pending_responses()
        self.s3_stubber.deactivate()
        self.requests_mock.stop()
