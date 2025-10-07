from __future__ import annotations

import typing as T
import time


if T.TYPE_CHECKING:
    from mypy_boto3_athena import AthenaClient
    from mypy_boto3_athena.type_defs import QueryExecutionTypeDef
    import logging


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
                raise Exception("Query failed! QueryExecutionId=%r" % execution_id)
            return query_execution
        elif state == "CANCELLED":
            raise Exception("Query cancelled! QueryExecutionId=%r" % execution_id)
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
        results: list[T.Union[None, QueryExecutionTypeDef]] = [None] * len(query_list)

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
