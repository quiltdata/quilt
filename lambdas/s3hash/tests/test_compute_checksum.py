import asyncio
import base64
import io

from aiobotocore.response import StreamingBody
from botocore.stub import Stubber
import pytest
from pytest_mock import MockerFixture

import t4_lambda_s3hash as s3hash

"""
stub S3:

get_object_attributes(
    **location.boto_args,
    ObjectAttributes=["ETag", "Checksum", "ObjectParts", "ObjectSize"],
    MaxParts=MAX_PARTS,
)

head_object(**location.boto_args)

# for legacy
get_object(**location.boto_args)

# MPU
create_multipart_upload(
    **target.boto_args,
    ChecksumAlgorithm="SHA256",
)

abort_multipart_upload(**mpu.boto_args)

upload_part_copy(
    **mpu.boto_args,
    **part.boto_args,
    CopySource=src.boto_args,
    # In case we don't have version ID (e.g. non-versioned bucket)
    # we have to use ETag to make sure object is not modified during copy,
    # otherwise we can end up with invalid checksum.
    CopySourceIfMatch=etag,
)
"""


class RawStream(io.BytesIO):
    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        pass

    @property
    def content(self):
        return self

    async def iter_any(self):
        yield super().read()


def make_body(contents: bytes) -> StreamingBody:
    return StreamingBody(
        raw_stream=RawStream(contents),
        content_length=len(contents),
    )


AWS_CREDENTIALS = s3hash.AWSCredentials.parse_obj({
    "key": "test-key",
    "secret": "test-secret",
    "token": "test-token",
})

LOC = s3hash.S3ObjectSource(
    bucket="test-bucket",
    key="test-key",
    version="test-version",
)

EXPECTED_GETATTR_PARAMS = {
    **LOC.boto_args,
    "MaxParts": s3hash.MAX_PARTS,
    "ObjectAttributes": ["ETag", "Checksum", "ObjectParts", "ObjectSize"],
}


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
    finally:
        s3hash.S3.reset(s3_token)


async def test_compliant(s3_stub: Stubber):
    checksum = "MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g="

    s3_stub.add_response(
        "get_object_attributes",
        {
            "Checksum": {"ChecksumSHA256": checksum},
            "ObjectSize": 1048576,
        },
        EXPECTED_GETATTR_PARAMS,
    )

    res = await s3hash.compute_checksum(LOC)

    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.singlepart(base64.b64decode(checksum)))


async def test_legacy(s3_stub: Stubber):
    s3_stub.add_client_error(
        "get_object_attributes",
        "AccessDenied",
        expected_params=EXPECTED_GETATTR_PARAMS,
    )

    s3_stub.add_response(
        "head_object",
        {
            "ETag": '"test-etag"',
            "ContentLength": s3hash.MAX_PART_SIZE + 1,
        },
        LOC.boto_args,
    )

    s3_stub.add_response(
        "get_object",
        {"Body": make_body(b"test-body")},
        LOC.boto_args,
    )

    res = await s3hash.compute_checksum(LOC)

    checksum_hex = bytes.fromhex("d9d865cc54ec60678f1b119084ad79ae7f9357d1c4519c6457de3314b7fbba8a")
    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.singlepart(checksum_hex))
