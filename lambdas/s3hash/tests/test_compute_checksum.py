"""Test CRC64NVME checksum computation."""

import base64
import io

import pytest
from aiobotocore.response import StreamingBody
from botocore.stub import Stubber
from pytest_mock import MockerFixture
from quilt3.data_transfer import CHECKSUM_MULTIPART_THRESHOLD
from quilt_shared.crc64 import combine_crc64nvme

import t4_lambda_s3hash as s3hash



def test_combine_crc64nvme():
    """Test CRC64NVME combination with known checksums.

    Known CRC64NVME checksums:
    - "test1": 0x7585d198a2d5b287
    - "test2": 0xf436c0c0f28b290c
    - "test1test2": 0x215f4b83b86262f3
    """
    crc_test1 = (0x7585D198A2D5B287).to_bytes(8, byteorder='big')
    crc_test2 = (0xF436C0C0F28B290C).to_bytes(8, byteorder='big')
    crc_combined_expected = (0x215F4B83B86262F3).to_bytes(8, byteorder='big')

    size_test1 = len(b"test1")  # 5 bytes
    size_test2 = len(b"test2")  # 5 bytes

    result = combine_crc64nvme([crc_test1, crc_test2], [size_test1, size_test2])

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

REGION = "test-region"
SCRATCH_BUCKET = "test-scratch-bucket"
SCRATCH_BUCKETS = {REGION: SCRATCH_BUCKET}
SCRATCH_KEY = "test-scratch-key"

MPU_DST = s3hash.S3ObjectDestination(
    bucket=SCRATCH_BUCKET,
    key=SCRATCH_KEY,
)

ALGORITHM_CRC64 = s3hash.ChecksumAlgorithm.CRC64NVME
ALGORITHM_SHA256 = s3hash.ChecksumAlgorithm.SHA256_CHUNKED

EXPECTED_MPU_PARAMS_CRC64 = {
    **MPU_DST.boto_args,
    "ChecksumAlgorithm": "CRC64NVME",
}

EXPECTED_MPU_PARAMS_SHA256 = {
    **MPU_DST.boto_args,
    "ChecksumAlgorithm": "SHA256",
}


@pytest.fixture(autouse=True)
def mock_scratch_key(mocker: MockerFixture):
    return mocker.patch("t4_lambda_s3hash.make_scratch_key", return_value=SCRATCH_KEY)


@pytest.mark.parametrize(
    "algorithm, expected_checksum",
    [
        (ALGORITHM_CRC64, s3hash.Checksum.empty_crc64nvme()),
        (ALGORITHM_SHA256, s3hash.Checksum.empty_sha256_chunked()),
    ],
)
async def test_empty(s3_stub: Stubber, algorithm, expected_checksum):
    """Test empty file returns empty checksum for specified algorithm"""
    s3_stub.add_response(
        "head_object",
        {
            "ETag": '"test-etag"',
            "ContentLength": 0,
        },
        LOC.boto_args,
    )

    res = await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS, algorithm)

    assert res == s3hash.ChecksumResult(checksum=expected_checksum)


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


@pytest.mark.parametrize(
    "algorithm, expected_mpu_params",
    [
        (ALGORITHM_CRC64, EXPECTED_MPU_PARAMS_CRC64),
        (ALGORITHM_SHA256, EXPECTED_MPU_PARAMS_SHA256),
    ],
)
async def test_mpu_fail(s3_stub: Stubber, algorithm, expected_mpu_params):
    ETAG = "test-etag"
    SIZE = 1048576
    s3_stub.add_response(
        "head_object",
        {"ContentLength": SIZE, "ETag": ETAG},
        LOC.boto_args,
    )

    stub_bucket_region(s3_stub)

    s3_stub.add_client_error(
        "create_multipart_upload",
        "TestError",
        expected_params=expected_mpu_params,
    )

    with pytest.raises(s3hash.LambdaError) as excinfo:
        await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS, algorithm)

    assert excinfo.value.dict() == {
        "name": "MPUError",
        "context": {
            "dst": MPU_DST.dict(),
            "error": "An error occurred (TestError) when calling the CreateMultipartUpload operation: ",
        },
    }


@pytest.mark.parametrize(
    "algorithm, expected_mpu_params, checksum_bytes, checksum_field, expected_checksum",
    [
        (
            ALGORITHM_CRC64,
            EXPECTED_MPU_PARAMS_CRC64,
            (0x7585D198A2D5B287).to_bytes(8, byteorder='big'),
            "ChecksumCRC64NVME",
            s3hash.Checksum.crc64nvme((0x7585D198A2D5B287).to_bytes(8, byteorder='big')),
        ),
        (
            ALGORITHM_SHA256,
            EXPECTED_MPU_PARAMS_SHA256,
            base64.b64decode("MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g="),
            "ChecksumSHA256",
            # SHA256_CHUNKED single-part still uses double-hash (from_parts)
            s3hash.Checksum.sha256_chunked_from_parts(
                [base64.b64decode("MOFJVevxNSJm3C/4Bn5oEEYH51CrudOzZYK4r5Cfy1g=")]
            ),
        ),
    ],
)
async def test_mpu_single(
    s3_stub: Stubber, algorithm, expected_mpu_params, checksum_bytes, checksum_field, expected_checksum
):
    """Test single-part MPU uses algorithm-specific checksum logic"""
    ETAG = "test-etag"
    PART_ETAG = "part-etag"
    SIZE = 1048576
    s3_stub.add_response(
        "head_object",
        {"ContentLength": SIZE, "ETag": ETAG},
        LOC.boto_args,
    )

    stub_bucket_region(s3_stub)

    MPU_ID = "test-upload-id"
    s3_stub.add_response(
        "create_multipart_upload",
        {"UploadId": MPU_ID},
        expected_mpu_params,
    )

    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                checksum_field: base64.b64encode(checksum_bytes).decode(),
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

    res = await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS, algorithm)

    # Single part: CRC64NVME used directly, SHA256_CHUNKED still double-hashed
    assert res == s3hash.ChecksumResult(checksum=expected_checksum)


@pytest.mark.parametrize(
    "algorithm, expected_mpu_params, checksum_1, checksum_2, checksum_combined, checksum_field, mock_target, expected_checksum_factory",
    [
        (
            ALGORITHM_CRC64,
            EXPECTED_MPU_PARAMS_CRC64,
            (0x1111111111111111).to_bytes(8, byteorder='big'),
            (0x2222222222222222).to_bytes(8, byteorder='big'),
            (0x3333333333333333).to_bytes(8, byteorder='big'),
            "ChecksumCRC64NVME",
            "quilt_shared.pkgpush.combine_crc64nvme",
            s3hash.Checksum.crc64nvme,
        ),
        (
            ALGORITHM_SHA256,
            EXPECTED_MPU_PARAMS_SHA256,
            base64.b64decode("wDbLt1U6kJ+LiHfURhkkMH8n7LZs/5KO7q/VacOIfik="),
            base64.b64decode("La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ="),
            base64.b64decode("bGeobZC1xyakKeDkOLWP9khl+vuOditELvPQhrT/R9M="),
            "ChecksumSHA256",
            "quilt_shared.pkgpush.Checksum.sha256_concat_and_hash",
            s3hash.Checksum.sha256_chunked,
        ),
    ],
)
async def test_mpu_multi(
    s3_stub: Stubber,
    mocker: MockerFixture,
    algorithm,
    expected_mpu_params,
    checksum_1,
    checksum_2,
    checksum_combined,
    checksum_field,
    mock_target,
    expected_checksum_factory,
):
    """Test multi-part MPU combines checksums correctly"""
    ETAG = "test-etag"
    SIZE = CHECKSUM_MULTIPART_THRESHOLD + 1
    s3_stub.add_response(
        "head_object",
        {"ContentLength": SIZE, "ETag": ETAG},
        LOC.boto_args,
    )

    stub_bucket_region(s3_stub)

    MPU_ID = "test-upload-id"
    s3_stub.add_response(
        "create_multipart_upload",
        {"UploadId": MPU_ID},
        expected_mpu_params,
    )

    # Mock the combination function to return our expected result
    mocker.patch(mock_target, return_value=checksum_combined)

    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                checksum_field: base64.b64encode(checksum_1).decode(),
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
                checksum_field: base64.b64encode(checksum_2).decode(),
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

    res = await s3hash.compute_checksum(LOC, SCRATCH_BUCKETS, algorithm)

    # Multi-part: checksums should be combined using algorithm-specific method
    assert res == s3hash.ChecksumResult(checksum=expected_checksum_factory(checksum_combined))


@pytest.mark.parametrize(
    "algorithm, checksum_field, checksum_1, checksum_2, response, result_version_id",
    [
        (
            ALGORITHM_CRC64,
            "ChecksumCRC64NVME",
            (0x7585D198A2D5B287).to_bytes(8, byteorder='big'),
            (0xF436C0C0F28B290C).to_bytes(8, byteorder='big'),
            {},
            None,
        ),
        (
            ALGORITHM_CRC64,
            "ChecksumCRC64NVME",
            (0x7585D198A2D5B287).to_bytes(8, byteorder='big'),
            (0xF436C0C0F28B290C).to_bytes(8, byteorder='big'),
            {"VersionId": "test-version-id"},
            "test-version-id",
        ),
        (
            ALGORITHM_SHA256,
            "ChecksumSHA256",
            base64.b64decode("wDbLt1U6kJ+LiHfURhkkMH8n7LZs/5KO7q/VacOIfik="),
            base64.b64decode("La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ="),
            {},
            None,
        ),
        (
            ALGORITHM_SHA256,
            "ChecksumSHA256",
            base64.b64decode("wDbLt1U6kJ+LiHfURhkkMH8n7LZs/5KO7q/VacOIfik="),
            base64.b64decode("La6x82CVtEsxhBCz9Oi12Yncx7sCPRQmxJLasKMFPnQ="),
            {"VersionId": "test-version-id"},
            "test-version-id",
        ),
    ],
)
async def test_mpu_multi_complete(
    s3_stub: Stubber, algorithm, checksum_field, checksum_1, checksum_2, response, result_version_id
):
    """Test copy() function completes MPU with specified algorithm"""
    ETAG = "test-etag"
    SIZE = CHECKSUM_MULTIPART_THRESHOLD + 1
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
            "ChecksumAlgorithm": algorithm.s3_checksum_algorithm,
        },
    )

    ETAG_1 = ETAG + "-a"
    ETAG_2 = ETAG + "-b"
    s3_stub.add_response(
        "upload_part_copy",
        {
            "CopyPartResult": {
                checksum_field: base64.b64encode(checksum_1).decode(),
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
                checksum_field: base64.b64encode(checksum_2).decode(),
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
                    {checksum_field: base64.b64encode(checksum_1).decode(), "ETag": ETAG_1, "PartNumber": 1},
                    {checksum_field: base64.b64encode(checksum_2).decode(), "ETag": ETAG_2, "PartNumber": 2},
                ],
            },
        },
    )

    res = await s3hash.copy(LOC, DEST, algorithm)

    assert res == s3hash.CopyResult(version=result_version_id)
