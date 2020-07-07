"""
Provide the head of a (potentially gzipped) file in S3. Stream to limit
disk and RAM pressure.

Lambda functions can have up to 3GB of RAM and only 512MB of disk.
"""
import boto3

from t4_lambda_shared.decorator import api, validate
from t4_lambda_shared.utils import get_default_origins, make_json_response

from .package_browse import get_logical_key_folder_view, load_df

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
    host = f'{bucket}.s3.amazonaws.com'

    # Call S3 Select
    sql_stmt = "SELECT s.logical_key from s3object s"
    if prefix:
        sql_stmt += f" WHERE s.logical_key LIKE ('{prefix}%')" 

    session = boto3.Session(
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key
    )
    s3 = session.client('s3')
    response = s3.select_object_content(
        Bucket=bucket,
        Key=key,
        ExpressionType='SQL',
        Expression=sql_stmt,
        InputSerialization = {'JSON': {'Type': 'DOCUMENT'}},
        OutputSerialization = {'JSON': { 'RecordDelimiter': '\n',}}
    )

    df, stats = load_df(response)

    ret_val = make_json_response(
        200,
        {
            'contents': get_logical_key_folder_view(df, prefix)
        }
    )
    print(ret_val)

    return ret_val
