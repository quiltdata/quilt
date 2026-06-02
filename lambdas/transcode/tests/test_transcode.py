import json
from unittest.mock import patch

import pytest

import t4_lambda_transcode

# A valid S3 virtual-host URL — the handler now rejects anything that isn't one
# (HTTPS + *.amazonaws.com host, no embedded credentials).
S3_URL = "https://my-bucket.s3.amazonaws.com/folder/file.ext"


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
    url = S3_URL
    event = _make_event({"url": url, "format": "video/mp4"})

    # Get the response
    with patch.object(t4_lambda_transcode, 'FFMPEG', '/bin/false'):
        response = t4_lambda_transcode.lambda_handler(event, MockContext())

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
        {"duration": "50"},
        {"duration": "-1"},
        {"file_size": ""},
        {"file_size": "0"},
        {"file_size": "100000000"},
    ],
)
def test_bad_params(params):
    """test invalid input"""
    url = S3_URL
    event = _make_event({"url": url, "format": "video/mp4", **params})

    # Get the response
    with patch.object(t4_lambda_transcode, 'FFMPEG', '/bin/false'):
        response = t4_lambda_transcode.lambda_handler(event, MockContext())

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
    ],
)
def test_format(format):
    url = S3_URL
    event = _make_event({"url": url, "format": format, "file_size": "10000"})

    # Get the response
    with patch.object(t4_lambda_transcode, 'FFMPEG', '/bin/true'):
        response = t4_lambda_transcode.lambda_handler(event, MockContext())

    assert response["statusCode"] == 200
    assert response["body"] == ''


@pytest.mark.parametrize(
    'url',
    [
        "https://example.com/folder/file.ext",  # non-S3 host
        "http://my-bucket.s3.amazonaws.com/file.ext",  # not HTTPS
        "https://user:pass@my-bucket.s3.amazonaws.com/file.ext",  # embedded creds
        "ftp://my-bucket.s3.amazonaws.com/file.ext",  # wrong scheme
    ],
)
def test_rejects_non_s3_url(url):
    """The handler refuses to transcode or redirect to non-S3 URLs (SSRF / open redirect)."""
    event = _make_event({"url": url, "format": "video/mp4"})

    # Reject before ffmpeg runs and regardless of whether ffmpeg is present.
    for ffmpeg in ('/bin/true', None):
        with patch.object(t4_lambda_transcode, 'FFMPEG', ffmpeg):
            response = t4_lambda_transcode.lambda_handler(event, MockContext())
        assert response["statusCode"] == 400
        assert json.loads(response["body"])['error']
