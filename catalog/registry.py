from datetime import timedelta

import boto3
from flask import Flask
from flask_cors import CORS
from flask_json import as_json, jsonify

app = Flask(__name__)
app.config['JSON_USE_ENCODE_METHODS'] = True
app.config['JSON_ADD_STATUS'] = False

sts_client = boto3.client(
    'sts',
)



CORS(app, resources={"/api/*": {"origins": "*", "max_age": timedelta(days=1)}})

@app.route('/api/buckets', methods=['GET'])
@as_json
def list_buckets():
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
