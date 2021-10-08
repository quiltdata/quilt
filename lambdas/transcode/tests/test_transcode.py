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


class MockContext:
    def get_remaining_time_in_millis(self):
        return 42


def test_403():
    """test 403 cases, such as Glacier"""
    url = "https://example.com/folder/file.ext"
    event = _make_event({"url": url})

    # Get the response
    with patch.object(index, 'FFMPEG', '/bin/false'):
        response = index.lambda_handler(event, MockContext())

    assert response["statusCode"] == 403
    body = json.loads(response["body"])
    assert body['error'] == ''


def test_bad_params():
    """test invalid input"""
    url = "https://example.com/folder/file.ext"
    width = "foo"
    event = _make_event({"url": url, "width": width})

    # Get the response
    with patch.object(index, 'FFMPEG', '/bin/false'):
        response = index.lambda_handler(event, MockContext())

    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert 'width' in body['error']


def test_success():
    url = "https://example.com/folder/file.ext"
    event = _make_event({"url": url})

    # Get the response
    with patch.object(index, 'FFMPEG', '/bin/true'):
        response = index.lambda_handler(event, MockContext())

    assert response["statusCode"] == 200
    assert response["body"] == ''
