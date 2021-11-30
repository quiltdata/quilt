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

api = fastapi.FastAPI()


@api.get("/api/auth/get_credentials")
def get_credentials():
    """
    Obtains credentials corresponding to your role.

    Returns a JSON object with three keys:
        AccessKeyId(string): access key ID
        SecretKey(string): secret key
        SessionToken(string): session token
    """
    try:
        creds = sts_client.get_session_token()
    except ClientError as ex:
        print(ex)
        raise ApiException(500, "Failed to get credentials for your AWS Account.")

    return creds["Credentials"]


api.mount("/graphql", ariadne.asgi.GraphQL(graphql_schema), "GraphQL")
