import json
from unittest.mock import patch

import pytest
import responses

from .. import index


HEADER_403 = {
    'x-amz-request-id': 'guid123',
    'x-amz-id-2': 'some/dat/here/+xxxxx+=',
    'Content-Type': 'application/xml',
    'Transfer-Encoding': 'chunked',
    'Date': 'Tue, 08 Sep 2020 00:01:06 GMT',
    'Server': 'AmazonS3'
}


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


@responses.activate
def test_403():
    """test 403 cases, such as Glacier"""
    url = "https://example.com/folder/file.ext"
    responses.add(
        responses.GET,
        url=url,
        status=403,
        headers=HEADER_403,
    )
    event = _make_event({"url": url, "format": "chemical/x-mdl-molfile"})

    # Get the response
    with patch.object(index, 'OBABEL', '/bin/false'):
        response = index.lambda_handler(event, MockContext())

    assert response["statusCode"] == 403
    body = json.loads(response["body"])
    assert "text" in body
    assert "error" in body

def test_bad_params():
    """test invalid input"""
    url = "https://example.com/folder/file.ext"
    responses.add(
        responses.GET,
        url=url,
        status=200,
        body="ab",
    )
    event = _make_event({"url": url, "format": "video/mp4"})

    # Get the response
    with patch.object(index, 'OBABEL', '/bin/false'):
        response = index.lambda_handler(event, MockContext())

    print("statusCode!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print(response["statusCode"])
    print("statusCode??????????????????????????")
    assert response["statusCode"] == 400
    # body = json.loads(response["body"])
    # body = response["body"]
    # print(body)
    # assert body["error"]


# @pytest.mark.parametrize(
#     'format',
#     [
#         'chemical/x-mdl-molfile',
#     ]
# )
# def test_format(format):
#     url = "https://example.com/folder/file.ext"
#     event = _make_event({"url": url, "format": format})

#     # Get the response
#     with patch.object(index, 'OBABEL', '/bin/true'):
#         response = index.lambda_handler(event, MockContext())

#     assert response["statusCode"] == 200
#     assert response["body"] == ''
