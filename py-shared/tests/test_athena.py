import logging
import types

import boto3
import pytest
from botocore.exceptions import ClientError, ParamValidationError, ReadTimeoutError
from botocore.stub import ANY, Stubber

from quilt_shared.athena import (
    AthenaQueryCancelledException,
    AthenaQueryFailedException,
    QueryRunner,
    is_retryable,
)


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


def _stub_start(stubber, query, execution_id, token=None):
    expected = {
        "QueryString": query,
        "WorkGroup": "test_workgroup",
        "QueryExecutionContext": {"Database": "test_database"},
    }
    if token is not None:
        expected["ClientRequestToken"] = token
    stubber.add_response("start_query_execution", {"QueryExecutionId": execution_id}, expected)


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


def test_run_multiple_queries_retry_does_not_preempt_unstarted(query_runner, stubbed_athena_client, no_backoff):
    """A requeued query goes behind queries that have never run, not ahead of them."""
    queries = ["MERGE INTO test_bucket_package_manifest", "SELECT * FROM table2"]

    # Only one slot, so ordering is observable: query 0 runs, conflicts, and is requeued.
    _stub_start(stubbed_athena_client, queries[0], "exec_id_1")
    _stub_status(stubbed_athena_client, "exec_id_1", "FAILED", COMMIT_ERROR_REASON)
    # Query 1 has never started, so it must go next -- not the retry.
    _stub_start(stubbed_athena_client, queries[1], "exec_id_2")
    _stub_status(stubbed_athena_client, "exec_id_2", "SUCCEEDED")
    _stub_start(stubbed_athena_client, queries[0], "exec_id_3")
    _stub_status(stubbed_athena_client, "exec_id_3", "SUCCEEDED")

    results = query_runner.run_multiple_queries(queries, max_current_queries=1, sleep_sec=0)

    assert [r["QueryExecutionId"] for r in results] == ["exec_id_3", "exec_id_2"]
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_failing_sibling_raises_while_retry_pending(
    query_runner, stubbed_athena_client, no_backoff
):
    """A non-retryable sibling failure raises even while another query is mid-retry."""
    queries = ["MERGE INTO test_bucket_package_manifest", "SELECT * FROM table2"]

    _stub_start(stubbed_athena_client, queries[0], "exec_id_1")
    _stub_start(stubbed_athena_client, queries[1], "exec_id_2")
    # Query 0 is requeued for a commit conflict; query 1 then fails unretryably.
    _stub_status(stubbed_athena_client, "exec_id_1", "FAILED", COMMIT_ERROR_REASON)
    _stub_status(stubbed_athena_client, "exec_id_2", "FAILED", "SYNTAX_ERROR: line 1:1: mismatched input")

    with pytest.raises(AthenaQueryFailedException) as exc_info:
        query_runner.run_multiple_queries(queries, sleep_sec=0)

    # The pending retry is abandoned rather than started: no third execution was stubbed.
    assert exc_info.value.query_execution_id == "exec_id_2"
    assert "SYNTAX_ERROR" in str(exc_info.value)
    stubbed_athena_client.assert_no_pending_responses()


@pytest.fixture
def clock(monkeypatch):
    """A monotonic clock, seen by the runner alone, that moves only when the runner sleeps."""
    now = [0.0]
    fake = types.SimpleNamespace(monotonic=lambda: now[0], sleep=lambda sec: now.__setitem__(0, now[0] + sec))
    monkeypatch.setattr("quilt_shared.athena.time", fake)
    return now


def _stub_stop(stubber, execution_id):
    stubber.add_response("stop_query_execution", {}, {"QueryExecutionId": execution_id})


def _refuse(stubber, operation):
    stubber.add_client_error(operation, service_error_code="TooManyRequestsException")


def _time_out_once(athena_client, operation):
    """The operation's next call times out on the network, before any stubbed response is taken."""
    calls = []

    def time_out(**kwargs):
        if not calls:
            calls.append(operation)
            raise ReadTimeoutError(endpoint_url="https://athena.us-east-1.amazonaws.com")

    athena_client.meta.events.register(f"before-parameter-build.athena.{operation}", time_out)


def _ids(results):
    return [r and r["QueryExecutionId"] for r in results]


def _stub_timed_start(stubber, query, execution_id):
    """A start under a deadline, which carries a ClientRequestToken."""
    _stub_start(stubber, query, execution_id, token=ANY)


def _start_tokens(athena_client):
    tokens = []
    athena_client.meta.events.register(
        "provide-client-params.athena.StartQueryExecution",
        lambda params, **kw: tokens.append(params.get("ClientRequestToken")),
    )
    return tokens


def test_run_multiple_queries_past_its_deadline_stops_a_running_query_and_keeps_a_finished_one(
    query_runner, stubbed_athena_client, clock
):
    queries = ["SELECT 1", "SELECT 2"]
    _stub_timed_start(stubbed_athena_client, queries[0], "exec_id_1")
    _stub_timed_start(stubbed_athena_client, queries[1], "exec_id_2")
    _stub_status(stubbed_athena_client, "exec_id_1", "SUCCEEDED")
    for _ in range(3):
        _stub_status(stubbed_athena_client, "exec_id_2", "RUNNING")
    _stub_stop(stubbed_athena_client, "exec_id_2")

    results = query_runner.run_multiple_queries(queries, deadline=2.5)

    assert _ids(results) == ["exec_id_1", None]
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_past_its_deadline_starts_nothing_more_and_survives_a_refused_stop(
    query_runner, stubbed_athena_client, clock
):
    queries = ["SELECT 1", "SELECT 2"]
    _stub_timed_start(stubbed_athena_client, queries[0], "exec_id_1")
    _stub_status(stubbed_athena_client, "exec_id_1", "RUNNING")
    _stub_status(stubbed_athena_client, "exec_id_1", "RUNNING")
    _refuse(stubbed_athena_client, "stop_query_execution")

    results = query_runner.run_multiple_queries(queries, max_current_queries=1, deadline=1.5)

    assert results == [None, None]
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_keeps_a_query_that_finished_as_its_deadline_came(
    query_runner, stubbed_athena_client, clock
):
    _stub_timed_start(stubbed_athena_client, "SELECT 1", "exec_id_1")
    _stub_status(stubbed_athena_client, "exec_id_1", "SUCCEEDED")

    results = query_runner.run_multiple_queries(["SELECT 1"], deadline=1)

    assert _ids(results) == ["exec_id_1"]
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_starts_nothing_once_a_commit_retry_backoff_runs_into_its_deadline(
    query_runner, athena_client, stubbed_athena_client, clock, monkeypatch
):
    monkeypatch.setattr("quilt_shared.athena.random.uniform", lambda a, b: 10)
    starts = _start_tokens(athena_client)
    _stub_timed_start(stubbed_athena_client, "MERGE INTO t", "exec_id_1")
    _stub_status(stubbed_athena_client, "exec_id_1", "FAILED", COMMIT_ERROR_REASON)

    results = query_runner.run_multiple_queries(["MERGE INTO t"], deadline=1.5)

    assert results == [None]
    assert len(starts) == 1
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_with_a_deadline_polls_a_refused_poll_again(query_runner, stubbed_athena_client, clock):
    _stub_timed_start(stubbed_athena_client, "SELECT 1", "exec_id_1")
    _refuse(stubbed_athena_client, "get_query_execution")
    _stub_status(stubbed_athena_client, "exec_id_1", "SUCCEEDED")

    results = query_runner.run_multiple_queries(["SELECT 1"], deadline=100)

    assert _ids(results) == ["exec_id_1"]
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_stops_a_query_it_cannot_poll_by_its_deadline(query_runner, stubbed_athena_client, clock):
    _stub_timed_start(stubbed_athena_client, "SELECT 1", "exec_id_1")
    _refuse(stubbed_athena_client, "get_query_execution")
    _refuse(stubbed_athena_client, "get_query_execution")
    _stub_stop(stubbed_athena_client, "exec_id_1")

    results = query_runner.run_multiple_queries(["SELECT 1"], deadline=1.5)

    assert results == [None]
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_with_a_deadline_starts_a_start_that_timed_out_again_with_the_same_token(
    query_runner, athena_client, stubbed_athena_client, clock
):
    tokens = _start_tokens(athena_client)
    _time_out_once(athena_client, "StartQueryExecution")
    _stub_timed_start(stubbed_athena_client, "SELECT 1", "exec_id_1")
    _stub_status(stubbed_athena_client, "exec_id_1", "SUCCEEDED")

    results = query_runner.run_multiple_queries(["SELECT 1"], deadline=100)

    assert _ids(results) == ["exec_id_1"]
    assert len(tokens) == 2 and tokens[0] and tokens[0] == tokens[1]
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_with_a_deadline_starts_a_commit_retry_with_a_new_token(
    query_runner, athena_client, stubbed_athena_client, clock, no_backoff
):
    tokens = _start_tokens(athena_client)
    _stub_timed_start(stubbed_athena_client, "MERGE INTO t", "exec_id_1")
    _stub_status(stubbed_athena_client, "exec_id_1", "FAILED", COMMIT_ERROR_REASON)
    _stub_timed_start(stubbed_athena_client, "MERGE INTO t", "exec_id_2")
    _stub_status(stubbed_athena_client, "exec_id_2", "SUCCEEDED")

    results = query_runner.run_multiple_queries(["MERGE INTO t"], deadline=100)

    assert _ids(results) == ["exec_id_2"]
    assert len(set(tokens)) == 2
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_starts_the_others_while_one_start_keeps_being_refused(
    query_runner, stubbed_athena_client, clock
):
    queries = ["SELECT 1", "SELECT 2"]
    _refuse(stubbed_athena_client, "start_query_execution")
    _stub_timed_start(stubbed_athena_client, queries[1], "exec_id_2")
    _stub_status(stubbed_athena_client, "exec_id_2", "SUCCEEDED")
    _refuse(stubbed_athena_client, "start_query_execution")

    results = query_runner.run_multiple_queries(queries, max_current_queries=1, deadline=2.5)

    assert _ids(results) == [None, "exec_id_2"]
    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_with_a_deadline_stops_its_other_queries_when_one_fails(
    query_runner, stubbed_athena_client, clock
):
    queries = ["SELECT 1", "SELECT 2"]
    _stub_timed_start(stubbed_athena_client, queries[0], "exec_id_1")
    _stub_timed_start(stubbed_athena_client, queries[1], "exec_id_2")
    _stub_status(stubbed_athena_client, "exec_id_1", "FAILED", "SYNTAX_ERROR: line 1:1: mismatched input")
    _stub_stop(stubbed_athena_client, "exec_id_2")

    with pytest.raises(AthenaQueryFailedException):
        query_runner.run_multiple_queries(queries, deadline=100)

    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_with_a_deadline_raises_a_poll_it_is_denied_after_stopping_its_queries(
    query_runner, stubbed_athena_client, clock
):
    queries = ["SELECT 1", "SELECT 2"]
    _stub_timed_start(stubbed_athena_client, queries[0], "exec_id_1")
    _stub_timed_start(stubbed_athena_client, queries[1], "exec_id_2")
    stubbed_athena_client.add_client_error("get_query_execution", service_error_code="AccessDeniedException")
    _stub_stop(stubbed_athena_client, "exec_id_1")
    _stub_stop(stubbed_athena_client, "exec_id_2")

    with pytest.raises(ClientError, match="AccessDeniedException"):
        query_runner.run_multiple_queries(queries, deadline=100)

    stubbed_athena_client.assert_no_pending_responses()


def test_run_multiple_queries_with_a_deadline_raises_a_statement_botocore_rejects(query_runner, clock):
    with pytest.raises(ParamValidationError):
        query_runner.run_multiple_queries([""], deadline=100)


def test_run_multiple_queries_without_a_deadline_raises_a_refused_poll(query_runner, stubbed_athena_client, clock):
    _stub_start(stubbed_athena_client, "SELECT 1", "exec_id_1")
    _refuse(stubbed_athena_client, "get_query_execution")
    _stub_status(stubbed_athena_client, "exec_id_1", "SUCCEEDED")  # what a retry would see

    with pytest.raises(ClientError):
        query_runner.run_multiple_queries(["SELECT 1"])


@pytest.mark.parametrize(
    "status, retryable",
    [
        ({"State": "FAILED", "AthenaError": {"ErrorCategory": 1, "Retryable": True}}, True),
        ({"State": "FAILED", "AthenaError": {"ErrorCategory": 2, "Retryable": False}}, False),
        ({"State": "FAILED"}, False),  # no verdict from Athena
        (
            {
                "State": "FAILED",
                "StateChangeReason": COMMIT_ERROR_REASON,
                "AthenaError": {"ErrorCategory": 2, "Retryable": False},
            },
            True,
        ),
        ({"State": "CANCELLED"}, True),
    ],
)
def test_a_query_is_retryable_as_athena_says_or_on_a_commit_conflict_or_a_cancellation(status, retryable):
    query_execution = {"QueryExecutionId": "exec_id_1", "Status": status}
    exception = AthenaQueryCancelledException if status["State"] == "CANCELLED" else AthenaQueryFailedException

    assert is_retryable(query_execution) is retryable
    assert exception(query_execution).retryable is retryable


def test_should_retry_matches_reason_with_leading_text():
    """Athena's StateChangeReason is free text; a leading category must not defeat the match."""
    query_execution = {
        "Status": {"State": "FAILED", "StateChangeReason": f"TrinoException: {COMMIT_ERROR_REASON}"},
    }

    assert QueryRunner._should_retry(query_execution, 1) is True


def test_should_retry_ignores_the_code_inside_an_echoed_statement():
    """Athena echoes the statement after the code, so a payload carrying the term is not a conflict."""
    query_execution = {
        "Status": {
            "State": "FAILED",
            "StateChangeReason": (
                "SYNTAX_ERROR: line 1:1: mismatched input 'MERGE'. "
                "Statement: MERGE INTO t USING (SELECT 'ICEBERG_COMMIT_ERROR' AS pkg_name)"
            ),
        },
    }

    assert QueryRunner._should_retry(query_execution, 1) is False


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
