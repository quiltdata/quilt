"""
Microservice that provides temporary user credentials to the catalog
"""

from datetime import timedelta

import os
import boto3
import requests
from botocore.exceptions import ClientError
from flask import Flask, request
from flask_cors import CORS, cross_origin
from flask_json import as_json

# delete below
from aws_requests_auth.boto_utils import BotoAWSRequestsAuth
from elasticsearch import Elasticsearch, RequestsHttpConnection

from t4_lambda_shared.utils import (
    PACKAGE_INDEX_SUFFIX,
    get_default_origins,
    make_json_response,
)

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


CORS(app, resources={
    "/api/*": {"origins": "*", "max_age": timedelta(days=1)},
    "/prod/*": {"origins": "*", "max_age": timedelta(days=1)}
})


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

###########################
# API Gateway methods
###########################

# Delete these
DEFAULT_SIZE = 1_000
MAX_QUERY_DURATION = 27  # Just shy of 29s API Gateway limit
NUM_PREVIEW_IMAGES = 100
NUM_PREVIEW_FILES = 20
COMPRESSION_EXTS = ['.gz']
IMG_EXTS = r'.*\.(bmp|gif|jpg|jpeg|png|tif|tiff|webp)'
SAMPLE_EXTS = r'.*\.(csv|ipynb|json|md|parquet|pdf|rmd|tsv|txt|vcf|xls|xlsx)(.gz)?'
README_KEYS = ['README.md', 'README.txt', 'README.ipynb']
SUMMARIZE_KEY = 'quilt_summarize.json'

@app.route('/prod/search', methods=['GET'])
@as_json
def search():
    """
    Calls through to ES for now
    """
    print("CALLED SEARCH!!!")
    print(request.args)

    action = request.args.get('action')
    user_body = request.args.get('body', {})
    user_fields = request.args.get('fields', [])
    user_indexes = request.args.get('index', "")
    user_size = request.args.get('size', DEFAULT_SIZE)
    user_source = request.args.get('_source', [])
    # 0-indexed starting position (for pagination)
    user_from = int(request.args.get('from', 0))
    user_retry = int(request.args.get('retry', 0))
    filter_path = request.args.get('filter_path')

    query = request.args.get('query', '')
    body = user_body or {
        "query": {
            "query_string": {
                "analyze_wildcard": True,
                "lenient": True,
                "query": query,
                # see enterprise/**/bucket.py for mappings
                "fields": [
                    # package
                    'comment', 'handle', 'handle_text^2', 'metadata', 'tags'
                ]
            }
        }
    }

    if not all(i.endswith(PACKAGE_INDEX_SUFFIX) for i in user_indexes.split(',')):
        raise ValueError(f"'packages' action to index that doesn't end in {PACKAGE_INDEX_SUFFIX}")
    _source = user_source
    size = user_size
    terminate_after = None

    es_host = os.environ['ES_HOST']
    region = os.environ['AWS_REGION']
    index_overrides = os.getenv('INDEX_OVERRIDES', '')

    auth = BotoAWSRequestsAuth(
        aws_host=es_host,
        aws_region=region,
        aws_service='es'
    )

    es_client = Elasticsearch(
        hosts=[{'host': es_host, 'port': 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=MAX_QUERY_DURATION,
    )

    to_search = f"{user_indexes},{index_overrides}" if index_overrides else user_indexes
    result = es_client.search(
        index=to_search,
        body=body,
        _source=_source,
        size=size,
        from_=user_from,
        filter_path=filter_path,
        # try turning this off to consider all documents
        terminate_after=terminate_after,
    )
    print("RESULT:")
    print(result)
    
    return result



if __name__ == '__main__':
    app.run()
