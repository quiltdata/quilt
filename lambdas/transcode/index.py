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
    },
    'required': ['url'],
    'additionalProperties': False
}

FFMPEG = '/opt/bin/ffmpeg'

# Lambda has a 6MB limit for request and response, however, base64 adds 33% overhead.
# Also, leave a few KB for the headers.
MAX_VIDEO_SIZE = 6 * 1024 * 1024 * 3 // 4 - 4096

MIN_WIDTH = 10
MAX_WIDTH = 640
MIN_HEIGHT = 10
MAX_HEIGHT = 480


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    """
    Generate previews for videos in S3
    """
    url = request.args['url']
    format = request.args.get('format', 'mp4')
    width_str = request.args.get('width', '320')
    height_str = request.args.get('height', '240')
    duration_str = request.args.get('duration', '5')

    try:
        width = int(width_str)
        if not MIN_WIDTH <= width <= MAX_WIDTH:
            raise ValueError
    except ValueError:
        return make_json_response(400, {'error': f"Invalid 'width'; must be between {MIN_WIDTH} and {MAX_WIDTH}"})

    try:
        height = int(height_str)
        if not MIN_HEIGHT <= height <= MAX_HEIGHT:
            raise ValueError
    except ValueError:
        return make_json_response(400, {'error': f"Invalid 'height'; must be between {MIN_HEIGHT} and {MAX_HEIGHT}"})

    try:
        duration = float(duration_str)
        if not 0 < duration <= 10:
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
                "crop='iw-mod(iw\\,2)':'ih-mod(ih\\,2)'",
            ]),
            "-timelimit", str(request.context.get_remaining_time_in_millis() // 1000 - 2),  # 2 seconds for padding
            "-fs", str(MAX_VIDEO_SIZE),
            "-y",  # Overwrite output file
            "-v", "error",  # Only print errors
            output_file.name
        ], check=False, stdin=subprocess.DEVNULL, stderr=subprocess.PIPE)

        if p.returncode != 0:
            return make_json_response(403, {'error': p.stderr.decode()})

        data = output_file.read()

    return 200, data, {'Content-Type': f'video/{format}'}
