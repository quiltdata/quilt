from __future__ import annotations

import random
import re
import time
import typing as T
import uuid

from botocore.exceptions import BotoCoreError, ClientError

if T.TYPE_CHECKING:
    import logging

    from types_boto3_athena.client import AthenaClient
    from types_boto3_athena.type_defs import QueryExecutionTypeDef

# Concurrent DML against one Iceberg table fails the loser's commit; a fresh execution
# of the same statement succeeds. Bounded low because the registry's bucket-add path
# calls this synchronously from an admin request, so retries delay a user-visible call.
ICEBERG_COMMIT_ERROR_CODE = "ICEBERG_COMMIT_ERROR"
RETRY_MAX_ATTEMPTS = 3
RETRY_BASE_SEC = 1


# Athena reports the error code at the head of StateChangeReason, sometimes behind a
# category or exception name. Anchoring there tolerates such a prefix while ignoring the
# statement Athena echoes after it, so a query whose own text carries the term and failed
# for another reason is not retried.
_COMMIT_ERROR_RE = re.compile(rf"(?:[\w.]+:\s*)*{ICEBERG_COMMIT_ERROR_CODE}\b")


def _is_commit_error(reason: str) -> bool:
    return _COMMIT_ERROR_RE.match(reason) is not None


def is_retryable(query_execution: QueryExecutionTypeDef) -> bool:
    """Athena's own verdict on a failed query, `Status.AthenaError.Retryable`; False where it gives none."""
    return query_execution.get("Status", {}).get("AthenaError", {}).get("Retryable", False)


class AthenaQueryBaseException(Exception):
    query_execution: QueryExecutionTypeDef
    state: str

    def __init__(self, query_execution: QueryExecutionTypeDef):
        self.query_execution = query_execution

    @property
    def query_execution_id(self) -> str:
        assert "QueryExecutionId" in self.query_execution
        return self.query_execution["QueryExecutionId"]

    @property
    def retryable(self) -> bool:
        return is_retryable(self.query_execution)

    def __str__(self) -> str:
        msg = f"Athena query {self.query_execution_id} failed with state {self.state}"
        if reason := self.query_execution.get("Status", {}).get("StateChangeReason"):
            msg += f": {reason}"
        return msg


class AthenaQueryFailedException(AthenaQueryBaseException):
    state = "FAILED"


class AthenaQueryCancelledException(AthenaQueryBaseException):
    state = "CANCELLED"


# XXX: this is mostly copy-pasted from access_counts lambda, should be deduplicated
class QueryRunner:
    def __init__(self, *, logger: logging.Logger, athena: AthenaClient, database: str, workgroup: str):
        # XXX: shouldn't we use its own logger?
        self.logger = logger
        self.athena = athena
        self.database = database
        self.workgroup = workgroup

    def start_query(self, query: str, *, token: str | None = None) -> str:
        response = self.athena.start_query_execution(
            QueryString=query,
            WorkGroup=self.workgroup,
            QueryExecutionContext={"Database": self.database},
            **({"ClientRequestToken": token} if token else {}),
        )
        self.logger.info(f"Started Athena query: {query}")

        return response["QueryExecutionId"]

    def query_finished(self, execution_id: str, *, raise_on_failed: bool = True):
        response = self.athena.get_query_execution(QueryExecutionId=execution_id)
        self.logger.debug("Athena query execution status: %r", response)
        query_execution = response["QueryExecution"]

        assert "Status" in query_execution
        assert "State" in query_execution["Status"]
        state = query_execution["Status"]["State"]

        if state in ("RUNNING", "QUEUED"):
            return
        elif state == "SUCCEEDED":
            return query_execution
        elif state == "FAILED":
            if raise_on_failed:
                raise AthenaQueryFailedException(query_execution)
            return query_execution
        elif state == "CANCELLED":
            raise AthenaQueryCancelledException(query_execution)
        else:
            assert False, "Unexpected state: %s" % state

    @staticmethod
    def _should_retry(query_execution: QueryExecutionTypeDef, attempts: int) -> bool:
        status = query_execution["Status"]
        return (
            status["State"] == "FAILED"
            and _is_commit_error(status.get("StateChangeReason", ""))
            and attempts < RETRY_MAX_ATTEMPTS
        )

    @T.overload
    def run_multiple_queries(
        self,
        query_list: list[str],
        *,
        raise_on_failed: bool = True,
        max_current_queries: int = 20,
        sleep_sec: float = 1,
        deadline: None = None,
    ) -> list[QueryExecutionTypeDef]: ...

    @T.overload
    def run_multiple_queries(
        self,
        query_list: list[str],
        *,
        raise_on_failed: bool = True,
        max_current_queries: int = 20,
        sleep_sec: float = 1,
        deadline: float,
    ) -> list[QueryExecutionTypeDef | None]: ...

    def run_multiple_queries(
        self,
        query_list: list[str],
        *,
        raise_on_failed: bool = True,
        max_current_queries: int = 20,
        sleep_sec: float = 1,
        deadline: float | None = None,
    ) -> list[QueryExecutionTypeDef] | list[QueryExecutionTypeDef | None]:
        """
        Execute multiple Athena queries in parallel with controlled concurrency.

        Args:
            query_list: List of SQL query strings to execute.
            raise_on_failed: If True, raises an Exception when a query fails. If False, returns the failed
                query execution info.
            max_current_queries: Maximum number of concurrent queries to run at once.
                Note: default quota for DDL queries is 20 per account, for DML is 200 per account.
            sleep_sec: Time in seconds to sleep between status checks.
            deadline: A `time.monotonic()` value to give up at. A start or poll Athena refuses is retried until
                then. Past it, or when this raises, every query it started and has not seen finish is stopped, best
                effort, and every statement not run to completion comes back as None. The stops run after the
                deadline, so leave room for them. Without a deadline, refused starts and polls raise.

        Returns:
            list[QueryExecutionTypeDef]: List of query execution results in the same order as input queries.
                Each element contains the full query execution information from Athena, or None as above.

        Raises:
            Exception: If a query fails and raise_on_failed is True.
            Exception: If a query is cancelled.

        Note:
            The method polls Athena for query status and manages concurrent execution within specified
            limits. Failed queries will either raise an exception or return execution details based on
            raise_on_failed.

            A query that fails with ICEBERG_COMMIT_ERROR is re-executed, so statements passed here must
            be idempotent: that error also covers a commit whose outcome is unknown.
        """
        results: list[QueryExecutionTypeDef | None] = [None] * len(query_list)

        remaining_queries = list(enumerate(query_list))
        remaining_queries.reverse()  # Just to make unit tests more sane: we use pop() later, so keep the order the same.
        pending_execution_ids = {}
        attempts: dict[int, int] = {}

        def left() -> float:
            return float("inf") if deadline is None else deadline - time.monotonic()

        def nap(sec: float) -> None:
            time.sleep(max(0, min(sec, left())))

        # Given a deadline, a refused start or poll is retried rather than raised.
        refused = (BotoCoreError, ClientError) if deadline is not None else ()
        # Athena answers a repeated token with the execution it already started, so retrying a refused start
        # never runs a statement twice; a commit-conflict retry, a new attempt, takes a new token.
        run = uuid.uuid4().hex

        try:
            while remaining_queries or pending_execution_ids:
                # Largest backoff any conflict asked for this pass. Taken once, below, rather
                # than per conflict inside the scan: concurrent conflicts would otherwise
                # sleep serially, and no in-flight execution is polled while one sleeps.
                backoff_sec: float = 0
                # Remove completed queries. Make a copy of the set before iterating over it.
                for execution_id, idx in list(pending_execution_ids.items()):
                    # Ask for the record rather than the exception, so a commit conflict can be retried.
                    try:
                        query_execution = self.query_finished(execution_id, raise_on_failed=False)
                    except refused:
                        self.logger.warning("Could not poll Athena query %s", execution_id, exc_info=True)
                        continue
                    if query_execution is None:
                        continue
                    del pending_execution_ids[execution_id]

                    if self._should_retry(query_execution, attempts.get(idx, 0)):
                        reason = query_execution["Status"]["StateChangeReason"]
                        self.logger.warning("Retrying Athena query %s after commit conflict: %s", execution_id, reason)
                        backoff_sec = max(
                            backoff_sec, random.uniform(0, RETRY_BASE_SEC * 2 ** (attempts.get(idx, 1) - 1))
                        )
                        # Bottom of the stack: pop() takes from the end, so a retry must not
                        # preempt queries that have never been started.
                        remaining_queries.insert(0, (idx, query_list[idx]))
                        continue

                    if raise_on_failed and query_execution["Status"]["State"] == "FAILED":
                        raise AthenaQueryFailedException(query_execution)
                    results[idx] = query_execution

                # Checked after the poll, so a query that finished in the last sleep keeps its result.
                if left() <= 0:
                    self.logger.warning(
                        "Deadline passed: stopping %d Athena queries, %d not started",
                        len(pending_execution_ids),
                        len(remaining_queries),
                    )
                    break

                if backoff_sec:
                    nap(backoff_sec)

                # Start new queries.
                while remaining_queries and len(pending_execution_ids) < max_current_queries and left() > 0:
                    idx, query = remaining_queries.pop()
                    token = None if deadline is None else f"{run}-{idx}-{attempts.get(idx, 0)}"
                    try:
                        execution_id = self.start_query(query, token=token)
                    except refused:
                        self.logger.warning("Could not start an Athena query; retrying it", exc_info=True)
                        # Bottom of the stack, so a start refused again and again holds up none of the others.
                        remaining_queries.insert(0, (idx, query))
                        break
                    pending_execution_ids[execution_id] = idx
                    attempts[idx] = attempts.get(idx, 0) + 1

                nap(sleep_sec)
        finally:
            if deadline is not None:
                for execution_id in pending_execution_ids:
                    try:
                        self.athena.stop_query_execution(QueryExecutionId=execution_id)
                    except (BotoCoreError, ClientError):
                        self.logger.warning("Could not stop Athena query %s", execution_id, exc_info=True)

        if deadline is None:
            assert all(results)

        return results
