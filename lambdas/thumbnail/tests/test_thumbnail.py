import json
from contextlib import contextmanager
from io import BytesIO
from pathlib import Path

import numpy as np
import pytest
import responses
from aicsimageio import AICSImage
from PIL import Image

import t4_lambda_thumbnail
from t4_lambda_shared.decorator import QUILT_INFO_HEADER
from t4_lambda_shared.utils import read_body

HEADER_403 = {
    'x-amz-request-id': 'guid123',
    'x-amz-id-2': 'some/dat/here/+xxxxx+=',
    'Content-Type': 'application/xml',
    'Transfer-Encoding': 'chunked',
    'Date': 'Tue, 08 Sep 2020 00:01:06 GMT',
    'Server': 'AmazonS3'
}


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


@contextmanager
def _mock(target, attr, obj):
    """a simple mocking context manager"""
    orig_obj = getattr(target, attr)
    try:
        setattr(target, attr, obj)
        yield
    finally:
        setattr(target, attr, orig_obj)


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
    params = {
        "size": "w32h32"
    }
    event = _make_event({"url": url, **params})
    # Get the response
    response = t4_lambda_thumbnail.lambda_handler(event, None)
    assert response["statusCode"] == 403
    body = json.loads(response["body"])
    assert "text" in body
    assert "error" in body


@responses.activate
@pytest.mark.parametrize(
    "input_file, params, expected_thumb, expected_original_size, expected_thumb_size, num_pages, status",
    [
        # BUG: lambda doesn't preserve source format.
        ("I16-mode.tiff", {"size": "w128h128"}, "I16-mode-128-fallback.png", [650, 650], [128, 128], None, 200),
        ("I16-mode.tiff", {"size": "w128h128"}, "I16-mode-128.png", [650, 650], [128, 128], None, 200),
        ("penguin.jpg", {"size": "w256h256"}, "penguin-256.png", [1526, 1290, 3], [216, 256], None, 200),
        ("cell.tiff", {"size": "w640h480"}, "cell-480.png", [15, 1, 158, 100], [515, 480], None, 200),
        ("cell.png", {"size": "w64h64"}, "cell-64.png", [168, 104, 3], [40, 64], None, 200),
        ("sat_greyscale.tiff", {"size": "w640h480"}, "sat_greyscale-480.png", [512, 512], [480, 480], None, 200),
        ("generated.ome.tiff", {"size": "w256h256"}, "generated-256.png", [6, 36, 76, 68], [224, 167], None, 200),
        ("sat_rgb.tiff", {"size": "w256h256"}, "sat_rgb-256.png", [256, 256, 4], [256, 256], None, 200),
        ("single_cell.ome.tiff", {"size": "w256h256"}, "single_cell.png", [6, 40, 152, 126], [256, 205], None, 200),
        # Test for statusCode error
        pytest.param(
            "empty.png",
            {"size": "w32h32"},
            None, None, None, None, 500,
            marks=pytest.mark.xfail(raises=AssertionError)
        ),
        # Test known bad file
        pytest.param(
            "cell.png",
            {"size": "w1h1"},
            None, None, None, None, 400,
            marks=pytest.mark.xfail(raises=AssertionError)
        ),
        # The following PDF tests should only run if poppler-utils is installed;
        # then call `pytest --poppler` to execute
        pytest.param(
            "MUMmer.pdf",
            {"size": "w1024h768", "input": "pdf", "page": "4"},
            "pdf-page4-1024w.jpeg", None, [1024, 1450], None, 200,
            marks=pytest.mark.poppler
        ),
        pytest.param(
            "MUMmer.pdf",
            {"size": "w256h256", "input": "pdf", "page": "8"},
            "pdf-page8-256w.jpeg", None, [256, 363], None, 200,
            marks=pytest.mark.poppler
        ),
        pytest.param(
            "MUMmer.pdf",
            {"size": "w1024h768", "input": "pdf", "page": "4", "countPages": "true"},
            "pdf-page4-1024w.jpeg", None, [1024, 1450], 8, 200,
            marks=pytest.mark.poppler
        ),
        pytest.param(
            "pptx/in.pptx",
            {"size": "w1024h768", "input": "pptx", "page": "1", "countPages": "true"},
            "pptx/out-page1-1024w.jpeg", None, [1024, 1450], 2, 200,
            marks=(pytest.mark.poppler, pytest.mark.loffice),
        ),
        pytest.param(
            "pptx/in.pptx",
            {"size": "w1024h768", "input": "pptx", "page": "2", "countPages": "true"},
            "pptx/out-page2-1024w.jpeg", None, [1024, 1450], 2, 200,
            marks=(pytest.mark.poppler, pytest.mark.loffice),
        ),
    ]
)
def test_generate_thumbnail(
        data_dir,
        input_file,
        params,
        expected_thumb,
        expected_original_size,
        expected_thumb_size,
        num_pages,
        status
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
    event = _make_event({"url": url, **params})
    # Get the response
    if expected_thumb == "I16-mode-128-fallback.png":
        # Note that if this set of params fails, it may be that better resamplers
        # have been added for this mode, and either the image or test will need
        # to be updated.
        with _mock(t4_lambda_thumbnail, '_convert_I16_to_L', Image.fromarray):
            response = t4_lambda_thumbnail.lambda_handler(event, None)
    else:
        response = t4_lambda_thumbnail.lambda_handler(event, None)

    # Assert the request was handled with no errors
    assert response["statusCode"] == 200, f"response: {response}"
    # only check the body and expected image if it's a successful call
    # Parse the body / the returned thumbnail
    body = read_body(response)
    # Assert basic metadata was filled properly
    info = json.loads(response["headers"][QUILT_INFO_HEADER])
    assert info["thumbnail_size"] == expected_thumb_size
    if expected_original_size:  # PDFs don't have an expected size
        assert info["original_size"] == expected_original_size
    if "countPages" in params:
        assert info["page_count"] == num_pages
    # Assert the produced image is the same as the expected
    if params.get('input') in ('pdf', "pptx"):
        actual = Image.open(BytesIO(body))
        expected = Image.open(data_dir / expected_thumb)
        actual_array = np.array(actual)
        expected_array = np.array(expected)
        assert actual_array.shape == expected_array.shape
        assert np.allclose(expected_array, actual_array, atol=15, rtol=0.1)
    else:
        actual = AICSImage(body)
        expected = AICSImage(data_dir / expected_thumb)
        assert actual.size() == expected.size()
        assert np.array_equal(actual.reader.data, expected.reader.data)
