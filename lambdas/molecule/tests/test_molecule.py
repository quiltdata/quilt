import json
from unittest.mock import patch

import pytest
import responses

import t4_lambda_molecule

HEADER_403 = {
    "x-amz-request-id": "guid123",
    "x-amz-id-2": "some/dat/here/+xxxxx+=",
    "Content-Type": "application/xml",
    "Transfer-Encoding": "chunked",
    "Date": "Tue, 08 Sep 2020 00:01:06 GMT",
    "Server": "AmazonS3",
}


def _make_event(query, headers=None):
    return {
        "httpMethod": "POST",
        "path": "/foo",
        "pathParameters": {},
        "queryStringParameters": query or None,
        "headers": headers or None,
        "body": None,
        "isBase64Encoded": False,
    }


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
    with patch.object(t4_lambda_molecule, "OBABEL", "/bin/false"):
        response = t4_lambda_molecule.lambda_handler(event, None)

    assert response["statusCode"] == 403
    body = json.loads(response["body"])
    assert "text" in body
    assert "error" in body


@responses.activate
@pytest.mark.parametrize(
    "format_,expected_extension",
    [
        ("chemical/x-mdl-molfile", "mol")
    ],
)
def test_format(format_, expected_extension):
    filename_base = "file"
    url = f"https://example.com/folder/{filename_base}.ext"
    responses.add(
        responses.GET,
        url=url,
        status=200,
        body="",
    )
    event = _make_event({"url": url, "format": format_})

    # Get the response
    with patch.object(t4_lambda_molecule, "OBABEL", "/bin/true"):
        response = t4_lambda_molecule.lambda_handler(event, None)

    assert response["statusCode"] == 200
    assert response["body"] == ""
    assert response["headers"]["Content-Disposition"] == f'inline; filename="{filename_base}.{expected_extension}"'
