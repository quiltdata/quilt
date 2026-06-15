import json
import logging

import elasticsearch
import pytest
from botocore.stub import Stubber

import t4_lambda_es_ingest


def test_bulk_ok(mocker):
    mock_bulk = mocker.patch("elasticsearch.Elasticsearch.bulk", return_value={"errors": False})
    mock_context = mocker.MagicMock()

    t4_lambda_es_ingest.bulk(mock_context, t4_lambda_es_ingest.es, b"data")

    mock_bulk.assert_called_once_with(
        b"data",
        filter_path="errors,items.*.error",
        request_timeout=mocker.ANY,
    )


def test_bulk_error(mocker, caplog):
    mapper_error = {"index": {"error": {"type": "mapper_parsing_exception", "reason": "failed to parse field [x]"}}}
    mock_bulk = mocker.patch(
        "elasticsearch.Elasticsearch.bulk",
        return_value={
            "errors": True,
            "items": [
                mapper_error,
                # Identical to the first: must collapse into a single (x2) group.
                mapper_error,
                {"delete": {"error": {"type": "index_not_found_exception", "reason": "no such index [y]"}}},
            ],
        },
    )
    mock_context = mocker.MagicMock()
    with caplog.at_level(logging.ERROR), pytest.raises(t4_lambda_es_ingest.BulkDocumentError) as exc_info:
        t4_lambda_es_ingest.bulk(mock_context, t4_lambda_es_ingest.es, b"data")

    mock_bulk.assert_called_once_with(
        b"data",
        filter_path="errors,items.*.error",
        request_timeout=mocker.ANY,
    )
    # The two identical errors collapse into one (x2) group; the delete stays separate.
    # %r-quoted so log-line forgery via a crafted reason is escaped.
    assert "Bulk index failed (x2): 'mapper_parsing_exception': 'failed to parse field [x]'" in caplog.text
    assert "Bulk delete failed (x1): 'index_not_found_exception': 'no such index [y]'" in caplog.text
    assert "3 document(s) failed in bulk request (2 distinct error(s))" in str(exc_info.value)


def test_bulk_error_without_details(mocker, caplog):
    # `errors` set but no per-item error details: still raise, and log the raw
    # response so the failure isn't silently undiagnosable.
    mock_bulk = mocker.patch("elasticsearch.Elasticsearch.bulk", return_value={"errors": True})
    mock_context = mocker.MagicMock()
    with caplog.at_level(logging.ERROR), pytest.raises(t4_lambda_es_ingest.BulkDocumentError) as exc_info:
        t4_lambda_es_ingest.bulk(mock_context, t4_lambda_es_ingest.es, b"data")

    mock_bulk.assert_called_once_with(
        b"data",
        filter_path="errors,items.*.error",
        request_timeout=mocker.ANY,
    )
    assert "no per-item error details" in caplog.text
    assert "no per-item error details" in str(exc_info.value)


def test_bulk_too_many_requests(mocker):
    mocker.patch("elasticsearch.exceptions.TransportError.status_code", 429)
    mock_bulk = mocker.patch("elasticsearch.Elasticsearch.bulk", side_effect=elasticsearch.exceptions.TransportError)
    mock_context = mocker.MagicMock()
    mock_sleep_until_timeout = mocker.patch("t4_lambda_es_ingest.sleep_until_timeout")

    with pytest.raises(t4_lambda_es_ingest.TooManyRequestsError):
        t4_lambda_es_ingest.bulk(mock_context, t4_lambda_es_ingest.es, b"data")

    mock_bulk.assert_called_once_with(
        b"data",
        filter_path=mocker.ANY,
        request_timeout=mocker.ANY,
    )
    mock_sleep_until_timeout.assert_called_once_with(mock_context)


@pytest.mark.parametrize("version_id", ["test-version-id", None])
def test_handler(mocker, version_id):
    mock_context = mocker.MagicMock()
    s3_record = {
        "bucket": {"name": "test-bucket"},
        "object": {
            "key": "test-key",
        },
    }
    if version_id:
        s3_record["object"]["version-id"] = version_id

    mock_event = {
        "Records": [
            {"body": json.dumps({"detail": s3_record})},
        ]
    }

    with Stubber(t4_lambda_es_ingest.s3_client) as stubber:
        mock_bulk = mocker.patch("t4_lambda_es_ingest.bulk")
        get_object_params = {"Bucket": "test-bucket", "Key": "test-key"}
        if version_id:
            get_object_params["VersionId"] = version_id

        stubber.add_response(
            "get_object",
            {
                "Body": mocker.MagicMock(read=lambda: b"test data"),
                "LastModified": "2023-10-01T00:00:00Z",
            },
            get_object_params,
        )
        stubber.add_response(
            "delete_object",
            {},
            (
                {"Bucket": "test-bucket", "Key": "test-key"}
                if version_id is None
                else {
                    "Bucket": "test-bucket",
                    "Key": "test-key",
                    "VersionId": version_id,
                }
            ),
        )

        t4_lambda_es_ingest.handler(mock_event, mock_context)

        stubber.assert_no_pending_responses()
        mock_bulk.assert_called_once_with(mock_context, t4_lambda_es_ingest.es, b"test data")


def test_handler_logs_source_on_bulk_error(mocker, caplog):
    mock_context = mocker.MagicMock()
    mock_event = {
        "Records": [
            {"body": json.dumps({"detail": {"bucket": {"name": "test-bucket"}, "object": {"key": "test-key"}}})},
        ]
    }

    with Stubber(t4_lambda_es_ingest.s3_client) as stubber:
        mocker.patch("t4_lambda_es_ingest.bulk", side_effect=t4_lambda_es_ingest.BulkDocumentError("boom"))
        stubber.add_response(
            "get_object",
            {"Body": mocker.MagicMock(read=lambda: b"test data"), "LastModified": "2023-10-01T00:00:00Z"},
            {"Bucket": "test-bucket", "Key": "test-key"},
        )
        # No delete_object response is queued: the object must NOT be deleted on
        # failure (so it stays for retry/DLQ); a delete call would error here.
        with caplog.at_level(logging.ERROR), pytest.raises(t4_lambda_es_ingest.BulkDocumentError):
            t4_lambda_es_ingest.handler(mock_event, mock_context)

        stubber.assert_no_pending_responses()

    assert "s3://test-bucket/test-key" in caplog.text
