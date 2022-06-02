"""
Convert molecule files from one format to another.
"""
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

    filename = urlparse(url).path.rpartition("/")[-1]
    input_base, input_ext = os.path.splitext(filename)
    if input_ext == ".gz":
        _, input_ext = os.path.splitext(input_base)
    input_ext = input_ext[1:]

    resp = requests.get(url)
    if not resp.ok:
        # Errored, return error code
        ret_val = {
            "error": resp.reason,
            "text": resp.text,
        }
        return make_json_response(resp.status_code, ret_val)

    p = subprocess.run(
        (
            OBABEL,
            f"-i{input_ext}",
            f"-o{FORMATS[format_]}",
        ),
        check=False,
        input=resp.content,
        capture_output=True,
    )

    if p.returncode != 0:
        return make_json_response(403, {"error": p.stderr.decode()})

    data = p.stdout

    headers = {
        "Content-Type": format_,
        "Content-Disposition": f'inline; filename="{filename}"',
    }

    return 200, data, headers
