import asyncio

import pytest
from botocore.stub import Stubber

import t4_lambda_s3hash as s3hash

AWS_CREDENTIALS = s3hash.AWSCredentials.parse_obj(
    {
        "key": "test-key",
        "secret": "test-secret",
        "token": "test-token",
    }
)


# pytest's async fixtures don't propagate contextvars, so we have to set them manually in a sync fixture
@pytest.fixture
def s3_stub():
    async def _get_s3():
        async with s3hash.aio_context(AWS_CREDENTIALS):
            return s3hash.S3.get()

    s3 = asyncio.run(_get_s3())
    stubber = Stubber(s3)
    stubber.activate()
    s3_token = s3hash.S3.set(s3)
    try:
        yield stubber
        stubber.assert_no_pending_responses()
    finally:
        s3hash.S3.reset(s3_token)
