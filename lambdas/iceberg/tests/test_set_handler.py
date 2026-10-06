import datetime
import io
import json
import os

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
TIMEOUT_S = 300  # the set's function's

# Athena's errors, by whether it tells a retry can succeed.
BAD_DATA = {"ErrorCategory": 2, "Retryable": False, "ErrorMessage": "HIVE_BAD_DATA: unreadable manifest"}
UNAVAILABLE = {"ErrorCategory": 1, "Retryable": True, "ErrorMessage": "Athena is unavailable"}


def s3_error(code: str, status: int) -> botocore.exceptions.ClientError:
    return botocore.exceptions.ClientError(
        {"Error": {"Code": code}, "ResponseMetadata": {"HTTPStatusCode": status}}, "GetObject"
    )


SLOW_DOWN = s3_error("SlowDown", 503)  # a read that clears by itself
ACCESS_DENIED = s3_error("AccessDenied", 403)  # one that does not, as for a bucket removed from the stack


def h(n: int) -> str:
    return f"{n:064x}"


def manifest_key(top_hash: str) -> str:
    return quilt_shared.const.MANIFESTS_PREFIX + top_hash


def pointer_key(pkg_name: str, pointer: str) -> str:
    return f"{quilt_shared.const.NAMED_PACKAGES_PREFIX}{pkg_name}/{pointer}"


def record(message_id: str, key: str, group: str | None = None) -> dict:
    """An SQS record of an S3 event from the set's FIFO queue, in its own message group unless one is given."""
    body = {"detail": {"s3": {"bucket": {"name": BUCKET}, "object": {"key": key}}}}
    return {"messageId": message_id, "body": json.dumps(body), "attributes": {"MessageGroupId": group or message_id}}


def undecodable(message_id: str, group: str | None = None) -> dict:
    return {"messageId": message_id, "body": "{}", "attributes": {"MessageGroupId": group or message_id}}


def failures(*message_ids: str) -> dict:
    return {"batchItemFailures": [{"itemIdentifier": m} for m in message_ids]}


def holdings(con) -> dict[str, set]:
    """The (registry, top_hash) of each table's rows."""
    return {t: set(con.execute(f'SELECT registry, top_hash FROM "{STACK_DB}"."{t}"').fetchall()) for t in TABLES}


class Clock:
    """The invocation's time: polling sleeps on it, and a query runs for as long as Athena takes."""

    def __init__(self):
        self.now = 0.0

    def sleep(self, seconds: float):
        self.now += seconds

    def monotonic(self) -> float:
        return self.now


class Context:
    """The Lambda context."""

    def __init__(self, clock: Clock):
        self.clock = clock

    def get_remaining_time_in_millis(self) -> int:
        return int((TIMEOUT_S - self.clock.now) * 1000)


class Athena:
    """Athena's API as the set's role sees it, running each query on DuckDB once it has taken its time.

    The role reaches the stack database alone, so a query run in any other database fails.
    """

    def __init__(self, con, clock: Clock):
        self.con = con
        self.clock = clock
        self.fails = lambda sql: None  # the AthenaError the query fails with, if it does
        self.takes = lambda sql: 0  # the seconds the query runs
        self.start_fails = lambda sql: None  # the error the API refuses to start the query with, if any
        self.poll_fails = lambda sql: None  # the error the API reports a started query's state with, if any
        self.started = []  # the queries started
        self.stopped = []  # the ids of those stopped
        self.ends = {}  # each query's end
        self.errors = {}  # each finished query's AthenaError, or None
        self.held = []  # the set's holdings after each query

    def start_query_execution(self, *, QueryString, QueryExecutionContext, **kwargs):
        if error := self.start_fails(QueryString):
            raise error.with_traceback(None)
        execution_id = str(len(self.started))
        self.started.append((QueryString, QueryExecutionContext["Database"]))
        self.ends[execution_id] = self.clock.now + self.takes(QueryString)
        return {"QueryExecutionId": execution_id}

    def _finish(self, execution_id: str):
        sql, database = self.started[int(execution_id)]
        if database != STACK_DB:
            error = {"Retryable": False, "ErrorMessage": "AccessDeniedException: no access to the database"}
        elif not (error := self.fails(sql)):
            try:
                self.con.execute(sql)
            except duckdb.Error as e:
                error = {"Retryable": False, "ErrorMessage": f"GENERIC_INTERNAL_ERROR: {e}"}
            self.held.append(holdings(self.con))
        self.errors[execution_id] = error

    def get_query_execution(self, *, QueryExecutionId):
        if error := self.poll_fails(self.started[int(QueryExecutionId)][0]):
            raise error.with_traceback(None)  # each raise its own, not one traceback grown by every poll
        if QueryExecutionId in self.stopped:
            status = {"State": "CANCELLED"}
        elif self.clock.now < self.ends[QueryExecutionId]:
            status = {"State": "RUNNING"}
        else:
            if QueryExecutionId not in self.errors:
                self._finish(QueryExecutionId)
            status = {"State": "SUCCEEDED"}
            if error := self.errors[QueryExecutionId]:
                status = {"State": "FAILED", "StateChangeReason": error["ErrorMessage"], "AthenaError": error}
        return {"QueryExecution": {"QueryExecutionId": QueryExecutionId, "Status": status}}

    def stop_query_execution(self, *, QueryExecutionId):
        self.stopped.append(QueryExecutionId)


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
            raise body.with_traceback(None)
        return {"Body": StreamingBody(io.BytesIO(body), len(body))}


class SQS:
    def __init__(self):
        self.sent = []
        self.fails = False

    def send_message(self, **message):
        if self.fails:
            raise botocore.exceptions.ClientError({"Error": {"Code": "AccessDenied"}}, "SendMessage")
        self.sent.append(message)


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
def clock(mocker):
    fake = Clock()
    mocker.patch("quilt_shared.athena.time", fake)
    mocker.patch("t4_lambda_iceberg.time", fake)
    return fake


@pytest.fixture
def athena(mocker, con, clock):
    fake = Athena(con, clock)
    for name in ("start_query_execution", "get_query_execution", "stop_query_execution"):
        mocker.patch.object(t4_lambda_iceberg.athena, name, getattr(fake, name))
    return fake


@pytest.fixture
def s3(mocker):
    fake = S3()
    mocker.patch.object(t4_lambda_iceberg.s3, "get_object", fake.get_object)
    return fake


@pytest.fixture
def sqs(mocker):
    fake = SQS()
    mocker.patch.object(t4_lambda_iceberg.sqs, "send_message", fake.send_message)
    return fake


@pytest.fixture
def handle(athena, clock, sqs):
    return lambda *records: t4_lambda_iceberg.set_handler({"Records": list(records)}, Context(clock))


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


def manifests(s3, con, *ns: int) -> list[dict]:
    """Manifests h(n) put, and a record `m{n}` of each."""
    for n in ns:
        put_manifest(s3, con, h(n))
    return [record(f"m{n}", manifest_key(h(n))) for n in ns]


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


def dead_lettered(sqs) -> dict[str, tuple[str, str, str]]:
    """Each dead-lettered message's group, body and reason, by its id."""
    assert all(m["QueueUrl"] == os.environ["QUILT_STACK_DEAD_LETTER_QUEUE_URL"] for m in sqs.sent)
    return {
        m["MessageDeduplicationId"]: (
            m["MessageGroupId"],
            m["MessageBody"],
            m["MessageAttributes"]["reason"]["StringValue"],
        )
        for m in sqs.sent
    }


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
    handle, athena, s3, con, sqs
):
    batch = manifests(s3, con, 1, 2, 3)
    put_pointer(s3, "u/p", "latest", h(1))
    athena.fails = lambda sql: UNAVAILABLE if '"package_entry"' in sql and h(2) in sql else None

    response = handle(*batch, record("tag", pointer_key("u/p", "latest")))

    assert response == failures("m2")
    assert holdings(con) == {
        "package_revision": set(),
        "package_tag": {(REGISTRY, h(1))},
        "package_manifest": {(REGISTRY, h(1)), (REGISTRY, h(3))},
        "package_entry": {(REGISTRY, h(1)), (REGISTRY, h(3))},
    }
    assert sqs.sent == []


def test_an_item_failing_alone_for_good_is_dead_lettered(handle, athena, s3, con, sqs):
    batch = manifests(s3, con, 1, 2, 3)
    athena.fails = lambda sql: BAD_DATA if '"package_entry"' in sql and h(2) in sql else None

    response = handle(*batch)

    assert response == failures()
    assert holdings(con)["package_manifest"] == {(REGISTRY, h(1)), (REGISTRY, h(3))}
    assert dead_lettered(sqs).keys() == {"m2"}
    group, body, reason = dead_lettered(sqs)["m2"]
    assert (group, body) == ("m2", batch[1]["body"])
    assert reason.startswith("statement: ") and "HIVE_BAD_DATA" in reason


def test_a_batchs_events_for_one_object_are_one_item_read_once_and_returned_together(handle, athena, s3, con):
    put_pointer(s3, "u/p", "latest", h(1))
    put_pointer(s3, "u/q", "latest", h(2))
    athena.fails = lambda sql: UNAVAILABLE if "'u/q'" in sql else None

    response = handle(
        record("p1", pointer_key("u/p", "latest")),
        record("q1", pointer_key("u/q", "latest")),
        record("p2", pointer_key("u/p", "latest")),
        record("q2", pointer_key("u/q", "latest")),
    )

    assert response == failures("q1", "q2")
    assert sorted(s3.reads) == [(BUCKET, pointer_key("u/p", "latest")), (BUCKET, pointer_key("u/q", "latest"))]
    assert holdings(con)["package_tag"] == {(REGISTRY, h(1))}


def test_an_empty_manifest_is_deleted_from_the_set(handle, s3, con):
    hold_manifest(con, h(1))
    s3.objects[BUCKET, manifest_key(h(1))] = b""

    response = handle(record("m1", manifest_key(h(1))))

    assert response == failures()
    assert holdings(con)["package_manifest"] == holdings(con)["package_entry"] == set()


@pytest.mark.parametrize(
    "error",
    [
        SLOW_DOWN,
        s3_error("InternalError", 500),
        botocore.exceptions.EndpointConnectionError(endpoint_url="s3"),
        s3_error("RequestTimeout", 400),
        s3_error("RequestTimeTooSkewed", 403),
        s3_error("OperationAborted", 409),
    ],
    ids=["throttled", "S3's fault", "unreachable", "timed out", "clock skewed", "conflicting operation"],
)
def test_an_object_that_cannot_be_read_for_now_is_returned_and_the_rest_of_the_batch_written(
    handle, s3, con, sqs, error
):
    put_manifest(s3, con, h(1))
    s3.objects[BUCKET, manifest_key(h(2))] = error

    response = handle(record("m1", manifest_key(h(1))), record("m2", manifest_key(h(2))))

    assert response == failures("m2")
    assert holdings(con)["package_manifest"] == {(REGISTRY, h(1))}
    assert sqs.sent == []


@pytest.mark.parametrize(
    "error", [ACCESS_DENIED, s3_error("NoSuchBucket", 404)], ids=["access denied", "no such bucket"]
)
@pytest.mark.parametrize("alone", [True, False], ids=["alone", "beside one written"])
def test_an_object_that_cannot_be_read_for_good_is_dead_lettered(handle, s3, con, sqs, error, alone):
    put_manifest(s3, con, h(1))
    s3.objects[BUCKET, manifest_key(h(2))] = error
    batch = [record("m2", manifest_key(h(2)))] + ([] if alone else [record("m1", manifest_key(h(1)))])

    response = handle(*batch)

    assert response == failures()
    assert dead_lettered(sqs).keys() == {"m2"}
    assert dead_lettered(sqs)["m2"][2].startswith("read: ")


def test_when_every_object_of_several_cannot_be_read_for_good_none_is_dead_lettered(handle, s3, sqs):
    s3.objects[BUCKET, manifest_key(h(1))] = ACCESS_DENIED
    s3.objects[BUCKET, manifest_key(h(2))] = ACCESS_DENIED

    response = handle(record("m1", manifest_key(h(1))), record("m2", manifest_key(h(2))))

    assert response == failures("m1", "m2")
    assert sqs.sent == []


@pytest.mark.parametrize("name", ["²", "9" * 13])  # a numeral but not ASCII digits; seconds past a timestamp's
def test_a_pointer_named_by_a_numeral_that_is_not_a_timestamp_is_a_tag(handle, s3, con, name):
    put_pointer(s3, "u/p", name, h(1))

    response = handle(record("p", pointer_key("u/p", name)))

    assert response == failures()
    assert holdings(con)["package_tag"] == {(REGISTRY, h(1))}


@pytest.mark.parametrize(
    "bad",
    [
        undecodable("bad", "g"),
        record("bad", "elsewhere/key", "g"),
        record("bad", pointer_key("a/b/c", "latest"), "g"),
        record("bad", pointer_key("a", "latest"), "g"),
        record("bad", manifest_key("not-a-hash"), "g"),
        record("bad", pointer_key("u/p", "latest"), "g"),  # its content is not a top hash
        record("bad", pointer_key("u/q", "latest"), "g"),  # it is empty
    ],
    ids=[
        "not an S3 event",
        "outside the prefixes",
        "too deep",
        "too shallow",
        "not a manifest",
        "not a top hash",
        "an empty pointer",
    ],
)
def test_an_event_no_retry_can_write_is_dead_lettered_at_once_and_its_group_goes_on(handle, s3, con, sqs, bad):
    s3.objects[BUCKET, pointer_key("u/p", "latest")] = b"not a top hash"
    s3.objects[BUCKET, pointer_key("u/q", "latest")] = b""
    put_manifest(s3, con, h(1))

    response = handle(bad, record("m1", manifest_key(h(1)), "g"))

    assert response == failures()
    assert holdings(con)["package_manifest"] == {(REGISTRY, h(1))}
    assert dead_lettered(sqs).keys() == {"bad"}
    group, body, reason = dead_lettered(sqs)["bad"]
    assert (group, body) == ("g", bad["body"])
    assert reason.startswith("input: ")


def test_a_message_group_is_returned_from_its_first_failed_message_on(handle, athena, s3, con, sqs):
    for n in (1, 2, 3):
        put_manifest(s3, con, h(n))
    s3.objects[BUCKET, manifest_key(h(4))] = SLOW_DOWN
    for pkg_name in ("u/p", "u/q", "u/r"):
        put_pointer(s3, pkg_name, "latest", h(1))
    athena.fails = lambda sql: UNAVAILABLE if '"package_entry"' in sql and h(2) in sql else None

    response = handle(
        record("m1", manifest_key(h(1)), "statement"),
        undecodable("undecodable", "dead"),
        record("m2", manifest_key(h(2)), "statement"),  # its entries fail
        record("unreadable", manifest_key(h(4)), "read"),
        record("p", pointer_key("u/p", "latest"), "dead"),
        record("m3", manifest_key(h(3)), "statement"),
        record("q", pointer_key("u/q", "latest"), "read"),
        record("r", pointer_key("u/r", "latest"), "other"),
    )

    assert response == failures("m2", "unreadable", "m3", "q")
    assert dead_lettered(sqs).keys() == {"undecodable"}


def test_a_message_that_cannot_be_dead_lettered_is_returned_and_holds_its_group(handle, s3, con, sqs):
    put_manifest(s3, con, h(1))
    put_manifest(s3, con, h(2))
    sqs.fails = True

    response = handle(
        record("m1", manifest_key(h(1))),
        undecodable("undecodable", "g"),
        record("m2", manifest_key(h(2)), "g"),
    )

    assert response == failures("undecodable", "m2")


def test_a_message_is_returned_rather_than_dead_lettered_with_too_little_time_left_to_send_it(handle, clock, sqs):
    clock.now = TIMEOUT_S - t4_lambda_iceberg.SEND_BUDGET_MS / 1000 + 1

    response = handle(undecodable("undecodable"))

    assert response == failures("undecodable")
    assert sqs.sent == []


@pytest.mark.parametrize(
    "events",
    [
        [record("m1", manifest_key(h(1))), record("m2", manifest_key(h(2)))],
        [record("m1", manifest_key(h(1))), undecodable("bad"), record("m2", manifest_key(h(2)))],
        [record("m1", manifest_key(h(1))), record("unreadable", manifest_key(h(3)))],
        [record("m1", manifest_key(h(1))), record("denied", manifest_key(h(4)))],
    ],
    ids=[
        "items",
        "items and an event no retry can write",
        "an item and one that cannot be read for now",
        "an item and one that cannot be read for good",
    ],
)
def test_when_every_item_of_several_fails_none_is_dead_lettered(handle, athena, s3, con, sqs, events):
    manifests(s3, con, 1, 2)
    s3.objects[BUCKET, manifest_key(h(3))] = SLOW_DOWN
    s3.objects[BUCKET, manifest_key(h(4))] = ACCESS_DENIED
    athena.fails = lambda sql: BAD_DATA

    response = handle(*events)

    assert response == failures(*(event["messageId"] for event in events))
    assert sqs.sent == []


@pytest.mark.parametrize(
    "fails, events",
    [
        (BAD_DATA, [record("m1", manifest_key(h(1)))]),
        (BAD_DATA, [record("m1", manifest_key(h(1))), record("m2", manifest_key(h(1)))]),  # one object's events
        (None, [undecodable("m1")]),
        (None, [undecodable("m1"), record("m2", "elsewhere/key")]),
    ],
    ids=["statement", "one object's events", "event", "events"],
)
def test_a_batch_of_one_item_or_none_failing_for_good_is_dead_lettered(handle, athena, s3, con, sqs, fails, events):
    put_manifest(s3, con, h(1))
    athena.fails = lambda sql: fails

    response = handle(*events)

    assert response == failures()
    assert dead_lettered(sqs).keys() == {event["messageId"] for event in events}


def test_a_batch_of_one_failing_for_now_is_returned(handle, athena, s3, con, sqs):
    put_manifest(s3, con, h(1))
    athena.fails = lambda sql: UNAVAILABLE

    response = handle(record("m1", manifest_key(h(1))))

    assert response == failures("m1")
    assert sqs.sent == []


THROTTLED_START = botocore.exceptions.ClientError({"Error": {"Code": "ThrottlingException"}}, "StartQueryExecution")
THROTTLED_POLL = botocore.exceptions.ClientError({"Error": {"Code": "ThrottlingException"}}, "GetQueryExecution")


@pytest.mark.parametrize(
    "refusing, refusal", [("start_fails", THROTTLED_START), ("poll_fails", THROTTLED_POLL)], ids=["start", "poll"]
)
def test_a_call_athena_refuses_for_a_while_is_retried_and_its_statement_written_once(
    handle, athena, s3, con, refusing, refusal
):
    batch = manifests(s3, con, 1, 2, 3)
    refusals = iter([refusal, refusal])
    setattr(athena, refusing, lambda sql: next(refusals, None) if '"package_entry"' in sql else None)

    response = handle(*batch)

    assert response == failures()
    assert holdings(con)["package_entry"] == {(REGISTRY, h(n)) for n in (1, 2, 3)}
    assert sum('"package_entry"' in sql for sql, _ in athena.started) == 1


def test_a_statement_athena_refuses_to_start_until_the_deadline_returns_its_items(handle, athena, s3, con):
    batch = manifests(s3, con, 1, 2, 3)
    athena.start_fails = lambda sql: THROTTLED_START if '"package_entry"' in sql else None

    response = handle(*batch)

    assert response == failures("m1", "m2", "m3")
    assert holdings(con)["package_entry"] == set()


@pytest.mark.parametrize(
    "error",
    [THROTTLED_POLL, botocore.exceptions.ReadTimeoutError(endpoint_url="https://athena")],
    ids=["refused", "unreachable"],
)
def test_a_statement_whose_state_athena_fails_to_report_until_the_deadline_is_stopped_and_its_items_returned(
    handle, athena, s3, con, error
):
    batch = manifests(s3, con, 1, 2, 3)
    athena.poll_fails = lambda sql: error if '"package_entry"' in sql else None

    response = handle(*batch)

    assert response == failures("m1", "m2", "m3")
    assert [i for i, (sql, _) in enumerate(athena.started) if '"package_entry"' in sql] == [0]
    assert athena.stopped == ["0"]
    assert holdings(con)["package_entry"] == set()


def test_a_refusal_until_the_deadline_while_retrying_item_by_item_returns_that_item_and_the_rest(
    handle, athena, s3, con
):
    for name in "pqr":
        put_pointer(s3, f"u/{name}", "latest", h(1))
    athena.fails = lambda sql: UNAVAILABLE if "'u/p'" in sql and "'u/q'" in sql else None
    athena.start_fails = lambda sql: THROTTLED_START if "'u/q'" in sql and "'u/p'" not in sql else None

    response = handle(*(record(name, pointer_key(f"u/{name}", "latest")) for name in "pqr"))

    assert response == failures("q", "r")
    assert con.execute(f'SELECT pkg_name FROM "{STACK_DB}"."package_tag"').fetchall() == [("u/p",)]


def test_statements_that_could_run_into_the_timeout_are_not_started_and_their_items_returned(handle, athena, s3, con):
    # Two statements spend the time left above the budget.
    athena.takes = lambda sql: (TIMEOUT_S - t4_lambda_iceberg.STATEMENT_BUDGET_MS / 1000) / 2 + 1

    response = handle(*push(s3, con))

    assert response == failures("tag", "revision")
    assert len(athena.started) == 2
    assert holdings(con) == {
        "package_revision": set(),
        "package_tag": set(),
        "package_manifest": {(REGISTRY, h(1))},
        "package_entry": {(REGISTRY, h(1))},
    }


def test_a_statement_still_running_at_the_deadline_is_stopped_and_its_items_returned(handle, athena, s3, con):
    batch = manifests(s3, con, 1, 2, 3)
    athena.takes = lambda sql: TIMEOUT_S if '"package_entry"' in sql else 0

    response = handle(*batch)

    assert response == failures("m1", "m2", "m3")
    assert athena.stopped == ["0"]
    assert holdings(con)["package_entry"] == set()


def test_an_item_whose_statement_botocore_will_not_send_is_dead_lettered(handle, athena, s3, con, sqs):
    batch = manifests(s3, con, 1, 2, 3)
    invalid = botocore.exceptions.ParamValidationError(report="Invalid type for parameter QueryString")
    athena.start_fails = lambda sql: invalid if '"package_entry"' in sql and h(2) in sql else None

    response = handle(*batch)

    assert response == failures()
    assert holdings(con)["package_manifest"] == {(REGISTRY, h(1)), (REGISTRY, h(3))}
    assert dead_lettered(sqs).keys() == {"m2"}
    assert dead_lettered(sqs)["m2"][2].startswith("input: ")


def test_a_call_athena_denies_for_good_returns_the_whole_batch_and_dead_letters_none(handle, athena, s3, con, sqs):
    batch = manifests(s3, con, 1)  # one item and an event no retry can write, which alone would be dead-lettered
    denied = botocore.exceptions.ClientError({"Error": {"Code": "AccessDeniedException"}}, "StartQueryExecution")
    athena.start_fails = lambda sql: denied if '"package_manifest"' in sql else None

    response = handle(*batch, undecodable("bad"))

    assert response == failures("m1", "bad")
    assert sqs.sent == []
