import base64
import io

import pytest
from aiobotocore.response import StreamingBody
from botocore.stub import Stubber
from pytest_mock import MockerFixture

import t4_lambda_s3hash as s3hash
from quilt_shared.const import MAX_PART_SIZE


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

REGION = "test-region"
SCRATCH_BUCKET = "test-scratch-bucket"
SCRATCH_BUCKETS = {REGION: SCRATCH_BUCKET}
SCRATCH_KEY = "test-scratch-key"

MPU_DST = s3hash.S3ObjectDestination(
    bucket=SCRATCH_BUCKET,
    key=SCRATCH_KEY,
)

EXPECTED_MPU_PARAMS = {
    **MPU_DST.boto_args,
    "ChecksumAlgorithm": "SHA256",
}


@pytest.fixture(autouse=True)
def mock_scratch_key(mocker: MockerFixture):
    return mocker.patch("t4_lambda_s3hash.make_scratch_key", return_value=SCRATCH_KEY)


async def test_compliant(s3_stub: Stubber):
    checksum = "MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g="
    checksum_hash = "WZ1xAz1wCsiSoOSPphsSXS9ZlBu0XaGQlETUPG7gurI="

    s3_stub.add_response(
        "get_object_attributes",
        {
            "Checksum": {"ChecksumSHA256": checksum},
            "ObjectSize": 1048576,  # below the threshold
        },
        EXPECTED_GETATTR_PARAMS,
    )

    res = await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS)

    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.sha256_chunked(base64.b64decode(checksum_hash)))


SHA256_EMPTY = bytes.fromhex("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")


@pytest.mark.parametrize(
    "chunked, expected",
    [
        (True, s3hash.Checksum.sha256_chunked(SHA256_EMPTY)),
        (False, s3hash.Checksum.sha256(SHA256_EMPTY)),
    ],
)
async def test_empty(chunked: bool, expected: s3hash.Checksum, s3_stub: Stubber, mocker: MockerFixture):
    mocker.patch("t4_lambda_s3hash.CHUNKED_CHECKSUMS", chunked)

    s3_stub.add_response(
        "get_object_attributes",
        {
            "Checksum": {"ChecksumSHA256": "doesnt matter"},
            "ObjectSize": 0,
            "ETag": "any",
        },
        EXPECTED_GETATTR_PARAMS,
    )

    res = await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS)

    assert res == s3hash.ChecksumResult(checksum=expected)


@pytest.mark.parametrize(
    "chunked, expected",
    [
        (True, s3hash.Checksum.sha256_chunked(SHA256_EMPTY)),
        (False, s3hash.Checksum.sha256(SHA256_EMPTY)),
    ],
)
async def test_empty_no_access(chunked: bool, expected: s3hash.Checksum, s3_stub: Stubber, mocker: MockerFixture):
    mocker.patch("t4_lambda_s3hash.CHUNKED_CHECKSUMS", chunked)

    s3_stub.add_client_error(
        "get_object_attributes",
        service_error_code="AccessDenied",
        expected_params=EXPECTED_GETATTR_PARAMS,
    )

    s3_stub.add_response(
        "head_object",
        {
            "ETag": '"test-etag"',
            "ContentLength": 0,
        },
        LOC.boto_args,
    )

    res = await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS)

    assert res == s3hash.ChecksumResult(checksum=expected)


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
            "ContentLength": MAX_PART_SIZE + 1,
        },
        LOC.boto_args,
    )

    s3_stub.add_response(
        "get_object",
        {"Body": make_body(b"test-body")},
        LOC.boto_args,
    )

    mocker.patch("t4_lambda_s3hash.CHUNKED_CHECKSUMS", False)

    res = await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS)

    checksum_hex = bytes.fromhex("d9d865cc54ec60678f1b119084ad79ae7f9357d1c4519c6457de3314b7fbba8a")
    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.sha256(checksum_hex))


def stub_bucket_region(s3_stub: Stubber):
    s3_stub.add_response(
        "head_bucket",
        expected_params={"Bucket": LOC.bucket},
        service_response={
            "ResponseMetadata": {
                "HTTPHeaders": {"x-amz-bucket-region": REGION},
            },
        },
    )


async def test_mpu_fail(s3_stub: Stubber):
    ETAG = "test-etag"
    SIZE = 1048576
    s3_stub.add_response(
        "get_object_attributes",
        {"ObjectSize": SIZE, "ETag": ETAG},
        EXPECTED_GETATTR_PARAMS,
    )

    stub_bucket_region(s3_stub)

    s3_stub.add_client_error(
        "create_multipart_upload",
        "TestError",
        expected_params=EXPECTED_MPU_PARAMS,
    )

    with pytest.raises(s3hash.LambdaError) as excinfo:
        await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS)

    assert excinfo.value.dict() == {
        "name": "MPUError",
        "context": {
            "dst": MPU_DST.dict(),
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

    stub_bucket_region(s3_stub)

    MPU_ID = "test-upload-id"
    s3_stub.add_response(
        "create_multipart_upload",
        {"UploadId": MPU_ID},
        EXPECTED_MPU_PARAMS,
    )

    CHECKSUM = bytes.fromhex("d9d865cc54ec60678f1b119084ad79ae7f9357d1c4519c6457de3314b7fbba8a")
    CHECKSUM_HASH = bytes.fromhex("7eb12f7f901586f5c53fc5d8aaccd4a18177aa122c0bd166133372f42bc23880")
    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                "ChecksumSHA256": base64.b64encode(CHECKSUM).decode(),
                "ETag": PART_ETAG,
            },
        },
        {
            **MPU_DST.boto_args,
            "UploadId": MPU_ID,
            "PartNumber": 1,
            "CopySource": LOC.boto_args,
            "CopySourceIfMatch": ETAG,
        },
    )

    s3_stub.add_response(
        "abort_multipart_upload",
        {},
        {**MPU_DST.boto_args, "UploadId": MPU_ID},
    )

    res = await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS)

    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.sha256_chunked(CHECKSUM_HASH))


async def test_mpu_multi(s3_stub: Stubber):
    ETAG = "test-etag"
    SIZE = s3hash.MIN_PART_SIZE + 1
    s3_stub.add_response(
        "get_object_attributes",
        {"ObjectSize": SIZE, "ETag": ETAG},
        EXPECTED_GETATTR_PARAMS,
    )

    stub_bucket_region(s3_stub)

    MPU_ID = "test-upload-id"
    s3_stub.add_response(
        "create_multipart_upload",
        {"UploadId": MPU_ID},
        EXPECTED_MPU_PARAMS,
    )

    CHECKSUM_1 = bytes.fromhex("d9d865cc54ec60678f1b119084ad79ae7f9357d1c4519c6457de3314b7fbba8a")
    CHECKSUM_2 = bytes.fromhex("a9d865cc54ec60678f1b119084ad79ae7f9357d1c4519c6457de3314b7fbba8a")
    CHECKSUM_TOP = s3hash.Checksum.hash_parts([CHECKSUM_1, CHECKSUM_2])
    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                "ChecksumSHA256": base64.b64encode(CHECKSUM_1).decode(),
                "ETag": ETAG + "-1",
            },
        },
        {
            **MPU_DST.boto_args,
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
            **MPU_DST.boto_args,
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
        {**MPU_DST.boto_args, "UploadId": MPU_ID},
    )

    res = await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS)

    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.sha256_chunked(CHECKSUM_TOP))


@pytest.mark.parametrize(
    "response, result_version_id",
    [
        ({}, None),
        ({"VersionId": "test-version-id"}, "test-version-id"),
    ],
)
async def test_mpu_multi_complete(s3_stub: Stubber, response, result_version_id):
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

    s3_stub.add_response(
        "complete_multipart_upload",
        response,
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

    assert res == s3hash.CopyResult(version=result_version_id)
