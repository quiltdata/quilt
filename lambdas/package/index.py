"""
Provide the head of a (potentially gzipped) file in S3. Stream to limit
disk and RAM pressure.

Lambda functions can have up to 3GB of RAM and only 512MB of disk.
"""

import io

import boto3
import pandas as pd

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.utils import get_default_origins, make_json_response

S3_DOMAIN_SUFFIX = '.amazonaws.com'

SCHEMA = {
    'type': 'object',
    'properties': {
        'bucket': {
            'type': 'string'
        },
        'key': {
            'type': 'string'
        },
        'access_key': {
            'type': 'string'
        },
        'secret_key': {
            'type': 'string'
        },
        'prefix': {
            'type': 'string'
        },
    },
    'required': ['bucket', 'key', 'access_key', 'secret_key'],
    'additionalProperties': False
}


def load_df(s3response):
    """
    Read a streaming response from s3 select into a
    Pandas DataFrame
    """
    buffer = io.StringIO()
    for event in s3response['Payload']:
        if 'Records' in event:
            records = event['Records']['Payload'].decode('utf-8')
            buffer.write(records)
        elif 'Stats' in event:
            statsDetails = event['Stats']['Details']
    buffer.seek(0)
    df = pd.read_json(buffer, lines=True)
    return df, statsDetails


def get_logical_key_folder_view(df, prefix=None):
    """
    Post process a set of logical keys to return only the
    top-level folder view (a special case of the s3-select
    lambda).
    """
    if prefix:
        col = df.logical_key.str.slice(start=len(prefix))
    else:
        col = df.logical_key
        
    # matches all strings; everything before and including the first
    # / is extracted
    folder = col.dropna().str.extract('([^/]+/?).*')[0].unique().tolist()
    return folder


def get_s3_client(aws_access_key_id, aws_secret_access_key):
    session = boto3.Session(
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key
    )
    s3_client = session.client('s3')
    return s3_client


def call_s3_select(s3_client, bucket, key, prefix):
    # Call S3 Select
    sql_stmt = "SELECT s.logical_key from s3object s"
    if prefix:
        sql_stmt += f" WHERE s.logical_key LIKE ('{prefix}%')"

    response = s3_client.select_object_content(
        Bucket=bucket,
        Key=key,
        ExpressionType='SQL',
        Expression=sql_stmt,
        InputSerialization = {
            'JSON': {'Type': 'DOCUMENT'},
            'CompressionType': 'NONE'
        },
        OutputSerialization = {'JSON': { 'RecordDelimiter': '\n',}}
    )
    return response


@api(cors_origins=get_default_origins())
@validate(SCHEMA)
def lambda_handler(request):
    """
    Parse a manifest to return a folder-like view of its contents (logical keys).

    Returns:
        JSON response
    """
    bucket = request.args['bucket']
    key = request.args['key']
    aws_access_key_id = request.args['access_key']
    aws_secret_access_key = request.args['secret_key']
    prefix = request.args.get('prefix')

    # Create an s3 client using the provided credentials
    s3 = get_s3_client(aws_access_key_id, aws_secret_access_key)

    # Call s3 select to fetch only logical keys matching the
    # desired prefix (folder path)
    response = call_s3_select(s3, bucket, key, prefix)

    # Parse the response into a logical folder view
    df, stats = load_df(response)

    ret_val = make_json_response(
        200,
        {
            'contents': get_logical_key_folder_view(df, prefix)
        }
    )

    return ret_val
