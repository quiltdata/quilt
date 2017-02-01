#!/usr/bin/env python3

"""
Docker entrypoint script.
- Determines whether the container is running in dev or EC2
- In EC2, downloads config.py from S3
- Sets QUILT_SERVER_CONFIG
"""

import os
import sys

import boto3
from botocore.exceptions import ClientError

def main(argv):
    config_bucket = os.getenv('QUILT_SERVER_CONFIG_S3_BUCKET')

    try:
        uuid = open('/sys/hypervisor/uuid').read()
        is_ec2 = uuid[0:3] == 'ec2'
    except IOError:
        is_ec2 = False

    if is_ec2 and not config_bucket:
        print("Error: need QUILT_SERVER_CONFIG_S3_BUCKET when running on EC2.", file=sys.stderr)
        return 1

    if not is_ec2 and config_bucket:
        print("Error: QUILT_SERVER_CONFIG_S3_BUCKET should not be used in dev.", file=sys.stderr)
        return 1

    if is_ec2:
        config_path = '/config.py'
        if not os.path.exists(config_path):
            s3_client = boto3.client('s3')
            try:
                config_obj = s3_client.get_object(Bucket=config_bucket, Key='config.py')
                config = config_obj['Body'].read()
                with open(config_path, 'wb') as config_file:
                    config_file.write(config)
            except ClientError as ex:
                print("Failed to read s3://%s/config.py: %s" % (config_bucket, ex))
                return 1
    else:
        config_path = 'dev_config.py'  # In `quilt_server`

    os.environ['QUILT_SERVER_CONFIG'] = config_path

    os.execvp(argv[1], argv[1:])

if __name__ == '__main__':
    sys.exit(main(sys.argv))
