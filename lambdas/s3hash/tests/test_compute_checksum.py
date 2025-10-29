"""Test CRC64NVME checksum computation."""
import base64
import io

import pytest
from aiobotocore.response import StreamingBody
from botocore.stub import Stubber
from pytest_mock import MockerFixture

import t4_lambda_s3hash as s3hash
from quilt_shared.const import MAX_PART_SIZE


def test_combine_crc64nvme():
    """Test CRC64NVME combination with known checksums.

    Known CRC64NVME checksums:
    - "test1": 0x7585d198a2d5b287
    - "test2": 0xf436c0c0f28b290c
    - "test1test2": 0x215f4b83b86262f3
    """
    crc_test1 = (0x7585d198a2d5b287).to_bytes(8, byteorder='big')
    crc_test2 = (0xf436c0c0f28b290c).to_bytes(8, byteorder='big')
    crc_combined_expected = (0x215f4b83b86262f3).to_bytes(8, byteorder='big')

    size_test1 = len(b"test1")  # 5 bytes
    size_test2 = len(b"test2")  # 5 bytes

    result = s3hash.combine_crc64nvme([crc_test1, crc_test2], [size_test1, size_test2])

    assert result == crc_combined_expected


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
    "ChecksumAlgorithm": "CRC64NVME",
}


@pytest.fixture(autouse=True)
def mock_scratch_key(mocker: MockerFixture):
    return mocker.patch("t4_lambda_s3hash.make_scratch_key", return_value=SCRATCH_KEY)


async def test_precomputed_crc64nvme(s3_stub: Stubber):
    """Test Tier 1: Retrieve precomputed CRC64NVME from S3 object attributes"""
    checksum = "AQIDBAUGBwg="  # base64-encoded CRC64NVME value

    s3_stub.add_response(
        "get_object_attributes",
        {
            "Checksum": {"ChecksumCRC64NVME": checksum},
            "ObjectSize": 1048576,
        },
        EXPECTED_GETATTR_PARAMS,
    )

    res = await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS)

    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.crc64nvme(base64.b64decode(checksum)))


async def test_empty(s3_stub: Stubber):
    """Test empty file returns empty CRC64NVME checksum"""
    s3_stub.add_response(
        "get_object_attributes",
        {
            "Checksum": {"ChecksumCRC64NVME": "doesnt matter"},
            "ObjectSize": 0,
            "ETag": "any",
        },
        EXPECTED_GETATTR_PARAMS,
    )

    res = await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS)

    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.empty_crc64nvme())


async def test_empty_no_access(s3_stub: Stubber):
    """Test empty file without GetObjectAttributes access"""
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

    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.empty_crc64nvme())


# Legacy SHA256 mode removed - CRC64NVME is always used now


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
    """Test Tier 2: Single-part MPU computation uses checksum directly"""
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

    CHECKSUM_CRC64 = (0x7585d198a2d5b287).to_bytes(8, byteorder='big')
    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                "ChecksumCRC64NVME": base64.b64encode(CHECKSUM_CRC64).decode(),
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

    # Single part: checksum should be used directly without combination
    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.crc64nvme(CHECKSUM_CRC64))


async def test_mpu_multi(s3_stub: Stubber, mocker: MockerFixture):
    """Test Tier 2: Multi-part MPU combines CRC64NVME checksums"""
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

    # Arbitrary CRC values for the two parts (8388608 bytes + 1 byte)
    CHECKSUM_1 = (0x1111111111111111).to_bytes(8, byteorder='big')
    CHECKSUM_2 = (0x2222222222222222).to_bytes(8, byteorder='big')
    CHECKSUM_COMBINED = (0x3333333333333333).to_bytes(8, byteorder='big')

    # Mock combine_crc64nvme to return our expected result
    mocker.patch("t4_lambda_s3hash.combine_crc64nvme", return_value=CHECKSUM_COMBINED)

    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                "ChecksumCRC64NVME": base64.b64encode(CHECKSUM_1).decode(),
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
                "ChecksumCRC64NVME": base64.b64encode(CHECKSUM_2).decode(),
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

    # Multi-part: checksums should be combined using CRC64NVME composition
    assert res == s3hash.ChecksumResult(checksum=s3hash.Checksum.crc64nvme(CHECKSUM_COMBINED))


@pytest.mark.parametrize(
    "response, result_version_id",
    [
        ({}, None),
        ({"VersionId": "test-version-id"}, "test-version-id"),
    ],
)
async def test_mpu_multi_complete(s3_stub: Stubber, response, result_version_id):
    """Test copy() function completes MPU with CRC64NVME"""
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
            "ChecksumAlgorithm": "CRC64NVME",
        },
    )

    CHECKSUM_1 = (0x7585d198a2d5b287).to_bytes(8, byteorder='big')
    ETAG_1 = ETAG + "-a"
    CHECKSUM_2 = (0xf436c0c0f28b290c).to_bytes(8, byteorder='big')
    ETAG_2 = ETAG + "-b"
    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                "ChecksumCRC64NVME": base64.b64encode(CHECKSUM_1).decode(),
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
                "ChecksumCRC64NVME": base64.b64encode(CHECKSUM_2).decode(),
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
                    {"ChecksumCRC64NVME": base64.b64encode(CHECKSUM_1).decode(), "ETag": ETAG_1, "PartNumber": 1},
                    {"ChecksumCRC64NVME": base64.b64encode(CHECKSUM_2).decode(), "ETag": ETAG_2, "PartNumber": 2},
                ],
            },
        },
    )

    res = await s3hash.copy(LOC, DEST)

    assert res == s3hash.CopyResult(version=result_version_id)
