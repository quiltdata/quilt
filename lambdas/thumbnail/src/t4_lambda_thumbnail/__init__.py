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
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from io import BytesIO
from math import sqrt
from typing import List, Tuple

import bioio_base.exceptions
import bioio_czi
import bioio_imageio
import bioio_ome_tiff
import bioio_tifffile
import dask.array as da
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

# If set to "1", /tmp directory will be cleaned up at the start of each invocation.
# Should be set in the Lambda environment variables.
# We need this because if the process is killed due to out-of-memory,
# temporary files are not deleted neither by Python nor by OS.
# It *seems* that Lambda should restart the environment in this case, but
# it doesn't (AWS bug?).
CLEANUP_TMP_DIR = os.environ.get("CLEANUP_TMP_DIR") == "1"

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
    (2048, 1536),
]
# Map URL parameters to actual sizes, e.g. 'w128h128' -> (128, 128)
SIZE_PARAMETER_MAP = {f'w{w}h{h}': (w, h) for w, h in SUPPORTED_SIZES}

SCHEMA = {
    'type': 'object',
    'properties': {
        'url': {'type': 'string'},
        'size': {'enum': list(SIZE_PARAMETER_MAP)},
        'input': {'enum': ['pdf', 'pptx']},
        'page': {
            'type': 'string',
            'pattern': r'^\d+$',
        },
        # not boolean because URL params like "true" always get converted to strings
        # clients should do this ONCE per document because it incurs latency and memory
        'countPages': {'enum': ['true', 'false']},
    },
    'required': ['url', 'size'],
    'additionalProperties': False,
}


def clean_tmp_dir():
    if not CLEANUP_TMP_DIR:
        return

    tmp_dir = tempfile.gettempdir()
    for filename in os.listdir(tmp_dir):
        file_path = os.path.join(tmp_dir, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path, ignore_errors=True)
        except Exception as e:
            print(f'Failed to delete {file_path}. Reason: {e}', file=sys.stderr)


def generate_factor_pairs(x: int) -> List[Tuple[int, int]]:
    """
    Generate tuples of integer pairs that are factors for the provided x integer value.
    """
    # Generate all factor pairs for an integer x.
    step = 2 if x % 2 else 1
    pairs = []

    for i in range(1, int(sqrt(x) + 1), step):
        if x % i == 0:
            pairs.append((i, x // i))

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
    if len(img.reader.dask_data.shape) == 3 and (
        img.reader.dask_data.shape[2] == 3 or img.reader.dask_data.shape[2] == 4
    ):
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
                    norm_img(img.dask_data[0, i, :, :, :].max(axis=0)), ((5, 0), (5, 0)) + s_pad, mode="constant"
                )
                projections.append(padded)
            else:
                # Add padding to the top and the left of the projection
                padded = da.pad(norm_img(img.dask_data[0, i, 0, :, :]), ((5, 0), (5, 0)) + s_pad, mode="constant")
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
        bioio_czi.reader.Reader | bioio_ome_tiff.reader.Reader | bioio_tifffile.reader.Reader,
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
    except (IndexError, PDFInfoNotInstalledError, PDFPageCountError, PDFSyntaxError, PopplerNotInstalledError) as e:
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


def read_image(path: str) -> BioImage:
    try:
        return BioImage(path)
    except bioio_base.exceptions.UnsupportedFileFormatError:
        # BioImage picks a reader strictly by file extension, and bioio-imageio
        # declares only a subset of the extensions it can actually read (e.g.
        # "jpg" but not "jpeg", no "webp"), so force it as a fallback.
        return BioImage(path, reader=bioio_imageio.Reader)


def handle_image(*, path: str, size: tuple[int, int], thumbnail_format: str):
    # Read image data
    img = read_image(path)
    orig_size = list(img.reader.dask_data.shape)
    # Generate a formatted ndarray using the image data
    # Makes some assumptions for n-dim data
    img = format_aicsimage_to_prepped(img)

    img = generate_thumbnail(img.compute(), size)

    # PNG has no 32-bit depth, and Pillow 13 removes saving mode "I" images
    # as PNG outright. Convert explicitly: I -> I;16 clamps exactly like the
    # clip the implicit save used to apply, so the output is unchanged.
    if img.mode == "I":
        img = img.convert("I;16")

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


# Pixels per block when histogramming (below). Bounds the int64 transient
# np.bincount allocates (8 bytes/pixel for its block); 1M pixels ≈ 8 MB.
_HIST_BLOCK = 1 << 20


def _percentile_uint16(arr, qs):
    # Caller contract: arr is a non-empty uint16 array, qs are percentiles in
    # [0, 100]. The sole caller (_rescale_uint16_to_uint8) guards emptiness and
    # passes constant qs, so this skips revalidating them.
    #
    # np.percentile partitions a flattened copy of the whole array (here ~2
    # bytes/pixel, the uint16 input dtype), so its peak transient scales with
    # image size — an OOM risk on large images, the known failure mode of this
    # lambda. uint16 has only 65536 possible values, so a histogram yields the
    # same percentiles in bounded memory. Accumulate it over blocks: a single
    # np.bincount over the whole array would upcast all of it to int64
    # (8 bytes/pixel) and cost *more* than np.percentile, so bincount per block
    # into a fixed accumulator instead, keeping the int64 transient block-sized.
    # Channels are pooled (arr is flattened), matching the joint range
    # np.percentile computes over the whole array.
    counts = np.zeros(65536, dtype=np.int64)
    # Chunk a flat iterator rather than reshape(-1): arr.flat[a:b] copies only
    # the requested slice for any shape and contiguity, so the int64 bincount
    # transient stays block-sized no matter the image dimensions. reshape(-1)
    # would instead copy a whole span up front — the entire non-contiguous
    # color slice arr[..., :3], or a single very wide row — which on odd
    # shapes costs more than the np.percentile this replaces.
    flat = arr.flat
    for start in range(0, arr.size, _HIST_BLOCK):
        counts += np.bincount(flat[start:start + _HIST_BLOCK], minlength=65536)
    cdf = np.cumsum(counts)
    n = cdf[-1]
    out = []
    for q in qs:
        # Replicate np.percentile's default "linear" method: a virtual 0-based
        # index into the sorted values, interpolated between the values at its
        # floor and ceil. Output matches np.percentile to within floating-point
        # tolerance — not bit-exact (numpy's _lerp is asymmetric for fraction
        # >= 0.5), but the difference is sub-ULP and vanishes in the uint8
        # rescale, so thumbnails are unchanged.
        v = q / 100 * (n - 1)
        lo_i = int(v)
        val_lo = int(np.searchsorted(cdf, lo_i, side="right"))
        val_hi = int(np.searchsorted(cdf, lo_i + 1, side="right"))
        out.append(val_lo + (val_hi - val_lo) * (v - lo_i))
    return out


def _rescale_uint16_to_uint8(arr):
    # Rescale by the actual value range instead of `arr // 256`: low-range
    # data (e.g. 12-bit microscopy stored as uint16) would otherwise produce
    # a nearly black thumbnail. Like norm_img, clip extreme percentiles so
    # a few hot/dead pixels don't compress the rest of the range. For color
    # arrays the range is computed jointly across channels to avoid
    # per-channel color skews.
    if not arr.size:
        return arr.astype(np.uint8)
    lo, hi = _percentile_uint16(arr, (0.01, 99.99))
    if hi == lo:
        # Percentiles collapse when almost all pixels share one value;
        # fall back to min/max so sparse data (e.g. label masks) stays
        # visible.
        lo, hi = float(arr.min()), float(arr.max())
    if hi == lo:
        # Constant image: keep the brightness level.
        return (arr >> 8).astype(np.uint8)
    # Rescale via a lookup table over the 65536 possible values: much lower
    # peak memory than a float copy of the full-resolution array (OOM kills
    # are a known failure mode of this lambda).
    lut = np.arange(65536, dtype=np.float64)
    lut = (lut - lo) * (255 / (hi - lo))
    # values outside [lo, hi] land outside [0, 255]; clamp before the cast
    lut = np.clip(lut.round(), 0, 255)
    return lut.astype(np.uint8)[arr]


def _rescale_float_to_uint8(arr):
    # Contrast-stretch float data to uint8, with the range computed jointly
    # across channels for color arrays to avoid per-channel color skews.
    # Same percentile clipping and sparse-data fallback as
    # _rescale_uint16_to_uint8. Non-finite values are excluded from the
    # range: NaNs are treated as missing and render black, ±inf saturate
    # to the range ends.
    if not arr.size:
        return arr.astype(np.uint8)
    # Compact only when non-finite values are actually present: the copy
    # would otherwise coexist with np.percentile's internal copy and double
    # the ranging-phase peak memory.
    mask = np.isfinite(arr)
    finite = arr if mask.all() else arr[mask]
    del mask
    if not finite.size:
        # No finite values to compute a range from; render black.
        return np.zeros(arr.shape, np.uint8)
    lo, hi = map(float, np.percentile(finite, (0.01, 99.99)))
    if hi == lo:
        # Percentiles collapse when almost all pixels share one value;
        # fall back to min/max so sparse data (e.g. label masks) stays
        # visible.
        lo, hi = float(finite.min()), float(finite.max())
    del finite
    if hi == lo:
        # Constant image: keep the level, assuming the common [0, 1] float
        # convention when the value allows it (tolerating one output
        # quantum of float error above 1, so a nudged 1.0 stays white).
        level = lo * 255 if 0.0 <= lo <= 256 / 255 else lo
        return np.full(arr.shape, np.clip(round(level), 0, 255), np.uint8)
    # float32 math halves the working copy, but only when it can represent
    # the data: wider floats keep their own precision so high-offset
    # low-contrast data doesn't collapse and values beyond the float32
    # range don't overflow in the cast.
    out = arr.astype(np.float32 if arr.dtype.itemsize <= 4 else arr.dtype)
    out -= lo
    out *= 255 / (hi - lo)
    return _saturate_to_uint8(out)


def _saturate_to_uint8(out):
    # Round, clamp to [0, 255] (±inf saturate to the ends), and zero the
    # NaNs — via mask assignment: np.nan_to_num allocates much larger
    # temporaries, and this runs at the callers' peak memory. `out` must be
    # a private float array; every op is in place.
    np.rint(out, out=out)
    np.clip(out, 0, 255, out=out)
    out[np.isnan(out)] = 0
    return out.astype(np.uint8)


def _alpha_to_uint8(alpha):
    # Scale an alpha channel to uint8 by its convention — opacity in [0, 1]
    # for floats, the full dtype range for uint16 — rather than
    # contrast-stretching it like the color channels. NaN renders
    # transparent.
    if alpha.dtype.kind == "f":
        out = alpha.astype(np.float32)
        out *= 255
        return _saturate_to_uint8(out)
    return (alpha >> 8).astype(np.uint8)


def generate_thumbnail(arr, size):
    # Contrast-stretch non-uint8 arrays to uint8 before building the image:
    # PIL only builds color images from uint8, can't construct from float16,
    # can't save mode-F greyscale as PNG, and 16-bit greyscale decodes to an
    # I;16 "limited support" mode
    # (https://pillow.readthedocs.io/en/stable/handbook/concepts.html#modes)
    # that thumbnail() rejects with "image has wrong mode" when it reduce()s
    # larger images. Dispatch on dtype, not the PIL mode, so big-endian uint16
    # (whose dtype != np.uint16) is handled the same as native-order.
    if arr.dtype.kind == "f":
        rescale = _rescale_float_to_uint8
    elif arr.dtype.kind == "u" and arr.dtype.itemsize == 2:
        rescale = _rescale_uint16_to_uint8
    else:
        rescale = None
    if rescale is not None:
        if arr.ndim == 3 and arr.shape[2] == 4:
            # Alpha is opacity, not intensity: keep it out of the color
            # channels' contrast range and scale it by its own convention.
            arr = np.dstack([rescale(arr[..., :3]), _alpha_to_uint8(arr[..., 3])])
        else:
            arr = rescale(arr)

    img = Image.fromarray(arr)
    img.thumbnail(size)
    return img


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

    clean_tmp_dir()
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
            # If the image is one of these formats, retain the format after formatting
            # SUPPORTED_BROWSER_FORMATS = {
            #     imageio.plugins.pillow_legacy.JPEGFormat.Reader: "JPG",
            #     imageio.plugins.pillow_legacy.PNGFormat.Reader: "PNG",
            #     imageio.plugins.pillow_legacy.GIFFormat.Reader: "GIF"
            # }
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

    headers = {'Content-Type': Image.MIME[thumbnail_format], QUILT_INFO_HEADER: json.dumps(info)}
    return 200, data, headers
