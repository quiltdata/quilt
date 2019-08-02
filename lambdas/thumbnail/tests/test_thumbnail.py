import base64
import json
from pathlib import Path

import numpy as np
import pytest
import responses
from aicsimageio import imread

from ..index import lambda_handler


@pytest.fixture
def data_dir():
    return Path(__file__).parent / 'data'


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


@responses.activate
@pytest.mark.parametrize("input_file, thumb_size, expected_thumb, expected_original_size, expected_thumb_size", [
    ("penguin.jpg", "w256h256", "penguin-256.png", [1526, 1290, 3], [217, 256]),
    ("cell.tiff", "w640h480", "cell-480.png", [15, 1, 158, 100], [514, 480]),
    ("cell.png", "w64h64", "cell-64.png", [168, 104, 3], [39, 64]),
    ("sat_greyscale.tiff", "w640h480",  "sat_greyscale-480.png", [512, 512], [480, 480]),
    ("sat_rgb.tiff", "w1024h768", "sat_rgb-768.png", [2048, 2048, 3], [768, 768]),
    # Test for statusCode error
    pytest.param("cell.png", "w1h1", None, None, None, marks=pytest.mark.raises(exception=AssertionError))
])
def test_generate_thumbnail(
    data_dir,
    input_file,
    thumb_size,
    expected_thumb,
    expected_original_size,
    expected_thumb_size
):
    # Resolve the input file path
    input_file = data_dir / input_file

    # Mock the request
    url = f"https://example.com/{input_file}"
    responses.add(
        responses.GET,
        url=url,
        body=input_file.read_bytes(),
        status=200
    )

    # Create the lambda request event
    event = _make_event({"url": url, "size": thumb_size})

    # Get the response
    response = lambda_handler(event, None)

    # Assert the request was handled with no errors
    assert response["statusCode"] == 200

    # Parse the body / the returned thumbnail
    body = json.loads(response["body"])

    # Assert basic metadata was fill properly
    assert body["info"]["original_size"] == expected_original_size
    assert body["info"]["thumbnail_size"] == expected_thumb_size

    # Assert the produced image is the same as the expected
    actual = imread(base64.b64decode(body['thumbnail']))
    expected = imread(data_dir / expected_thumb)
    assert np.array_equal(actual, expected)
