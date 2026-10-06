import datetime
import io
import json

import botocore.exceptions
import duckdb
import pytest
from botocore.response import StreamingBody

import quilt_shared.const
import t4_lambda_iceberg
from quilt_shared.iceberg_stack_queries import TABLES

STACK_DB = "test_stack_db"
USER_DB = "test_user_athena_db"
BUCKET = "b1"
REGISTRY = "s3://b1"


def h(n: int) -> str:
    return f"{n:064x}"


def manifest_key(top_hash: str) -> str:
    return quilt_shared.const.MANIFESTS_PREFIX + top_hash


def pointer_key(pkg_name: str, pointer: str) -> str:
    return f"{quilt_shared.const.NAMED_PACKAGES_PREFIX}{pkg_name}/{pointer}"


def record(message_id: str, key: str, group: str | None = None) -> dict:
    body = {"detail": {"s3": {"bucket": {"name": BUCKET}, "object": {"key": key}}}}
    return in_group({"messageId": message_id, "body": json.dumps(body)}, group)


def in_group(record: dict, group: str | None) -> dict:
    """The record as a FIFO queue delivers it, in its message group."""
    return {**record, "attributes": {"MessageGroupId": group}} if group else record


def failures(*message_ids: str) -> dict:
    return {"batchItemFailures": [{"itemIdentifier": m} for m in message_ids]}


def holdings(con) -> dict[str, set]:
    """The (registry, top_hash) of each table's rows."""
    return {t: set(con.execute(f'SELECT registry, top_hash FROM "{STACK_DB}"."{t}"').fetchall()) for t in TABLES}


class Athena:
    """Athena's API as the set's role sees it, running each query on DuckDB as it starts.

    The role reaches the stack database alone, so a query run in any other database fails.
    """

    def __init__(self, con):
        self.con = con
        self.fails = lambda sql: False
        self.refuses = lambda sql: False  # whether the API refuses to start the query
        self.refusals = 0
        self.reasons = {}  # a failed execution's reason
        self.held = []  # the set's holdings after each query
        self.remaining_ms = 300_000  # the invocation's, spent as queries run
        self.query_ms = 0

    def start_query_execution(self, *, QueryString, QueryExecutionContext, **kwargs):
        if self.refuses(QueryString):
            self.refusals += 1
            raise botocore.exceptions.ClientError({"Error": {"Code": "ThrottlingException"}}, "StartQueryExecution")
        self.remaining_ms -= self.query_ms
        execution_id = str(len(self.reasons))
        self.reasons[execution_id] = None
        if QueryExecutionContext["Database"] != STACK_DB:
            self.reasons[execution_id] = "AccessDeniedException: no access to the database"
        elif self.fails(QueryString):
            self.reasons[execution_id] = "HIVE_BAD_DATA: unreadable manifest"
        else:
            self.con.execute(QueryString)
            self.held.append(holdings(self.con))
        return {"QueryExecutionId": execution_id}

    def get_query_execution(self, *, QueryExecutionId):
        status = {"State": "SUCCEEDED"}
        if reason := self.reasons[QueryExecutionId]:
            status = {"State": "FAILED", "StateChangeReason": reason}
        return {"QueryExecution": {"QueryExecutionId": QueryExecutionId, "Status": status}}


class S3:
    def __init__(self):
        self.objects = {}  # (bucket, key) -> its body, or the error reading it raises
        self.reads = []

    def get_object(self, *, Bucket, Key):
        self.reads.append((Bucket, Key))
        body = self.objects.get((Bucket, Key))
        if body is None:
            raise t4_lambda_iceberg.s3.exceptions.NoSuchKey({"Error": {"Code": "NoSuchKey"}}, "GetObject")
        if isinstance(body, Exception):
            raise body
        return {"Body": StreamingBody(io.BytesIO(body), len(body))}


@pytest.fixture
def con():
    """The set's tables beside the user Athena database's table over the bucket's manifests."""
    con = duckdb.connect()
    con.execute("CREATE MACRO from_unixtime(x) AS make_timestamp(CAST(x AS BIGINT) * 1000000)")
    con.execute(f"CREATE SCHEMA {STACK_DB}")
    con.execute(f"CREATE SCHEMA {USER_DB}")
    for name, table in TABLES.items():
        con.execute(f'CREATE TABLE "{STACK_DB}"."{name}" ({table.columns})')
    con.execute(
        f'CREATE TABLE "{USER_DB}"."{BUCKET}_manifests" ("$path" VARCHAR, logical_key VARCHAR,'
        " physical_keys VARCHAR[], hash STRUCT(type VARCHAR, value VARCHAR), size BIGINT, meta VARCHAR,"
        " message VARCHAR, user_meta VARCHAR)"
    )
    return con


@pytest.fixture
def athena(mocker, con):
    fake = Athena(con)
    for name in ("start_query_execution", "get_query_execution"):
        mocker.patch.object(t4_lambda_iceberg.athena, name, getattr(fake, name))
    mocker.patch("quilt_shared.athena.time.sleep")
    return fake


@pytest.fixture
def s3(mocker):
    fake = S3()
    mocker.patch.object(t4_lambda_iceberg.s3, "get_object", fake.get_object)
    return fake


class Context:
    """The Lambda context, whose time runs out as Athena runs queries."""

    def __init__(self, athena: Athena):
        self.athena = athena

    def get_remaining_time_in_millis(self) -> int:
        return self.athena.remaining_ms


@pytest.fixture
def handle(athena):
    return lambda *records: t4_lambda_iceberg.set_handler({"Records": list(records)}, Context(athena))


def put_manifest(s3, con, top_hash: str):
    """A manifest of one entry, in the bucket and in the user Athena database's view of it."""
    s3.objects[BUCKET, manifest_key(top_hash)] = b'{"message": "m"}\n{"logical_key": "a.txt"}\n'
    path = f"s3://{BUCKET}/{manifest_key(top_hash)}"
    con.execute(
        f'INSERT INTO "{USER_DB}"."{BUCKET}_manifests" VALUES (?, NULL, NULL, NULL, NULL, NULL, ?, ?)',
        [path, "m", "{}"],
    )
    con.execute(
        f'INSERT INTO "{USER_DB}"."{BUCKET}_manifests" VALUES (?, ?, ?, ?, 7, ?, NULL, NULL)',
        [path, "a.txt", [f"s3://{BUCKET}/a.txt"], {"type": "SHA256", "value": "x"}, "{}"],
    )


def put_pointer(s3, pkg_name: str, pointer: str, top_hash: str):
    s3.objects[BUCKET, pointer_key(pkg_name, pointer)] = top_hash.encode()


def insert(con, table: str, *rows):
    for row in rows:
        con.execute(f'INSERT INTO "{STACK_DB}"."{table}" VALUES ({", ".join("?" * len(row))})', list(row))


def hold_manifest(con, top_hash: str):
    """The set holding a manifest and its one entry."""
    insert(con, "package_entry", (REGISTRY, top_hash, "a.txt", f"s3://{BUCKET}/a.txt", "SHA256", "x", 7, "{}"))
    insert(con, "package_manifest", (REGISTRY, top_hash, "m", "{}"))


def push(s3, con) -> list[dict]:
    put_manifest(s3, con, h(1))
    put_pointer(s3, "u/p", "100", h(1))
    put_pointer(s3, "u/p", "latest", h(1))
    # The pointers' events arrive ahead of their manifest's.
    return [
        record("tag", pointer_key("u/p", "latest")),
        record("revision", pointer_key("u/p", "100")),
        record("manifest", manifest_key(h(1))),
    ]


def delete(s3, con) -> list[dict]:
    hold_manifest(con, h(1))
    insert(con, "package_revision", (REGISTRY, "u/p", datetime.datetime(1970, 1, 1, 0, 1, 40), h(1)))
    insert(con, "package_tag", (REGISTRY, "u/p", "latest", h(1)))
    # The manifest's event arrives ahead of its pointers'.
    return [
        record("manifest", manifest_key(h(1))),
        record("revision", pointer_key("u/p", "100")),
        record("tag", pointer_key("u/p", "latest")),
    ]


@pytest.mark.parametrize(
    "batch, held",
    [
        (push, {table: {(REGISTRY, h(1))} for table in TABLES}),
        (delete, {table: set() for table in TABLES}),
    ],
)
def test_a_batch_never_leaves_a_manifest_without_its_entries(handle, athena, s3, con, batch, held):
    response = handle(*batch(s3, con))

    assert response == failures()
    assert holdings(con) == held
    assert all(state["package_manifest"] <= state["package_entry"] for state in athena.held)


def test_a_pointer_is_written_whether_or_not_the_set_holds_its_manifest(handle, s3, con):
    hold_manifest(con, h(1))
    put_pointer(s3, "u/p", "latest", h(1))
    put_pointer(s3, "u/q", "latest", h(2))
    put_pointer(s3, "u/q", "200", h(2))

    response = handle(
        record("p", pointer_key("u/p", "latest")),
        record("q", pointer_key("u/q", "latest")),
        record("q200", pointer_key("u/q", "200")),
    )

    assert response == failures()
    assert holdings(con)["package_tag"] == {(REGISTRY, h(1)), (REGISTRY, h(2))}
    assert holdings(con)["package_revision"] == {(REGISTRY, h(2))}


def test_a_failed_statement_is_retried_item_by_item_and_only_the_item_failing_alone_is_returned(
    handle, athena, s3, con
):
    for n in (1, 2, 3):
        put_manifest(s3, con, h(n))
    put_pointer(s3, "u/p", "latest", h(1))
    athena.fails = lambda sql: '"package_entry"' in sql and h(2) in sql

    response = handle(
        *(record(f"m{n}", manifest_key(h(n))) for n in (1, 2, 3)), record("tag", pointer_key("u/p", "latest"))
    )

    assert response == failures("m2")
    assert holdings(con) == {
        "package_revision": set(),
        "package_tag": {(REGISTRY, h(1))},
        "package_manifest": {(REGISTRY, h(1)), (REGISTRY, h(3))},
        "package_entry": {(REGISTRY, h(1)), (REGISTRY, h(3))},
    }


def test_a_batchs_events_for_one_object_are_one_item_read_once_and_returned_together(handle, athena, s3, con):
    put_pointer(s3, "u/p", "latest", h(1))
    put_pointer(s3, "u/q", "latest", h(2))
    athena.fails = lambda sql: "'u/q'" in sql

    response = handle(
        record("p1", pointer_key("u/p", "latest")),
        record("q1", pointer_key("u/q", "latest")),
        record("p2", pointer_key("u/p", "latest")),
        record("q2", pointer_key("u/q", "latest")),
    )

    assert response == failures("q1", "q2")
    assert sorted(s3.reads) == [(BUCKET, pointer_key("u/p", "latest")), (BUCKET, pointer_key("u/q", "latest"))]
    assert holdings(con)["package_tag"] == {(REGISTRY, h(1))}


def test_an_event_that_cannot_be_read_is_returned_for_retry_and_the_rest_of_the_batch_written(handle, s3, con):
    put_manifest(s3, con, h(1))
    s3.objects[BUCKET, manifest_key(h(2))] = botocore.exceptions.ClientError(
        {"Error": {"Code": "AccessDenied"}}, "GetObject"
    )

    response = handle(
        record("m1", manifest_key(h(1))),
        record("m2", manifest_key(h(2))),
        {"messageId": "nobject", "body": "{}"},
    )

    assert response == failures("m2", "nobject")
    assert holdings(con)["package_manifest"] == {(REGISTRY, h(1))}


def test_a_pointer_named_by_a_numeral_that_is_not_a_timestamp_is_a_tag(handle, s3, con):
    put_pointer(s3, "u/p", "²", h(1))

    response = handle(record("p", pointer_key("u/p", "²")))

    assert response == failures()
    assert holdings(con)["package_tag"] == {(REGISTRY, h(1))}


def test_a_message_group_is_returned_from_its_first_failed_message_on(handle, athena, s3, con):
    for n in (1, 2, 3):
        put_manifest(s3, con, h(n))
    s3.objects[BUCKET, manifest_key(h(4))] = botocore.exceptions.ClientError(
        {"Error": {"Code": "AccessDenied"}}, "GetObject"
    )
    for pkg_name in ("u/p", "u/q", "u/r"):
        put_pointer(s3, pkg_name, "latest", h(1))
    athena.fails = lambda sql: '"package_entry"' in sql and h(2) in sql

    response = handle(
        record("m1", manifest_key(h(1)), "statement"),
        in_group({"messageId": "undecodable", "body": "{}"}, "decode"),
        record("m2", manifest_key(h(2)), "statement"),  # its entries fail
        record("unreadable", manifest_key(h(4)), "read"),
        record("p", pointer_key("u/p", "latest"), "decode"),
        record("m3", manifest_key(h(3)), "statement"),
        record("q", pointer_key("u/q", "latest"), "read"),
        record("r", pointer_key("u/r", "latest"), "other"),
    )

    assert response == failures("undecodable", "m2", "unreadable", "p", "m3", "q")


def test_a_statement_whose_athena_calls_are_refused_is_run_again_whole(handle, athena, s3, con):
    for n in (1, 2, 3):
        put_manifest(s3, con, h(n))
    refusals = iter([True, True])
    athena.refuses = lambda sql: '"package_entry"' in sql and next(refusals, False)

    response = handle(*(record(f"m{n}", manifest_key(h(n))) for n in (1, 2, 3)))

    assert response == failures()
    assert holdings(con)["package_entry"] == {(REGISTRY, h(n)) for n in (1, 2, 3)}
    assert athena.refusals == 2


def test_a_statement_whose_athena_calls_stay_refused_returns_its_items_unsplit(handle, athena, s3, con):
    for n in (1, 2, 3):
        put_manifest(s3, con, h(n))
    put_pointer(s3, "u/p", "latest", h(1))
    athena.refuses = lambda sql: '"package_entry"' in sql

    response = handle(
        *(record(f"m{n}", manifest_key(h(n))) for n in (1, 2, 3)), record("tag", pointer_key("u/p", "latest"))
    )

    assert response == failures("m1", "m2", "m3")
    assert holdings(con)["package_tag"] == {(REGISTRY, h(1))}
    assert athena.refusals == t4_lambda_iceberg.API_ATTEMPTS


def test_a_refusal_while_retrying_item_by_item_returns_the_rest_of_the_statement_untried(handle, athena, s3, con):
    for n in (1, 2, 3):
        put_manifest(s3, con, h(n))
    athena.fails = lambda sql: '"package_entry"' in sql and h(1) in sql and h(2) in sql
    athena.refuses = lambda sql: '"package_entry"' in sql and h(2) in sql and h(1) not in sql

    response = handle(*(record(f"m{n}", manifest_key(h(n))) for n in (1, 2, 3)))

    assert response == failures("m2", "m3")
    assert holdings(con)["package_manifest"] == {(REGISTRY, h(1))}
    assert athena.refusals == t4_lambda_iceberg.API_ATTEMPTS


def test_statements_that_could_run_into_the_timeout_are_not_started_and_their_items_returned(handle, athena, s3, con):
    # Two queries spend the time left above the budget.
    athena.query_ms = (athena.remaining_ms - t4_lambda_iceberg.STATEMENT_BUDGET_MS) // 2 + 1

    response = handle(*push(s3, con))

    assert response == failures("tag", "revision")
    assert holdings(con) == {
        "package_revision": set(),
        "package_tag": set(),
        "package_manifest": {(REGISTRY, h(1))},
        "package_entry": {(REGISTRY, h(1))},
    }
