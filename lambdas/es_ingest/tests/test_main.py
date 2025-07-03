import elasticsearch
import pytest

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
