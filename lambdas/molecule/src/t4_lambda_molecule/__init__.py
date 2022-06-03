"""
Convert molecule files from one format to another.
"""
import gzip
import os
import subprocess
from urllib.parse import urlparse

import requests

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.utils import get_default_origins, make_json_response

FORMATS = {
    "chemical/x-mdl-molfile": "mol",
}

SCHEMA = {
    "type": "object",
    "properties": {
        "url": {
            "type": "string",
        },
        "format": {
            "enum": list(FORMATS),
        },
    },
    "required": ["url", "format"],
    "additionalProperties": False,
}

OBABEL = "/usr/bin/obabel"


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    """
    Convert molecule formats
    """
    url = request.args["url"]
    format_ = request.args["format"]

    resp = requests.get(url)
    if not resp.ok:
        # Errored, return error code
        ret_val = {
            "error": resp.reason,
            "text": resp.text,
        }
        return make_json_response(resp.status_code, ret_val)
    input_bytes = resp.content

    filename = urlparse(url).path.rpartition("/")[-1]
    input_base, input_ext = os.path.splitext(filename)
    if input_ext == ".gz":
        input_ext = os.path.splitext(input_base)[1]
        input_bytes = gzip.decompress(input_bytes)
    input_ext = input_ext[1:]

    p = subprocess.run(
        (
            OBABEL,
            f"-i{input_ext}",
            f"-o{FORMATS[format_]}",
        ),
        check=False,
        input=input_bytes,
        capture_output=True,
    )

    if p.returncode != 0:
        return make_json_response(403, {"error": p.stderr.decode()})

    data = p.stdout

    headers = {
        "Content-Type": format_,
        "Content-Disposition": f'inline; filename="{input_base}.{FORMATS[format_]}"',
    }

    return 200, data, headers
