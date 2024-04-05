from botocore.stub import Stubber
import pytest

import t4_lambda_s3hash as s3hash


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_get_bucket_region_exist_error(s3_stub: Stubber):
    bucket_name = "existent-bucket"
    expected_region = "us-west-2"
    s3_stub.add_client_error(
        method="head_bucket",
        service_error_code="403",
        expected_params={"Bucket": bucket_name},
        service_message="Not Found",
        response_meta={
            "HTTPHeaders": {"x-amz-bucket-region": expected_region},
        },
    )
    region = await s3hash.get_bucket_region(bucket_name)
    assert region == expected_region


@pytest.mark.asyncio
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
