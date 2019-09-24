"""
search_util.py

Contains search-related glue code
"""
import json
import re
from urllib.parse import urlparse

from aws_requests_auth.boto_utils import BotoAWSRequestsAuth
from aws_requests_auth.aws_auth import AWSRequestsAuth
from botocore.session import Session

import requests

from .session import create_botocore_session
from .util import QuiltException, get_from_config


def search_credentials(host, region, service):
    credentials = create_botocore_session().get_credentials()
    if credentials:
        # use registry-provided credentials if present, otherwise
        # standard boto credentials
        creds = credentials.get_frozen_credentials()
        auth = AWSRequestsAuth(aws_access_key=creds.access_key,
                               aws_secret_access_key=creds.secret_key,
                               aws_host=host,
                               aws_region=region,
                               aws_service=service,
                               aws_token=creds.token,
                               )
    else:
        auth = None

    return auth

def _bucket_index_name(bucket_name):
    if bucket_name is None:
        return '_all'
    else:
        es_index = ",".join([bucket_name, 'drive'])
        return es_index

def search_api(query, index, limit=10):
    """
    Sends a query to the search API (supports simple search
    queries only)
    """
    api_gateway = get_from_config('apiGatewayEndpoint')
    api_gateway_host = urlparse(api_gateway).hostname
    match = re.match(r".*\.([a-z]{2}-[a-z]+-\d)\.amazonaws\.com$", api_gateway_host)
    region = match.groups()[0]
    auth = search_credentials(api_gateway_host, region, 'execute-api')
    response = requests.get(
        f"{api_gateway}/search",
        params=dict(index=index, action='search', query=query),
        auth=auth
    )

    if not response.ok:
        raise QuiltException(response.text)

    return response.json()

