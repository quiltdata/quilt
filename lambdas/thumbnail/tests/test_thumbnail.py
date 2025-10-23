import json
import tempfile
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
        "size": "w32h32",
        "input": "pdf",
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
        ("generated.ome.tiff", {"size": "w256h256"}, "generated-256.png", [1, 6, 36, 76, 68], [224, 167], None, 200),
        ("sat_rgb.tiff", {"size": "w256h256"}, "sat_rgb-256.png", [256, 256, 4], [256, 256], None, 200),
        ("single_cell.ome.tiff", {"size": "w256h256"}, "single_cell.png", [1, 6, 40, 152, 126], [256, 205], None, 200),
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
    if params.get("input") in ("pdf", "pptx"):
        url = f"https://example.com/{input_file}"
        responses.add(
            responses.GET,
            url=url,
            body=input_file.read_bytes(),
            status=200
        )
    else:
        url = str(input_file)
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
        with tempfile.NamedTemporaryFile(suffix=".png") as f:
            f.write(body)
            f.flush()
            actual = BioImage(f.name)
            expected = BioImage(data_dir / expected_thumb)
            assert actual.dims.items() == expected.dims.items()
            assert np.array_equal(actual.reader.data, expected.reader.data)


TEST_DATA_REGISTRY = "s3://quilt-test-public-data"
TIFF_PKG = "images/bioio-tifffile", "dc6fe8a79486743c783a22fd6ff045d6548eee5fa02637e79029bca5dde89cbc"
OME_TIFF_PKG = "images/bioio-ome-tiff", "6dbddd093e0a92cfc1cc5957ad7a7177ba98a0fee5d99ffaea58e30b7c46e182"
CZI_PKG = "images/pylibczirw", "552c9290ffa24738a578c494b7fc9f95cc03e3d12d701bc0bd944f5c1c558b2c"
THUMBS_PKG = "images/thumbs", "f551ee98499be442fbe67419a53f0ab51cb5c0a71cc1ee0e63638266a930e8c3"
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
        # Traceback (most recent call last):
        #   File ".site-packages/PIL/Image.py", line 3308, in fromarray
        #     mode, rawmode = _fromarray_typemap[typekey]
        #                     ~~~~~~~~~~~~~~~~~~^^^^^^^^^
        # KeyError: ((1, 1, 3), '<u2')
        # The above exception was the direct cause of the following exception:
        # Traceback (most recent call last):
        #   File "<ipython-input-5-03f7162314ed>", line 5, in <module>
        #     _info, data = handle_image(src=e.get_bytes(), size=(1024, 768), thumbnail_format='PNG', url=f'x/{lk}')
        #                   ~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        #   File "src/t4_lambda_thumbnail/__init__.py", line 351, in handle_image
        #     img = generate_thumbnail(img, size)
        #   File "src/t4_lambda_thumbnail/__init__.py", line 376, in generate_thumbnail
        #     img = Image.fromarray(arr)
        #   File ".site-packages/PIL/Image.py", line 3312, in fromarray
        #     raise TypeError(msg) from e
        # TypeError: Cannot handle this data type: (1, 1, 3), <u2
        pytest.param(
            TIFF_PKG,
            "s_1_t_1_c_1_z_1_RGB.tiff",
            marks=pytest.mark.xfail(raises=TypeError),
        ),
        (TIFF_PKG, "s_1_t_1_c_2_z_1_RGB.tiff"),
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
        pytest.param(CZI_PKG, "c1_bgr96float.czi", marks=pytest.mark.xfail(raises=ValueError)),
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

    print(f"Testing {lk}...")
    _info, data = t4_lambda_thumbnail.handle_image(url=src_entry.get_cached_path(), size=SIZE, thumbnail_format="PNG")

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

        print(f"  actual size: {actual.dims.items()}, expected size: {expected.dims.items()}")
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
