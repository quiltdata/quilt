import asyncio
from unittest.mock import ANY

import botocore.exceptions
import pytest
from botocore.stub import Stubber
from pytest_mock import MockerFixture

import t4_lambda_s3hash as s3hash

AWS_CREDENTIALS = {
    "key": "test-key",
    "secret": "test-secret",
    "token": "test-token",
}

S3_SRC = {
    "bucket": "src-bucket",
    "key": "src-key",
    "version": "src-version",
}


class FakeContext:
    def __init__(self, _remaining_time_in_millis: int):
        self._remaining_time_in_millis = _remaining_time_in_millis

    def get_remaining_time_in_millis(self):
        return self._remaining_time_in_millis


def test_input_validation_error(mocker: MockerFixture):
    mock_compute_checksum = mocker.patch("t4_lambda_s3hash.compute_checksum")

    res = s3hash.lambda_handler(
        {
            "credentials": AWS_CREDENTIALS,
            "location": "s3://bucket/key",
            "scratch_buckets": {},
            "checksum_algorithm": "CRC64NVME",
        },
        None,
    )

    assert res == {
        "error": {
            "name": "InvalidInputParameters",
            "context": {
                "details": ANY,
            },
        },
    }

    mock_compute_checksum.assert_not_called()


def test_timeout(mocker: MockerFixture):
    async def sleep(*_):
        await asyncio.sleep(1)

    mock_compute_checksum = mocker.patch("t4_lambda_s3hash.compute_checksum", side_effect=sleep)

    res = s3hash.lambda_handler(
        {
            "credentials": AWS_CREDENTIALS,
            "location": S3_SRC,
            "scratch_buckets": {},
            "checksum_algorithm": "CRC64NVME",
        },
        FakeContext(1001),
    )

    assert res == {
        "error": {
            "name": "Timeout",
            "context": None,
        },
    }

    mock_compute_checksum.assert_called_once()


def test_aws_wiring(mocker: MockerFixture):
    result = {"checksum": "fake-checksum"}

    class FakeChecksum:
        type = "CRC64NVME"

    class FakeResponse:
        checksum = FakeChecksum()

        def dict(self):
            return result

    aio_context_mock = mocker.patch("t4_lambda_s3hash.aio_context")

    mock_compute_checksum = mocker.patch("t4_lambda_s3hash.compute_checksum", return_value=FakeResponse())

    res = s3hash.lambda_handler(
        {
            "credentials": AWS_CREDENTIALS,
            "location": S3_SRC,
            "scratch_buckets": {"region": "bucket"},
            "checksum_algorithm": "CRC64NVME",
        },
        FakeContext(2000),
    )

    assert res == {"result": result}

    mock_compute_checksum.assert_called_once_with(
        s3hash.S3ObjectSource(
            bucket=S3_SRC["bucket"],
            key=S3_SRC["key"],
            version=S3_SRC["version"],
        ),
        {"region": "bucket"},
        s3hash.ChecksumAlgorithm.CRC64NVME,
    )

    aio_context_mock.assert_called_once_with(s3hash.AWSCredentials.parse_obj(AWS_CREDENTIALS))


@pytest.mark.asyncio
async def test_mpu_abort_failure(s3_stub: Stubber, mocker: MockerFixture):
    """Test that MPU abort errors don't crash the cleanup.

    This tests the error recovery path in create_mpu context manager (lines 279-283)
    where aborting an MPU fails but we catch and log the exception.
    """
    target = s3hash.S3ObjectDestination(bucket="test-bucket", key="test-key")
    algorithm = s3hash.ChecksumAlgorithm.CRC64NVME

    # Mock make_scratch_key to avoid needing the full setup
    mocker.patch("t4_lambda_s3hash.make_scratch_key", return_value="test-key")

    # Create MPU succeeds
    s3_stub.add_response(
        "create_multipart_upload",
        {"UploadId": "test-upload-id"},
        {
            **target.boto_args,
            "ChecksumAlgorithm": algorithm.s3_checksum_algorithm,
        },
    )

    # Abort MPU fails with a client error
    s3_stub.add_client_error(
        "abort_multipart_upload",
        service_error_code="InternalError",
        service_message="S3 internal error during abort",
        expected_params={
            **target.boto_args,
            "UploadId": "test-upload-id",
        },
    )

    # Mock logger to verify the exception is logged
    mock_logger = mocker.patch("t4_lambda_s3hash.logger")

    # The context manager should not raise even though abort fails
    async with s3hash.create_mpu(target, algorithm) as mpu:
        assert mpu.id == "test-upload-id"
        # Simulate an error in the body that triggers cleanup
        pass

    # Verify the exception was logged
    mock_logger.exception.assert_called_once_with("Error aborting MPU")


@pytest.mark.asyncio
async def test_mpu_double_completion(s3_stub: Stubber):
    """Test that completing MPU twice raises an error.

    This tests the defensive check in MPURef.complete() (lines 246-248)
    that prevents double-completion of an MPU.
    """
    mpu = s3hash.MPURef(bucket="test-bucket", key="test-key", id="test-upload-id")

    # First completion succeeds
    s3_stub.add_response(
        "complete_multipart_upload",
        {"VersionId": "test-version"},
        {
            **mpu.boto_args,
            "MultipartUpload": {"Parts": []},
        },
    )

    # Complete the MPU
    await mpu.complete([])

    # Second completion attempt should raise
    with pytest.raises(Exception, match="MPU is already completed"):
        await mpu.complete([])
