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
        },
        'format': {
            'enum': ['mp4', 'webm']
        },
        'width': {
            'type': 'string'
        },
        'height': {
            'type': 'string'
        },
        'duration': {
            'type': 'string'
        },
        'timelimit': {
            'type': 'string'
        },
    },
    'required': ['url'],
    'additionalProperties': False
}

FFMPEG = '/opt/bin/ffmpeg'

# Lambda has a 6MB limit for request and response,
# so limit the preview to 6MB, minus 4KB for headers, etc.
MAX_VIDEO_SIZE = 6 * 1024 * 1024 - 4 * 1024

@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    """
    Generate previews for videos in S3
    """
    url = request.args['url']
    format = request.args.get('format', 'mp4')
    width_str = request.args.get('width', '320')
    height_str = request.args.get('width', '240')
    duration_str = request.args.get('duration', '5')

    timelimit = request.args.get('timelimit', '20')

    try:
        width = int(width_str)
        if not (10 <= width <= 640):
            raise ValueError
    except ValueError:
        return make_json_response(400, {'error': "Invalid 'width'"})

    try:
        height = int(height_str)
        if not (10 <= height <= 480):
            raise ValueError
    except ValueError:
        return make_json_response(400, {'error': "Invalid 'height'"})

    try:
        duration = float(duration_str)
        if not (0 < duration <= 10):
            raise ValueError
    except ValueError:
        return make_json_response(400, {'error': "Invalid 'duration'"})

    with tempfile.NamedTemporaryFile() as output_file:
        p = subprocess.run([
            FFMPEG,
            "-t", str(duration),
            "-i", url,
            "-f", format,
            "-vf", ','.join([
                f"scale=w={width}:h={height}:force_original_aspect_ratio=decrease",
                f"crop='iw-mod(iw\\,2)':'ih-mod(ih\\,2)'",
            ]),
            # "-timelimit", str(request.context.get_remaining_time_in_millis() // 1000 - 3),  # 3 seconds for padding
            "-timelimit", timelimit,
            "-fs", str(MAX_VIDEO_SIZE),
            "-y",  # Overwrite output file
            "-v", "error",  # Only print errors
            output_file.name
        ], check=False, stdin=subprocess.DEVNULL, stderr=subprocess.PIPE)

        if p.returncode != 0:
            return make_json_response(403, {'error': p.stderr.decode()})

        data = output_file.read()

    return 200, data, {'Content-Type': f'video/{format}'}
