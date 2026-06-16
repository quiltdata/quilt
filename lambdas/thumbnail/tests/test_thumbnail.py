import json
import tempfile
import warnings
from io import BytesIO
from pathlib import Path

import bioio
import bioio_base
import bioio_czi
import bioio_imageio
import dask.array as da
import numpy as np
import pytest
import responses
import tifffile
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


@pytest.mark.parametrize(
    "src_file, name",
    [
        ("penguin.jpg", "penguin.jpeg"),
        ("cell.webp", "cell.webp"),
    ],
)
def test_read_image_fallback(data_dir, tmp_path, src_file, name):
    """Pin the mechanism behind the .jpeg/.webp cases in
    test_generate_thumbnail: default reader selection must fail for these
    names (the extensions aren't declared by bioio-imageio), and read_image()
    must recover via the forced reader. If the first assertion starts failing,
    bioio-imageio has declared the extension and the fallback no longer guards
    these formats.
    """
    path = tmp_path / name
    path.symlink_to(data_dir / src_file)
    with pytest.raises(bioio_base.exceptions.UnsupportedFileFormatError):
        BioImage(path)
    img = t4_lambda_thumbnail.read_image(str(path))
    assert isinstance(img.reader, bioio_imageio.Reader)


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
        # BUG: lambda doesn't preserve source format. This I;16 input also
        # exercises the _rescale_uint16_to_uint8 contrast-stretch end-to-end.
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
        # Content pin for the normalized montage path through decode: a 3-channel
        # float OME-TIFF with a constant (blank) channel and a NaN patch. Catches
        # a bioio/tifffile NaN-mangling regression that the warning-only
        # end-to-end test would miss. See the fixture's regen recipe in
        # test_handle_image_blank_and_nan_channels_through_public_path.
        ("blank-and-nan-channels.ome.tiff", {"size": "w256h256"}, "blank-and-nan-channels-256.png",
         [1, 3, 1, 64, 64], [212, 74], None, 200),
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


# The three non-CZI color reader paths, each with an independent decoder; keep in
# sync with test_generate_thumbnail's color rows.
_COLOR_ORACLE_FIXTURES = [
    ("penguin.jpg", lambda p: np.asarray(Image.open(p).convert("RGB"))),    # bioio-imageio 8-bit RGB
    ("sat_rgb.tiff", lambda p: tifffile.imread(p)[..., :3]),                # bioio-tifffile 8-bit RGBA
    ("float-rgb.tiff", lambda p: tifffile.imread(p).astype(np.float64)),    # bioio-tifffile float16
]


def _coarse_means(rgb, grid=12):
    # Reduce an image to grid×grid×C block means (np.mean → float64, no full-image
    # upcast), coarse enough to survive the thumbnail's resize/stretch.
    rgb = np.asarray(rgb)
    assert rgb.ndim == 3 and min(rgb.shape[:2]) >= grid, f"expected an H×W×C image, H,W >= {grid}; got {rgb.shape}"
    h, w, c = rgb.shape
    ys = np.linspace(0, h, grid + 1, dtype=int)
    xs = np.linspace(0, w, grid + 1, dtype=int)
    return np.array([[rgb[ys[i]:ys[i + 1], xs[j]:xs[j + 1]].reshape(-1, c).mean(0)
                      for j in range(grid)] for i in range(grid)])


@pytest.mark.parametrize(
    "fixture, decode", _COLOR_ORACLE_FIXTURES, ids=[f for f, _ in _COLOR_ORACLE_FIXTURES]
)
def test_handle_image_color_channel_order(data_dir, fixture, decode):
    # Independent channel-order oracle for the non-CZI color path. The byte goldens
    # in test_generate_thumbnail are self-generated, so a swap "fixed" by
    # regenerating them is enshrined silently — how the BGR R/B swap nearly shipped
    # (CZI sibling: test_handle_image_bgr_czi_channel_order). Checking regional
    # R-vs-B lean against an independent decode can't be faked that way. Only R/B
    # (the axis BGR reverses) is checked; for the TIFFs tifffile is shared with
    # bioio-tifffile, so there it guards the lambda's handling, not the decode.
    ref = decode(data_dir / fixture)
    _info, png = t4_lambda_thumbnail.handle_image(
        path=str(data_dir / fixture), size=(256, 256), thumbnail_format="PNG")
    out = np.asarray(Image.open(BytesIO(png)).convert("RGB"), np.float64)

    cr, co = _coarse_means(ref), _coarse_means(out)
    # On clearly red/blue-leaning blocks the thumbnail must lean the same way; an
    # R/B swap flips every sign -> ~0 agreement.
    rb_ref, rb_out = cr[..., 0] - cr[..., 2], co[..., 0] - co[..., 2]
    colored = np.abs(rb_ref) > 0.05 * (cr.max() - cr.min())
    assert colored.sum() >= 5, f"{fixture}: too few colored blocks to test ({colored.sum()})"
    agree = (np.sign(rb_ref[colored]) == np.sign(rb_out[colored])).mean()
    assert agree > 0.9, f"{fixture}: R/B channel order agreement only {agree * 100:.0f}%"


def test_rescale_uint16_to_uint8_rescales_by_range():
    # Low-range data (e.g. 12-bit microscopy stored as uint16) must be
    # contrast-stretched, not truncated to a nearly black image.
    arr = np.array([[3000, 3500], [4000, 4096]], dtype=np.uint16)
    out = t4_lambda_thumbnail._rescale_uint16_to_uint8(arr)
    assert out.dtype == np.uint8
    assert np.array_equal(out, [[0, 116], [233, 255]])


def test_rescale_uint16_to_uint8_constant():
    # Constant images keep their brightness level instead of being rescaled.
    arr = np.full((4, 4), 1234, dtype=np.uint16)
    out = t4_lambda_thumbnail._rescale_uint16_to_uint8(arr)
    assert out.dtype == np.uint8
    assert (out == (1234 >> 8)).all()


def test_rescale_uint16_to_uint8_empty():
    arr = np.empty((0, 4), dtype=np.uint16)
    out = t4_lambda_thumbnail._rescale_uint16_to_uint8(arr)
    assert out.dtype == np.uint8
    assert out.size == 0


def test_rescale_uint16_to_uint8_no_uint8_wraparound():
    # A sub-grey-level percentile span near the top of the uint16 scale must
    # not overshoot 255 and wrap around in the uint8 cast, rendering the
    # brightest pixels dark. The outliers are spread so that the percentiles
    # interpolate fractionally instead of collapsing to the min/max fallback.
    arr = np.full((100, 100), 65000, dtype=np.uint16)
    arr[0, 0] = 64999
    arr[0, 1] = 65020
    out = t4_lambda_thumbnail._rescale_uint16_to_uint8(arr)
    assert out.max() == 255


def test_rescale_uint16_to_uint8_sparse():
    # Percentiles collapse when almost all pixels share one value; min/max
    # fallback keeps sparse data (e.g. label masks) visible.
    arr = np.zeros((200, 200), dtype=np.uint16)
    arr[0, :3] = 4000
    out = t4_lambda_thumbnail._rescale_uint16_to_uint8(arr)
    assert out.min() == 0
    assert out.max() == 255


def test_rescale_uint16_to_uint8_clips_outliers():
    # A single hot pixel must not compress the rest of the range to black.
    arr = np.linspace(3000, 4096, 10000, dtype=np.uint16).reshape(100, 100)
    arr[0, 0] = 65535
    out = t4_lambda_thumbnail._rescale_uint16_to_uint8(arr)
    assert out.min() == 0
    assert out.max() == 255
    assert np.median(out) > 100


def test_rescale_uint16_to_uint8_clips_dead_pixels():
    # A single dead pixel must not compress the rest of the range to white.
    arr = np.linspace(60000, 65535, 10000, dtype=np.uint16).reshape(100, 100)
    arr[0, 0] = 0
    out = t4_lambda_thumbnail._rescale_uint16_to_uint8(arr)
    assert out.min() == 0
    assert out.max() == 255
    assert np.median(out) < 155


@pytest.mark.parametrize(
    "arr",
    [
        np.random.default_rng(0).integers(0, 4096, (200, 200), dtype=np.uint16),
        np.random.default_rng(1).integers(0, 65536, (150, 150), dtype=np.uint16),
        np.random.default_rng(2).integers(100, 400, (64, 64), dtype=np.uint16),
        # skewed / fractional-percentile distribution
        (np.random.default_rng(3).power(0.3, (180, 180)) * 65535).astype(np.uint16),
        # color array: percentiles are pooled across channels
        np.random.default_rng(4).integers(0, 4096, (40, 40, 3), dtype=np.uint16),
    ],
)
def test_percentile_uint16_matches_numpy(arr):
    # The histogram percentile must track np.percentile's default "linear"
    # method — that equivalence is what keeps _rescale output (and the
    # checked-in thumbnails) unchanged. Tolerance, not exact equality: numpy's
    # _lerp is asymmetric for fraction >= 0.5, which the helper doesn't
    # replicate; the gap is sub-ULP and vanishes in the uint8 rescale.
    expected = list(np.percentile(arr, (0.01, 99.99)))
    actual = t4_lambda_thumbnail._percentile_uint16(arr, (0.01, 99.99))
    assert np.allclose(actual, expected, rtol=0, atol=1e-9)


@pytest.mark.parametrize(
    "arr",
    [
        np.random.default_rng(5).integers(0, 65536, (100, 100), dtype=np.uint16),
        # non-contiguous color slice (the generate_thumbnail RGBA path)
        np.random.default_rng(6).integers(0, 4096, (60, 60, 4), dtype=np.uint16)[..., :3],
        # degenerate aspect ratios: flat-iterator chunking handles a single
        # wide row / column the same as a balanced image
        np.random.default_rng(7).integers(0, 65536, (1, 5000), dtype=np.uint16),
        np.random.default_rng(8).integers(0, 65536, (5000, 1), dtype=np.uint16),
    ],
)
def test_percentile_uint16_multi_block(monkeypatch, arr):
    # The per-block accumulation only runs once for the small arrays above
    # unless the block is shrunk; force many blocks so the cross-block sum
    # is actually exercised.
    monkeypatch.setattr(t4_lambda_thumbnail, "_HIST_BLOCK", 256)
    expected = list(np.percentile(arr, (0.01, 99.99)))
    actual = t4_lambda_thumbnail._percentile_uint16(arr, (0.01, 99.99))
    assert np.allclose(actual, expected, rtol=0, atol=1e-9)


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


def test_rescale_float_to_uint8_sparse_with_nan():
    # The _finite_clip_range interaction pinned at this call site: collapsed
    # percentiles AND a NaN present. The min/max fallback must range over the
    # finite values — arr.min()/arr.max() would be NaN and blank everything,
    # and the hi == lo guard wouldn't catch it (NaN != NaN).
    arr = np.zeros((200, 200), dtype=np.float32)
    arr[0, :3] = 1.0      # sparse hot pixels -> finite max
    arr[0, 4] = np.nan    # masked pixel
    out = t4_lambda_thumbnail._rescale_float_to_uint8(arr)
    assert (out[0, :3] == 255).all()  # hot pixels visible (finite max, not NaN)
    assert out[0, 4] == 0             # NaN -> black
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


@pytest.mark.parametrize(
    "shape, expected_mode",
    [
        ((64, 64), "L"),       # greyscale: would otherwise reach PIL as I;16B
        ((64, 64, 3), "RGB"),  # color: PIL can't build a color image from uint16
        ((64, 64, 4), "RGBA"),
    ],
)
def test_generate_thumbnail_handles_byte_swapped_uint16(shape, expected_mode):
    # Dispatch is by dtype (kind/itemsize), not PIL mode, so byte-swapped uint16
    # is rescaled to uint8 like native-order — rather than reaching PIL as an
    # I;16B greyscale image (rejected by thumbnail()'s reduce()) or a color
    # array PIL can't build at all (the old `== np.uint16` check missed both).
    arr = np.random.default_rng(0).integers(0, 65536, shape).astype(">u2")
    img = t4_lambda_thumbnail.generate_thumbnail(arr, (32, 32))
    assert img.mode == expected_mode


def test_norm_img_path_saves_16bit_png(data_dir):
    # Pin the output depth of the normalized (mode I) path: the golden
    # comparisons only enforce it as long as the goldens themselves stay
    # 16-bit, so a golden regeneration could silently change it. Shipping
    # 8-bit instead (smaller, browsers can't use more) is a fine future
    # choice, but it has to be made consciously — flip this then.
    _info, data = t4_lambda_thumbnail.handle_image(
        path=str(data_dir / "cell.tiff"), size=(640, 480), thumbnail_format="PNG",
    )
    assert Image.open(BytesIO(data)).mode == "I;16"


def _norm(arr, chunks=-1):
    return np.asarray(t4_lambda_thumbnail.norm_img(da.from_array(arr, chunks=chunks)))


def _norm_float_reference(arr):
    # Independent float64 reference for norm_img's normalization, used to pin
    # that the bounded unsigned-integer path (histogram percentile + LUT) stays
    # bit-identical to it. Mirrors the float branch's exact arithmetic.
    imax = np.iinfo(np.uint16).max + 1
    a = np.asarray(arr).astype(np.float64)
    lo, hi = map(float, np.percentile(a, (0.01, 99.99)))
    if hi == lo:
        lo, hi = float(a.min()), float(a.max())
    if hi == lo:
        return np.zeros(a.shape, np.int32)
    np.clip(a, lo, hi, out=a)
    a -= lo
    a /= hi - lo
    a *= imax
    a[a == imax] = imax - 1
    return a.astype(np.int32)


@pytest.mark.parametrize("dtype", [np.uint8, np.uint16, np.float32])
def test_norm_img_empty_plane_renders_black(dtype):
    # A degenerate empty plane must render black (an empty int32 array) rather
    # than raise — the unsigned path's _uint16_clip_range has no emptiness guard
    # (unlike the float path's _finite_clip_range), so norm_img guards up front.
    out = _norm(np.empty((0, 5), dtype=dtype))
    assert out.dtype == np.int32
    assert out.shape == (0, 5)


@pytest.mark.parametrize("dtype", [np.uint8, np.uint16, np.dtype(">u2")])
def test_norm_img_uint_path_bit_identical_to_float_reference(dtype):
    # The bounded unsigned path (histogram percentile + 65536-entry LUT) must
    # stay bit-identical to the float64 normalization — that equivalence is the
    # whole reason it's a safe memory optimization rather than a visible change.
    # Byte-swapped uint16 (>u2) takes the same path. Covers full-range, low-range
    # (12-bit-style), sparse (min/max fallback), and constant (-> black).
    top = np.iinfo(np.uint8 if np.dtype(dtype).itemsize == 1 else np.uint16).max
    rng = np.random.default_rng(0)
    sparse = np.full((100, 100), 5, dtype=dtype)
    sparse[0, 0] = top
    cases = [
        rng.integers(0, top + 1, (120, 90)).astype(dtype),        # full range
        rng.integers(0, top // 16 + 1, (100, 100)).astype(dtype),  # low range
        sparse,                                                    # sparse
        np.full((40, 40), 9, dtype=dtype),                         # constant -> black
    ]
    for arr in cases:
        assert np.array_equal(_norm(arr), _norm_float_reference(arr))


def test_norm_img_uint_path_bit_identical_sweep():
    # Property-style guard for the same equivalence: many random unsigned planes
    # across dtypes / sizes / value distributions must match the float64
    # reference bit-for-bit. The histogram percentile differs from np.percentile
    # only sub-ULP, and the *16-bit rescale must never let that flip an int32
    # output bit. Seeded, so deterministic in CI (no flakiness).
    rng = np.random.default_rng(1234)
    for _ in range(60):
        dtype = rng.choice([np.uint8, np.uint16, np.dtype(">u2")])
        top = np.iinfo(np.uint8 if np.dtype(dtype).itemsize == 1 else np.uint16).max
        h, w = int(rng.integers(8, 300)), int(rng.integers(8, 300))
        kind = int(rng.integers(0, 4))
        if kind == 0:        # uniform full range
            arr = rng.integers(0, top + 1, (h, w))
        elif kind == 1:      # narrow low-range band (12-bit-style)
            lo = int(rng.integers(0, top // 2 + 1))
            arr = rng.integers(lo, lo + top // 8 + 1, (h, w))
        elif kind == 2:      # gaussian (hot/dead tails exercise the clip)
            arr = rng.normal(top / 2, top / 8, (h, w)).clip(0, top)
        else:                # sparse: a few bright pixels on a flat background
            arr = np.full((h, w), int(rng.integers(0, top + 1)))
            arr.flat[: max(1, arr.size // 500)] = top
        arr = arr.astype(dtype)
        assert np.array_equal(_norm(arr), _norm_float_reference(arr)), \
            f"int32 flip: dtype={np.dtype(dtype).str} shape={(h, w)} kind={kind}"


def test_handle_image_blank_and_nan_channels_through_public_path(data_dir):
    # End-to-end reachability: a real multi-channel image can carry a blank
    # (constant) channel and a region of masked/invalid float pixels (NaN).
    # Both reach norm_img through the montage path when decoded by bioio. The
    # previous code hit 0/0 and an undefined int32(NaN) cast there, emitting
    # "invalid value encountered" RuntimeWarnings and platform-dependent
    # output; the fix renders them deterministically. Pins that such a file
    # flows through the public decode path cleanly.
    #
    # blank-and-nan-channels.ome.tiff is a 3-channel float32 OME-TIFF: ch0 a
    # normal gradient, ch1 constant 0.5 (blank channel), ch2 the gradient with
    # a 20x20 NaN patch. Regenerate with:
    #   grad = np.linspace(0, 1, 64 * 64, dtype=np.float32).reshape(64, 64)
    #   ch2 = grad.copy(); ch2[20:40, 20:40] = np.nan
    #   data = np.stack([grad, np.full((64, 64), 0.5, np.float32), ch2])
    #   tifffile.imwrite(path, data, metadata={"axes": "CYX"})
    # (pixels reproduce exactly; bytes differ — tifffile injects a random OME-UUID.)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        _info, png = t4_lambda_thumbnail.handle_image(
            path=str(data_dir / "blank-and-nan-channels.ome.tiff"),
            size=(256, 256), thumbnail_format="PNG")

    invalid = [str(w.message) for w in caught if "invalid value encountered" in str(w.message)]
    assert not invalid, f"normalization emitted non-finite warnings: {invalid}"
    assert Image.open(BytesIO(png)).mode == "I;16"


def test_norm_img_normalizes_to_full_16bit_range():
    # A gradient stretches to the full I;16 range, as int32 (PIL mode I).
    out = _norm(np.linspace(0, 1000, 64 * 64).reshape(64, 64))
    assert out.dtype == np.int32
    assert out.min() == 0
    assert out.max() == np.iinfo(np.uint16).max


@pytest.mark.parametrize("chunks", [-1, (16, 16)])
def test_norm_img_constant_plane_renders_black_without_warning(chunks):
    # A constant plane has no contrast to stretch. It must render black
    # deterministically, not divide 0/0 -> NaN -> a platform-dependent int32
    # cast (the previous bug). Tested for a single chunk and, since the prior
    # code raised on a multi-chunk 2-D array via da.percentile, multiple chunks.
    with warnings.catch_warnings():
        warnings.simplefilter("error")  # any warning (e.g. the 0/0 RuntimeWarning) fails
        out = _norm(np.full((40, 40), 5000, np.uint16), chunks=chunks)
    assert out.dtype == np.int32
    assert np.array_equal(out, np.zeros((40, 40), np.int32))


def test_norm_img_nan_renders_black_per_pixel():
    # A single NaN used to blank the whole tile (da.percentile returned NaN
    # bounds). Now only the NaN pixels render black; finite pixels still
    # contrast-stretch.
    arr = np.linspace(0, 1, 64).reshape(8, 8).copy()
    arr[0, 0] = np.nan
    out = _norm(arr)
    assert out[0, 0] == 0
    assert out.max() == np.iinfo(np.uint16).max  # finite range still spans output


def test_norm_img_all_non_finite_renders_black():
    out = _norm(np.full((8, 8), np.nan))
    assert np.array_equal(out, np.zeros((8, 8), np.int32))


def test_norm_img_inf_saturates_to_range_ends():
    arr = np.linspace(0, 1, 64).reshape(8, 8).copy()
    arr[0, 0] = np.inf
    arr[0, 1] = -np.inf
    out = _norm(arr)
    assert out[0, 0] == np.iinfo(np.uint16).max  # +inf saturates to white
    assert out[0, 1] == 0                          # -inf saturates to black


def test_norm_img_multichunk_2d_does_not_raise():
    # Defensive guard: da.percentile raises NotImplementedError on a
    # multi-chunk 2-D array on current dask, so the previous norm_img only
    # worked because bioio happens to emit each YX plane as a single chunk
    # (verified even for a mosaic overview CZI and a 6184x7712 pyramid). That
    # isn't a documented contract, so pin that norm_img doesn't depend on it:
    # normalizing on the computed plane is chunking-agnostic.
    rng = np.random.default_rng(0)
    arr = rng.integers(0, 65536, (64, 64)).astype(np.uint16)
    multi = _norm(arr, chunks=(16, 16))
    single = _norm(arr, chunks=-1)
    assert np.array_equal(multi, single)


def test_norm_img_sparse_stays_visible():
    # Almost-constant data (a few bright pixels on a flat background, e.g. a
    # label mask): percentiles collapse, so the shared min/max fallback keeps
    # the bright pixels visible instead of clipping the whole tile flat.
    arr = np.full((100, 100), 100, np.uint16)
    arr[0, 0] = 60000
    out = _norm(arr)
    assert out.max() == np.iinfo(np.uint16).max
    assert out.min() == 0


def test_norm_img_sparse_plane_with_nan_ranges_over_finite_values():
    # The exact interaction _finite_clip_range exists to get right: percentiles
    # collapse (almost all one value) AND non-finite pixels are present. The
    # min/max fallback must range over the *finite* values — arr.min()/arr.max()
    # would be NaN and blank the whole plane, and the hi == lo guard wouldn't
    # catch it (NaN != NaN). Sized (200x200, one outlier) so the outlier sits
    # above the 99.99th percentile, forcing the collapse + fallback.
    arr = np.full((200, 200), 100.0)
    arr[0, 0] = 60000.0   # lone bright outlier -> finite max
    arr[0, 1] = np.nan    # masked pixel
    out = _norm(arr)
    assert out[0, 1] == 0                          # NaN -> black
    assert out.max() == np.iinfo(np.uint16).max    # outlier visible: finite max, not NaN


def test_norm_img_leaves_color_planes_unchanged():
    # YXC / YXS planes are passed through untouched (normalization is for
    # greyscale only).
    arr = np.random.default_rng(0).integers(0, 256, (8, 8, 3)).astype(np.uint8)
    assert np.array_equal(_norm(arr), arr)


TEST_DATA_REGISTRY = "s3://quilt-test-public-data"
TIFF_PKG = "images/bioio-tifffile", "5fa99558a167d6430defbfa4033808c7e7004b847e94a213292c2c776ef43ac5"
OME_TIFF_PKG = "images/bioio-ome-tiff", "6dbddd093e0a92cfc1cc5957ad7a7177ba98a0fee5d99ffaea58e30b7c46e182"
CZI_PKG = "images/pylibczirw", "617551541881add8011f55de0c3936a90fc2188a40b6ef47c7e6ab20c3d2c8bf"
THUMBS_PKG = "images/thumbs", "9c8f7781a3dcf68b75e18f66622c0c191beac3fffb3d4acd22aaab9eaca651a4"
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
        # all zeros; kept as a constant-input guard for the multi-channel RGB
        # montage path (would catch e.g. a div-by-zero if normalization ever
        # gets applied to color channels), but useless for pixel correctness
        (TIFF_PKG, "s_1_t_1_c_2_z_1_RGB.tiff"),
        # real-content variant of the above with distinct channels; this is
        # what actually pins pixel correctness of the montage (channel order,
        # grid placement, padding)
        (TIFF_PKG, "s_1_t_1_c_2_z_1_RGB_gradient.tiff"),
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
        # Readable since bioio-czi 2.7.0; lambda swaps BGR->RGB. B/W
        # checkerboard, so it pins decode/shape but not channel order.
        (CZI_PKG, "c1_bgr48.czi"),
        # RuntimeError: Sorry, this pixeltype isn't implemented yet.
        pytest.param(CZI_PKG, "c1_bgr96float.czi", marks=pytest.mark.xfail(raises=(RuntimeError, ValueError))),
        (CZI_PKG, "c1_gray16.czi"),
        (CZI_PKG, "c1_gray32float.czi"),
        (CZI_PKG, "c1_gray8.czi"),
        (CZI_PKG, "c1_gray8_s2_non_overlapping_bounding_boxes.czi"),
        (CZI_PKG, "c1_gray8_s2_overlapping_bounding_boxes.czi"),
        (CZI_PKG, "c2_gray8_gray16.czi"),
        (CZI_PKG, "c2_gray8_t3_z5_s2.czi"),
        # A real mosaic (whole-slide) acquisition that decodes to a single greyscale plane.
        (CZI_PKG, "OverViewScan.czi"),
        # Color CZI (Bgr24); readable since bioio-czi 2.7.0. Pins CZI color
        # channel order (test_handle_image_bgr_czi_channel_order is the oracle).
        (CZI_PKG, "rgb-image.czi"),
    ],
)
def test_handle_image(pytestconfig, pkg_ref, lk):
    pkg_name, top_hash = pkg_ref
    src_pkg = quilt3.Package.browse(
        pkg_name,
        registry=TEST_DATA_REGISTRY,
        top_hash=top_hash,
    )
    src_entry = src_pkg[lk]
    # Gate on size before install() downloads the file (browse() reads only the manifest).
    if not pytestconfig.getoption("large_files") and src_entry.size > 20 * 1024 * 1024:
        pytest.skip("Skipping large file test; use --large-files to enable")
    quilt3.Package.install(
        pkg_name,
        registry=TEST_DATA_REGISTRY,
        top_hash=top_hash,
        path=lk,
    )

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


def test_handle_image_bgr_czi_channel_order():
    # Independent oracle for the BGR->RGB swap: a self-generated golden can't
    # catch a re-introduced swap, but this can. rgb-image.czi is tan wooden
    # dice, so the rendered subject must be warm-toned (R > B). It is ~1 MB, so
    # (unlike test_handle_image, which also fetches large fixtures) no
    # --large-files size gate is needed.
    quilt3.Package.install(
        CZI_PKG[0],
        registry=TEST_DATA_REGISTRY,
        top_hash=CZI_PKG[1],
        path="rgb-image.czi",
    )
    src_entry = quilt3.Package.browse(
        CZI_PKG[0],
        registry=TEST_DATA_REGISTRY,
        top_hash=CZI_PKG[1],
    )["rgb-image.czi"]
    _info, data = t4_lambda_thumbnail.handle_image(
        path=src_entry.get_cached_path(), size=SIZE, thumbnail_format="PNG")

    pixels = np.asarray(Image.open(BytesIO(data)).convert("RGB")).reshape(-1, 3)
    # Subject = the dice: drop near-white background and near-black pips.
    brightness = pixels.sum(axis=1)
    subject = pixels[(brightness > 60) & (brightness < 690)]
    mean = subject.mean(axis=0)
    assert mean[0] > mean[2] + 10, f"expected warm wood tone (R>B), got mean RGB={mean}"


def test_handle_image_multichannel_bgr_czi_channel_order(data_dir):
    # Covers the montage branch (C>1), where the swap lands on the montage's
    # trailing S axis. No real fixture exists (real color CZIs are single-
    # channel), so multichannel-bgr.czi is synthetic: channel 0 red, channel 1
    # blue, in native BGR; the rendered tiles must keep those colors.
    # Regenerate with:
    #   import numpy as np
    #   from pylibCZIrw import czi as pyczi
    #   red = np.zeros((32, 32, 3), np.uint8); red[..., 2] = 255    # BGR -> red
    #   blue = np.zeros((32, 32, 3), np.uint8); blue[..., 0] = 255  # BGR -> blue
    #   with pyczi.create_czi("multichannel-bgr.czi") as doc:
    #       opts = "zstd0:ExplicitLevel=10"
    #       doc.write(data=red, plane={"C": 0}, compression_options=opts)
    #       doc.write(data=blue, plane={"C": 1}, compression_options=opts)
    _info, data = t4_lambda_thumbnail.handle_image(
        path=str(data_dir / "multichannel-bgr.czi"), size=SIZE, thumbnail_format="PNG")
    arr = np.asarray(Image.open(BytesIO(data)).convert("RGB"))

    # ch0 tiles into the left half, ch1 the right (montage is a 1x2 grid).
    # Average the colored pixels in each half (dropping the black padding) so
    # the check doesn't depend on exact tile centers.
    def half_color(region):
        flat = region.reshape(-1, 3)
        return flat[flat.sum(axis=1) > 30].mean(axis=0)

    mid = arr.shape[1] // 2
    left, right = half_color(arr[:, :mid]), half_color(arr[:, mid:])
    assert left[0] > left[2] + 10, f"channel 0 should render red (R>B), got {left}"
    assert right[2] > right[0] + 10, f"channel 1 should render blue (B>R), got {right}"


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
