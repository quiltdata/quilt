import json
import tempfile
import warnings
from contextlib import contextmanager
from io import BytesIO
from pathlib import Path

import bioio
import bioio_base
import bioio_czi
import numpy as np
import pytest
import responses
from bioio import BioImage
from PIL import Image

import quilt3
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
        # low-range uint16: pins the contrast stretch end-to-end
        ("I16-low-range.tiff", {"size": "w64h64"}, "I16-low-range-64.png", [64, 64], [64, 64], None, 200),
        # float greyscale and color: pin the float-to-uint8 rescale end-to-end
        ("float-grey.tiff", {"size": "w64h64"}, "float-grey-64.png", [64, 64], [64, 64], None, 200),
        ("float-rgb.tiff", {"size": "w64h64"}, "float-rgb-64.png", [64, 64, 3], [64, 64], None, 200),
        ("penguin.jpg", {"size": "w256h256"}, "penguin-256.png", [1526, 1290, 3], [216, 256], None, 200),
        ("cell.tiff", {"size": "w640h480"}, "cell-480.png", [15, 1, 158, 100], [515, 480], None, 200),
        ("cell.png", {"size": "w64h64"}, "cell-64.png", [168, 104, 3], [40, 64], None, 200),
        # .jpeg/.webp aren't in bioio-imageio's declared extensions and need
        # the forced-reader fallback in read_image(); .jpeg is plain JPEG,
        # so serve the existing fixture under a different name
        (("penguin.jpg", "penguin.jpeg"), {"size": "w256h256"}, "penguin-256.png", [1526, 1290, 3], [216, 256], None,
         200),
        # cell.webp is lossless-converted from cell.png, so the thumbnail is
        # identical to cell.png's
        ("cell.webp", {"size": "w64h64"}, "cell-64.png", [168, 104, 3], [40, 64], None, 200),
        ("sat_greyscale.tiff", {"size": "w640h480"}, "sat_greyscale-480.png", [512, 512], [480, 480], None, 200),
        ("generated.ome.tiff", {"size": "w256h256"}, "generated-256.png", [1, 6, 36, 76, 68], [224, 167], None, 200),
        ("sat_rgb.tiff", {"size": "w256h256"}, "sat_rgb-256.png", [256, 256, 4], [256, 256], None, 200),
        ("single_cell.ome.tiff", {"size": "w256h256"}, "single_cell.png", [1, 6, 40, 152, 126], [256, 205], None, 200),
        # Unreadable image -> 500
        ("empty.png", {"size": "w32h32"}, None, None, None, None, 500),
        # Unsupported size -> 400
        ("cell.png", {"size": "w1h1"}, None, None, None, None, 400),
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
    # input_file is either a file name or a (file name, URL name) pair when
    # the URL must present a different extension than the fixture's
    if isinstance(input_file, tuple):
        input_file, url_name = input_file
    else:
        url_name = input_file
    # Resolve the input file path
    input_file = data_dir / input_file
    # Mock the request
    url = f"https://example.com/{url_name}"
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

    assert response["statusCode"] == status, f"response: {response}"
    if status != 200:
        # Error bodies are plain-text messages produced by the @api/@validate
        # decorators, unlike the JSON shape checked in test_403.
        assert response["headers"]["Content-Type"] == "text/plain"
        assert read_body(response)
        return

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
        with tempfile.NamedTemporaryFile(suffix=".png") as f:
            f.write(body)
            f.flush()
            actual = BioImage(f.name)
            expected = BioImage(data_dir / expected_thumb)
            assert actual.dims.items() == expected.dims.items()
            assert np.array_equal(actual.reader.data, expected.reader.data)


def test_convert_I16_to_L_rescales_by_range():
    # Low-range data (e.g. 12-bit microscopy stored as uint16) must be
    # contrast-stretched, not truncated to a nearly black image.
    arr = np.array([[3000, 3500], [4000, 4096]], dtype=np.uint16)
    out = np.asarray(t4_lambda_thumbnail._convert_I16_to_L(arr))
    assert out.dtype == np.uint8
    assert np.array_equal(out, [[0, 116], [233, 255]])


def test_convert_I16_to_L_constant():
    # Constant images keep their brightness level instead of being rescaled.
    arr = np.full((4, 4), 1234, dtype=np.uint16)
    out = np.asarray(t4_lambda_thumbnail._convert_I16_to_L(arr))
    assert out.dtype == np.uint8
    assert (out == (1234 >> 8)).all()


def test_convert_I16_to_L_empty():
    arr = np.empty((0, 4), dtype=np.uint16)
    out = np.asarray(t4_lambda_thumbnail._convert_I16_to_L(arr))
    assert out.dtype == np.uint8
    assert out.size == 0


def test_convert_I16_to_L_no_uint8_wraparound():
    # A sub-grey-level percentile span near the top of the uint16 scale must
    # not overshoot 255 and wrap around in the uint8 cast, rendering the
    # brightest pixels dark. The outliers are spread so that the percentiles
    # interpolate fractionally instead of collapsing to the min/max fallback.
    arr = np.full((100, 100), 65000, dtype=np.uint16)
    arr[0, 0] = 64999
    arr[0, 1] = 65020
    out = np.asarray(t4_lambda_thumbnail._convert_I16_to_L(arr))
    assert out.max() == 255


def test_convert_I16_to_L_sparse():
    # Percentiles collapse when almost all pixels share one value; min/max
    # fallback keeps sparse data (e.g. label masks) visible.
    arr = np.zeros((200, 200), dtype=np.uint16)
    arr[0, :3] = 4000
    out = np.asarray(t4_lambda_thumbnail._convert_I16_to_L(arr))
    assert out.min() == 0
    assert out.max() == 255


def test_convert_I16_to_L_clips_outliers():
    # A single hot pixel must not compress the rest of the range to black.
    arr = np.linspace(3000, 4096, 10000, dtype=np.uint16).reshape(100, 100)
    arr[0, 0] = 65535
    out = np.asarray(t4_lambda_thumbnail._convert_I16_to_L(arr))
    assert out.min() == 0
    assert out.max() == 255
    assert np.median(out) > 100


def test_convert_I16_to_L_clips_dead_pixels():
    # A single dead pixel must not compress the rest of the range to white.
    arr = np.linspace(60000, 65535, 10000, dtype=np.uint16).reshape(100, 100)
    arr[0, 0] = 0
    out = np.asarray(t4_lambda_thumbnail._convert_I16_to_L(arr))
    assert out.min() == 0
    assert out.max() == 255
    assert np.median(out) < 155


@pytest.mark.parametrize(
    ("arr", "rescale"),
    [
        pytest.param(
            np.dstack([
                np.linspace(0, 2048, 16, dtype=np.uint16).reshape(4, 4),
                np.linspace(0, 4096, 16, dtype=np.uint16).reshape(4, 4),
                np.zeros((4, 4), dtype=np.uint16),
            ]),
            t4_lambda_thumbnail._rescale_uint16_to_uint8,
            id="uint16",
        ),
        pytest.param(
            np.dstack([
                np.linspace(0, 0.5, 16, dtype=np.float32).reshape(4, 4),
                np.linspace(0, 1.0, 16, dtype=np.float32).reshape(4, 4),
                np.zeros((4, 4), dtype=np.float32),
            ]),
            t4_lambda_thumbnail._rescale_float_to_uint8,
            id="float32",
        ),
    ],
)
def test_rescale_joint_channels(arr, rescale):
    # The range is shared across channels so relative intensities survive:
    # a half-range channel must map to mid-grey, not stretch to full range
    # on its own.
    out = rescale(arr)
    assert out[..., 0].max() == 128
    assert out[..., 1].max() == 255
    assert (out[..., 2] == 0).all()


def test_rescale_float_to_uint8():
    arr = np.array([[0.0, 0.25], [0.5, 1.0]], dtype=np.float16)
    out = t4_lambda_thumbnail._rescale_float_to_uint8(arr)
    assert out.dtype == np.uint8
    assert np.array_equal(out, [[0, 64], [128, 255]])


def test_rescale_float_to_uint8_nan():
    # NaNs are ignored for the range and render black.
    arr = np.array([[np.nan, 0.25], [0.5, 1.0]], dtype=np.float32)
    with warnings.catch_warnings():
        # NaN must be zeroed explicitly, not rely on the undefined (but
        # warning-emitting) NaN-to-uint8 cast happening to produce 0.
        warnings.simplefilter("error")
        out = t4_lambda_thumbnail._rescale_float_to_uint8(arr)
    assert np.array_equal(out, [[0, 0], [85, 255]])


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        # [0, 1]-convention constants keep their brightness level
        pytest.param(0.5, 128, id="in-01-convention"),
        # one output quantum of tolerance above 1.0: a nudged 1.0 stays white
        pytest.param(1.0000001, 255, id="nudged-above-one"),
        # constants outside the convention are kept as absolute levels
        pytest.param(100.0, 100, id="absolute-level"),
    ],
)
def test_rescale_float_to_uint8_constant(value, expected):
    arr = np.full((4, 4), value, dtype=np.float32)
    out = t4_lambda_thumbnail._rescale_float_to_uint8(arr)
    assert out.dtype == np.uint8
    assert (out == expected).all()


def test_rescale_float_to_uint8_inf():
    # ±inf are excluded from the range and saturate to its ends.
    arr = np.array([[np.inf, -np.inf], [np.nan, 0.0], [0.5, 1.0]], dtype=np.float32)
    out = t4_lambda_thumbnail._rescale_float_to_uint8(arr)
    assert np.array_equal(out, [[255, 0], [0, 0], [128, 255]])


def test_rescale_float_to_uint8_all_non_finite():
    arr = np.array([[np.inf, -np.inf], [np.nan, np.inf]], dtype=np.float32)
    out = t4_lambda_thumbnail._rescale_float_to_uint8(arr)
    assert out.dtype == np.uint8
    assert (out == 0).all()


def test_rescale_float_to_uint8_float64_precision():
    # High-offset low-contrast float64: sub-float32-ulp differences must
    # not collapse in the working copy.
    arr = np.linspace(1e6, 1e6 + 0.01, 256, dtype=np.float64).reshape(16, 16)
    out = t4_lambda_thumbnail._rescale_float_to_uint8(arr)
    assert out.min() == 0
    assert out.max() == 255
    assert len(np.unique(out)) >= 250


def test_rescale_float_to_uint8_sparse():
    # Percentiles collapse when almost all pixels share one value; min/max
    # fallback keeps sparse data (e.g. label masks) visible. The hot pixels
    # must stay below the 0.01% percentile window (here: <4 of 40000) so
    # the percentiles actually collapse instead of interpolating.
    arr = np.zeros((200, 200), dtype=np.float32)
    arr[0, :3] = 1.0
    out = t4_lambda_thumbnail._rescale_float_to_uint8(arr)
    assert (out[0, :3] == 255).all()
    assert out[1, 0] == 0


def test_rescale_float_to_uint8_clips_outlier_pixels():
    # A few hot/dead pixels must not compress the rest of the range: the
    # bulk must keep (nearly) all of its distinct levels, not collapse
    # into a few bins around the midpoint.
    arr = np.linspace(0, 1, 10000, dtype=np.float32).reshape(100, 100)
    arr[0, 0] = 100.0
    arr[0, 1] = -100.0
    out = t4_lambda_thumbnail._rescale_float_to_uint8(arr)
    assert out[0, 0] == 255
    assert out[0, 1] == 0
    assert len(np.unique(out)) > 200


def test_rescale_float_to_uint8_empty():
    out = t4_lambda_thumbnail._rescale_float_to_uint8(np.empty((0, 4), dtype=np.float32))
    assert out.dtype == np.uint8
    assert out.size == 0


@pytest.mark.parametrize(
    "arr",
    [
        pytest.param(np.linspace(0, 1, 48, dtype=np.float16).reshape(4, 4, 3), id="float16-rgb"),
        pytest.param(np.linspace(3000, 4096, 48, dtype=np.uint16).reshape(4, 4, 3), id="uint16-rgb"),
    ],
)
def test_generate_thumbnail_color_dtypes(arr):
    # Color arrays in dtypes PIL can't handle are contrast-stretched to uint8.
    img = t4_lambda_thumbnail.generate_thumbnail(arr, (4, 4))
    assert img.mode == "RGB"
    out = np.asarray(img)
    assert out.min() == 0
    assert out.max() == 255


@pytest.mark.parametrize(
    "arr",
    [
        pytest.param(
            np.dstack([
                np.linspace(0, 1000, 48, dtype=np.float32).reshape(4, 4, 3),
                np.ones((4, 4), dtype=np.float32),
            ]),
            id="float32-rgba",
        ),
        pytest.param(
            np.dstack([
                np.linspace(3000, 4096, 48, dtype=np.uint16).reshape(4, 4, 3),
                np.full((4, 4), 65535, dtype=np.uint16),
            ]),
            id="uint16-rgba",
        ),
    ],
)
def test_generate_thumbnail_rgba(arr):
    # Opaque alpha must stay opaque and must not skew the color channels'
    # contrast range.
    img = t4_lambda_thumbnail.generate_thumbnail(arr, (4, 4))
    assert img.mode == "RGBA"
    out = np.asarray(img)
    assert (out[..., 3] == 255).all()
    assert out[..., :3].min() == 0
    assert out[..., :3].max() == 255


def test_alpha_to_uint8_float():
    # Float alpha is scaled by the [0, 1] opacity convention; NaN renders
    # transparent, out-of-range values clamp.
    alpha = np.array([np.nan, -0.5, 0.0, 0.25, 1.0, 2.0], dtype=np.float32)
    out = t4_lambda_thumbnail._alpha_to_uint8(alpha)
    assert out.dtype == np.uint8
    assert np.array_equal(out, [0, 0, 0, 64, 255, 255])


def test_alpha_to_uint8_uint16():
    # uint16 alpha is scaled by the full dtype range — the values stay
    # below it so a contrast-stretch regression can't produce the same
    # output (it would map 32768 to 255).
    alpha = np.array([0, 256, 16384, 32768], dtype=np.uint16)
    out = t4_lambda_thumbnail._alpha_to_uint8(alpha)
    assert out.dtype == np.uint8
    assert np.array_equal(out, [0, 1, 64, 128])


def test_generate_thumbnail_float_greyscale_saves_png():
    # Float greyscale used to reach PIL as mode F, which can't be saved as PNG.
    arr = np.linspace(0, 1, 64, dtype=np.float32).reshape(8, 8)
    img = t4_lambda_thumbnail.generate_thumbnail(arr, (8, 8))
    assert img.mode == "L"
    img.save(BytesIO(), "PNG")


TEST_DATA_REGISTRY = "s3://quilt-test-public-data"
TIFF_PKG = "images/bioio-tifffile", "2ddbc5ef7accb6fe8f1ef1a38b727fab667f3f907bfb6dd557250345d9785910"
OME_TIFF_PKG = "images/bioio-ome-tiff", "6dbddd093e0a92cfc1cc5957ad7a7177ba98a0fee5d99ffaea58e30b7c46e182"
CZI_PKG = "images/pylibczirw", "552c9290ffa24738a578c494b7fc9f95cc03e3d12d701bc0bd944f5c1c558b2c"
THUMBS_PKG = "images/thumbs", "38e7c3406ef0828d6f9c12a7b9535f0b3425d6187a638a721ad8300043be62f8"
SIZE = (1024, 768)


@pytest.mark.parametrize(
    "pkg_ref, lk",
    [
        (TIFF_PKG, "image_stack_tpzc_50tp_2p_5z_3c_512k_1_MMStack_2-Pos000_000.ome.tif"),
        (TIFF_PKG, "image_stack_tpzc_50tp_2p_5z_3c_512k_1_MMStack_2-Pos001_000.ome.tif"),
        (TIFF_PKG, "s_1_t_10_c_3_z_1.tiff"),
        (TIFF_PKG, "s_1_t_1_c_10_z_1.ome.tiff"),
        (TIFF_PKG, "s_1_t_1_c_1_z_1.ome.tiff"),
        (TIFF_PKG, "s_1_t_1_c_1_z_1.tiff"),
        (TIFF_PKG, "s_1_t_1_c_1_z_1_RGB.tiff"),
        (TIFF_PKG, "s_1_t_1_c_2_z_1_RGB.tiff"),
        # float16 RGB photo (values in [0, 1]), from tlnagy/exampletiffs
        (TIFF_PKG, "spring.tif"),
        (TIFF_PKG, "s_3_t_1_c_3_z_5.ome.tiff"),
        (OME_TIFF_PKG, "3d-cell-viewer.ome.tiff"),
        (OME_TIFF_PKG, "actk.ome.tiff"),
        # (OME_TIFF_PKG, "image_stack_tpzc_50tp_2p_5z_3c_512k_1_MMStack_2-Pos000_000.ome.tif"),  # duplicate
        # (OME_TIFF_PKG, "image_stack_tpzc_50tp_2p_5z_3c_512k_1_MMStack_2-Pos001_000.ome.tif"),  # duplicate
        (OME_TIFF_PKG, "pipeline-4.ome.tiff"),
        (OME_TIFF_PKG, "pre-variance-cfe.ome.tiff"),
        # (OME_TIFF_PKG, "s_1_t_1_c_10_z_1.ome.tiff"),  # duplicate
        # (OME_TIFF_PKG, "s_1_t_1_c_1_z_1.ome.tiff"),  # duplicate
        # Traceback (most recent call last):
        #   File "<ipython-input-41-93392373085b>", line 5, in <module>
        #     _info, data = handle_image(src=e.get_bytes(), size=(1024, 768), thumbnail_format='PNG')
        #   File "src/t4_lambda_thumbnail/__init__.py", line 328, in handle_image
        #     img = BioImage(src)
        #   File "venv/lib/python3.9/site-packages/bioio/aics_image.py", line 116, in __init__
        #     reader_class = self.determine_reader(data)
        #   File "venv/lib/python3.9/site-packages/bioio/aics_image.py", line 138, in determine_reader
        #     raise UnsupportedFileFormatError(type(data))
        # bioio.exceptions.UnsupportedFileFormatError: BioImage module does not support this image file type: '<class 'bytes'>'
        pytest.param(
            OME_TIFF_PKG,
            "s_1_t_1_c_2_z_1.lif",
            marks=pytest.mark.xfail(raises=bioio_base.exceptions.UnsupportedFileFormatError),
        ),
        # (OME_TIFF_PKG, "s_1_t_1_c_2_z_1_RGB.tiff"),  # duplicate
        # (OME_TIFF_PKG, "s_3_t_1_c_3_z_5.ome.tiff"),  # duplicate
        (OME_TIFF_PKG, "variable_scene_shape_first_scene_pyramid.ome.tiff"),
        (OME_TIFF_PKG, "variance-cfe.ome.tiff"),
        #   File "site-packages/bioio_base/reader.py", line 613, in dims
        #     self._dims = Dimensions(dims=self.xarray_dask_data.dims, shape=self.shape)
        #                                  ^^^^^^^^^^^^^^^^^^^^^
        #   File "site-packages/bioio_base/reader.py", line 440, in xarray_dask_data
        #     self._xarray_dask_data = self._read_delayed()
        #                              ~~~~~~~~~~~~~~~~~~^^
        #   File "site-packages/bioio_czi/reader.py", line 195, in _read_delayed
        #     return self._implementation._read_delayed()
        #            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^
        #   File "site-packages/bioio_czi/pylibczirw_reader/reader.py", line 277, in _read_delayed
        #     coords = self._get_coords(self.metadata, self._current_scene_index, dim_bounds)
        #   File "site-packages/bioio_czi/pylibczirw_reader/reader.py", line 183, in _get_coords
        #     for dim_name, scale in self.physical_pixel_sizes._asdict().items():
        #                            ^^^^^^^^^^^^^^^^^^^^^^^^^
        #   File "site-packages/bioio_czi/pylibczirw_reader/reader.py", line 429, in physical_pixel_sizes
        #     return get_physical_pixel_sizes(self.metadata)
        #   File "site-packages/bioio_czi/pixel_sizes.py", line 15, in get_physical_pixel_sizes
        #     Y=_single_physical_pixel_size(metadata, "Y"),
        #       ~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
        #   File "site-packages/bioio_czi/pixel_sizes.py", line 31, in _single_physical_pixel_size
        #     raise UnsupportedMetadataError(
        #     ...<2 lines>...
        #     )
        # bioio_czi.metadata.UnsupportedMetadataError: Expected 1 distance scale for dimension 'Y' but found 0.
        pytest.param(
            CZI_PKG,
            "c1_bgr24.czi",
            marks=pytest.mark.xfail(raises=bioio_czi.metadata.UnsupportedMetadataError),
        ),
        #   File "site-packages/bioio_base/reader.py", line 613, in dims
        #     self._dims = Dimensions(dims=self.xarray_dask_data.dims, shape=self.shape)
        #                                  ^^^^^^^^^^^^^^^^^^^^^
        #   File "site-packages/bioio_base/reader.py", line 440, in xarray_dask_data
        #     self._xarray_dask_data = self._read_delayed()
        #                              ~~~~~~~~~~~~~~~~~~^^
        #   File "site-packages/bioio_czi/reader.py", line 195, in _read_delayed
        #     return self._implementation._read_delayed()
        #            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^
        #   File "site-packages/bioio_czi/pylibczirw_reader/reader.py", line 319, in _read_delayed
        #     return xr.DataArray(
        #            ~~~~~~~~~~~~^
        #         data=da.block(lazy_arrays.tolist()),
        #         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        #     ...<2 lines>...
        #         attrs={constants.METADATA_UNPROCESSED: self.metadata},
        #         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        #     )
        #     ^
        #   File "site-packages/xarray/core/dataarray.py", line 461, in __init__
        #     coords, dims = _infer_coords_and_dims(data.shape, coords, dims)
        #                    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
        #   File "site-packages/xarray/core/dataarray.py", line 166, in _infer_coords_and_dims
        #     raise ValueError(
        #     ...<2 lines>...
        #     )
        # ValueError: different number of dimensions on data and dims: 3 vs 4
        pytest.param(CZI_PKG, "c1_bgr48.czi", marks=pytest.mark.xfail(raises=ValueError)),
        # RuntimeError: Sorry, this pixeltype isn't implemented yet.
        pytest.param(CZI_PKG, "c1_bgr96float.czi", marks=pytest.mark.xfail(raises=(RuntimeError, ValueError))),
        (CZI_PKG, "c1_gray16.czi"),
        (CZI_PKG, "c1_gray32float.czi"),
        (CZI_PKG, "c1_gray8.czi"),
        (CZI_PKG, "c1_gray8_s2_non_overlapping_bounding_boxes.czi"),
        (CZI_PKG, "c1_gray8_s2_overlapping_bounding_boxes.czi"),
        (CZI_PKG, "c2_gray8_gray16.czi"),
        (CZI_PKG, "c2_gray8_t3_z5_s2.czi"),
        #   File "site-packages/bioio_base/reader.py", line 613, in dims
        #     self._dims = Dimensions(dims=self.xarray_dask_data.dims, shape=self.shape)
        #                                  ^^^^^^^^^^^^^^^^^^^^^
        #   File "site-packages/bioio_base/reader.py", line 440, in xarray_dask_data
        #     self._xarray_dask_data = self._read_delayed()
        #                              ~~~~~~~~~~~~~~~~~~^^
        #   File "site-packages/bioio_czi/reader.py", line 195, in _read_delayed
        #     return self._implementation._read_delayed()
        #            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^
        #   File "site-packages/bioio_czi/pylibczirw_reader/reader.py", line 319, in _read_delayed
        #     return xr.DataArray(
        #            ~~~~~~~~~~~~^
        #         data=da.block(lazy_arrays.tolist()),
        #         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        #     ...<2 lines>...
        #         attrs={constants.METADATA_UNPROCESSED: self.metadata},
        #         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        #     )
        #     ^
        #   File "site-packages/xarray/core/dataarray.py", line 461, in __init__
        #     coords, dims = _infer_coords_and_dims(data.shape, coords, dims)
        #                    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
        #   File "site-packages/xarray/core/dataarray.py", line 166, in _infer_coords_and_dims
        #     raise ValueError(
        #     ...<2 lines>...
        #     )
        # ValueError: different number of dimensions on data and dims: 4 vs 5
        pytest.param(CZI_PKG, "rgb-image.czi", marks=pytest.mark.xfail(raises=ValueError)),
    ],
)
def test_handle_image(pytestconfig, pkg_ref, lk):
    pkg_name, top_hash = pkg_ref
    quilt3.Package.install(
        pkg_name,
        registry=TEST_DATA_REGISTRY,
        top_hash=top_hash,
        path=lk,
    )
    src_pkg = quilt3.Package.browse(
        pkg_name,
        registry=TEST_DATA_REGISTRY,
        top_hash=top_hash,
    )
    src_entry = src_pkg[lk]
    if not pytestconfig.getoption("large_files") and src_entry.size > 20 * 1024 * 1024:
        pytest.skip("Skipping large file test; use --large-files to enable")

    print(f"Testing {pkg_name}/{lk}...")
    _info, data = t4_lambda_thumbnail.handle_image(path=src_entry.get_cached_path(), size=SIZE, thumbnail_format="PNG")

    thumb_lk = f"{pkg_name}/{lk}.png"
    quilt3.Package.install(
        THUMBS_PKG[0],
        registry=TEST_DATA_REGISTRY,
        top_hash=THUMBS_PKG[1],
        path=thumb_lk,
    )
    thumbs_pkg = quilt3.Package.browse(
        THUMBS_PKG[0],
        registry=TEST_DATA_REGISTRY,
        top_hash=THUMBS_PKG[1],
    )
    with tempfile.NamedTemporaryFile(suffix=".png") as actual_f:
        actual_f.write(data)
        actual_f.flush()
        actual = BioImage(actual_f.name)
        expected = BioImage(thumbs_pkg[thumb_lk].get_cached_path())

        assert actual.dims.items() == expected.dims.items()
        np.testing.assert_equal(actual.reader.data, expected.reader.data)


def test_http():
    """
    Smoke test for image with HTTP URL.
    """
    url = (
        "https://quilt-test-public-data.s3.us-east-1.amazonaws.com/"
        "images/thumbs/images/bioio-tifffile/s_1_t_1_c_10_z_1.ome.tiff.png"
    )
    resp = t4_lambda_thumbnail.lambda_handler(_make_event({"url": url, "size": "w256h256"}), None)
    assert resp["statusCode"] == 200
