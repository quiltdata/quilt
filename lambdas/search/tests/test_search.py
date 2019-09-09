from base64 import b64decode
import json
import os
from unittest import TestCase
from unittest.mock import patch

import responses

from index import lambda_handler


class TestS3Select(TestCase):
    """Tests S3 Select"""
    def setUp(self):
        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        self.requests_mock.start()

        self.env_patcher = patch.dict(os.environ, {
            'AWS_ACCESS_KEY_ID': 'test_key',
            'AWS_SECRET_ACCESS_KEY': 'test_secret',
            'AWS_REGION': 'ng-north-1',
            'ES_HOST': 'www.example.com'
        })
        self.env_patcher.start()

    def tearDown(self):
        self.env_patcher.stop()
        self.requests_mock.stop()

    @classmethod
    def _make_event(cls, path, query):
        return {
            'httpMethod': 'GET',
            'path': f'/lambda/{path}',
            'pathParameters': {
                'proxy': path
            },
            'queryStringParameters': query or None,
            'headers': None,
            'body': None,
            'isBase64Encoded': False,
        }

    def test_search(self):
        url = 'https://www.example.com:443/bucket/_search?size=10'

        def _callback(request):
            payload = json.loads(request.body)
            assert payload == {'q': 123}
            return 200, {}, json.dumps({'results': 'blah'})

        self.requests_mock.add_callback(
            responses.GET,
            url,
            callback=_callback,
            content_type='application/json',
            match_querystring=True
        )

        query = {
            'source': {'q': 123},
            'size': '10',
        }

        event = self._make_event('bucket', query)
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 200
        assert json.loads(resp['body']) == {'results': 'blah'}
