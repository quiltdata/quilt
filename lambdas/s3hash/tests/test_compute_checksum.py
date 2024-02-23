import asyncio
import base64
import io

import pytest
from aiobotocore.response import StreamingBody
from botocore.stub import Stubber
from pytest_mock import MockerFixture

import t4_lambda_s3hash as s3hash


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


AWS_CREDENTIALS = s3hash.AWSCredentials.parse_obj(
    {
        "key": "test-key",
        "secret": "test-secret",
        "token": "test-token",
    }
)

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

EXPECTED_MPU_PARAMS = {
    **s3hash.MPU_DST.boto_args,
    "ChecksumAlgorithm": "SHA256",
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
        stubber.assert_no_pending_responses()
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


async def test_legacy(s3_stub: Stubber, mocker: MockerFixture):
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

    mocker.patch("t4_lambda_s3hash.MULTIPART_CHECKSUMS", False)

    res = await s3hash.compute_checksum(LOC)

    checksum_hex = bytes.fromhex("d9d865cc54ec60678f1b119084ad79ae7f9357d1c4519c6457de3314b7fbba8a")
    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.singlepart(checksum_hex))


async def test_mpu_fail(s3_stub: Stubber):
    ETAG = "test-etag"
    SIZE = 1048576
    s3_stub.add_response(
        "get_object_attributes",
        {"ObjectSize": SIZE, "ETag": ETAG},
        EXPECTED_GETATTR_PARAMS,
    )

    s3_stub.add_client_error(
        "create_multipart_upload",
        "TestError",
        expected_params=EXPECTED_MPU_PARAMS,
    )

    with pytest.raises(s3hash.LambdaError) as excinfo:
        await s3hash.compute_checksum(LOC)

    assert excinfo.value.dict() == {
        "name": "MPUError",
        "context": {
            "dst": s3hash.MPU_DST.dict(),
            "error": "An error occurred (TestError) when calling the CreateMultipartUpload operation: ",
        },
    }


async def test_mpu_single(s3_stub: Stubber):
    ETAG = "test-etag"
    PART_ETAG = "part-etag"
    SIZE = 1048576
    s3_stub.add_response(
        "get_object_attributes",
        {"ObjectSize": SIZE, "ETag": ETAG},
        EXPECTED_GETATTR_PARAMS,
    )

    MPU_ID = "test-upload-id"
    s3_stub.add_response(
        "create_multipart_upload",
        {"UploadId": MPU_ID},
        EXPECTED_MPU_PARAMS,
    )

    CHECKSUM = bytes.fromhex("d9d865cc54ec60678f1b119084ad79ae7f9357d1c4519c6457de3314b7fbba8a")
    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                "ChecksumSHA256": base64.b64encode(CHECKSUM).decode(),
                "ETag": ETAG + "-1",
            },
        },
        {
            **s3hash.MPU_DST.boto_args,
            "UploadId": MPU_ID,
            "PartNumber": 1,
            "CopySource": LOC.boto_args,
            "CopySourceIfMatch": ETAG,
        },
    )

    s3_stub.add_response(
        "abort_multipart_upload",
        {},
        {**s3hash.MPU_DST.boto_args, "UploadId": MPU_ID},
    )

    res = await s3hash.compute_checksum(LOC)

    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.singlepart(CHECKSUM))


async def test_mpu_multi(s3_stub: Stubber):
    ETAG = "test-etag"
    SIZE = s3hash.MIN_PART_SIZE + 1
    s3_stub.add_response(
        "get_object_attributes",
        {"ObjectSize": SIZE, "ETag": ETAG},
        EXPECTED_GETATTR_PARAMS,
    )

    MPU_ID = "test-upload-id"
    s3_stub.add_response(
        "create_multipart_upload",
        {"UploadId": MPU_ID},
        EXPECTED_MPU_PARAMS,
    )

    CHECKSUM_1 = bytes.fromhex("d9d865cc54ec60678f1b119084ad79ae7f9357d1c4519c6457de3314b7fbba8a")
    CHECKSUM_2 = bytes.fromhex("a9d865cc54ec60678f1b119084ad79ae7f9357d1c4519c6457de3314b7fbba8a")
    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                "ChecksumSHA256": base64.b64encode(CHECKSUM_1).decode(),
                "ETag": ETAG + "-1",
            },
        },
        {
            **s3hash.MPU_DST.boto_args,
            "UploadId": MPU_ID,
            "PartNumber": 1,
            "CopySourceRange": "bytes=0-8388607",
            "CopySource": LOC.boto_args,
            "CopySourceIfMatch": ETAG,
        },
    )
    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                "ChecksumSHA256": base64.b64encode(CHECKSUM_2).decode(),
                "ETag": ETAG + "-2",
            },
        },
        {
            **s3hash.MPU_DST.boto_args,
            "UploadId": MPU_ID,
            "PartNumber": 2,
            "CopySourceRange": "bytes=8388608-8388608",
            "CopySource": LOC.boto_args,
            "CopySourceIfMatch": ETAG,
        },
    )

    s3_stub.add_response(
        "abort_multipart_upload",
        {},
        {**s3hash.MPU_DST.boto_args, "UploadId": MPU_ID},
    )

    res = await s3hash.compute_checksum(LOC)

    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.multipart([CHECKSUM_1, CHECKSUM_2]))


async def test_mpu_multi_complete(s3_stub: Stubber):
    ETAG = "test-etag"
    SIZE = s3hash.MIN_PART_SIZE + 1
    s3_stub.add_response(
        "head_object",
        {"ContentLength": SIZE, "ETag": ETAG},
        LOC.boto_args,
    )

    MPU_ID = "test-upload-id"
    DEST = s3hash.S3ObjectDestination(
        bucket="dest-bucket",
        key="dest-key",
    )
    s3_stub.add_response(
        "create_multipart_upload",
        {"UploadId": MPU_ID},
        {
            **DEST.boto_args,
            "ChecksumAlgorithm": "SHA256",
        },
    )

    CHECKSUM_1 = bytes.fromhex("d9d865cc54ec60678f1b119084ad79ae7f9357d1c4519c6457de3314b7fbba8a")
    ETAG_1 = ETAG + "-a"
    CHECKSUM_2 = bytes.fromhex("a9d865cc54ec60678f1b119084ad79ae7f9357d1c4519c6457de3314b7fbba8a")
    ETAG_2 = ETAG + "-b"
    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                "ChecksumSHA256": base64.b64encode(CHECKSUM_1).decode(),
                "ETag": ETAG_1,
            },
        },
        {
            **DEST.boto_args,
            "UploadId": MPU_ID,
            "PartNumber": 1,
            "CopySourceRange": "bytes=0-8388607",
            "CopySource": LOC.boto_args,
            "CopySourceIfMatch": ETAG,
        },
    )
    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                "ChecksumSHA256": base64.b64encode(CHECKSUM_2).decode(),
                "ETag": ETAG_2,
            },
        },
        {
            **DEST.boto_args,
            "UploadId": MPU_ID,
            "PartNumber": 2,
            "CopySourceRange": "bytes=8388608-8388608",
            "CopySource": LOC.boto_args,
            "CopySourceIfMatch": ETAG,
        },
    )

    RESULT_VERSION_ID = "result-version-id"
    s3_stub.add_response(
        "complete_multipart_upload",
        {
            "VersionId": RESULT_VERSION_ID,
        },
        {
            **DEST.boto_args,
            "UploadId": MPU_ID,
            "MultipartUpload": {
                "Parts": [
                    {"ChecksumSHA256": base64.b64encode(CHECKSUM_1).decode(), "ETag": ETAG_1, "PartNumber": 1},
                    {"ChecksumSHA256": base64.b64encode(CHECKSUM_2).decode(), "ETag": ETAG_2, "PartNumber": 2},
                ],
            },
        },
    )

    res = await s3hash.copy(LOC, DEST)

    assert res == s3hash.CopyResult(version=RESULT_VERSION_ID)
