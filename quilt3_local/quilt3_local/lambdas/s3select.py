"""
Sign S3 select requests (because S3 select does not allow anonymous access).

The implementation doesn't care what the request is, and just signs it using
the current AWS credentials.
"""
import os
from urllib.parse import urlencode

import requests
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.session import Session

from .shared.decorator import api
from .shared.utils import get_default_origins

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

    # Make an unsigned HEAD request to test anonymous access.

    object_url = f'https://{host}/{key}'
    head_response = session.head(object_url)
    if not head_response.ok:
        return requests.codes.forbidden, 'Not allowed', {'content-type': 'text/plain'}

    # Sign the full S3 select request.

    url = f'{object_url}?{urlencode(request.args)}'

    headers = {k: v for k, v in request.headers.items() if k in REQUEST_HEADERS_TO_FORWARD}
    headers['host'] = host

    aws_request = AWSRequest(
        method=request.method,
        url=url,
        data=request.data,
        headers={k: v for k, v in headers.items() if k in REQUEST_HEADERS_TO_SIGN}
    )
    credentials = Session().get_credentials()
    auth = SigV4Auth(credentials, SERVICE, REGION)
    auth.add_auth(aws_request)

    headers.update(aws_request.headers)

    response = session.post(
        url=url,
        data=request.data,  # Forward the POST data.
        headers=headers,
    )

    response_headers = {k: v for k, v in response.headers.items() if k in RESPONSE_HEADERS_TO_FORWARD}
    # Add a default content type to prevent API Gateway from setting it to application/json.
    response_headers.setdefault('content-type', 'application/octet-stream')

    return response.status_code, response.content, response_headers
