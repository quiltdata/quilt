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


def test_run_multiple_queries(query_runner, stubbed_athena_client):
    queries = ["SELECT * FROM table1", "SELECT * FROM table2"]
    execution_ids = ["exec_id_1", "exec_id_2"]

    # Stub start_query_execution responses
    for query, execution_id in zip(queries, execution_ids):
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
