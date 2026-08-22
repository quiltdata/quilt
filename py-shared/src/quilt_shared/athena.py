from __future__ import annotations

import time
import typing as T

if T.TYPE_CHECKING:
    import logging

    from types_boto3_athena.client import AthenaClient
    from types_boto3_athena.type_defs import QueryExecutionTypeDef


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
        return f"Athena query {self.query_execution_id} failed with state {self.state}"


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

        while remaining_queries or pending_execution_ids:
            # Remove completed queries. Make a copy of the set before iterating over it.
            for execution_id, idx in list(pending_execution_ids.items()):
                if (query_execution := self.query_finished(execution_id, raise_on_failed=raise_on_failed)) is not None:
                    del pending_execution_ids[execution_id]
                    results[idx] = query_execution

            # Start new queries.
            while remaining_queries and len(pending_execution_ids) < max_current_queries:
                idx, query = remaining_queries.pop()
                execution_id = self.start_query(query)
                pending_execution_ids[execution_id] = idx

            time.sleep(sleep_sec)

        assert all(results)

        return results
