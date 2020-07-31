"""
Provide a virtual-file-system view of a package's logical keys.
"""

import json

import boto3
import pandas as pd

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.utils import (
    query_manifest_content,
    get_default_origins,
    make_json_response,
    sql_escape
)

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
        'session_token': {
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


def file_list_to_folder(df: pd.DataFrame) -> dict:
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


def get_s3_client(
    aws_access_key_id: str,
    aws_secret_access_key: str,
    aws_session_token: str
):
    """
    Create an S3 Client using the provided credentials
    """
    session = boto3.Session(
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        aws_session_token=aws_session_token
    )
    s3_client = session.client('s3')
    return s3_client


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
    aws_session_token = request.args['session_token']
    prefix = request.args.get('prefix')
    logical_key = request.args.get('logical_key')

    # Create an s3 client using the provided credentials
    s3_client = get_s3_client(aws_access_key_id, aws_secret_access_key, aws_session_token)

    # Get details of a single file in the package
    if logical_key is not None:
        sql_stmt = f"SELECT s.* FROM s3object s WHERE s.logical_key = '{sql_escape(logical_key)}' LIMIT 1"
        response_data = json.load(query_manifest_content(
            s3_client,
            bucket=bucket,
            key=key,
            sql_stmt=sql_stmt
        ))
    else:
        # Call s3 select to fetch only logical keys matching the
        # desired prefix (folder path)
        prefix_length = len(prefix) if prefix is not None else 0
        sql_stmt = f"SELECT SUBSTRING(s.logical_key, {prefix_length + 1}) AS logical_key FROM s3object s"
        if prefix:
            sql_stmt += f" WHERE SUBSTRING(s.logical_key, 1, {prefix_length}) = '{sql_escape(prefix)}'"
        result = query_manifest_content(
            s3_client,
            bucket=bucket,
            key=key,
            sql_stmt=sql_stmt
        )
        # Parse the response into a logical folder view
        df = pd.read_json(result, lines=True)
        response_data = file_list_to_folder(df)

    ret_val = make_json_response(
        200,
        {
            'contents': response_data
        }
    )

    return ret_val
