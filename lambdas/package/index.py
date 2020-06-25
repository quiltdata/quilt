"""
Provide the head of a (potentially gzipped) file in S3. Stream to limit
disk and RAM pressure.

Lambda functions can have up to 3GB of RAM and only 512MB of disk.
"""
import io
from contextlib import redirect_stderr
from urllib.parse import urlparse

import pandas
import requests

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.preview import (
    CATALOG_LIMIT_BYTES,
    CATALOG_LIMIT_LINES,
    extract_parquet,
    get_bytes,
    get_preview_lines
)
from t4_lambda_shared.utils import get_default_origins, make_json_response


S3_DOMAIN_SUFFIX = '.amazonaws.com'

SCHEMA = {
    'type': 'object',
    'properties': {
        'url': {
            'type': 'string'
        },
        # separator for CSV files
        'sep': {
            'minLength': 1,
            'maxLength': 1
        },
        'max_bytes': {
            'type': 'string',
        },
        # line_count used to be an integer with a max and min, which is more correct
        # nevertheless, request.args has it as a string, even if
        # the request specifies it as an integer
        'line_count': {
            'type': 'string',
        },
        'input': {
            'enum': FILE_EXTENSIONS
        },
        'exclude_output': {
            'enum': ['true', 'false']
        },
        'compression': {
            'enum': ['gz']
        }
    },
    'required': ['url', 'input'],
    'additionalProperties': False
}

# global option for pandas
pandas.set_option('min_rows', 50)


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    """
    Parse a manifest to return a folder-like view of its contents (logical keys).

    Returns:
        JSON response
    """
    url = request.args['url']
    input_type = request.args.get('input')
    compression = request.args.get('compression')
    separator = request.args.get('sep') or ','
    exclude_output = request.args.get('exclude_output') == 'true'

    bucket, key = request.pathParameters['proxy'].split('/', 1)
    host = f'{bucket}.s3.amazonaws.com'

    # Call S3 Select
    sql_stmt = "SELECT s.logical_key from s3object s"
    #if prefix:
    #        sql_stmt += f" WHERE s.logical_key LIKE ('{prefix}%')" 

    s3 = boto3.client('s3')
    response = s3.select_object_content(
        Bucket=bucket,
        Key=key,
        ExpressionType='SQL',
        Expression=sql_stmt,
        InputSerialization = {'JSON': {'Type': 'DOCUMENT'}},
        OutputSerialization = {'JSON': { 'RecordDelimiter': '\n',}}
    )
    ret_val = {
        'contents': get_logical_key_folder_view(response)
    }

    return make_json_response(200, content)
