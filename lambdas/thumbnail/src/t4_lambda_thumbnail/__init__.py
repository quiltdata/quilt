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
from math import isqrt

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
from dask import delayed
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
    (2048, 1536)
]
# Map URL parameters to actual sizes, e.g. 'w128h128' -> (128, 128)
SIZE_PARAMETER_MAP = {f'w{w}h{h}': (w, h) for w, h in SUPPORTED_SIZES}

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


def most_square_grid(x: int) -> tuple[int, int]:
    """
    Return the most-square grid (rows, cols) for laying out `x` cells: the factor
    pair of `x` whose two factors are closest together. The gap shrinks as the
    smaller factor grows, so the largest divisor of `x` that is <= sqrt(x) is the
    number of rows and its cofactor the number of columns.

    Requires x >= 1; x == 0 has no factor pair and raises ValueError.
    """
    rows = max(i for i in range(1, isqrt(x) + 1) if x % i == 0)
    return rows, x // rows


def _finite_clip_range(arr: np.ndarray) -> tuple[float, float] | None:
    """
    Percentile clip bounds (0.01, 99.99) over the finite values of `arr`, with a
    fallback to their full min/max when the percentiles collapse — almost all
    pixels share one value, e.g. a sparse label mask — so sparse data stays
    visible instead of clipping flat. Returns ``(lo, hi)``, or ``None`` when
    `arr` has no finite values.

    A returned ``(lo, hi)`` can still have ``hi == lo`` — a genuinely constant
    finite plane collapses both the percentiles and the min/max fallback — so
    callers must re-check and handle the no-contrast case themselves.

    Shared by _normalize_plane (float planes) and _rescale_finite_to_uint8 (float
    and wide/signed integers, where the finite mask is skipped) so their
    clip/fallback and non-finite filtering can't diverge (the same pixels must
    not render differently by reader path). The <=16-bit unsigned paths use
    _uint16_clip_range instead (histogram percentile, bounded memory).
    """
    # Compact to the finite values only when some are non-finite: the masked
    # copy would otherwise coexist with np.percentile's internal copy and double
    # the ranging-phase peak memory. Non-float planes carry no non-finite values,
    # so skip the mask (and its full-size scan) entirely.
    if arr.dtype.kind == "f":
        mask = np.isfinite(arr)
        finite = arr if mask.all() else arr[mask]
        del mask
    else:
        finite = arr
    if not finite.size:
        return None
    # When `finite` is the compacted copy (non-finite values were present) it is
    # a private throwaway whose element order stops mattering after ranging, so
    # let np.percentile partition it in place rather than copy again. When
    # `finite is arr` (all finite) the order must survive for the caller's
    # rescale, so don't overwrite.
    lo, hi = map(float, np.percentile(finite, (0.01, 99.99), overwrite_input=finite is not arr))
    if hi == lo:
        lo, hi = float(finite.min()), float(finite.max())
    return lo, hi


def _uint16_clip_range(arr: np.ndarray) -> tuple[float, float]:
    """
    Percentile clip bounds (0.01, 99.99) for an unsigned <=16-bit plane (uint16,
    uint8, or byte-swapped >u2 — anything `_percentile_uint16`'s 65536-bin
    histogram covers) via a histogram (bounded memory, no float64 copy of the
    plane), with the same min/max fallback as _finite_clip_range when the
    percentiles collapse. A returned ``(lo, hi)`` can still have ``hi == lo``
    (constant plane) — callers re-check. Integer planes carry no non-finite
    values, so there is nothing to filter. Shared by _normalize_plane and
    _rescale_uint16_to_uint8 so their range logic can't diverge.
    """
    lo, hi = _percentile_uint16(arr, (0.01, 99.99))
    if hi == lo:
        lo, hi = float(arr.min()), float(arr.max())
    return lo, hi


def _lut_uint_to_uint8(arr: np.ndarray, lo: float, hi: float) -> np.ndarray:
    """
    Rescale an unsigned <=16-bit plane to uint8 by applying _stretch_to_uint8 to
    each of the 65536 possible values once (the LUT), then gathering the plane
    through it. The float64 work is bounded to the 65536-entry table — no float64
    copy of the full plane (OOM is this lambda's failure mode on large images) —
    and building the LUT *through* _stretch_to_uint8 makes it the exact
    memoization of the eager float path, so the two can't diverge. Caller
    guarantees hi != lo. Shared by _rescale_uint16_to_uint8 and _normalize_plane
    so the raw and montage greyscale paths map identical pixels identically.
    """
    lut = np.arange(65536, dtype=np.float64)  # one entry per possible uint16 value
    return _stretch_to_uint8(lut, lo, hi)[arr]


def _normalize_plane(plane) -> np.ndarray:
    """
    Contrast-stretch one greyscale plane to uint8 (PIL mode L) for the n-dim
    montage / projection path. The per-plane work is eager NumPy so finite-aware
    percentiles and the histogram/LUT rescale stay exact; norm_img wraps this in
    dask.delayed so the montage releases each plane once it's been copied in,
    rather than holding all N (see norm_img).

    Shares its range helpers (_uint16_clip_range / _finite_clip_range), uint8 LUT
    (_lut_uint_to_uint8) and affine stretch (_stretch_to_uint8) with the raw
    greyscale rescales (_rescale_uint16_to_uint8 / _rescale_finite_to_uint8), so
    the same pixels can't render differently by reader path. The deliberate
    difference: a constant (or empty / all-NaN) plane renders black here, where
    the raw paths keep its level — a blank montage channel should read as empty,
    a standalone flat image should not vanish.
    """
    arr = np.asarray(plane)
    if not arr.size:
        # Empty plane: nothing to range over -> black. _uint16_clip_range has no
        # emptiness guard (the float path's _finite_clip_range returns None for
        # the same effect), so guard both branches here.
        return np.zeros(arr.shape, np.uint8)

    # Unsigned <=16-bit planes (the common microscopy case): range via histogram
    # and rescale via a 65536-entry LUT, with no float64 copy of the full plane.
    # Bit-identical to the float path below for the same (lo, hi) — the LUT
    # memoizes the same per-pixel math.
    if arr.dtype.kind == "u" and arr.dtype.itemsize <= 2:
        lo, hi = _uint16_clip_range(arr)
        if hi == lo:
            return np.zeros(arr.shape, np.uint8)  # constant plane -> black
        return _lut_uint_to_uint8(arr, lo, hi)

    # Float (and any other) planes: range in float64 with finite-aware
    # percentiles — full precision, where the raw float path trades to float32 to
    # save memory; this keeps the montage's float planes at full ranging precision.
    # copy=False skips the copy only when `arr` is already float64; the in-place
    # math below then mutates it, so this assumes `arr` is private. It is here:
    # np.asarray of the computed dask block (or of a non-float64 array, which
    # astype copies) yields a fresh array. A future direct caller that hands in
    # a float64 array it still needs would see it mutated.
    arr = arr.astype(np.float64, copy=False)

    rng = _finite_clip_range(arr)
    if rng is None:
        # No finite values to range over; render black (as the uint path does).
        return np.zeros(arr.shape, np.uint8)
    lo, hi = rng
    if hi == lo:
        # Constant plane: render black deterministically rather than dividing
        # 0/0 -> NaN -> an undefined cast.
        return np.zeros(arr.shape, np.uint8)

    # Shared affine stretch -> uint8, the same arithmetic as the raw float path.
    return _stretch_to_uint8(arr, lo, hi)


def norm_img(img: da.Array) -> da.Array:
    """
    Lazily contrast-stretch a greyscale plane to uint8 (PIL mode L) for the
    n-dim montage / projection path; color planes (YXC / YXS) are returned
    unchanged.

    _normalize_plane is eager NumPy, but wrapped in dask.delayed so the plane is
    a deferred task in the montage graph rather than a concrete array. dask
    materializes each plane when the montage is computed and releases it once it
    has been copied into the output, so the planes don't stay resident through
    the downstream resize. Returning a concrete array instead (da.from_array)
    bakes every plane into the graph, keeping all N resident as long as the
    montage is referenced — and handle_image holds the montage through
    generate_thumbnail's resize, so on large multi-channel images that OOMs (the
    documented failure mode). The peak while the montage itself is assembled is
    similar either way; the win is not carrying the planes into the resize.

    da.from_delayed trusts _normalize_plane to return an array of this shape and
    dtype — keep them in sync (a mismatch corrupts the graph rather than raising).
    """
    if len(img.shape) == 3:
        # leave color images alone
        # XXX: is this correct?
        # No uint8 cast needed: color planes carry normalized=False, so
        # generate_thumbnail rescales them by dtype downstream. Only the greyscale
        # path below returns uint8 — which is what the normalized passthrough in
        # generate_thumbnail relies on to render mode L.
        return img
    return da.from_delayed(
        delayed(_normalize_plane)(img), shape=img.shape, dtype=np.uint8,
    )


def _format_n_dim_ndarray(img: BioImage) -> tuple[da.Array, bool]:
    # Returns (array, normalized): normalized is True only when norm_img
    # contrast-stretched the data to uint8 (a greyscale montage / Z-projection,
    # passed straight through to an 8-bit PNG). Raw planes and color (which
    # norm_img leaves untouched) return False, to be rescaled downstream by dtype.
    # Even though the reader was n-dim, check if the actual data is simply greyscale and return
    if len(img.reader.dask_data.shape) == 2:
        return img.reader.dask_data, False

    # Even though the reader was n-dim,
    # check if the actual data is similar to YXC ("YX-RGBA" or "YX-RGB") and return
    if (len(img.reader.dask_data.shape) == 3 and (
            img.reader.dask_data.shape[2] == 3 or img.reader.dask_data.shape[2] == 4)):
        return img.reader.dask_data, False

    # Check which dimensions are available
    # BioImage makes strong assumptions about dimension ordering

    # Reduce the array down to 2D + Channels when possible
    # Always choose middle time slice
    if "T" in img.reader.dims.order:
        img = BioImage(img.dask_data[img.dask_data.shape[0] // 2 : img.dask_data.shape[0] // 2 + 1, :, :, :, :])

    # norm_img normalizes greyscale but passes color (an "S" samples axis)
    # through, so `not has_samples` is the normalized flag below (and drives s_pad).
    has_samples = "S" in img.reader.dims.order

    # Keep Channel data, but max project when possible
    if "C" in img.reader.dims.order and img.dask_data.shape[1] > 1:
        # Each channel is normalized lazily (norm_img returns a dask graph), then
        # laid out in the most-square grid: every cell padded 5px on its top and
        # left, the whole montage padded 5px on its bottom and right. Keeping the
        # planes lazy lets dask release each once it has been copied into the
        # montage, so they don't stay resident through the downstream resize (see
        # norm_img); a concrete-array assembly would hold all N until then.
        projections = []
        s_pad = ((0, 0),) if has_samples else ()
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

        # Lay the channels out in the most-square grid (6 channels -> (2, 3))
        grid_shape = most_square_grid(len(projections))

        # Make rows of images
        # Use a counter so that we don't have to use `projections.pop` which is O(N)
        rows = []
        proj_counter = 0
        for y_i in range(grid_shape[0]):
            row = []
            for x_i in range(grid_shape[1]):
                row.append(projections[proj_counter])
                proj_counter += 1

            rows.append(row)

        # Concatenate each row then concatenate all rows together into a single 2D image
        merged = [da.concatenate(row, axis=1) for row in rows]

        # Add padding on the entire bottom and entire right side of the thumbnail
        montage = da.pad(da.concatenate(merged, axis=0), ((0, 5), (0, 5)) + s_pad, mode="constant")
        return montage, not has_samples

    # If there is a Z dimension we need to do _something_ the get a 2D out.
    # Without causing a war about which projection method is best
    # we will simply use a max projection on files that contain a Z dimension
    if "Z" in img.reader.dims.order:
        return norm_img(img.dask_data[0, 0, :, :, :].max(axis=0)), not has_samples

    return norm_img(img.dask_data[0, 0, 0, :, :]), not has_samples


def format_aicsimage_to_prepped(img: BioImage) -> tuple[da.Array, bool]:
    """
    Wrap the format-n-dim function, returning its ``(array, normalized)`` (see
    _format_n_dim_ndarray for the flag) and reversing CZI's BGR samples to RGB.
    Non-n-dim readers return their raw data (normalized=False).
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
        arr, normalized = _format_n_dim_ndarray(img)
        # CZI color is always BGR (Bgr24/Bgr48/Bgr96Float, 3-sample; no RGB/BGRA
        # layout) and bioio-czi exposes the samples raw, so reverse them to RGB.
        if (
            isinstance(img.reader, bioio_czi.reader.Reader)
            and "S" in img.reader.dims.order
            and arr.ndim >= 3
            and arr.shape[-1] == 3
        ):
            arr = arr[..., ::-1]
        return arr, normalized

    return img.reader.dask_data, False


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
    arr, normalized = format_aicsimage_to_prepped(img)

    img = generate_thumbnail(arr.compute(), size, normalized=normalized)

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
    # Caller contract: arr is a non-empty unsigned <=16-bit array, qs are
    # percentiles in [0, 100]. Reached only via _uint16_clip_range (from
    # _rescale_uint16_to_uint8 and _normalize_plane); both guard emptiness and
    # pass constant qs first, so this skips revalidating them.
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
        # >= 0.5), but the difference is sub-ULP and vanishes in both the
        # _rescale_uint16_to_uint8 and _normalize_plane uint8 rescales, so
        # thumbnails are unchanged.
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
    lo, hi = _uint16_clip_range(arr)
    if hi == lo:
        # Constant image: keep the brightness level.
        return (arr >> 8).astype(np.uint8)
    return _lut_uint_to_uint8(arr, lo, hi)


def _rescale_finite_to_uint8(arr):
    # Contrast-stretch a float or signed/wide-unsigned integer plane (float16/32/64,
    # int8/16/32/64, uint32/64) to uint8 via a float copy. uint8/uint16 use the
    # bounded histogram+LUT path instead; these dtypes have too many values to
    # histogram, so they share _finite_clip_range and _stretch_to_uint8 here. The
    # range is computed jointly across channels for color arrays (no per-channel
    # skew); non-finite values are excluded — NaN renders black, ±inf saturates to
    # the range ends.
    rng = _finite_clip_range(arr)
    if rng is None:
        return np.zeros(arr.shape, np.uint8)  # no finite values to range over
    lo, hi = rng
    is_float = arr.dtype.kind == "f"
    if hi == lo:
        # Constant image: keep the level. Floats assume the [0, 1] convention when
        # the value allows it (tolerating one output quantum above 1, so a nudged
        # 1.0 stays white); integers keep the absolute level. Both clamp to [0, 255].
        level = lo * 255 if is_float and 0.0 <= lo <= 256 / 255 else lo
        return np.full(arr.shape, np.clip(round(level), 0, 255), np.uint8)
    # float32 halves the working copy where it represents the data exactly
    # (float16/32, int8/16); wider floats keep their own precision, and wider ints
    # need float64 — float32 would quantize away a low-contrast band at a high
    # offset (uint32/uint64 past float32's 24-bit mantissa). Hence float <= 4
    # bytes, int <= 2.
    work = np.float32 if arr.dtype.itemsize <= (4 if is_float else 2) else np.float64
    return _stretch_to_uint8(arr.astype(work), lo, hi)


def _stretch_to_uint8(out, lo, hi):
    # Affine-stretch a private float working array to uint8 in place:
    # (out - lo) * 255 / (hi - lo), then round / clamp / zero-NaN via
    # _saturate_to_uint8 (so values outside [lo, hi] pin to the range ends,
    # ±inf saturate to white/black, NaN -> black). Shared by the eager float
    # rescales — _normalize_plane's float planes and _rescale_finite_to_uint8 —
    # and by _lut_uint_to_uint8 (applied to the 65536-entry LUT), so the same
    # pixels can't render differently by reader path; each caller picks its own
    # working dtype first. Caller guarantees hi != lo and that `out` is private
    # (mutated in place).
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
    # for floats, the full dtype range for integers — rather than
    # contrast-stretching it like the color channels. NaN renders
    # transparent.
    if alpha.dtype.kind == "f":
        out = alpha.astype(np.float32)
        out *= 255
        return _saturate_to_uint8(out)
    if alpha.dtype.kind == "i":
        # Signed alpha is nonsensical (no reader emits it) but reachable now that
        # signed RGBA routes here; scale the positive range to full opacity so
        # the max maps to 255 (a right-shift would land it at 127), and let the
        # clamp in _saturate_to_uint8 render negatives transparent.
        out = alpha.astype(np.float32)
        out *= 255 / np.iinfo(alpha.dtype).max
        return _saturate_to_uint8(out)
    # Unsigned alpha: the full dtype range is full opacity, so scale by the high
    # byte (uint16 -> >>8, uint32 -> >>24, uint64 -> >>56).
    return (alpha >> (8 * (alpha.dtype.itemsize - 1))).astype(np.uint8)


def generate_thumbnail(arr, size, *, normalized=False):
    # A `normalized` array (from norm_img — a greyscale montage / Z-projection
    # already contrast-stretched to uint8) passes straight through to an 8-bit
    # mode-L PNG; the producer flags it, so we don't infer it from the data.
    # Anything else is raw: contrast-stretch what PIL can't render directly to uint8 — it
    # only builds color from uint8, can't construct float16 or 64-bit ints, can't
    # save mode-F greyscale as PNG, and wide/signed integer greyscale decodes to an
    # I;16 "limited support" mode
    # (https://pillow.readthedocs.io/en/stable/handbook/concepts.html#modes) that
    # thumbnail() rejects when it reduce()s larger images. Dispatch on dtype, not
    # PIL mode, so big-endian uint16 is handled like native-order.
    if normalized:
        # Already uint8 -> pass through, then resized at 8-bit below like every
        # other path. Resizing the montage at 8-bit rather than at higher
        # precision is a deliberate, sub-perceptual tradeoff on a lossy preview.
        rescale = None
    elif arr.dtype.kind == "u" and arr.dtype.itemsize == 2:
        rescale = _rescale_uint16_to_uint8
    elif arr.dtype != np.uint8 and arr.dtype.kind in "fiu":
        # float, signed int, or wide unsigned (float16/32/64, int8/16/32/64,
        # uint32/64): contrast-stretch via a float copy. A normalized montage is
        # handled above, so a raw int32 here is real image data, stretched like
        # any other wide integer.
        rescale = _rescale_finite_to_uint8
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

    headers = {
        'Content-Type': Image.MIME[thumbnail_format],
        QUILT_INFO_HEADER: json.dumps(info)
    }
    return 200, data, headers
