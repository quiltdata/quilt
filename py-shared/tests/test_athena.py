import logging

import boto3
import pytest
from botocore.stub import Stubber

from quilt_shared.athena import AthenaQueryCancelledException, AthenaQueryFailedException, QueryRunner


@pytest.fixture
def athena_client():
    return boto3.client("athena", region_name="us-east-1")


@pytest.fixture
def stubbed_athena_client(athena_client):
    with Stubber(athena_client) as stubber:
        yield stubber


@pytest.fixture
def query_runner(athena_client):
    logger = logging.getLogger("test_logger")
    return QueryRunner(
        logger=logger,
        athena=athena_client,
        database="test_database",
        workgroup="test_workgroup",
    )


def test_start_query(query_runner, stubbed_athena_client):
    query = "SELECT * FROM test_table"
    stubbed_athena_client.add_response(
        "start_query_execution",
        {"QueryExecutionId": "test_execution_id"},
        {
            "QueryString": query,
            "WorkGroup": "test_workgroup",
            "QueryExecutionContext": {"Database": "test_database"},
        },
    )

    execution_id = query_runner.start_query(query)
    assert execution_id == "test_execution_id"


@pytest.mark.parametrize(
    "state, raise_on_failed, expected_outcome",
    [
        ("RUNNING", True, None),
        ("QUEUED", True, None),
        ("SUCCEEDED", True, {"Status": {"State": "SUCCEEDED"}}),
        ("FAILED", True, AthenaQueryFailedException),
        ("FAILED", False, {"Status": {"State": "FAILED"}}),
        ("CANCELLED", True, AthenaQueryCancelledException),
    ],
)
def test_query_finished_states(query_runner, stubbed_athena_client, state, raise_on_failed, expected_outcome):
    execution_id = "test_execution_id"

    # Stub response for the given state
    stubbed_athena_client.add_response(
        "get_query_execution",
        {
            "QueryExecution": {
                "Status": {"State": state},
                "QueryExecutionId": execution_id,
            }
        },
        {"QueryExecutionId": execution_id},
    )

    if isinstance(expected_outcome, type) and issubclass(expected_outcome, Exception):
        with pytest.raises(expected_outcome):
            query_runner.query_finished(execution_id, raise_on_failed=raise_on_failed)
    else:
        result = query_runner.query_finished(execution_id, raise_on_failed=raise_on_failed)
        if result is not None:
            assert result.pop("QueryExecutionId") == execution_id
        assert result == expected_outcome


COMMIT_ERROR_REASON = "ICEBERG_COMMIT_ERROR: failed to commit to table test_bucket_package_manifest"


@pytest.fixture
def no_backoff(monkeypatch):
    """Collapse the retry backoff so tests don't actually sleep, recording the bounds asked for."""
    bounds = []

    def fake_uniform(a, b):
        bounds.append(b)
        return 0

    monkeypatch.setattr("quilt_shared.athena.random.uniform", fake_uniform)
    return bounds


def _stub_start(stubber, query, execution_id):
    stubber.add_response(
        "start_query_execution",
        {"QueryExecutionId": execution_id},
        {
            "QueryString": query,
            "WorkGroup": "test_workgroup",
            "QueryExecutionContext": {"Database": "test_database"},
        },
    )


def _stub_status(stubber, execution_id, state, reason=None):
    status = {"State": state}
    if reason is not None:
        status["StateChangeReason"] = reason
    stubber.add_response(
        "get_query_execution",
        {"QueryExecution": {"Status": status, "QueryExecutionId": execution_id}},
        {"QueryExecutionId": execution_id},
    )


def test_run_multiple_queries_retries_commit_error(query_runner, stubbed_athena_client, no_backoff):
    query = "MERGE INTO test_bucket_package_manifest"

    _stub_start(stubbed_athena_client, query, "exec_id_1")
    _stub_status(stubbed_athena_client, "exec_id_1", "FAILED", COMMIT_ERROR_REASON)
    _stub_start(stubbed_athena_client, query, "exec_id_2")
    _stub_status(stubbed_athena_client, "exec_id_2", "SUCCEEDED")

    (result,) = query_runner.run_multiple_queries([query], sleep_sec=0)

    assert result["Status"]["State"] == "SUCCEEDED"
    assert result["QueryExecutionId"] == "exec_id_2"
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_retries_are_bounded(query_runner, stubbed_athena_client, no_backoff):
    query = "MERGE INTO test_bucket_package_manifest"

    for execution_id in ("exec_id_1", "exec_id_2", "exec_id_3"):
        _stub_start(stubbed_athena_client, query, execution_id)
        _stub_status(stubbed_athena_client, execution_id, "FAILED", COMMIT_ERROR_REASON)

    with pytest.raises(AthenaQueryFailedException) as exc_info:
        query_runner.run_multiple_queries([query], sleep_sec=0)

    # Third attempt is the last: no fourth start_query_execution was stubbed.
    stubbed_athena_client.assert_no_pending_responses()
    assert exc_info.value.query_execution_id == "exec_id_3"
    assert COMMIT_ERROR_REASON in str(exc_info.value)
    assert no_backoff == [1, 2]


def test_run_multiple_queries_does_not_retry_other_failures(query_runner, stubbed_athena_client, no_backoff):
    query = "MERGE INTO test_bucket_package_manifest"

    _stub_start(stubbed_athena_client, query, "exec_id_1")
    _stub_status(stubbed_athena_client, "exec_id_1", "FAILED", "SYNTAX_ERROR: line 1:1: mismatched input")

    with pytest.raises(AthenaQueryFailedException) as exc_info:
        query_runner.run_multiple_queries([query], sleep_sec=0)

    # No second start_query_execution was stubbed, so a retry would have errored.
    stubbed_athena_client.assert_no_pending_responses()
    assert exc_info.value.query_execution_id == "exec_id_1"
    assert "SYNTAX_ERROR" in str(exc_info.value)


def test_run_multiple_queries_exhausted_retries_without_raising(query_runner, stubbed_athena_client, no_backoff):
    query = "MERGE INTO test_bucket_package_manifest"

    for execution_id in ("exec_id_1", "exec_id_2", "exec_id_3"):
        _stub_start(stubbed_athena_client, query, execution_id)
        _stub_status(stubbed_athena_client, execution_id, "FAILED", COMMIT_ERROR_REASON)

    (result,) = query_runner.run_multiple_queries([query], raise_on_failed=False, sleep_sec=0)

    assert result["Status"]["State"] == "FAILED"
    assert result["QueryExecutionId"] == "exec_id_3"
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_retry_does_not_rerun_successful_siblings(
    query_runner, stubbed_athena_client, no_backoff
):
    queries = ["SELECT * FROM table1", "MERGE INTO test_bucket_package_manifest"]

    _stub_start(stubbed_athena_client, queries[0], "exec_id_1")
    _stub_start(stubbed_athena_client, queries[1], "exec_id_2")
    _stub_status(stubbed_athena_client, "exec_id_1", "SUCCEEDED")
    _stub_status(stubbed_athena_client, "exec_id_2", "FAILED", COMMIT_ERROR_REASON)
    # Only the conflicting query is restarted.
    _stub_start(stubbed_athena_client, queries[1], "exec_id_3")
    _stub_status(stubbed_athena_client, "exec_id_3", "SUCCEEDED")

    results = query_runner.run_multiple_queries(queries, sleep_sec=0)

    assert [r["QueryExecutionId"] for r in results] == ["exec_id_1", "exec_id_3"]
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries(query_runner, stubbed_athena_client):
    queries = ["SELECT * FROM table1", "SELECT * FROM table2"]
    execution_ids = ["exec_id_1", "exec_id_2"]

    # Stub start_query_execution responses
    for query, execution_id in zip(queries, execution_ids, strict=True):
        stubbed_athena_client.add_response(
            "start_query_execution",
            {"QueryExecutionId": execution_id},
            {
                "QueryString": query,
                "WorkGroup": "test_workgroup",
                "QueryExecutionContext": {"Database": "test_database"},
            },
        )

    # Stub get_query_execution responses
    for execution_id in execution_ids:
        stubbed_athena_client.add_response(
            "get_query_execution",
            {
                "QueryExecution": {
                    "Status": {"State": "SUCCEEDED"},
                    "QueryExecutionId": execution_id,
                }
            },
            {"QueryExecutionId": execution_id},
        )

    results = query_runner.run_multiple_queries(queries, sleep_sec=0.1)
    assert len(results) == len(queries)
    for result in results:
        assert result["Status"]["State"] == "SUCCEEDED"
