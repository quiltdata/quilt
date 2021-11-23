"""
Generate video previews for videos in S3.
"""
import subprocess
import tempfile
from urllib.parse import urlparse

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.utils import get_default_origins, make_json_response

# Map of supported content types and corresponding FFMPEG formats
FORMATS = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
}

# TODO: Remove this.
LEGACY_FORMATS = {v: k for k, v in FORMATS.items()}

SCHEMA = {
    'type': 'object',
    'properties': {
        'url': {
            'type': 'string'
        },
        'format': {
            'enum': list(FORMATS) + list(LEGACY_FORMATS)
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
        'audio_bitrate': {
            'type': 'string',
        },
        'file_size': {
            'type': 'string'
        }
    },
    'required': ['url', 'format'],
    'additionalProperties': False
}

FFMPEG = '/opt/bin/ffmpeg'

# Lambda has a 6MB limit for request and response, however, base64 adds 33% overhead.
# Also, leave a few KB for the headers.
MAX_FILE_SIZE = 6 * 1024 * 1024 * 3 // 4 - 4096


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    """
    Generate previews for videos in S3
    """
    url = request.args['url']
    format = request.args['format']

    def _parse_param(name, default_value, min_value, max_value):
        value_str = request.args.get(name)
        if value_str is None:
            return default_value

        try:
            value = type(default_value)(value_str)
            if not min_value <= value <= max_value:
                raise ValueError
            return value
        except ValueError:
            raise ValueError(f"Invalid {name!r}; must be between {min_value} and {max_value} inclusive")

    try:
        width = _parse_param('width', 320, 10, 640)
        height = _parse_param('height', 240, 10, 480)
        duration = _parse_param('duration', 5.0, 0.1, 10)
        audio_bitrate = _parse_param('audio_bitrate', 128, 64, 320)
        file_size = _parse_param('file_size', MAX_FILE_SIZE, 1024, MAX_FILE_SIZE)
    except ValueError as ex:
        return make_json_response(400, {'error': str(ex)})

    format = LEGACY_FORMATS.get(format, format)
    category = format.split('/')[0]

    format_params = []
    if category == 'audio':
        format_params.extend([
            '-b:a', f'{audio_bitrate}k',
            '-vn',  # Drop the video stream
        ])
    elif category == 'video':
        format_params.extend([
            "-vf", ','.join([
                f"scale=w={width}:h={height}:force_original_aspect_ratio=decrease",
                "crop='iw-mod(iw\\,2)':'ih-mod(ih\\,2)'",
            ]),
        ])

    with tempfile.NamedTemporaryFile() as output_file:
        p = subprocess.run([
            FFMPEG,
            "-t", str(duration),
            "-i", url,
            "-f", FORMATS[format],
            *format_params,
            "-timelimit", str(request.context.get_remaining_time_in_millis() // 1000 - 2),  # 2 seconds for padding
            "-fs", str(file_size),
            "-y",  # Overwrite output file
            "-v", "error",  # Only print errors
            output_file.name
        ], check=False, stdin=subprocess.DEVNULL, stderr=subprocess.PIPE)

        if p.returncode != 0:
            return make_json_response(403, {'error': p.stderr.decode()})

        data = output_file.read()

    parsed = urlparse(url)
    filename = parsed.path.rpartition('/')[-1]

    headers = {
        'Content-Type': format,
        'Title': f"Preview of {filename}",
        'Content-Disposition': f'inline; filename="{filename}"',
    }

    return 200, data, headers
