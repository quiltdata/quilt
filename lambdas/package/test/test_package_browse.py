"""
Test functions for package endpoint
"""

from unittest import TestCase
from unittest.mock import patch

class TestPackageBrowse(TestCase)

    def setUp(self):
        """
        Mocks to tests calls to S3 Select
        """
        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        self.requests_mock.start()

        self.env_patcher = patch.dict(os.environ, {
            'AWS_ACCESS_KEY_ID': 'test_key',
            'AWS_SECRET_ACCESS_KEY': 'test_secret',
        })
        self.env_patcher.start()

    def tearDown(self):
        self.env_patcher.stop()
        self.requests_mock.stop()

    @classmethod
    def _make_event(cls, params, headers=None):
        return {
            'httpMethod': 'POST',
            'path': '/foo',
            'pathParameters': {},
            'queryStringParameters': params or None,
            'headers': headers or None,
            'body': None,
            'isBase64Encoded': False,
        }
    
    def test_call_s3select(self):
        pass

    def test_browse_no_prefix(self):
        pass

    def test_browse_prefix(self):
        pass

    def test_browse_bad_manifest(self):
        pass

        
