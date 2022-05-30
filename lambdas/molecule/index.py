"""
Convert molecele files from one format to another.
"""
import os
import requests
import subprocess
import tempfile
from urllib.parse import urlparse

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.utils import get_default_origins, make_json_response

FORMATS = {
    'chemical/x-mdl-molfile': 'mol',
}

SCHEMA = {
    'type': 'object',
    'properties': {
        'url': {
            'type': 'string'
        },
        'format': {
            'enum': list(FORMATS)
        },
    },
    'required': ['url', 'format'],
    'additionalProperties': False
}

OBABEL = '/usr/bin/obabel'


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    """
    Convert molecule formats
    """
    url = request.args['url']
    format = request.args['format']

    input_base, input_ext = os.path.splitext(url)
    if input_ext == '.gz':
        _, input_ext = os.path.splitext(input_base)

    resp = requests.get(url)

    if not resp.ok:
        # Errored, return error code
        ret_val = {
            'error': resp.reason,
            'text': resp.text,
        }
        return make_json_response(resp.status_code, ret_val)

    with tempfile.TemporaryDirectory() as tmp_dir:
        src_file_path = os.path.join(tmp_dir, f"file.{input_ext}")
        with open(src_file_path, "xb") as src_file:
            src_file.write(resp.content)

            with tempfile.NamedTemporaryFile() as output_file:
                p = subprocess.run([
                    OBABEL,
                    "-i", input_ext,
                    src_file_path,
                    "-o", FORMATS[format],
                    "-O", output_file.name
                ], check=False, stdin=subprocess.DEVNULL, stderr=subprocess.PIPE)

                if p.returncode != 0:
                    return make_json_response(403, {'error': p.stderr.decode()})

                data = output_file.read()

    parsed = urlparse(url)
    filename = parsed.path.rpartition('/')[-1]

    headers = {
        'Content-Type': format,
        'Title': f"Conversion of {filename} from {input_ext} to {FORMATS[format]}",
        'Content-Disposition': f'inline; filename="{filename}"',
    }

    return 200, data, headers
