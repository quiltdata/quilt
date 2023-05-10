"""
search_util.py

Contains search-related glue code
"""
from aws_requests_auth.aws_auth import AWSRequestsAuth

from . import session
from .session import create_botocore_session


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


def search_api(query, index, limit=10):
    """
    Sends a query to the search API (supports simple search
    queries only)
    """
    response = session.get_session().get(
        f"{session.get_registry_url()}/api/search",
        params=dict(index=index, action='search', query=query, size=limit),
    )
    return response.json()
