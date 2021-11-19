"""
Generate video previews for videos in S3.
"""
import subprocess
import tempfile
from urllib.parse import urlparse

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.utils import get_default_origins, make_json_response

VIDEO_FORMATS = ['mp4', 'webm']
AUDIO_FORMATS = ['mp3', 'ogg']

CONTENT_TYPES = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
}

SCHEMA = {
    'type': 'object',
    'properties': {
        'url': {
            'type': 'string'
        },
        'format': {
            'enum': VIDEO_FORMATS + AUDIO_FORMATS
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

    format_params = []

    if format in AUDIO_FORMATS:
        format_params.extend([
            '-b:a', '128k',  # 128KB audio bitrate
            '-vn',  # Drop the video stream
        ])
    elif format in VIDEO_FORMATS:
        format_params.extend([
            "-vf", ','.join([
                f"scale=w={width}:h={height}:force_original_aspect_ratio=decrease",
                "crop='iw-mod(iw\\,2)':'ih-mod(ih\\,2)'",
            ]),
        ])
    else:
        assert False

    with tempfile.NamedTemporaryFile() as output_file:
        p = subprocess.run([
            FFMPEG,
            "-t", str(duration),
            "-i", url,
            "-f", format,
            *format_params,
            "-timelimit", str(request.context.get_remaining_time_in_millis() // 1000 - 2),  # 2 seconds for padding
            "-fs", str(MAX_VIDEO_SIZE),
            "-y",  # Overwrite output file
            "-v", "error",  # Only print errors
            output_file.name
        ], check=False, stdin=subprocess.DEVNULL, stderr=subprocess.PIPE)

        if p.returncode != 0:
            return make_json_response(403, {'error': p.stderr.decode()})

        data = output_file.read()

    parsed = urlparse(url)
    filename = parsed.path.rsplit('/', 1)[-1]

    headers = {
        'Content-Type': CONTENT_TYPES[format],
        'Title': f"Preview of {filename}",
        'Content-Disposition': f'inline; filename="{filename}"',
    }

    return 200, data, headers
