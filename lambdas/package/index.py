"""
Provide a virtual-file-system view of a package's logical keys.
"""

import io
import json

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
        'manifest': {
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
        'logical_key': {
            'type': 'string'
        }
    },
    'required': ['bucket', 'manifest', 'access_key', 'secret_key'],
    'additionalProperties': False
}


class IncompleteResultException(Exception):
    """
    Exception indicating an incomplete response
    (e.g., from S3 Select)
    """


def load_df(s3response):
    """
    Read a streaming response from s3 select into a
    Pandas DataFrame
    """
    buffer = io.StringIO()
    end_event_received = False
    stats = None
    for event in s3response['Payload']:
        if 'Records' in event:
            records = event['Records']['Payload'].decode()
            buffer.write(records)
        elif 'Progress' in event:
            print(event['Progress']['Details'])
        elif 'Stats' in event:
            stats = event['Stats']['Details']
        elif 'End' in event:
            # End event indicates that the request finished successfully
            end_event_received = True

    if not end_event_received:
        raise IncompleteResultException("Error: Received an incomplete response from S3 Select.")

    buffer.seek(0)
    df = pd.read_json(buffer, lines=True)
    return df, stats


def load_manifest_detail(s3response):
    """
    Read a streaming response from s3 select into a dict
    """
    end_event_received = False
    response_data = None
    for event in s3response['Payload']:
        if 'Records' in event:
            records = event['Records']['Payload'].decode()
            response_data = json.loads(records)
        elif 'Progress' in event:
            print(event['Progress']['Details'])
        elif 'Stats' in event:
            print(event['Stats']['Details'])
        elif 'End' in event:
            # End event indicates that the request finished successfully
            end_event_received = True

    if not end_event_received:
        raise IncompleteResultException("Error: Received an incomplete response from S3 Select.")

    return response_data


def get_logical_key_folder_view(df):
    """
    Post process a set of logical keys to return only the
    top-level folder view (a special case of the s3-select
    lambda).
    """
    # matches all strings; everything before and including the first
    # / is extracted
    folder = pd.Series(df.logical_key.dropna().str.extract('([^/]+/?).*')[0].unique())
    return dict(
        prefixes=folder[folder.str.endswith('/')].sort_values().tolist(),
        objects=folder[~folder.str.endswith('/')].sort_values().tolist()
    )


def get_s3_client(aws_access_key_id, aws_secret_access_key):
    """
    Create an S3 Client using the provided credentials
    """
    session = boto3.Session(
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key
    )
    s3_client = session.client('s3')
    return s3_client


def call_s3_select(s3_client, bucket, key, logical_key_prefix, detail=False):
    """
    Call S3 Select to read only the logical keys from a
    package manifest that match the desired folder path
    prefix
    """

    if logical_key_prefix is None:
        logical_key_prefix = ""

    prefix_length = len(logical_key_prefix)
    sanitized = logical_key_prefix.replace("'", "''")

    if detail:
        logical_key = sanitized
        sql_stmt = f"SELECT s.* FROM s3object s WHERE s.logical_key = '{logical_key}' LIMIT 1"
    else:
        prefix = sanitized
        sql_stmt = f"SELECT SUBSTRING(s.logical_key, {prefix_length + 1}) AS logical_key FROM s3object s"
        if prefix:
            sql_stmt += f" WHERE SUBSTRING(s.logical_key, 1, {prefix_length}) = '{prefix}'"

    print(sql_stmt)
    response = s3_client.select_object_content(
        Bucket=bucket,
        Key=key,
        ExpressionType='SQL',
        Expression=sql_stmt,
        InputSerialization={
            'JSON': {'Type': 'DOCUMENT'},
            'CompressionType': 'NONE'
        },
        OutputSerialization={'JSON': {'RecordDelimiter': '\n'}}
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
    key = request.args['manifest']
    aws_access_key_id = request.args['access_key']
    aws_secret_access_key = request.args['secret_key']
    prefix = request.args.get('prefix')
    logical_key = request.args.get('logical_key')

    # Create an s3 client using the provided credentials
    s3_client = get_s3_client(aws_access_key_id, aws_secret_access_key)

    # Get details of a single file in the package
    if logical_key is not None:
        response = call_s3_select(s3_client, bucket, key, logical_key, detail=True)
        # parse and prep response
        response_data = load_manifest_detail(response)
    else:
        # Call s3 select to fetch only logical keys matching the
        # desired prefix (folder path)
        response = call_s3_select(s3_client, bucket, key, prefix)

        # Parse the response into a logical folder view
        df, _ = load_df(response)
        response_data = get_logical_key_folder_view(df)

    ret_val = make_json_response(
        200,
        {
            'contents': response_data
        }
    )

    return ret_val
