"""
Sign S3 select requests (because S3 select does not allow anonymous access).

The implementation doesn't care what the request is, and just signs it using
the current AWS credentials.
"""
import json
import os
from urllib.parse import urlencode

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.session import Session

import requests

from t4_lambda_shared.decorator import api
from t4_lambda_shared.package_browse import get_logical_key_folder_view
from t4_lambda_shared.utils import get_default_origins

SERVICE = 's3'
REGION = os.environ.get('AWS_REGION', '')

REQUEST_HEADERS_TO_FORWARD = {'content-type', 'cache-control', 'pragma', 'x-amz-content-sha256', 'x-amz-user-agent'}
REQUEST_HEADERS_TO_SIGN = {'host', 'x-amz-content-sha256', 'x-amz-user-agent'}
RESPONSE_HEADERS_TO_FORWARD = {'content-type'}

session = requests.Session()

@api(cors_origins=get_default_origins())
def lambda_handler(request):
    """
    Sign the request and forward it to S3.
    """
    if not (request.method == 'POST' and 'select' in request.args):
        return requests.codes.bad_request, 'Not an S3 select', {'content-type': 'text/plain'}

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
    content = get_logical_key_folder_view(response)

    #response_headers = {k: v for k, v in response.headers.items() if k in RESPONSE_HEADERS_TO_FORWARD}
    response_headers = {}
    # Add a default content type to prevent API Gateway from setting it to application/json.
    #response_headers.setdefault('content-type', 'application/octet-stream')

    return requests.codes.ok, json.dumps(content), response_headers
