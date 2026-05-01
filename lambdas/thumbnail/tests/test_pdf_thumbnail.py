from types import SimpleNamespace

import pytest
from PIL import Image

import t4_lambda_thumbnail.pdf_thumbnail as pdf_thumbnail


def test_run_command_wraps_missing_binary(mocker):
    mocker.patch.object(pdf_thumbnail.subprocess, "run", side_effect=FileNotFoundError())

    with pytest.raises(pdf_thumbnail.PDFThumbError, match="Missing required command: pdfinfo"):
        pdf_thumbnail._run_command("pdfinfo")


def test_run_command_wraps_subprocess_error(mocker):
    error = pdf_thumbnail.subprocess.CalledProcessError(
        1,
        ["pdfinfo"],
        stderr="page count failed",
    )
    mocker.patch.object(pdf_thumbnail.subprocess, "run", side_effect=error)

    with pytest.raises(pdf_thumbnail.PDFThumbError, match="page count failed"):
        pdf_thumbnail._run_command("pdfinfo")


def test_get_pdf_render_dpi_defaults_and_clamps(monkeypatch):
    monkeypatch.delenv("PDF_PREVIEW_DPI", raising=False)
    assert pdf_thumbnail.get_pdf_render_dpi() == pdf_thumbnail.DEFAULT_PDF_RENDER_DPI

    monkeypatch.setenv("PDF_PREVIEW_DPI", "36")
    assert pdf_thumbnail.get_pdf_render_dpi() == 72

    monkeypatch.setenv("PDF_PREVIEW_DPI", "600")
    assert pdf_thumbnail.get_pdf_render_dpi() == pdf_thumbnail.MAX_PDF_RENDER_DPI


def test_get_pdf_render_dpi_rejects_invalid_value(monkeypatch):
    monkeypatch.setenv("PDF_PREVIEW_DPI", "fast")

    with pytest.raises(pdf_thumbnail.PDFThumbError, match="Invalid PDF_PREVIEW_DPI"):
        pdf_thumbnail.get_pdf_render_dpi()


def test_resize_pdf_page_keeps_small_image():
    img = Image.new("RGB", (64, 32))

    assert pdf_thumbnail.resize_pdf_page(img, size=128) is img


def test_resize_pdf_page_downscales_wider_image():
    img = Image.new("RGB", (200, 100))

    resized = pdf_thumbnail.resize_pdf_page(img, size=80)

    assert resized.size == (80, 40)


def test_render_pdf_page_uses_pdfium_when_pdftoppm_is_missing(monkeypatch):
    expected = Image.new("RGB", (10, 20))

    def render_mock(**kwargs):
        return expected

    monkeypatch.setattr(pdf_thumbnail.shutil, "which", lambda _: None)
    monkeypatch.setattr(pdf_thumbnail, "_render_pdf_page_with_pdfium", render_mock)

    result = pdf_thumbnail.render_pdf_page(path="demo.pdf", page=3, dpi=144)

    assert result is expected


def test_render_pdf_page_uses_pdftoppm_output(monkeypatch, tmp_path):
    rendered = tmp_path / "page.jpg"
    Image.new("RGB", (12, 34)).save(rendered)

    class TempDir:
        def __enter__(self):
            return str(tmp_path)

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(pdf_thumbnail.shutil, "which", lambda _: "/usr/bin/pdftoppm")
    monkeypatch.setattr(pdf_thumbnail.tempfile, "TemporaryDirectory", TempDir)
    monkeypatch.setattr(pdf_thumbnail, "_run_command", lambda *args: None)

    result = pdf_thumbnail.render_pdf_page(path="demo.pdf", page=4, dpi=150)

    assert result.size == (12, 34)


def test_count_pdf_pages_uses_pdfium_when_pdfinfo_is_missing(monkeypatch):
    monkeypatch.setattr(pdf_thumbnail.shutil, "which", lambda _: None)
    monkeypatch.setattr(pdf_thumbnail, "_count_pdf_pages_with_pdfium", lambda path: 8)

    assert pdf_thumbnail.count_pdf_pages("demo.pdf") == 8


def test_count_pdf_pages_parses_pdfinfo_output(monkeypatch):
    monkeypatch.setattr(pdf_thumbnail.shutil, "which", lambda _: "/usr/bin/pdfinfo")
    monkeypatch.setattr(
        pdf_thumbnail,
        "_run_command",
        lambda *args: SimpleNamespace(stdout="Title: demo\nPages:          8\n"),
    )

    assert pdf_thumbnail.count_pdf_pages("demo.pdf") == 8


def test_count_pdf_pages_errors_when_pdfinfo_output_has_no_pages(monkeypatch):
    monkeypatch.setattr(pdf_thumbnail.shutil, "which", lambda _: "/usr/bin/pdfinfo")
    monkeypatch.setattr(
        pdf_thumbnail,
        "_run_command",
        lambda *args: SimpleNamespace(stdout="Title: demo\nProducer: unit-test\n"),
    )

    with pytest.raises(pdf_thumbnail.PDFThumbError, match="Unable to determine PDF page count"):
        pdf_thumbnail.count_pdf_pages("demo.pdf")
