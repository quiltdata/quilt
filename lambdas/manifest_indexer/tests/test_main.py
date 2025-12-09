import datetime
import json
from unittest.mock import MagicMock, call, patch

import pytest

from quilt_shared.es import get_manifest_doc_id, get_manifest_entry_doc_id
from t4_lambda_manifest_indexer import (
    get_metadata_fields,
    index_manifest,
    prepare_workflow_for_es,
)

WORKFLOW_BUCKET = "BUCKET"
WORKFLOW_DATA = {
    "config": f"s3://{WORKFLOW_BUCKET}/.quilt/workflows/config.yml?versionId=asdf",
    "id": "workflow-id",
    "schemas": {
        "schema-id": "schema-url",
    },
}


def test_prepare_workflow_for_es():
    assert prepare_workflow_for_es(
        WORKFLOW_DATA,
        WORKFLOW_BUCKET,
    ) == {
        "config_version_id": "asdf",
        "id": "workflow-id",
        "schemas": [
            {
                "id": "schema-id",
                "url": "schema-url",
            }
        ],
    }


@pytest.fixture
def mock_s3_client():
    mock_client = MagicMock()
    return mock_client


@pytest.fixture
def mock_es():
    mock_es = MagicMock()
    return mock_es


@pytest.fixture
def mock_batcher():
    mock_batcher = MagicMock()
    return mock_batcher


def test_index_manifest(mock_s3_client, mock_es, mock_batcher):
    mnfst_bucket = "test-bucket"
    mnfst_hash = "a" * 64
    mnfst_key = f".quilt/packages/{mnfst_hash}"
    pkg_index = f"{mnfst_bucket}_packages"
    es_aliases = frozenset([mnfst_bucket, pkg_index])

    user_meta = {"description": "test manifest"}
    mnfst_entries = [
        {
            "user_meta": {"description": "test manifest"},
            "message": "test message",
            "workflow": {
                "config": f"s3://{mnfst_bucket}/.quilt/workflows/config.yml?versionId=asdf",
                "id": "workflow-id",
                "schemas": {
                    "schema-id": "schema-url",
                },
            },
        },
        {
            "logical_key": "test.txt",
            "physical_keys": [f"s3://{mnfst_bucket}/test.txt?versionId=some-version-id"],
            "size": 100,
            "hash": "testhash",
            "meta": {"test": "metadata"},
        },
        {
            "logical_key": "test2.txt",
            "physical_keys": [f"s3://{mnfst_bucket}/test2.txt"],
            "size": 100,
            "hash": "testhash",
            "meta": {"test": "metadata"},
        },
        {
            "logical_key": "dir/",
            "hash": "dirhash",
            "meta": {"test": "metadata"},
        },
        {
            "logical_key": "empty.txt",
            "physical_keys": ["s3://other-bucket/empty.txt"],
            "size": 0,
            "hash": "testhash",
            "meta": {"test": "metadata"},
        },
        {
            "logical_key": "non-s3.txt",
            "physical_keys": ["file:///local/path/non-s3.txt"],
            "size": 200,
            "hash": "testhash",
            "meta": {"test": "metadata", "user_meta": "42"},
        },
    ]

    last_modified = datetime.datetime(2023, 1, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
    mock_s3_client.get_object.return_value = {
        "Body": MagicMock(iter_lines=lambda: map(json.dumps, mnfst_entries)),
        "LastModified": last_modified,
    }

    with patch("t4_lambda_manifest_indexer.s3_client", mock_s3_client):
        with patch("t4_lambda_manifest_indexer.es", mock_es):
            with patch("t4_lambda_manifest_indexer.get_es_aliases", return_value=es_aliases):
                index_manifest(mock_batcher, bucket=mnfst_bucket, key=mnfst_key)

    assert mock_batcher.append.call_args_list == [
        call(
            {
                "_index": pkg_index,
                "_op_type": "index",
                "_id": get_manifest_entry_doc_id(mnfst_hash, "test.txt"),
                "join_field": {"name": "entry", "parent": get_manifest_doc_id(mnfst_hash)},
                "routing": get_manifest_doc_id(mnfst_hash),
                "entry_lk": "test.txt",
                "entry_pk": f"s3://{mnfst_bucket}/test.txt?versionId=some-version-id",
                "entry_pk_parsed.s3": {
                    "bucket": mnfst_bucket,
                    "key": "test.txt",
                    "version_id": "some-version-id",
                },
                "entry_size": 100,
                "entry_hash": "testhash",
                "entry_metadata": json.dumps({"test": "metadata"}, separators=(",", ":")),
            }
        ),
        call(
            {
                "_index": mnfst_bucket,
                "_op_type": "update",
                "_id": "test.txt:some-version-id",
                "doc": {"was_packaged": True},
                "doc_as_upsert": True,
            }
        ),
        call(
            {
                "_index": pkg_index,
                "_op_type": "index",
                "_id": get_manifest_entry_doc_id(mnfst_hash, "test2.txt"),
                "join_field": {"name": "entry", "parent": get_manifest_doc_id(mnfst_hash)},
                "routing": get_manifest_doc_id(mnfst_hash),
                "entry_lk": "test2.txt",
                "entry_pk": f"s3://{mnfst_bucket}/test2.txt",
                "entry_pk_parsed.s3": {
                    "bucket": mnfst_bucket,
                    "key": "test2.txt",
                    "version_id": None,
                },
                "entry_size": 100,
                "entry_hash": "testhash",
                "entry_metadata": json.dumps({"test": "metadata"}, separators=(",", ":")),
            }
        ),
        call(
            {
                "_index": mnfst_bucket,
                "_op_type": "update",
                "_id": "test2.txt:null",
                "doc": {"was_packaged": True},
                "doc_as_upsert": True,
            }
        ),
        call(
            {
                "_index": pkg_index,
                "_op_type": "index",
                "_id": get_manifest_entry_doc_id(mnfst_hash, "empty.txt"),
                "join_field": {"name": "entry", "parent": get_manifest_doc_id(mnfst_hash)},
                "routing": get_manifest_doc_id(mnfst_hash),
                "entry_lk": "empty.txt",
                "entry_pk": "s3://other-bucket/empty.txt",
                "entry_pk_parsed.s3": {
                    "bucket": "other-bucket",
                    "key": "empty.txt",
                    "version_id": None,
                },
                "entry_size": 0,
                "entry_hash": "testhash",
                "entry_metadata": json.dumps({"test": "metadata"}, separators=(",", ":")),
            }
        ),
        call(
            {
                "_index": pkg_index,
                "_op_type": "index",
                "_id": get_manifest_entry_doc_id(mnfst_hash, "non-s3.txt"),
                "join_field": {"name": "entry", "parent": get_manifest_doc_id(mnfst_hash)},
                "routing": get_manifest_doc_id(mnfst_hash),
                "entry_lk": "non-s3.txt",
                "entry_pk": "file:///local/path/non-s3.txt",
                "entry_pk_parsed.s3": None,
                "entry_size": 200,
                "entry_hash": "testhash",
                "entry_metadata": json.dumps({"test": "metadata", "user_meta": "42"}, separators=(",", ":")),
            }
        ),
        call(
            {
                "_index": pkg_index,
                "_op_type": "index",
                "_id": get_manifest_doc_id(mnfst_hash),
                "join_field": {"name": "mnfst"},
                "mnfst_hash": mnfst_hash,
                "mnfst_last_modified": last_modified,
                "mnfst_stats": {
                    "total_bytes": 400,
                    "total_files": 4,
                },
                "mnfst_metadata": json.dumps({"description": "test manifest"}, separators=(",", ":")),
                "mnfst_metadata_fields": get_metadata_fields(user_meta),
                "mnfst_message": "test message",
                "mnfst_workflow": {
                    "config_version_id": "asdf",
                    "id": "workflow-id",
                    "schemas": [{"id": "schema-id", "url": "schema-url"}],
                },
            }
        ),
    ]
    mock_es.delete_by_query.assert_not_called()


def test_index_manifest_invalid_hash(mock_s3_client, mock_es, mock_batcher):
    bucket = "test-bucket"
    key = ".quilt/packages/INVALID_HASH"

    with patch("t4_lambda_manifest_indexer.s3_client", mock_s3_client):
        with patch("t4_lambda_manifest_indexer.es", mock_es):
            index_manifest(mock_batcher, bucket=bucket, key=key)

    mock_s3_client.get_object.assert_not_called()


def test_index_manifest_no_entries(mock_s3_client, mock_es, mock_batcher):
    bucket = "test-bucket"
    key = ".quilt/packages/" + "a" * 64

    mock_s3_client.get_object.return_value = {"Body": MagicMock(iter_lines=lambda: [])}

    with patch("t4_lambda_manifest_indexer.s3_client", mock_s3_client):
        with patch("t4_lambda_manifest_indexer.es", mock_es):
            index_manifest(mock_batcher, bucket=bucket, key=key)

    mock_es.delete_by_query.assert_called_once_with(
        index="test-bucket_packages",
        body={
            "query": {
                "parent_id": {
                    "type": "entry",
                    "id": get_manifest_doc_id("a" * 64),
                },
            }
        },
    )
