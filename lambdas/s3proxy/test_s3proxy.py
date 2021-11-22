from unittest import TestCase

import responses

from .index import lambda_handler


class TestS3Proxy(TestCase):
    """Tests S3 Select"""
    def setUp(self):
        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        self.requests_mock.start()

    def tearDown(self):
        self.requests_mock.stop()

    @classmethod
    def _make_event(cls, method, path, query, headers, body):
        return {
            'httpMethod': method,
            'path': f'/lambda/{path}',
            'pathParameters': {
                'proxy': path
            },
            'queryStringParameters': query or None,
            'headers': headers or None,
            'body': body,
            'isBase64Encoded': False,
        }

    def test_options(self):
        event = self._make_event('OPTIONS', '-/bucket/object.csv', None, None, None)
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 200
        assert resp['headers']['access-control-allow-origin'] == '*'

    def test_not_allowed(self):
        url = 'https://bucket.s3.amazonaws.com/object.csv'

        self.requests_mock.add(responses.GET, url, status=403)

        event = self._make_event('GET', '-/bucket/object.csv', None, None, None)
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 403
        assert resp['headers']['access-control-allow-origin'] == '*'

    def test_bad_request(self):
        event = self._make_event('GET', 'foo', None, None, None)
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 400
        assert resp['headers']['access-control-allow-origin'] == '*'

    def test_success(self):
        url = 'https://bucket.s3.us-west-1.amazonaws.com/weird%20%2B%20path?a=1&b=2'

        self.requests_mock.add(responses.GET, url)

        headers = {
            'access-control-request-headers': 'foo, bar',
            'access-control-request-method': 'GET',
        }

        event = self._make_event('GET', 'us-west-1/bucket/weird + path', {'a': '1', 'b': '2'}, headers, None)
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 200
        assert resp['headers']['access-control-allow-origin'] == '*'
        assert resp['headers']['access-control-allow-headers'] == 'foo, bar'
        assert resp['headers']['access-control-allow-methods'] == 'GET'
