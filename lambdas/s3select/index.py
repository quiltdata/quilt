"""
"""
import os
from urllib.parse import urlencode

from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.session import Session

import requests

from t4_lambda_shared.decorator import api
from t4_lambda_shared.utils import get_default_origins

SERVICE = 's3'
REGION = os.environ['AWS_REGION']

REQUEST_HEADERS_TO_FORWARD = {'content-type', 'x-amz-content-sha256', 'x-amz-user-agent'}
REQUEST_HEADERS_TO_SIGN = {'host', 'x-amz-content-sha256', 'x-amz-user-agent'}
RESPONSE_HEADERS_TO_FORWARD = {'content-type'}

credentials = Session().get_credentials()
auth = SigV4Auth(credentials, SERVICE, REGION)
session = requests.Session()


@api(cors_origins=get_default_origins())
def lambda_handler(request):
    """
    """
    bucket, key = request.pathParameters['proxy'].split('/', 1)
    host = f'{bucket}.s3.amazonaws.com'

    url = f'https://{host}/{key}?{urlencode(request.args)}'

    headers = { k: v for k, v in request.headers.items() if k in REQUEST_HEADERS_TO_FORWARD }
    headers['host'] = host

    aws_request = AWSRequest(
        method=request.method,
        url=url,
        data=request.data,
        headers={ k: v for k, v in headers.items() if k in REQUEST_HEADERS_TO_SIGN }
    )
    auth.add_auth(aws_request)

    headers.update(aws_request.headers)

    response = session.request(
        method=request.method,
        url=url,
        data=request.data,
        headers=headers,
    )

    response_headers = {
        k: v for k, v in response.headers.items() if k in RESPONSE_HEADERS_TO_FORWARD
    }

    return response.status_code, response.content, response_headers
