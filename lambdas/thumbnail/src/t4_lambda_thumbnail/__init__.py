"""
Generate thumbnails for n-dimensional images in S3.

Uses `aicsimageio.AICSImage` to read common imaging formats + some supported
n-dimensional imaging formats. Stong assumptions as to the shape of the
n-dimensional data are made, specifically that dimension order is STCZYX, or,
Scene-Timepoint-Channel-SpacialZ-SpacialY-SpacialX.
"""
import functools
import io
import json
import os
import subprocess
import sys
import tempfile
from io import BytesIO
from math import sqrt
from typing import List, Tuple

import imageio
import numpy as np
import pdf2image
import pptx
import requests
from aicsimageio import AICSImage, readers
from pdf2image import convert_from_bytes
from pdf2image.exceptions import (
    PDFInfoNotInstalledError,
    PDFPageCountError,
    PDFSyntaxError,
    PopplerNotInstalledError,
)
from PIL import Image

from t4_lambda_shared.decorator import QUILT_INFO_HEADER, api, validate
from t4_lambda_shared.utils import get_default_origins, make_json_response

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
    imageio.plugins.pillow.JPEGFormat.Reader: "JPG",
    imageio.plugins.pillow.PNGFormat.Reader: "PNG",
    imageio.plugins.pillow.GIFFormat.Reader: "GIF"
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


def norm_img(img: np.ndarray) -> np.ndarray:
    """
    Normalize an image. This clips the upper and lower 0.01 intensities and
    then rescales the intensities to fit on a int32 range.
    """
    # Set to float64 for futher correction math
    img = img.astype(np.float64)

    # Clip upper bound
    img = np.clip(
        img,
        a_min=np.percentile(img, 0.01),
        a_max=np.percentile(img, 99.99),
    )

    # Normalize greyscale values to floats between zero and one
    img = img - np.min(img)
    img = img / np.max(img)

    # Cast the floats to integers
    imax = np.iinfo(np.uint16).max + 1  # eg imax = 256 for uint8
    img = img * imax
    img[img == imax] = imax - 1
    img = img.astype(np.int32)

    return img


def _format_n_dim_ndarray(img: AICSImage) -> np.ndarray:
    # Even though the reader was n-dim, check if the actual data is simply greyscale and return
    if len(img.reader.data.shape) == 2:
        return img.reader.data

    # Even though the reader was n-dim,
    # check if the actual data is similar to YXC ("YX-RGBA" or "YX-RGB") and return
    if (len(img.reader.data.shape) == 3 and (
            img.reader.data.shape[2] == 3 or img.reader.data.shape[2] == 4)):
        return img.reader.data

    # Check which dimensions are available
    # AICSImage makes strong assumptions about dimension ordering

    # Reduce the array down to 2D + Channels when possible
    # Always choose first Scene
    if "S" in img.reader.dims:
        img = AICSImage(img.data[0, :, :, :, :, :])
    # Always choose middle time slice
    if "T" in img.reader.dims:
        img = AICSImage(img.data[0, img.data.shape[1] // 2, :, :, :, :])

    # Keep Channel data, but max project when possible
    if "C" in img.reader.dims:
        projections = []
        for i in range(img.data.shape[2]):
            if "Z" in img.reader.dims:
                # Add padding to the top and left of the projection
                padded = np.pad(
                    norm_img(img.data[0, 0, i, :, :, :].max(axis=0)),
                    ((5, 0), (5, 0)),
                    mode="constant"
                )
                projections.append(padded)
            else:
                # Add padding to the top and the left of the projection
                padded = np.pad(
                    norm_img(img.data[0, 0, i, 0, :, :]),
                    ((5, 0), (5, 0)),
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
        merged = [np.concatenate(row, axis=1) for row in rows]

        # Add padding on the entire bottom and entire right side of the thumbnail
        return np.pad(np.concatenate(merged, axis=0), ((0, 5), (0, 5)), mode="constant")

    # If there is a Z dimension we need to do _something_ the get a 2D out.
    # Without causing a war about which projection method is best
    # we will simply use a max projection on files that contain a Z dimension
    if "Z" in img.reader.dims:
        return norm_img(img.data[0, 0, 0, :, :, :].max(axis=0))

    return norm_img(img.data[0, 0, 0, 0, :, :])


def format_aicsimage_to_prepped(img: AICSImage) -> np.ndarray:
    """
    Simple wrapper around the format n-dim array function to
    determine if we need to format or not.
    """
    # These readers are specific for n dimensional images
    if isinstance(img.reader, (readers.CziReader, readers.OmeTiffReader, readers.TiffReader)):
        return _format_n_dim_ndarray(img)

    return img.reader.data


def pptx_to_pdf(*, src: bytes, page: int) -> bytes:
    with tempfile.TemporaryDirectory() as tmp_dir:
        return subprocess.run(
            (
                sys.executable,
                "unoconv",
                "--doctype=presentation",
                "--format=pdf",
                "--stdout",
                "--stdin",
                f"--export=PageRange={page}-{page}",
            ),
            check=True,
            env={
                **os.environ,
                # This is needed because LibreOffice writes some stuff to $HOME/.config.
                "HOME": tmp_dir,
            },
            input=src,
            capture_output=True,
        ).stdout


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


def pdf_thumb(src: bytes, page: int, size: int):
    try:
        pages = convert_from_bytes(
            src,
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


def handle_pdf(*, src: bytes, page: int, size: int, count_pages: bool):
    fmt = "JPEG"
    thumb = pdf_thumb(src, page, size)
    info = {
        "thumbnail_format": fmt,
        "thumbnail_size": thumb.size,
    }
    if count_pages:
        info["page_count"] = pdf2image.pdfinfo_from_bytes(src)["Pages"]

    thumbnail_bytes = BytesIO()
    thumb.save(thumbnail_bytes, fmt)
    data = thumbnail_bytes.getvalue()

    return info, data


def handle_pptx(*, src: bytes, page: int, size: int, count_pages: bool):
    pdf_bytes = pptx_to_pdf(src=src, page=page)
    info, data = handle_pdf(src=pdf_bytes, page=1, size=size, count_pages=False)
    if count_pages:
        info["page_count"] = len(pptx.Presentation(io.BytesIO(src)).slides)

    return info, data


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
    output = request.args.get('output', 'json')
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

    src_bytes = resp.content
    try:
        thumbnail_format = SUPPORTED_BROWSER_FORMATS.get(
            imageio.get_reader(src_bytes),
            "PNG"
        )
    except ValueError:
        thumbnail_format = "JPEG" if input_ in ("pdf", "pptx") else "PNG"
    if input_ == "pdf":
        info, data = handle_pdf(src=src_bytes, page=page, size=size[0], count_pages=count_pages)
    elif input_ == "pptx":
        info, data = handle_pptx(src=src_bytes, page=page, size=size[0], count_pages=count_pages)
    else:
        # Read image data
        img = AICSImage(src_bytes)
        orig_size = list(img.reader.data.shape)
        # Generate a formatted ndarray using the image data
        # Makes some assumptions for n-dim data
        img = format_aicsimage_to_prepped(img)
        # Send to Image object for thumbnail generation and saving to bytes
        img = Image.fromarray(img)
        # Generate thumbnail
        img.thumbnail(size)
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

    headers = {
        'Content-Type': Image.MIME[thumbnail_format],
        QUILT_INFO_HEADER: json.dumps(info)
    }
    return 200, data, headers
