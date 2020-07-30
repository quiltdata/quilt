import base64
from io import BytesIO
import json
import os
from pathlib import Path
from unittest.mock import patch

from PIL import Image
import numpy as np
import pytest
import responses
from aicsimageio import AICSImage

from t4_lambda_shared.utils import read_body

from ..index import lambda_handler, set_pdf_env


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
@pytest.mark.parametrize("input_file, params, expected_thumb, expected_original_size, expected_thumb_size", [
    ("penguin.jpg", {"size": "w256h256"}, "penguin-256.jpg", [1526, 1290, 3], [217, 256]),
    ("cell.tiff", {"size": "w640h480"}, "cell-480.png", [15, 1, 158, 100], [514, 480]),
    ("cell.png", {"size": "w64h64"}, "cell-64.png", [168, 104, 3], [39, 64]),
    ("sat_greyscale.tiff", {"size": "w640h480"}, "sat_greyscale-480.png", [512, 512], [480, 480]),
    ("generated.ome.tiff", {"size": "w256h256"}, "generated-256.png", [6, 36, 76, 68], [224, 167]),
    ("sat_rgb.tiff", {"size": "w256h256"}, "sat_rgb-256.png", [256, 256, 4], [256, 256]),
    ("single_cell.ome.tiff", {"size": "w256h256"}, "single_cell.png", [6, 40, 152, 126], [256, 205]),
    # Following PDF tests should only be run if poppler-utils installed;
    # then call pytest with --poppler
    pytest.param(
        "MUMmer.pdf",
        {"size": "w1024h768", "input": "pdf", "page": 4},
        "pdf-page4-1024w.jpeg", None, [1024, 1450],
        marks=pytest.mark.poppler
    ),
    pytest.param(
        "MUMmer.pdf",
        {"size": "w256h256", "input": "pdf", "page": 8},
        # pdf ignores the height dimension
        "pdf-page8-256w.jpeg", None, [256, 363],
        marks=pytest.mark.poppler
    ),
    # Test for statusCode error
    pytest.param("cell.png", {"size": "w1h1"}, None, None, None, marks=pytest.mark.xfail(raises=AssertionError))
])
def test_generate_thumbnail(
        data_dir,
        input_file,
        params,
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
    event = _make_event({"url": url, **params})
    # Get the response
    response = lambda_handler(event, None)
    # Assert the request was handled with no errors
    assert response["statusCode"] == 200
    # Parse the body / the returned thumbnail
    body = json.loads(read_body(response))
    # Assert basic metadata was filled properly
    if expected_original_size:  # PDFs don't have an expected size
        assert body["info"]["original_size"] == expected_original_size
    assert body["info"]["thumbnail_size"] == expected_thumb_size
    # Assert the produced image is the same as the expected
    if params.get('input') == 'pdf':
        actual = Image.open(BytesIO(base64.b64decode(body['thumbnail'])))
        expected = Image.open(data_dir / expected_thumb)
    else:
        actual = AICSImage(base64.b64decode(body['thumbnail'])).reader.data
        expected = AICSImage(data_dir / expected_thumb).reader.data
    assert np.array_equal(actual, expected)


@patch.dict(os.environ, {
    'LAMBDA_TASK_ROOT': str(Path('/var/task')),
    'PATH': str(Path('/one/two')) + os.pathsep + str(Path('/three')),
    'LD_LIBRARY_PATH': str(Path('/lib64')) + os.pathsep + str(Path('/usr/lib64'))
})
def test_pdf_env():
    """test that env vars are set so that poppler, pdf2image work properly"""
    set_pdf_env()
    assert os.environ.get('FONTCONFIG_PATH') == os.path.join(
        os.environ.get('LAMBDA_TASK_ROOT'),
        'quilt_binaries',
        'fonts'
    )
    assert os.environ.get('PATH') == os.pathsep.join([
        str(Path('/one/two')),
        str(Path('/three')),
        str(Path('/var/task/quilt_binaries/usr/bin'))
    ])
    assert os.environ.get('LD_LIBRARY_PATH') == os.pathsep.join([
        str(Path('/lib64')),
        str(Path('/usr/lib64')),
        str(Path('/var/task/quilt_binaries/usr/lib64'))
    ])
    # we should never mod this:
    assert os.environ.get('LAMBDA_TASK_ROOT') == str(Path('/var/task'))
