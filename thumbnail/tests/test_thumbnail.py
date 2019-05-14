import base64
import json
import pathlib
from unittest import TestCase

import responses

from ..index import lambda_handler


BASE_DIR = pathlib.Path(__file__).parent / 'data'


# pylint: disable=invalid-sequence-index
class TestThumbnail(TestCase):
    """Tests image thumbnails"""

    @classmethod
    def _make_event(cls, query, headers=None):
        return {
            'httpMethod': 'POST',
            'path': '/foo',
            'queryStringParameters': query or None,
            'headers': headers or None,
            'body': None,
        }

    @responses.activate
    def test_thumbnail(self):
        url = 'https://example.com/penguin.jpg'
        image = BASE_DIR / 'penguin.jpg'
        thumbnail = BASE_DIR / 'penguin-256.jpg'

        responses.add(
            responses.GET,
            url,
            body=image.read_bytes(),
            status=200)

        event = self._make_event({'url': url, 'size': 'w256h256'})
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 200
        body = json.loads(resp['body'])

        info = body['info']
        assert info['original_format'] == 'JPEG'
        assert info['original_size'] == [1290, 1526]
        assert info['thumbnail_format'] == 'JPEG'
        assert info['thumbnail_size'] == [217, 256]

        thumbnail_bytes = base64.b64decode(body['thumbnail'])
        assert thumbnail_bytes == thumbnail.read_bytes()

    @responses.activate
    def test_invalid_size(self):
        url = 'https://example.com/foo.jpg'

        event = self._make_event({'url': url, 'size': 'w100h100'})
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 400
