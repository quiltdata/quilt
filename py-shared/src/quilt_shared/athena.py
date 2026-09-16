from __future__ import annotations

import random
import time
import typing as T

if T.TYPE_CHECKING:
    import logging

    from types_boto3_athena.client import AthenaClient
    from types_boto3_athena.type_defs import QueryExecutionTypeDef

# Concurrent DML against one Iceberg table fails the loser's commit; a fresh execution
# of the same statement succeeds. Bounded low: callers sit behind an SQS retry with a
# far longer budget, and sleeping here spends a lambda timeout.
ICEBERG_COMMIT_ERROR_PREFIX = "ICEBERG_COMMIT_ERROR"
RETRY_MAX_ATTEMPTS = 3
RETRY_BASE_SEC = 1
RETRY_CAP_SEC = 8


class AthenaQueryBaseException(Exception):
    query_execution: QueryExecutionTypeDef
    state: str

    def __init__(self, query_execution: QueryExecutionTypeDef):
        self.query_execution = query_execution

    @property
    def query_execution_id(self) -> str:
        assert "QueryExecutionId" in self.query_execution
        return self.query_execution["QueryExecutionId"]

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

    def start_query(self, query: str) -> str:
        response = self.athena.start_query_execution(
            QueryString=query,
            WorkGroup=self.workgroup,
            QueryExecutionContext={"Database": self.database},
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
            and status.get("StateChangeReason", "").startswith(ICEBERG_COMMIT_ERROR_PREFIX)
            and attempts < RETRY_MAX_ATTEMPTS
        )

    def run_multiple_queries(
        self,
        query_list: list[str],
        *,
        raise_on_failed: bool = True,
        max_current_queries: int = 20,
        sleep_sec: float = 1,
    ) -> list[QueryExecutionTypeDef]:
        """
        Execute multiple Athena queries in parallel with controlled concurrency.

        Args:
            query_list: List of SQL query strings to execute.
            raise_on_failed: If True, raises an Exception when a query fails. If False, returns the failed
                query execution info.
            max_current_queries: Maximum number of concurrent queries to run at once.
                Note: default quota for DDL queries is 20 per account, for DML is 200 per account.
            sleep_sec: Time in seconds to sleep between status checks.

        Returns:
            list[QueryExecutionTypeDef]: List of query execution results in the same order as input queries.
                Each element contains the full query execution information from Athena.

        Raises:
            Exception: If a query fails and raise_on_failed is True.
            Exception: If a query is cancelled.

        Note:
            The method polls Athena for query status and manages concurrent execution within specified
            limits. Failed queries will either raise an exception or return execution details based on
            raise_on_failed.
        """
        results: list[QueryExecutionTypeDef | None] = [None] * len(query_list)

        remaining_queries = list(enumerate(query_list))
        remaining_queries.reverse()  # Just to make unit tests more sane: we use pop() later, so keep the order the same.
        pending_execution_ids = {}
        attempts: dict[int, int] = {}

        while remaining_queries or pending_execution_ids:
            # Remove completed queries. Make a copy of the set before iterating over it.
            for execution_id, idx in list(pending_execution_ids.items()):
                # Ask for the record rather than the exception, so a commit conflict can be retried.
                if (query_execution := self.query_finished(execution_id, raise_on_failed=False)) is None:
                    continue
                del pending_execution_ids[execution_id]

                if self._should_retry(query_execution, attempts[idx]):
                    reason = query_execution["Status"]["StateChangeReason"]
                    self.logger.warning("Retrying Athena query %s after commit conflict: %s", execution_id, reason)
                    time.sleep(random.uniform(0, min(RETRY_CAP_SEC, RETRY_BASE_SEC * 2 ** (attempts[idx] - 1))))
                    remaining_queries.append((idx, query_list[idx]))
                    continue

                if raise_on_failed and query_execution["Status"]["State"] == "FAILED":
                    raise AthenaQueryFailedException(query_execution)
                results[idx] = query_execution

            # Start new queries.
            while remaining_queries and len(pending_execution_ids) < max_current_queries:
                idx, query = remaining_queries.pop()
                execution_id = self.start_query(query)
                pending_execution_ids[execution_id] = idx
                attempts[idx] = attempts.get(idx, 0) + 1

            time.sleep(sleep_sec)

        assert all(results)

        return results
