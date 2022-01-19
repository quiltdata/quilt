import logging
import sys

import ariadne.asgi
import boto3
import fastapi
from botocore.exceptions import ClientError

from .context import QuiltContext
from .graphql import schema as graphql_schema

logger = logging.getLogger(__name__)

sts_client = boto3.client("sts")
session_cred = boto3._get_default_session().get_credentials()

if session_cred is None:
    print("AWS credentials required. See boto3 docs for details:")
    print("https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials")
    sys.exit(1)


api = fastapi.FastAPI()


@api.middleware("http")
async def add_quilt_context(request: fastapi.Request, call_next):
    with QuiltContext():
        return await call_next(request)


@api.get("/api/auth/get_credentials")
def get_credentials():
    """
    Obtain credentials corresponding to your role.
    Returns a JSON object with the following keys:
        AccessKeyId(string): access key ID
        SecretAccessKey(string): secret key
        SessionToken(string): session token
        Expiration(ISO date string)
    """
    try:
        if session_cred.token:
            return {
                "AccessKeyId": session_cred.access_key,
                "SecretAccessKey": session_cred.secret_key,
                "SessionToken": session_cred.token,
                "Expiration": getattr(session_cred, "expiry_time", None),
            }
        return sts_client.get_session_token()["Credentials"]
    except ClientError:
        logger.exception("Failed to get credentials for your AWS Account")
        raise fastapi.HTTPException(500, "Failed to get credentials for your AWS Account.")


api.mount("/graphql", ariadne.asgi.GraphQL(graphql_schema), "GraphQL")
