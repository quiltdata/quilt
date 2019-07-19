from base64 import b64decode
import json
from unittest import TestCase
from unittest.mock import patch

from botocore.credentials import Credentials
import responses

from ..index import lambda_handler


@patch('index.credentials', Credentials('ACCESS-KEY', 'SECRET-KEY'))
@patch('index.REGION', 'us-east-1')
class TestS3Select(TestCase):
    """Tests S3 Select"""

    @classmethod
    def _make_event(cls, path, query, headers, body):
        return {
            'httpMethod': 'POST',
            'path': f'/lambda/{path}',
            'pathParameters': {
                'proxy': path
            },
            'queryStringParameters': query or None,
            'headers': headers or None,
            'body': body,
            'isBase64Encoded': False,
        }

    @responses.activate
    def test_signature(self):
        url = 'https://bucket.s3.amazonaws.com/object.csv'

        responses.add(
            responses.HEAD,
            url,
            status=200)

        def _callback(request):
            assert 'X-Amz-Date' in request.headers
            assert 'Authorization' in request.headers
            assert request.headers['content-type'] == 'application/octet-stream'
            assert request.headers['cache-control'] == 'no-cache'
            assert request.headers['pragma'] == 'no-cache'
            assert 'referer' not in request.headers
            return 200, {}, b'results'

        responses.add_callback(
            responses.POST,
            url,
            _callback)

        query = {
            'select': '',
            'select-type': '2',
        }
        headers = {
            'content-type': 'application/octet-stream',
            'x-amz-content-sha256': '123456',
            'x-amz-user-agent': 'test',
            'cache-control': 'no-cache',
            'pragma': 'no-cache',
            'referer': 'http://example.com'
        }
        body = b's3 select request body'

        event = self._make_event('bucket/object.csv', query, headers, body)
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 200
        assert resp['isBase64Encoded']
        assert b64decode(resp['body']) == b'results'

    @responses.activate
    def test_not_public(self):
        url = 'https://bucket.s3.amazonaws.com/object.csv'

        responses.add(
            responses.HEAD,
            url,
            status=403)

        event = self._make_event('bucket/object.csv', {'select': None}, {}, b'test')
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 403

    @responses.activate
    def test_bad_request(self):
        event = self._make_event('bucket/object.csv', {}, {}, b'test')
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 400

        event = self._make_event('bucket/object.csv', {'select': None}, {}, b'test')
        event['httpMethod'] = 'PUT'
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 400
