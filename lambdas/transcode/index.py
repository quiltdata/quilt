"""
Generate video previews for videos in S3.
"""
import subprocess
import tempfile

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.utils import get_default_origins, make_json_response


SCHEMA = {
    'type': 'object',
    'properties': {
        'url': {
            'type': 'string'
        }
    },
    'required': ['url'],
    'additionalProperties': False
}

FFMPEG = '/opt/bin/ffmpeg'
FFMPEG_TIME_LIMIT = 20
DURATION = 5
WIDTH = 320
HEIGHT = 240


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    """
    Generate thumbnails for images in S3
    """
    url = request.args['url']

    with tempfile.NamedTemporaryFile(suffix='.mp4') as output_file:
        p = subprocess.run([
            FFMPEG,
            "-t", str(DURATION),
            "-i", url,
            "-vf", f"scale=w={WIDTH}:h={HEIGHT}:force_original_aspect_ratio=decrease",
            "-timelimit", str(FFMPEG_TIME_LIMIT),
            "-y",  # Overwrite output file
            "-v", "error",  # Only print errors
            output_file.name
        ], stdin=subprocess.DEVNULL, stderr=subprocess.PIPE)

        if p.returncode != 0:
            return make_json_response(403, {'error': p.stderr.decode()})

        data = output_file.read()

    return 200, data, {'Content-Type': 'video/mp4'}
