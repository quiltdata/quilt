"""
Provide a virtual-file-system view of a package's logical keys.
"""

import json
import os

import boto3
import botocore
from botocore import UNSIGNED
from botocore.client import Config
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
    'required': ['bucket', 'manifest'],
    'additionalProperties': False
}


def file_list_to_folder(df: pd.DataFrame) -> dict:
    """
    Post process a set of logical keys to return only the
    top-level folder view (a special case of the s3-select
    lambda).
    """
    try:
        groups = df.groupby(df.logical_key.str.extract('([^/]+/?).*')[0], dropna=True)
        folder = groups.agg(
            size=('size', 'sum'),
            physical_key=('physical_key', 'first')
        )
        folder.reset_index(inplace=True)  # move the logical_key from the index to column[0]
        folder.rename(columns={0: 'logical_key'}, inplace=True) # name the new column
        # Do not return physical_key for prefixes
        prefixes = folder[folder.logical_key.str.contains('/')].drop(
            ['physical_key'],
            axis=1
        ).to_dict(orient='records')
        objects = folder[~folder.logical_key.str.contains('/')].to_dict(orient='records')
    except AttributeError as err:
        # Pandas will raise an attribute error if the DataFrame has
        # no rows with a non-null logical_key. We expect that case if
        # either: (1) the package is empty (has zero package entries)
        # or, (2) zero package entries match the prefix filter. The
        # choice to allow this to raise the exception instead of
        # testing for the empty case ahead of time optimizes the
        # case where the result set is large.
        prefixes = []
        objects = []

    return dict(
        prefixes=prefixes,
        objects=objects
    )


def create_s3_client(
    *,
    aws_access_key_id: str,
    aws_secret_access_key: str,
    aws_session_token: str
):
    """
    Create an S3 Client using caller-provided credentials.
    """
    assert aws_access_key_id and aws_secret_access_key and aws_session_token
    session = boto3.Session(
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        aws_session_token=aws_session_token
    )
    return session.client('s3')


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
    prefix = request.args.get('prefix')
    logical_key = request.args.get('logical_key')
    access_key = request.args.get('access_key')
    secret_key = request.args.get('secret_key')
    session_token = request.args.get('session_token')
    allow_anonymous_access = bool(os.getenv('ALLOW_ANONYMOUS_ACCESS'))

    # If credentials are passed in, use them
    # for the client. If no credentials are supplied, test that
    # the manifest object is publicly accessible. If so, create
    # an s3 client using the underlying IAM role's permissions.

    if access_key and secret_key and session_token:
        s3_client = create_s3_client(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            aws_session_token=session_token
        )
    elif (
        allow_anonymous_access and
        access_key is None and
        secret_key is None and
        session_token is None
    ):
        # Test to see if the target key is publicly accessible. If not, the call
        # below will raise and exception and return a 403 response
        anons3 = boto3.client('s3', config=Config(signature_version=UNSIGNED))
        try:
            anons3.head_object(Bucket=bucket, Key=key)
        except botocore.exceptions.ClientError as error:
            if error.response.get('Error'):
                code = error.response['Error']['Code']
                if code == '403':
                    return make_json_response(
                        403,
                        {
                            'title': 'Access Denied',
                            'detail': f"Access denied reading manifest: {key}"
                        }
                    )
            raise error

        # Use the default S3 client configuration
        s3_client = boto3.client('s3')
    else:
        return make_json_response(
            401,
            {
                'title': 'Incomplete credentials',
                'detail': "access_key, secret_key and session_token are required"
            }
        )
    assert s3_client

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
        sql_stmt = f"SELECT SUBSTRING(s.logical_key, {prefix_length + 1}) AS logical_key"
        sql_stmt += ", s.\"size\", s.physical_keys[0] as physical_key FROM s3object s"
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

        # Fetch package-level or directory-level metadata
        if prefix:
            sql_stmt = f"SELECT s.meta FROM s3object s WHERE s.logical_key = '{sql_escape(prefix)}'"
        else:
            sql_stmt = "SELECT s.* FROM s3object s WHERE s.logical_key is NULL"
        result = query_manifest_content(
            s3_client,
            bucket=bucket,
            key=key,
            sql_stmt=sql_stmt
        )
        meta = json.load(result) if result else {}
        response_data.update(dict(meta=meta))

    ret_val = make_json_response(
        200,
        {
            'contents': response_data
        }
    )

    return ret_val
