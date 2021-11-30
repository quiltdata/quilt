import json
from unittest.mock import patch

import pytest

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
    event = _make_event({"url": url, "format": "video/mp4"})

    # Get the response
    with patch.object(index, 'FFMPEG', '/bin/false'):
        response = index.lambda_handler(event, MockContext())

    assert response["statusCode"] == 403
    body = json.loads(response["body"])
    assert body['error'] == ''


@pytest.mark.parametrize(
    'params',
    [
        {"width": "foo"},
        {"width": "700"},
        {"width": "5"},
        {"height": "blah"},
        {"height": "500"},
        {"height": "5"},
        {"duration": "zzz"},
        {"duration": "20"},
        {"duration": "-1"},
        {"file_size": ""},
        {"file_size": "0"},
        {"file_size": "100000000"},
    ]
)
def test_bad_params(params):
    """test invalid input"""
    url = "https://example.com/folder/file.ext"
    event = _make_event({"url": url, "format": "video/mp4", **params})

    # Get the response
    with patch.object(index, 'FFMPEG', '/bin/false'):
        response = index.lambda_handler(event, MockContext())

    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert body['error']


@pytest.mark.parametrize(
    'format',
    [
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/ogg',
    ]
)
def test_format(format):
    url = "https://example.com/folder/file.ext"
    event = _make_event({"url": url, "format": format, "file_size": "10000"})

    # Get the response
    with patch.object(index, 'FFMPEG', '/bin/true'):
        response = index.lambda_handler(event, MockContext())

    assert response["statusCode"] == 200
    assert response["body"] == ''
