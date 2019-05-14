"""
Decorator tests
"""

from unittest import TestCase

from t4_lambda_shared.decorator import api, Request, validate

# pylint: disable=invalid-sequence-index
class TestDecorator(TestCase):
    """Tests for the @api and @validate decorators"""

    @classmethod
    def _make_get(cls, args, headers):
        return {
            'httpMethod': 'GET',
            'path': '/foo',
            'queryStringParameters': args or None,
            'headers': headers or None,
            'body': None,
        }

    @classmethod
    def _make_post(cls, body, headers):
        return {
            'httpMethod': 'POST',
            'path': '/foo',
            'queryStringParameters': None,
            'headers': headers or None,
            'body': body,
        }

    def test_api_get(self):
        """Test a GET request with a query string"""
        @api()
        def handler(request):
            assert request.method == 'GET'
            assert request.path == '/foo'
            assert request.args == {'foo': 'bar'}
            assert request.headers == {}
            assert request.data is None
            return 200, 'blah', {'Content-Type': 'text/plain'}

        resp = handler(self._make_get({'foo': 'bar'}, None), None)

        assert resp['statusCode'] == 200
        assert resp['isBase64Encoded'] is False
        assert resp['body'] == 'blah'
        assert resp['headers'] == {'Content-Type': 'text/plain'}

    def test_api_query_headers(self):
        """Test a POST request with headers and no query string"""
        @api()
        def handler(request):
            assert request.method == 'POST'
            assert request.path == '/foo'
            assert request.headers == {'content-length': '123'}
            assert request.args == {}
            assert request.data == 'hello'
            return 200, 'foo', {'Content-Type': 'text/plain'}

        resp = handler(self._make_post(
            'hello',
            {'content-length': '123'}
        ), None)

        assert resp['statusCode'] == 200
        assert resp['isBase64Encoded'] is False
        assert resp['body'] == 'foo'
        assert resp['headers'] == {'Content-Type': 'text/plain'}

    def test_api_binary_response(self):
        """Test a GET request that returns binary"""
        @api()
        def handler(request):
            data = b'\x04\xb0\x07'
            return 200, data, {'Content-Type': 'application/octet-stream'}

        resp = handler(self._make_get(None, None), None)

        assert resp['statusCode'] == 200
        assert resp['isBase64Encoded'] is True
        assert resp['body'] == 'BLAH'
        assert resp['headers'] == {'Content-Type': 'application/octet-stream'}

    def test_api_cors(self):
        """Test the CORS headers for different origins"""
        @api(cors_origins=['https://example.com'])
        def handler(request):
            return 200, 'foo', {'Content-Type': 'text/plain'}

        # Request with a correct origin.
        resp = handler(self._make_get(
            {'foo': 'bar'},
            {'origin': 'https://example.com'}
        ), None)

        assert resp['statusCode'] == 200
        assert resp['body'] == 'foo'
        assert resp['headers'] == {
            'Content-Type': 'text/plain',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'HEAD,GET,POST',
            'access-control-allow-headers': '*',
            'access-control-max-age': 86400
        }

        # Request with a bad origin.
        resp = handler(self._make_get(
            {'foo': 'bar'},
            {'origin': 'https://quiltdata.com'}
        ), None)

        assert resp['statusCode'] == 200
        assert resp['body'] == 'foo'
        assert resp['headers'] == {
            'Content-Type': 'text/plain',
        }

        # Request with no origin.
        resp = handler(self._make_get(
            {'foo': 'bar'},
            {}
        ), None)

        assert resp['statusCode'] == 200
        assert resp['body'] == 'foo'
        assert resp['headers'] == {
            'Content-Type': 'text/plain',
        }

    def test_api_exception(self):
        """Test that exceptions are converted into 500s"""
        @api(cors_origins=['https://example.com'])
        def handler(request):
            raise TypeError("Fail!")

        resp = handler(self._make_get(
            {'foo': 'bar'},
            {'origin': 'https://example.com'}
        ), None)

        assert resp['statusCode'] == 500
        assert resp['body'] == 'Fail!'
        assert resp['headers'] == {
            'Content-Type': 'text/plain',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'HEAD,GET,POST',
            'access-control-allow-headers': '*',
            'access-control-max-age': 86400
        }

    def test_validator(self):
        """Test errors from the schema validator"""
        schema = {
            'type': 'object',
            'properties': {
                'foo': {
                    'type': 'string'
                },
            },
            'required': ['foo'],
            'additionalProperties': False
        }

        @validate(schema)
        def handler(request):
            assert request.args == {'foo': 'bar'}
            assert request.headers == {}
            return 200, 'blah', {}

        code, body, headers = handler(Request(self._make_get({'foo': 'bar'}, None)))
        assert code == 200
        assert body == 'blah'
        assert headers == {}

        code, _, headers = handler(Request(self._make_get(None, None)))
        assert code == 400
        assert headers == {'Content-Type': 'text/plain'}

        code, _, headers = handler(Request(self._make_get({'foo': 'bar', 'x': 'y'}, None)))
        assert code == 400
        assert headers == {'Content-Type': 'text/plain'}
