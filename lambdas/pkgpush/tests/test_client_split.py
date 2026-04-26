"""
Tests that verify the source/service S3 client split introduced in the add-bucket branch:
- get_bucket_region (head_bucket)         -> user client
- list_prefix_latest_versions (paginator) -> user client
- package_prefix metadata read            -> user client
- get_scratch_buckets (scratch-map read)  -> service client (t4_lambda_pkgpush.s3)
"""

import io
import json
from unittest import mock

import quilt3
import t4_lambda_pkgpush

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_mock_client(name: str):
    """Return a MagicMock that records calls and has a distinct identity."""
    return mock.MagicMock(name=name)


# ---------------------------------------------------------------------------
# get_bucket_region uses user client
# ---------------------------------------------------------------------------


def test_get_bucket_region_uses_user_client():
    user_client = _make_mock_client("user_s3")
    service_client = _make_mock_client("service_s3")

    # Simulate a normal head_bucket response (bucket found, region header present).
    user_client.head_bucket.return_value = {
        "ResponseMetadata": {"HTTPHeaders": {"x-amz-bucket-region": "us-west-2"}}
    }

    with (
        mock.patch.object(t4_lambda_pkgpush, "get_user_s3_client", return_value=user_client),
        mock.patch.object(t4_lambda_pkgpush, "get_service_s3_client", return_value=service_client),
    ):
        region = t4_lambda_pkgpush.get_bucket_region("my-source-bucket")

    # User client must have been called.
    user_client.head_bucket.assert_called_once_with(Bucket="my-source-bucket")
    # Service client must NOT have been called for this operation.
    service_client.head_bucket.assert_not_called()
    assert region == "us-west-2"


# ---------------------------------------------------------------------------
# list_prefix_latest_versions uses user client
# ---------------------------------------------------------------------------


def test_list_prefix_latest_versions_uses_user_client():
    user_client = _make_mock_client("user_s3")
    service_client = _make_mock_client("service_s3")

    fake_paginator = mock.MagicMock()
    fake_paginator.paginate.return_value = [
        {"Versions": [{"Key": "prefix/obj.txt", "IsLatest": True, "Size": 10}]}
    ]
    user_client.get_paginator.return_value = fake_paginator

    with (
        mock.patch.object(t4_lambda_pkgpush, "get_user_s3_client", return_value=user_client),
        mock.patch.object(t4_lambda_pkgpush, "get_service_s3_client", return_value=service_client),
    ):
        results = list(t4_lambda_pkgpush.list_prefix_latest_versions("my-source-bucket", "prefix/"))

    user_client.get_paginator.assert_called_once_with("list_object_versions")
    fake_paginator.paginate.assert_called_once_with(Bucket="my-source-bucket", Prefix="prefix/")
    service_client.get_paginator.assert_not_called()
    assert len(results) == 1
    assert results[0]["Key"] == "prefix/obj.txt"


# ---------------------------------------------------------------------------
# get_scratch_buckets uses service client (not user client)
# ---------------------------------------------------------------------------


def test_get_scratch_buckets_uses_service_client():
    user_client = _make_mock_client("user_s3")
    service_client = _make_mock_client("service_s3")

    scratch_map = {"us-east-1": "scratch-bucket-east"}
    service_client.get_object.return_value = {
        "Body": io.BytesIO(json.dumps(scratch_map).encode())
    }

    with (
        mock.patch.object(t4_lambda_pkgpush, "get_user_s3_client", return_value=user_client),
        mock.patch.object(t4_lambda_pkgpush, "get_service_s3_client", return_value=service_client),
    ):
        result = t4_lambda_pkgpush.get_scratch_buckets()

    service_client.get_object.assert_called_once_with(
        Bucket=t4_lambda_pkgpush.SERVICE_BUCKET, Key="scratch-buckets.json"
    )
    # User client must NOT have been used to read the scratch map.
    user_client.get_object.assert_not_called()
    assert result == scratch_map


# ---------------------------------------------------------------------------
# package_prefix metadata read uses user client
# ---------------------------------------------------------------------------


def test_package_prefix_metadata_read_uses_user_client():
    """
    When package_prefix resolves a metadata_uri, it must read the object
    through the user-scoped client, not the service client.

    Everything after the metadata fetch is patched away so the test focuses
    solely on which S3 client handled the metadata get_object call.
    """
    user_client = _make_mock_client("user_s3")
    service_client = _make_mock_client("service_s3")

    metadata_payload = {"author": "test"}
    user_client.get_object.return_value = {
        "Body": io.BytesIO(json.dumps(metadata_payload).encode())
    }

    # Minimal paginator: no objects, so no PackageEntry work is needed.
    fake_paginator = mock.MagicMock()
    fake_paginator.paginate.return_value = [{"Versions": []}]
    user_client.get_paginator.return_value = fake_paginator

    event_json = json.dumps(
        {
            "source_prefix": "s3://source-bucket/data/",
            "metadata_uri": "s3://source-bucket/data/meta.json",
        }
    )

    with (
        mock.patch.object(t4_lambda_pkgpush, "get_user_s3_client", return_value=user_client),
        mock.patch.object(t4_lambda_pkgpush, "get_service_s3_client", return_value=service_client),
        mock.patch.object(t4_lambda_pkgpush, "get_package_registry"),
        mock.patch.object(t4_lambda_pkgpush, "get_scratch_buckets", return_value={}),
        mock.patch.object(t4_lambda_pkgpush, "calculate_pkg_hashes"),
        mock.patch.object(t4_lambda_pkgpush, "get_checksum_algorithms", return_value=[]),
        mock.patch.object(t4_lambda_pkgpush, "complete_entries_metadata"),
        mock.patch.object(quilt3.Package, "_validate_with_workflow"),
        mock.patch.object(quilt3.Package, "_build", return_value="deadbeef"),
        mock.patch("time.time", return_value=1234567890.0),
    ):
        t4_lambda_pkgpush.package_prefix(event_json, None)

    # Metadata object must have been fetched via the user client.
    user_client.get_object.assert_called_once_with(
        Bucket="source-bucket", Key="data/meta.json"
    )
    # Service client must NOT have been used for the metadata read.
    service_client.get_object.assert_not_called()
