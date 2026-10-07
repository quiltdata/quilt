import os

# Isolate Quilt before its first import; never use the developer's Catalog login.
os.environ["QUILT_DISABLE_USAGE_METRICS"] = "true"
os.environ["QUILT_DISABLE_CACHE"] = "true"
os.environ["AWS_EC2_METADATA_DISABLED"] = "true"

import boto3
import pytest
from moto import mock_aws


@pytest.fixture(autouse=True)
def isolated_config(monkeypatch, tmp_path):
    import quilt3.session
    import quilt3.util

    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    for name in (
        "FARADAY_MCP_URL",
        "QUILT_API_KEY",
        "FARADAY_MAX_SECONDS",
        "FARADAY_MAX_TURNS",
        "FARADAY_MAX_TOKENS",
        "FARADAY_MODEL_ID",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(quilt3.session, "get_from_config", lambda *args, **kwargs: None)
    monkeypatch.setattr(quilt3.util, "CONFIG_PATH", tmp_path / "no-quilt-config.yml")


@pytest.fixture
def registry():
    with mock_aws():
        boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="faraday-test")
        yield "s3://faraday-test"
