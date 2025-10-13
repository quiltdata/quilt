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


def test_query_finished_succeeded(query_runner, stubbed_athena_client):
    execution_id = "test_execution_id"
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

    result = query_runner.query_finished(execution_id)
    assert result["Status"]["State"] == "SUCCEEDED"


def test_query_finished_failed(query_runner, stubbed_athena_client):
    execution_id = "test_execution_id"
    stubbed_athena_client.add_response(
        "get_query_execution",
        {
            "QueryExecution": {
                "Status": {"State": "FAILED"},
                "QueryExecutionId": execution_id,
            }
        },
        {"QueryExecutionId": execution_id},
    )

    with pytest.raises(AthenaQueryFailedException):
        query_runner.query_finished(execution_id)


def test_query_finished_cancelled(query_runner, stubbed_athena_client):
    execution_id = "test_execution_id"
    stubbed_athena_client.add_response(
        "get_query_execution",
        {
            "QueryExecution": {
                "Status": {"State": "CANCELLED"},
                "QueryExecutionId": execution_id,
            }
        },
        {"QueryExecutionId": execution_id},
    )

    with pytest.raises(AthenaQueryCancelledException):
        query_runner.query_finished(execution_id)


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

    results = query_runner.run_multiple_queries(queries)
    assert len(results) == len(queries)
    for result in results:
        assert result["Status"]["State"] == "SUCCEEDED"
