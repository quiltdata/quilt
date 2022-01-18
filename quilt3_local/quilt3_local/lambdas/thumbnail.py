"""
Generate thumbnails for n-dimensional images in S3.

Uses `aicsimageio.AICSImage` to read common imaging formats + some supported
n-dimensional imaging formats. Stong assumptions as to the shape of the
n-dimensional data are made, specifically that dimension order is STCZYX, or,
Scene-Timepoint-Channel-SpacialZ-SpacialY-SpacialX.
"""
import base64
import json
import sys
from io import BytesIO
from math import sqrt
from typing import List, Tuple

import imageio
import numpy as np
import requests
from aicsimageio import AICSImage, readers
from PIL import Image

from .shared.decorator import QUILT_INFO_HEADER, api, validate
from .shared.utils import get_default_origins, make_json_response

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
        'output': {
            'enum': ['json', 'raw']
        },
    },
    'required': ['url', 'size'],
    'additionalProperties': False
}


def generate_factor_pairs(x: int) -> List[Tuple[int]]:
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


def choose_min_grid(x: int) -> Tuple[int]:
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


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    """
    Generate thumbnails for images in S3
    """
    # Parse request info
    url = request.args['url']
    size = SIZE_PARAMETER_MAP[request.args['size']]
    output = request.args.get('output', 'json')

    # Handle request
    resp = requests.get(url)
    if resp.ok:
        try:
            thumbnail_format = SUPPORTED_BROWSER_FORMATS.get(
                imageio.get_reader(resp.content),
                "PNG"
            )
        except ValueError:
            thumbnail_format = "PNG"

        # Read image data
        img = AICSImage(resp.content)
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

        if output == 'json':
            ret_val = {
                'info': info,
                'thumbnail': base64.b64encode(data).decode(),
            }
            return make_json_response(200, ret_val)
        # Not JSON response ('raw')
        headers = {
            'Content-Type': Image.MIME[thumbnail_format],
            QUILT_INFO_HEADER: json.dumps(info)
        }
        return 200, data, headers

    # Errored, return error code
    ret_val = {
        'error': resp.reason,
        'text': resp.text,
    }
    return make_json_response(resp.status_code, ret_val)
