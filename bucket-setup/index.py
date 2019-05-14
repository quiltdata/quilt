"""
Modify bucket properties so that bucket works well with Quilt;
intended for QuiltBucket (CloudFormation parameter)
"""
import boto3
import botocore
import cfnresponse

S3_CLIENT = boto3.client('s3')

def handler(event, context):
    """entry point"""
    if event['RequestType'] == 'Delete':
        cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
        return

    try:
        props = event['ResourceProperties']
        bucket = props['Bucket']
        catalog_host = props['QuiltWebHost']
        enable_versioning(bucket)
        set_cors(bucket, catalog_host)
        cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
        return
    except Exception as ex:
        print(ex)
        cfnresponse.send(event, context, cfnresponse.FAILED, {})
        raise

def enable_versioning(bucket):
    """switch on object versionsing"""
    S3_CLIENT.put_bucket_versioning(
        Bucket=bucket,
        VersioningConfiguration={
            'Status': 'Enabled'
        }
    )

def set_cors(bucket, catalog_host):
    """set CORS so catalog works properly"""
    new_cors_rule = {
        'AllowedHeaders': ['*'],
        'AllowedMethods': [
            'GET',
            'HEAD',
            'PUT',
            'POST'
        ],
        'AllowedOrigins': [
            'https://' + catalog_host
        ],
        'ExposeHeaders': [
            'Content-Length',
            'Content-Range',
            'x-amz-meta-helium'
        ],
        'MaxAgeSeconds': 3000
    }

    try:
        existing_cors_rules = S3_CLIENT.get_bucket_cors(Bucket=bucket)['CORSRules']
    # if there's no CORS set at all, we'll get an error
    except botocore.exceptions.ClientError as problem:
        if 'NoSuchCORSConfiguration' in str(problem):
            existing_cors_rules = []
        else:
            raise

    if new_cors_rule not in existing_cors_rules:
        existing_cors_rules.append(new_cors_rule)
        S3_CLIENT.put_bucket_cors(
            Bucket=bucket,
            CORSConfiguration={
                'CORSRules': existing_cors_rules
            }
        )
