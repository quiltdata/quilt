"""
Microservice that provides temporary user credentials to the catalog
"""

from datetime import timedelta

import boto3
import requests
from botocore.exceptions import ClientError
from flask import Flask
from flask_cors import CORS
from flask_json import as_json

app = Flask(__name__)  # pylint: disable=invalid-name
app.config['JSON_USE_ENCODE_METHODS'] = True
app.config['JSON_ADD_STATUS'] = False

sts_client = boto3.client(  # pylint: disable=invalid-name
    'sts',
)


class ApiException(Exception):
    """
    Base class for API exceptions.
    """
    def __init__(self, status_code, message):
        super().__init__()
        self.status_code = status_code
        self.message = message


CORS(app, resources={"/api/*": {"origins": "*", "max_age": timedelta(days=1)}})


@app.route('/api/buckets', methods=['GET'])
@as_json
def list_buckets():
    """
    Returns an empty list for compatibility
    """
    return dict(
        buckets=[]
    )


@app.route('/api/auth/get_credentials', methods=['GET'])
@as_json
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
        raise ApiException(requests.codes.server_error,
                           "Failed to get credentials for your AWS Account.")
    return creds['Credentials']


if __name__ == '__main__':
    app.run()
