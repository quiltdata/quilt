import pytest
from botocore.stub import Stubber
from pytest_mock import MockerFixture

import t4_lambda_s3hash as s3hash

SCRATCH_KEY = "test-scratch-key"


@pytest.fixture(autouse=True)
def mock_scratch_key(mocker: MockerFixture):
    return mocker.patch("t4_lambda_s3hash.make_scratch_key", return_value=SCRATCH_KEY)


async def test_get_bucket_region_valid(s3_stub: Stubber):
    expected_region = "us-west-2"
    bucket_name = "test-bucket"
    s3_stub.add_response(
        method="head_bucket",
        expected_params={"Bucket": bucket_name},
        service_response={
            "ResponseMetadata": {
                "HTTPHeaders": {"x-amz-bucket-region": expected_region},
            },
        },
    )
    region = await s3hash.get_bucket_region(bucket_name)
    assert region == expected_region


async def test_get_bucket_region_exist_error(s3_stub: Stubber):
    bucket_name = "existent-bucket"
    expected_region = "us-west-2"
    s3_stub.add_client_error(
        method="head_bucket",
        service_error_code="403",
        expected_params={"Bucket": bucket_name},
        service_message="Not Found",  # we only care about the error code, not the message
        response_meta={
            "HTTPHeaders": {"x-amz-bucket-region": expected_region},
        },
    )
    region = await s3hash.get_bucket_region(bucket_name)
    assert region == expected_region


async def test_get_bucket_region_nonexist_error(s3_stub: Stubber):
    bucket_name = "non-existent-bucket"
    s3_stub.add_client_error(
        method="head_bucket",
        service_error_code="404",
        expected_params={"Bucket": bucket_name},
        service_message="Not Found",
    )
    with pytest.raises(Exception) as exc_info:
        await s3hash.get_bucket_region(bucket_name)
    assert "Not Found" in str(exc_info.value)


async def test_get_mpu_dst_for_location_valid(s3_stub: Stubber):
    src_loc = s3hash.S3ObjectSource(bucket="source-bucket", key="source-key", version="source-version")
    scratch_buckets = {"us-west-2": "scratch-bucket-us-west-2"}
    expected_dst = s3hash.S3ObjectDestination(bucket="scratch-bucket-us-west-2", key=SCRATCH_KEY)

    s3_stub.add_response(
        method="head_bucket",
        expected_params={"Bucket": src_loc.bucket},
        service_response={
            "ResponseMetadata": {
                "HTTPHeaders": {"x-amz-bucket-region": "us-west-2"},
            },
        },
    )

    dst = await s3hash.get_mpu_dst_for_location(src_loc, scratch_buckets)
    assert dst == expected_dst


async def test_get_mpu_dst_for_location_no_scratch_bucket(s3_stub: Stubber):
    src_loc = s3hash.S3ObjectSource(bucket="source-bucket", key="source-key", version="source-version")
    scratch_buckets = {"us-east-1": "scratch-bucket-us-east-1"}

    s3_stub.add_response(
        method="head_bucket",
        expected_params={"Bucket": src_loc.bucket},
        service_response={
            "ResponseMetadata": {
                "HTTPHeaders": {"x-amz-bucket-region": "us-west-2"},
            },
        },
    )

    with pytest.raises(s3hash.LambdaError) as exc_info:
        await s3hash.get_mpu_dst_for_location(src_loc, scratch_buckets)
    assert "ScratchBucketNotFound" in str(exc_info.value)
