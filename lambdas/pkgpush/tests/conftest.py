import os


def pytest_configure(config):
    os.environ.update(
        AWS_ACCESS_KEY_ID='foo',
        AWS_SECRET_ACCESS_KEY='bar',
        AWS_DEFAULT_REGION='us-east-1',
        AUTH_ENDPOINT='https://example-com/auth/endpoint',
        SERVICE_BUCKET='service-bucket',
        **dict.fromkeys(
            (
                'PROMOTE_PKG_MAX_MANIFEST_SIZE',
                'PROMOTE_PKG_MAX_PKG_SIZE',
                'PROMOTE_PKG_MAX_FILES',
                'PKG_FROM_FOLDER_MAX_PKG_SIZE',
                'PKG_FROM_FOLDER_MAX_FILES',
            ),
            str(2 ** 64),  # Value big enough to serve as 'unlimited'.
        ),
    )
