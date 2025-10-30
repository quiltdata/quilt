"""
Generate thumbnails for n-dimensional images in S3.

Uses `bioio.BioImage` to read common imaging formats + some supported
n-dimensional imaging formats. Strong assumptions as to the shape of the
n-dimensional data are made, specifically that dimension order is TCZYX(S), or,
Timepoint-Channel-SpacialZ-SpacialY-SpacialX-(Samples).
"""

import contextlib
import functools
import json
import os
import subprocess
import sys
import tempfile
import urllib.parse
from io import BytesIO
from math import sqrt
from typing import List, Tuple

import bioio_czi
import bioio_ome_tiff
import bioio_tifffile
import dask.array as da
import imageio
import numpy as np
import pdf2image
import pptx
import requests
from bioio import BioImage
from pdf2image.exceptions import (
    PDFInfoNotInstalledError,
    PDFPageCountError,
    PDFSyntaxError,
    PopplerNotInstalledError,
)
from PIL import Image

from t4_lambda_shared.decorator import QUILT_INFO_HEADER, api, validate
from t4_lambda_shared.utils import get_default_origins, make_json_response

# See https://pillow.readthedocs.io/en/stable/reference/Image.html#PIL.Image.open.
# Use 0 to disable the limit.
if _MAX_IMAGE_PIXELS := os.environ.get("MAX_IMAGE_PIXELS"):
    Image.MAX_IMAGE_PIXELS = int(_MAX_IMAGE_PIXELS) or None

# Eventually we'll want to precompute/cache thumbnails, so we won't be able to support
# arbitrary sizes. Might as well copy Dropbox' API:
# https://www.dropbox.com/developers/documentation/http/documentation#files-get_thumbnail
SUPPORTED_SIZES = [
    (32, 32),
    (64, 64),
    (128, 128),
    (256, 256),
    (480, 320),
    (640, 480),
    (960, 640),
    (1024, 768),
    (2048, 1536)
]
# Map URL parameters to actual sizes, e.g. 'w128h128' -> (128, 128)
SIZE_PARAMETER_MAP = {f'w{w}h{h}': (w, h) for w, h in SUPPORTED_SIZES}

# If the image is one of these formats, retain the format after formatting
SUPPORTED_BROWSER_FORMATS = {
    imageio.plugins.pillow_legacy.JPEGFormat.Reader: "JPG",
    imageio.plugins.pillow_legacy.PNGFormat.Reader: "PNG",
    imageio.plugins.pillow_legacy.GIFFormat.Reader: "GIF"
}

SCHEMA = {
    'type': 'object',
    'properties': {
        'url': {
            'type': 'string'
        },
        'size': {
            'enum': list(SIZE_PARAMETER_MAP)
        },
        'input': {
            'enum': ['pdf', 'pptx']
        },
        'page': {
            'type': 'string',
            'pattern': r'^\d+$',
        },
        # not boolean because URL params like "true" always get converted to strings
        # clients should do this ONCE per document because it incurs latency and memory
        'countPages': {
            'enum': ['true', 'false']
        }
    },
    'required': ['url', 'size'],
    'additionalProperties': False
}


def generate_factor_pairs(x: int) -> List[Tuple[int, int]]:
    """
    Generate tuples of integer pairs that are factors for the provided x integer value.
    """
    # Generate all factor pairs for an integer x.
    step = 2 if x % 2 else 1
    pairs = []

    for i in range(1, int(sqrt(x) + 1), step):
        if x % i == 0:
            pairs.append((i, x//i))

    return pairs


def choose_min_grid(x: int) -> Tuple[int, int]:
    """
    Choose a minimum grid size based off the distance between two values that form
    a factor pair of the provided x amount of objects to create a grid off.
    """
    # Chose a minimum grid size. (The smallest distance between a factor pair.)
    factor_pairs = generate_factor_pairs(x)
    min_grid_shape = None
    min_distance = sys.maxsize
    for pair in factor_pairs:
        if pair[1] - pair[0] < min_distance:
            min_grid_shape = pair

    return min_grid_shape


def norm_img(img: da.Array) -> da.Array:
    """
    Normalize an image. This clips the upper and lower 0.01 intensities and
    then rescales the intensities to fit on a int32 range.
    """
    if len(img.shape) == 3:
        # leave color images alone
        # XXX: is this correct?
        # XXX: do we need to cast to uint8?
        return img
    # Set to float64 for futher correction math
    img = img.astype(np.float64)

    # Clip upper bound
    img = da.clip(
        img,
        da.percentile(img, 0.01),
        da.percentile(img, 99.99),
    )

    # Normalize greyscale values to floats between zero and one
    img = img - da.min(img)
    img = img / da.max(img)

    # Cast the floats to integers
    imax = np.iinfo(np.uint16).max + 1  # eg imax = 256 for uint8
    img = img * imax
    img[img == imax] = imax - 1
    img = img.astype(np.int32)

    return img


def _format_n_dim_ndarray(img: BioImage) -> da.Array:
    # Even though the reader was n-dim, check if the actual data is simply greyscale and return
    if len(img.reader.dask_data.shape) == 2:
        return img.reader.dask_data

    # Even though the reader was n-dim,
    # check if the actual data is similar to YXC ("YX-RGBA" or "YX-RGB") and return
    if (len(img.reader.dask_data.shape) == 3 and (
            img.reader.dask_data.shape[2] == 3 or img.reader.dask_data.shape[2] == 4)):
        return img.reader.dask_data

    # Check which dimensions are available
    # BioImage makes strong assumptions about dimension ordering

    # Reduce the array down to 2D + Channels when possible
    # Always choose middle time slice
    if "T" in img.reader.dims.order:
        img = BioImage(img.dask_data[img.dask_data.shape[0] // 2 : img.dask_data.shape[0] // 2 + 1, :, :, :, :])

    # Keep Channel data, but max project when possible
    if "C" in img.reader.dims.order and img.dask_data.shape[1] > 1:
        projections = []
        s_pad = ((0, 0),) if "S" in img.reader.dims.order else ()
        for i in range(img.dask_data.shape[1]):
            if "Z" in img.reader.dims.order:
                # Add padding to the top and left of the projection
                padded = da.pad(
                    norm_img(img.dask_data[0, i, :, :, :].max(axis=0)),
                    ((5, 0), (5, 0)) + s_pad,
                    mode="constant"
                )
                projections.append(padded)
            else:
                # Add padding to the top and the left of the projection
                padded = da.pad(
                    norm_img(img.dask_data[0, i, 0, :, :]),
                    ((5, 0), (5, 0)) + s_pad,
                    mode="constant"
                )
                projections.append(padded)

        # Get min grid shape
        # For 6 channels this returns (2, 3)
        min_grid_shape = choose_min_grid(len(projections))

        # Make rows of images
        # Use a counter so that we don't have to use `projections.pop` which is O(N)
        rows = []
        proj_counter = 0
        for y_i in range(min_grid_shape[0]):
            row = []
            for x_i in range(min_grid_shape[1]):
                row.append(projections[proj_counter])
                proj_counter += 1

            rows.append(row)

        # Concatenate each row then concatenate all rows together into a single 2D image
        merged = [da.concatenate(row, axis=1) for row in rows]

        # Add padding on the entire bottom and entire right side of the thumbnail
        return da.pad(da.concatenate(merged, axis=0), ((0, 5), (0, 5)) + s_pad, mode="constant")

    # If there is a Z dimension we need to do _something_ the get a 2D out.
    # Without causing a war about which projection method is best
    # we will simply use a max projection on files that contain a Z dimension
    if "Z" in img.reader.dims.order:
        return norm_img(img.dask_data[0, 0, :, :, :].max(axis=0))

    return norm_img(img.dask_data[0, 0, 0, :, :])


def format_aicsimage_to_prepped(img: BioImage) -> da.Array:
    """
    Simple wrapper around the format n-dim array function to
    determine if we need to format or not.
    """
    # These readers are specific for n dimensional images
    if isinstance(
        img.reader,
        (
            bioio_czi.reader.Reader,
            bioio_ome_tiff.reader.Reader,
            bioio_tifffile.reader.Reader,
        ),
    ):
        return _format_n_dim_ndarray(img)

    return img.reader.dask_data


@contextlib.contextmanager
def pptx_to_pdf(*, path: str, page: int):
    with tempfile.TemporaryDirectory() as out_dir:
        with tempfile.TemporaryDirectory() as tmp_dir:
            subprocess.run(
                (
                    "libreoffice",
                    "--convert-to",
                    'pdf:impress_pdf_Export:{"PageRange":{"type":"string","value":"%s-%s"}}' % (page, page),
                    "--outdir",
                    out_dir,
                    path,
                ),
                check=True,
                env={
                    **os.environ,
                    # This is needed because LibreOffice writes some stuff to $HOME/.config.
                    "HOME": tmp_dir,
                },
            )
        yield os.path.join(out_dir, os.path.splitext(os.path.basename(path))[0] + ".pdf")



def handle_exceptions(*exception_types):
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            try:
                return f(*args, **kwargs)
            except exception_types as e:
                return make_json_response(500, {'error': str(e)})

        return wrapper
    return decorator


class PDFThumbError(Exception):
    pass


def pdf_thumb(*, path: str, page: int, size: int):
    try:
        pages = pdf2image.convert_from_path(
            path,
            # respect width but not necessarily height to preserve aspect ratio
            size=(size, None),
            fmt="JPEG",
            first_page=page,
            last_page=page,
        )
        return pages[0]
    except (
        IndexError,
        PDFInfoNotInstalledError,
        PDFPageCountError,
        PDFSyntaxError,
        PopplerNotInstalledError
    ) as e:
        raise PDFThumbError(str(e))


def handle_pdf(*, path: str, page: int, size: int, count_pages: bool):
    fmt = "JPEG"
    thumb = pdf_thumb(path=path, page=page, size=size)
    info = {
        "thumbnail_format": fmt,
        "thumbnail_size": thumb.size,
    }
    if count_pages:
        info["page_count"] = pdf2image.pdfinfo_from_path(path)["Pages"]

    thumbnail_bytes = BytesIO()
    thumb.save(thumbnail_bytes, fmt)
    data = thumbnail_bytes.getvalue()

    return info, data


def handle_pptx(*, path: str, page: int, size: int, count_pages: bool):
    with pptx_to_pdf(path=path, page=page) as pdf_path:
        info, data = handle_pdf(path=pdf_path, page=1, size=size, count_pages=False)
    if count_pages:
        info["page_count"] = len(pptx.Presentation(path).slides)

    return info, data


def handle_image(*, path: str, size: tuple[int, int], thumbnail_format: str):
    # Read image data
    img = BioImage(path)
    orig_size = list(img.reader.dask_data.shape)
    # Generate a formatted ndarray using the image data
    # Makes some assumptions for n-dim data
    img = format_aicsimage_to_prepped(img)

    img = generate_thumbnail(img.compute(), size)

    thumbnail_size = img.size
    # Store the bytes
    thumbnail_bytes = BytesIO()
    img.save(thumbnail_bytes, thumbnail_format)
    # Get bytes data
    data = thumbnail_bytes.getvalue()
    # Create metadata object
    info = {
        'original_size': orig_size,
        'thumbnail_format': thumbnail_format,
        'thumbnail_size': thumbnail_size,
    }

    return info, data


def _convert_I16_to_L(arr):
    # separated out for testing
    return Image.fromarray((arr // 256).astype('uint8'))


def generate_thumbnail(arr, size):
    # Send to Image object for thumbnail generation and saving to bytes
    img = Image.fromarray(arr)

    # The mode I;16 has limited resamplers for scaling, and throws an error.
    # Rather than use a non-default poor-quality resampler, convert to a better-handled mode.
    if img.mode == 'I;16':
        img = _convert_I16_to_L(arr)

    # Generate thumbnail
    try:
        # attempt to use the default resampler - we have test images using this.
        img.thumbnail(size)
        return img
    except ValueError as err:
        if 'image has wrong mode' in str(err):
            # The default resampler doesn't work with this image mode.
            # PIL does not support all resamplers with all modes.
            # These are all of the resamplers available, Ordered highest to lowest quality.
            fallback_resampler_order = [
                Image.Resampling.LANCZOS,
                Image.Resampling.BICUBIC,
                Image.Resampling.HAMMING,
                Image.Resampling.BILINEAR,
                Image.Resampling.BOX,
                Image.Resampling.NEAREST,
            ]
            for resampler in fallback_resampler_order:
                try:
                    img.thumbnail(size, resample=resampler)
                    return img
                except ValueError:
                    continue
            # If this error is raised, we need to convert the image to a mode that can scale.
            raise ValueError(f"Exhausted all fallback resamplers for scaling mode {img.mode}")
        else:
            raise


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
@handle_exceptions(PDFThumbError)
def lambda_handler(request):
    """
    Generate thumbnails for images in S3
    """
    # Parse request info
    url = request.args['url']
    size = SIZE_PARAMETER_MAP[request.args['size']]
    input_ = request.args.get('input', 'image')
    page = int(request.args.get('page', '1'))
    count_pages = request.args.get('countPages') == 'true'

    # Handle request
    resp = requests.get(url)
    if not resp.ok:
        # Errored, return error code
        ret_val = {
            'error': resp.reason,
            'text': resp.text,
        }
        return make_json_response(resp.status_code, ret_val)

    # FIXME: If the process is killed because it's out of memory, named temporary files
    #        are not deleted neither by Python nor by OS.
    #        It *seems* that Lambda should restart the environment in this case, but
    #        it doesn't (AWS bug?). So we may end up cleaning tmp files manually in
    #        the beginning of the invocation.
    # XXX: BioImage can read from s3/http(s) URLs directly, but in practice it's at least 2x slower
    #      than downloading the file first and reading from local FS even with cache_type='all' which
    #      downloads the file in one shot.
    filename_suffix = urllib.parse.unquote(urllib.parse.urlparse(url).path.split('/')[-1])
    with tempfile.NamedTemporaryFile(suffix=filename_suffix) as src_file:
        src_file.write(resp.content)
        src_file.flush()

        thumbnail_format = "JPEG"
        if input_ == "pdf":
            info, data = handle_pdf(path=src_file.name, page=page, size=size[0], count_pages=count_pages)
        elif input_ == "pptx":
            info, data = handle_pptx(path=src_file.name, page=page, size=size[0], count_pages=count_pages)
        else:
            # XXX: This never seemed to work, because imageio.get_reader() returns an instance,
            #      not a class/type. imageio 2.28+ stopped return instances of these classes altogether.
            #      So for now, always use PNG.
            # try:
            #     thumbnail_format = SUPPORTED_BROWSER_FORMATS.get(
            #         imageio.get_reader(url),
            #         "PNG"
            #     )
            # except ValueError:
            #     thumbnail_format = "PNG"
            thumbnail_format = "PNG"
            info, data = handle_image(
                path=src_file.name,
                size=size,
                thumbnail_format=thumbnail_format,
            )

    headers = {
        'Content-Type': Image.MIME[thumbnail_format],
        QUILT_INFO_HEADER: json.dumps(info)
    }
    return 200, data, headers
