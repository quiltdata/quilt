import asyncio
from unittest.mock import ANY

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
