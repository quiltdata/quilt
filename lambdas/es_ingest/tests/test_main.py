import json

import elasticsearch
import pytest
from botocore.stub import Stubber

import t4_lambda_es_ingest


def test_bulk_error(mocker):
    mock_bulk = mocker.patch("elasticsearch.Elasticsearch.bulk", return_value={"errors": True})
    mock_context = mocker.MagicMock()
    with pytest.raises(t4_lambda_es_ingest.BulkDocumentError):
        t4_lambda_es_ingest.bulk(mock_context, t4_lambda_es_ingest.es, b"data")

    mock_bulk.assert_called_once_with(
        b"data",
        filter_path=mocker.ANY,
        request_timeout=mocker.ANY,
    )


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
        "s3": {
            "bucket": {"name": "test-bucket"},
            "object": {
                "key": "test-key",
            },
        }
    }
    if version_id:
        s3_record["s3"]["object"]["versionId"] = version_id

    mock_event = {
        "Records": [
            {"body": json.dumps({"Records": [s3_record]})},
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
