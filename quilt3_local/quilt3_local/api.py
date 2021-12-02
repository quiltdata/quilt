import ariadne.asgi
import boto3
import fastapi
from botocore.exceptions import ClientError

from .graphql import schema as graphql_schema


class ApiException(Exception):
    """
    Base class for API exceptions.
    """
    def __init__(self, status_code, message):
        super().__init__()
        self.status_code = status_code
        self.message = message


sts_client = boto3.client("sts")
session_cred = boto3._get_default_session().get_credentials()


api = fastapi.FastAPI()


@api.get("/api/auth/get_credentials")
def get_credentials():
    """
    Obtains credentials corresponding to your role.

    Returns a JSON object with three keys:
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
    except ClientError as ex:
        print(ex)
        raise ApiException(500, "Failed to get credentials for your AWS Account.")


api.mount("/graphql", ariadne.asgi.GraphQL(graphql_schema), "GraphQL")
