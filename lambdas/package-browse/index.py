"""
Sign S3 select requests (because S3 select does not allow anonymous access).

The implementation doesn't care what the request is, and just signs it using
the current AWS credentials.
"""
import io
import os
from urllib.parse import urlencode

from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.session import Session

import pandas as pd
import requests

from t4_lambda_shared.decorator import api
from t4_lambda_shared.utils import get_default_origins

SERVICE = 's3'
REGION = os.environ.get('AWS_REGION', '')

REQUEST_HEADERS_TO_FORWARD = {'content-type', 'cache-control', 'pragma', 'x-amz-content-sha256', 'x-amz-user-agent'}
REQUEST_HEADERS_TO_SIGN = {'host', 'x-amz-content-sha256', 'x-amz-user-agent'}
RESPONSE_HEADERS_TO_FORWARD = {'content-type'}

session = requests.Session()


def get_logical_key_folder_view(s3response):
    """
    Post process a set of logical keys to return only the
    top-level folder view (a special case of the s3-select
    lambda).
    """
    buffer = io.StringIO()
    for event in req['Payload']:
            if 'Records' in event:
            records = event['Records']['Payload'].decode('utf-8')
            buffer.write(records)
        elif 'Stats' in event:
            statsDetails = event['Stats']['Details']
    buffer.seek(0)
    df = pd.read_json(buffer, lines=True)

    # matches all strings; everything before and including the first
    # / is extracted
    folder = df.logical_key.str.extract('([^/]+/?).*')[0].unique()
    return folder

@api(cors_origins=get_default_origins())
def lambda_handler(request):
    """
    Parse a manifest to return a virtual folder-level view inside
    a package.
    """

    folder = "/".join(pathlib.PurePosixPath(prefix).parts) if prefix else ""

    sql_stmt = "SELECT s.logical_key from s3object s"
    if prefix:
        sql_stmt += f" WHERE s.logical_key LIKE ('{prefix}%')" 

    bucket_name = "allencell"
    file_name = ".quilt/packages/7fd488f05ec41968607c7263cb13b3e70812972a24e832ef6f72195bdd35f1b2"


    response = s3.select_object_content(
        Bucket=bucket_name,
        Key=file_name,
        ExpressionType='SQL',
        Expression=sql_stmt,
        InputSerialization = {'JSON': {'Type': 'DOCUMENT'}},
        OutputSerialization = {'JSON': { 'RecordDelimiter': '\n',}}
    )

    response_headers = {k: v for k, v in response.headers.items() if k in RESPONSE_HEADERS_TO_FORWARD}
    # Add a default content type to prevent API Gateway from setting it to application/json.
    response_headers.setdefault('content-type', 'application/octet-stream')

    return response.status_code, get_logical_key_folder_view(response), response_headers
