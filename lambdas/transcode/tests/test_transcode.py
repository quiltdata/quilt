import json
from unittest.mock import patch

from .. import index


def _make_event(query, headers=None):
    return {
        'httpMethod': 'POST',
        'path': '/foo',
        'pathParameters': {},
        'queryStringParameters': query or None,
        'headers': headers or None,
        'body': None,
        'isBase64Encoded': False,
    }


def test_403():
    """test 403 cases, such as Glacier"""
    url = "https://example.com/folder/file.ext"
    event = _make_event({"url": url})

    # Get the response
    with patch.object(index, 'FFMPEG', '/bin/false'):
        response = index.lambda_handler(event, None)

    assert response["statusCode"] == 403
    body = json.loads(response["body"])
    assert body['error'] == ''


def test_success():
    url = "https://example.com/folder/file.ext"
    event = _make_event({"url": url})

    # Get the response
    with patch.object(index, 'FFMPEG', '/bin/true'):
        response = index.lambda_handler(event, None)

    assert response["statusCode"] == 200
    assert response["body"] == ''
