from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile

import pypdfium2
from PIL import Image

DEFAULT_PDF_RENDER_DPI = 300
MAX_PDF_RENDER_DPI = 300


class PDFThumbError(Exception):
    pass


def _run_command(*argv: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(argv, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise PDFThumbError(f"Missing required command: {argv[0]}") from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or str(exc)).strip()
        raise PDFThumbError(detail) from exc


def _render_pdf_page_with_pdfium(*, path: str, page: int, dpi: int) -> Image.Image:
    document = pypdfium2.PdfDocument(path)
    page_index = page - 1
    if page_index < 0 or page_index >= len(document):
        raise PDFThumbError(f"Page {page} is out of range for {path}")
    bitmap = document[page_index].render(scale=dpi / 72)
    return bitmap.to_pil()


def _count_pdf_pages_with_pdfium(path: str) -> int:
    return len(pypdfium2.PdfDocument(path))


def get_pdf_render_dpi() -> int:
    raw = os.environ.get("PDF_PREVIEW_DPI")
    if raw is None:
        return DEFAULT_PDF_RENDER_DPI
    try:
        dpi = int(raw)
    except ValueError as exc:
        raise PDFThumbError(f"Invalid PDF_PREVIEW_DPI: {raw!r}") from exc
    return max(72, min(dpi, MAX_PDF_RENDER_DPI))


def resize_pdf_page(img: Image.Image, *, size: int) -> Image.Image:
    if img.width <= size:
        return img

    height = max(1, round(img.height * size / img.width))
    return img.resize((size, height), Image.Resampling.LANCZOS)


def render_pdf_page(*, path: str, page: int, dpi: int) -> Image.Image:
    if shutil.which("pdftoppm") is None:
        return _render_pdf_page_with_pdfium(path=path, page=page, dpi=dpi)

    with tempfile.TemporaryDirectory() as out_dir:
        out_base = os.path.join(out_dir, "page")
        _run_command(
            "pdftoppm",
            "-f",
            str(page),
            "-l",
            str(page),
            "-r",
            str(dpi),
            "-singlefile",
            "-jpeg",
            path,
            out_base,
        )
        rendered = out_base + ".jpg"
        if not os.path.exists(rendered):
            raise PDFThumbError("pdftoppm did not produce an output image")
        with Image.open(rendered) as img:
            return img.copy()


def count_pdf_pages(path: str) -> int:
    if shutil.which("pdfinfo") is None:
        return _count_pdf_pages_with_pdfium(path)

    result = _run_command("pdfinfo", path)
    match = re.search(r"^Pages:\s+(\d+)\s*$", result.stdout, re.MULTILINE)
    if match is None:
        raise PDFThumbError("Unable to determine PDF page count")
    return int(match.group(1))
