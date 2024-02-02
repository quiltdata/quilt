import os


def pytest_configure(config):
    os.environ.update(
        AWS_ACCESS_KEY_ID='foo',
        AWS_SECRET_ACCESS_KEY='bar',
        AWS_DEFAULT_REGION='us-east-1',
        SERVICE_BUCKET='service-bucket',
        **dict.fromkeys(
            (
                'PROMOTE_PKG_MAX_MANIFEST_SIZE',
                'PROMOTE_PKG_MAX_PKG_SIZE',
                'PROMOTE_PKG_MAX_FILES',
                'MAX_BYTES_TO_HASH',
                'MAX_FILES_TO_HASH',
                'S3_HASH_LAMBDA_MAX_FILE_SIZE_BYTES',
            ),
            str(2 ** 64),  # Value big enough to serve as 'unlimited'.
        ),
        S3_HASH_LAMBDA='s3-hash-lambda-name',
        S3_HASH_LAMBDA_CONCURRENCY='40',
    )
