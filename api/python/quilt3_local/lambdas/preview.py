"""Provide the head of a file from local-mode object storage."""

import io
import os
from contextlib import redirect_stderr
from urllib.parse import urlparse

import pandas
import requests

from .. import settings
from .._upstream import load_module
from .shared.decorator import api, validate
from .shared.utils import get_default_origins, make_json_response

_shared_preview = load_module("lambdas.shared.preview")

CATALOG_LIMIT_BYTES = _shared_preview.CATALOG_LIMIT_BYTES
CATALOG_LIMIT_LINES = _shared_preview.CATALOG_LIMIT_LINES
TRUNCATED = _shared_preview.TRUNCATED
extract_excel = _shared_preview.extract_excel
extract_fcs = _shared_preview.extract_fcs
extract_parquet = _shared_preview.extract_parquet
get_bytes = _shared_preview.get_bytes
get_preview_lines = _shared_preview.get_preview_lines
remove_pandas_footer = _shared_preview.remove_pandas_footer

CHUNK = 1024 * 8
LAMBDA_MAX_OUT = 6_000_000
MIN_VCF_COLS = 8
S3_DOMAIN_SUFFIX = ".amazonaws.com"

FILE_EXTENSIONS = ["csv", "excel", "fcs", "ipynb", "parquet", "vcf"]
TEXT_TYPES = ["bed", "txt"]
FILE_EXTENSIONS.extend(TEXT_TYPES)
EXTRACT_PARQUET_MAX_BYTES = 10_000

SCHEMA = {
    "type": "object",
    "properties": {
        "url": {"type": "string"},
        "sep": {"minLength": 1, "maxLength": 1},
        "max_bytes": {"type": "string"},
        "line_count": {"type": "string"},
        "input": {"enum": FILE_EXTENSIONS},
        "exclude_output": {"enum": ["true", "false"]},
        "compression": {"enum": ["gz"]},
    },
    "required": ["url", "input"],
    "additionalProperties": False,
}

pandas.set_option("min_rows", 50)


def _is_valid_source_url(url: str) -> bool:
    parsed_url = urlparse(url, allow_fragments=False)
    if settings.is_local_proxy_url(url):
        return True
    return (
        parsed_url.scheme == "https"
        and parsed_url.netloc.endswith(S3_DOMAIN_SUFFIX)
        and parsed_url.username is None
        and parsed_url.password is None
    )


def _str_to_line_count(raw: str) -> int:
    line_count = int(raw)
    if line_count < 1:
        raise ValueError("line_count must be at least 1")
    return line_count


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    url = request.args["url"]
    input_type = request.args.get("input")
    compression = request.args.get("compression")
    separator = request.args.get("sep") or ","
    exclude_output = request.args.get("exclude_output") == "true"
    try:
        max_bytes = int(request.args.get("max_bytes", CATALOG_LIMIT_BYTES))
    except ValueError as error:
        return make_json_response(400, {"title": "Unexpected max_bytes= value", "detail": str(error)})

    if not _is_valid_source_url(url):
        return make_json_response(400, {"title": "Invalid url=. Expected S3 virtual-host URL or local object proxy URL."})

    try:
        line_count = _str_to_line_count(request.args.get("line_count", str(CATALOG_LIMIT_LINES)))
    except ValueError as error:
        return make_json_response(400, {"title": "Unexpected line_count= value", "detail": str(error)})

    resp = requests.get(url, stream=True)
    if not resp.ok:
        return make_json_response(resp.status_code, {"error": resp.reason, "text": resp.text})

    content_iter = resp.iter_content(CHUNK)
    if input_type == "csv":
        html, info = extract_csv(get_preview_lines(content_iter, compression, line_count, max_bytes), separator)
    elif input_type == "excel":
        html, info = extract_excel(get_bytes(content_iter, compression))
    elif input_type == "fcs":
        html, info = extract_fcs(get_bytes(content_iter, compression))
    elif input_type == "ipynb":
        html, info = extract_ipynb(get_bytes(content_iter, compression), exclude_output)
    elif input_type == "parquet":
        html, info = extract_parquet(get_bytes(content_iter, compression), max_bytes=EXTRACT_PARQUET_MAX_BYTES)
    elif input_type == "vcf":
        html, info = extract_vcf(get_preview_lines(content_iter, compression, line_count, max_bytes))
    elif input_type in TEXT_TYPES:
        html, info = extract_txt(get_preview_lines(content_iter, compression, line_count, max_bytes))
    else:
        assert False, f"unexpected input_type: {input_type}"

    return make_json_response(resp.status_code, {"info": info, "html": html})


def extract_csv(head, separator):
    warnings_ = io.StringIO()
    try:
        data = pandas.read_csv(io.StringIO("\n".join(head)), sep=separator)
    except pandas.errors.ParserError:
        with redirect_stderr(warnings_):
            data = pandas.read_csv(
                io.StringIO("\n".join(head)),
                engine="python",
                on_bad_lines="warn",
                sep=None,
            )
    html = remove_pandas_footer(data._repr_html_())
    return html, {"note": TRUNCATED, "warnings": warnings_.getvalue()}


def extract_ipynb(file_, exclude_output: bool):
    import nbformat
    from nbconvert import HTMLExporter

    file_.seek(0, os.SEEK_END)
    size = file_.tell()
    if size > LAMBDA_MAX_OUT:
        exclude_output = True
    file_.seek(0, os.SEEK_SET)

    info = {}
    if exclude_output:
        info["warnings"] = "Omitted cell outputs to reduce notebook size"

    html_exporter = HTMLExporter(template_name="basic", exclude_output=exclude_output)
    notebook = nbformat.read(file_, 4)
    html, _ = html_exporter.from_notebook_node(notebook)
    return html, info


def extract_vcf(head):
    meta = []
    header = None
    data = []
    variants = []
    limit = MIN_VCF_COLS + 1

    for line in head:
        if line.startswith("##"):
            meta.append(line)
        elif line.startswith("#"):
            header = line
        else:
            variants.append(line.split("\t", limit))
            data.append(line)

    if header is None:
        return "", {"warnings": "Invalid VCF header"}

    columns = header.lstrip("#").split("\t", limit)
    df = pandas.DataFrame(variants, columns=columns)
    html = remove_pandas_footer(df._repr_html_())
    return html, {"note": TRUNCATED, "meta": meta, "lines": data}


def extract_txt(head):
    return "", {
        "data": {
            "head": head,
            "tail": [],
        },
        "note": TRUNCATED,
    }
