"""
Generate thumbnails for images in S3.
"""
import base64
from io import BytesIO
import json
import os

from PIL import Image
import requests

from t4_lambda_shared.decorator import api, validate
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
        }
    },
    'required': ['url', 'size'],
    'additionalProperties': False
}

@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    """
    Generate thumbnails for images in S3
    """
    url = request.args['url']
    size = SIZE_PARAMETER_MAP[request.args['size']]
    output = request.args.get('output', 'json')

    resp = requests.get(url)
    if resp.ok:
        image_bytes = BytesIO(resp.content)
        with Image.open(image_bytes) as image:
            orig_format = image.format
            orig_size = image.size
            image.thumbnail(size)
            thumbnail_size = image.size
            thumbnail_bytes = BytesIO()
            image.save(thumbnail_bytes, image.format)

        data = thumbnail_bytes.getvalue()

        info = {
            'original_format': orig_format,
            'original_size': orig_size,
            'thumbnail_format': orig_format,
            'thumbnail_size': thumbnail_size,
        }

        if output == 'json':
            ret_val = {
                'info': info,
                'thumbnail': base64.b64encode(data).decode(),
            }
            return make_json_response(200, ret_val)
        else:
            headers = {
                'Content-Type': Image.MIME[orig_format],
                'X-Quilt-Info': json.dumps(info)
            }
            return 200, data, headers

    else:
        ret_val = {
            'error': resp.reason
        }
        return make_json_response(resp.status_code, ret_val)
