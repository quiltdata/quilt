import json
import logging
import os
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

import boto3
import botocore.config
import botocore.exceptions

import quilt_shared.const
from quilt_shared.athena import AthenaQueryBaseException, QueryRunner
from quilt_shared.iceberg_queries import QueryMaker
from quilt_shared.iceberg_stack_queries import (
    Manifest,
    Pointer,
    PointerKey,
    StackQueryMaker,
    is_revision,
    is_top_hash,
    parse_key,
)

athena = boto3.client("athena")
s3 = boto3.client("s3")
# The set's own clients, bounded so that no hung call keeps a batch from its answer: about 48 s a call at most.
_SET_CLIENT = botocore.config.Config(
    connect_timeout=5, read_timeout=10, retries={"mode": "standard", "total_max_attempts": 3}
)
set_athena = boto3.client("athena", config=_SET_CLIENT)
set_s3 = boto3.client("s3", config=_SET_CLIENT)
# Bounded, so dead-lettering after the deadline cannot run into the invocation's timeout: one attempt, about 4 s at
# most; a message whose send fails is returned for retry.
sqs = boto3.client(
    "sqs", config=botocore.config.Config(connect_timeout=2, read_timeout=2, retries={"total_max_attempts": 1})
)
logger = logging.getLogger("quilt-lambda-iceberg")
logger.setLevel(os.environ.get("QUILT_LOG_LEVEL", "WARNING"))

QUILT_USER_ATHENA_DATABASE = os.environ["QUILT_USER_ATHENA_DATABASE"]
QUILT_ICEBERG_GLUE_DB = os.environ["QUILT_ICEBERG_GLUE_DB"]
QUILT_ICEBERG_BUCKET = os.environ["QUILT_ICEBERG_BUCKET"]
QUILT_ICEBERG_WORKGROUP = os.environ["QUILT_ICEBERG_WORKGROUP"]


query_runner = QueryRunner(
    logger=logger,
    athena=athena,
    database=QUILT_ICEBERG_GLUE_DB,
    workgroup=QUILT_ICEBERG_WORKGROUP,
)
query_maker = QueryMaker(user_athena_db=QUILT_USER_ATHENA_DATABASE)


def get_first_line(bucket, key) -> bytes | None:
    try:
        resp = s3.get_object(Bucket=bucket, Key=key)
        for line in resp["Body"].iter_lines():
            return line
    except s3.exceptions.NoSuchKey:
        return None


def decode_record(record) -> tuple[str, str]:
    s3_event = json.loads(record["body"])["detail"]["s3"]
    return s3_event["bucket"]["name"], s3_event["object"]["key"]


def process_s3_event(event):
    assert len(event["Records"]) == 1, "Expected exactly one SQS message"
    (record,) = event["Records"]
    return decode_record(record)


def generate_queries(bucket, key, first_line):
    if key.startswith(quilt_shared.const.NAMED_PACKAGES_PREFIX):
        pkg_name, pointer_name = key.removeprefix(quilt_shared.const.NAMED_PACKAGES_PREFIX).rsplit("/", 1)
        return (
            [
                (
                    query_maker.package_revision_add_single
                    if pointer_name.isnumeric()
                    else query_maker.package_tag_add_single
                )(bucket=bucket, pkg_name=pkg_name, pointer=pointer_name, top_hash=first_line.decode())
            ]
            if first_line
            else [
                (
                    query_maker.package_revision_delete_single
                    if pointer_name.isnumeric()
                    else query_maker.package_tag_delete_single
                )(bucket=bucket, pkg_name=pkg_name, pointer=pointer_name)
            ]
        )
    elif key.startswith(quilt_shared.const.MANIFESTS_PREFIX):
        top_hash = key.removeprefix(quilt_shared.const.MANIFESTS_PREFIX)
        return (
            [
                query_maker.package_manifest_add_single(bucket=bucket, top_hash=top_hash),
                query_maker.package_entry_add_single(bucket=bucket, top_hash=top_hash),
            ]
            if first_line
            else [
                query_maker.package_manifest_delete_single(bucket=bucket, top_hash=top_hash),
                query_maker.package_entry_delete_single(bucket=bucket, top_hash=top_hash),
            ]
        )
    else:
        raise ValueError(f"Unexpected key prefix: {key}")


def handler(event, context):
    logger.debug("Invoked with event: %s", event)
    bucket, key = process_s3_event(event)
    first_line = get_first_line(bucket, key)
    queries = generate_queries(bucket, key, first_line)

    query_runner.run_multiple_queries(queries)


# Left after QueryRunner's deadline: one call on `set_athena` can take 3 attempts of 5 s connect and 10 s read, with
# backoff, about 48 s, and then the queries are stopped, messages dead-lettered and the batch answered.
DEADLINE_MARGIN_MS = 60_000
# The time an invocation must have left to start a statement: the margin and about 30 s for the statement to run. At a
# 300 s timeout, a batch gets about 210 s of statements.
STATEMENT_BUDGET_MS = 90_000
# The time an invocation must have left to dead-letter a message: one send's worst case, and a second for DNS.
SEND_BUDGET_MS = 5_000


class _Invalid(Exception):
    """An event no retry can write."""


def _execute(runner: QueryRunner, context, deadline: float, sql: str) -> bool:
    """Whether the statement ran to completion: not when time ran short, or when the deadline passed or a call to
    Athena failed, and QueryRunner stopped what it had started rather than leave it running."""
    if context.get_remaining_time_in_millis() < STATEMENT_BUDGET_MS:
        logger.warning("Too little of the invocation left to start a statement")
        return False
    (execution,) = runner.run_multiple_queries([sql], deadline=deadline)
    return execution is not None


def _run(runner: QueryRunner, context, deadline: float, build, items, failed: dict):
    """Records in `failed` each item that failed, with why if no retry can write it."""
    for statement in build([i for i in items if i not in failed]):
        try:
            if not _execute(runner, context, deadline, statement.sql):
                failed.update(dict.fromkeys(statement.items))
            continue
        except (AthenaQueryBaseException, botocore.exceptions.ParamValidationError):
            logger.exception("Retrying a failed statement's %d items one at a time", len(statement.items))
        # In turn: run together, they would race one another's commits.
        for n, item in enumerate(statement.items):
            try:
                ran = all(_execute(runner, context, deadline, s.sql) for s in build([item]))
            except AthenaQueryBaseException as e:
                logger.exception("Failed to write %s", item)
                failed[item] = None if e.retryable else f"statement: {e}"
                continue
            except botocore.exceptions.ParamValidationError as e:
                # A statement botocore will not send is this item's alone.
                logger.exception("Failed to write %s", item)
                failed[item] = f"input: {e}"
                continue
            if not ran:
                failed.update(dict.fromkeys(statement.items[n:]))
                break


def _first_line(bucket: str, key: str) -> bytes | None:
    """The object's first line, empty for an empty object, or None if there is no object."""
    try:
        resp = set_s3.get_object(Bucket=bucket, Key=key)
        return next(iter(resp["Body"].iter_lines()), b"")
    except set_s3.exceptions.NoSuchKey:
        return None


def _read(bucket: str, key: str) -> tuple[PointerKey | Pointer | Manifest, bool]:
    """The item an object's current state makes, and whether it is upserted rather than deleted."""
    if (item := parse_key(bucket, key)) is None:
        raise _Invalid(f"not a package's pointer or manifest: {key}")
    first_line = _first_line(bucket, key)
    # A pointer that exists names a manifest, so empty content is no top hash rather than a delete.
    if first_line is not None and isinstance(item, PointerKey):
        top_hash = first_line.decode(errors="replace")
        if not is_top_hash(top_hash):
            raise _Invalid(f"a pointer whose content is not a top hash: {key}")
        return Pointer(*item, top_hash), True
    return item, bool(first_line)


# S3's client errors that clear by themselves.
_S3_TRANSIENT = frozenset({"RequestTimeout", "RequestTimeTooSkewed", "OperationAborted"})


def _refused_for_good(error: Exception) -> bool:
    """Whether S3 refused a read with a client error no retry clears, as for a bucket the stack no longer reads."""
    if not isinstance(error, botocore.exceptions.ClientError):
        return False
    status = error.response.get("ResponseMetadata", {}).get("HTTPStatusCode", 0)
    code = error.response.get("Error", {}).get("Code")
    return 400 <= status < 500 and status != 429 and code not in _S3_TRANSIENT  # 429 is throttling


def _dead_letter(queue_url: str, context, record, reason: str) -> bool:
    if context.get_remaining_time_in_millis() < SEND_BUDGET_MS:
        logger.warning("Too little of the invocation left to dead-letter message %s", record["messageId"])
        return False
    try:
        sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=record["body"],
            MessageGroupId=record["attributes"]["MessageGroupId"],
            MessageDeduplicationId=record["messageId"],
            # Escaped as JSON escapes it, since SQS refuses an attribute holding a control character, as a key may.
            MessageAttributes={"reason": {"DataType": "String", "StringValue": json.dumps(reason)[1:-1][:1024]}},
        )
        return True
    except Exception:
        logger.exception("Failed to dead-letter message %s", record["messageId"])
        return False


def set_handler(event, context):
    logger.debug("Invoked with event: %s", event)
    # Only the set's function is given the stack database, so it is not read at import.
    database = os.environ["QUILT_STACK_DATABASE"]
    dead_letter_queue = os.environ["QUILT_STACK_DEAD_LETTER_QUEUE_URL"]
    maker = StackQueryMaker(database=database, user_athena_db=QUILT_USER_ATHENA_DATABASE)
    # The set's role cannot reach the Iceberg database, so its queries run in the stack database.
    runner = QueryRunner(logger=logger, athena=set_athena, database=database, workgroup=QUILT_ICEBERG_WORKGROUP)
    deadline = time.monotonic() + (context.get_remaining_time_in_millis() - DEADLINE_MARGIN_MS) / 1000

    records = event["Records"]
    retry: set = set()  # message ids returned for retry
    dead: dict = {}  # message ids to dead-letter, with why
    # An object is read as it now stands, so a batch's events for one key are one item.
    keys: dict[tuple[str, str], list[str]] = {}
    for record in records:
        try:
            keys.setdefault(decode_record(record), []).append(record["messageId"])
        except Exception as e:
            logger.exception("Failed to decode message %s", record["messageId"])
            dead[record["messageId"]] = f"input: not an S3 event: {e!r}"
    with ThreadPoolExecutor(max_workers=10) as pool:  # botocore's default connection pool size
        reads = {key: pool.submit(_read, *key) for key in keys}

    ids, groups, unread = {}, defaultdict(list), 0
    for key, read in reads.items():
        try:
            item, upsert = read.result()
        except _Invalid as e:
            logger.warning("Failed to read s3://%s/%s: %s", *key, e)
            dead.update(dict.fromkeys(keys[key], f"input: {e}"))
            continue
        except Exception as e:
            logger.exception("Failed to read s3://%s/%s", *key)
            unread += 1
            if _refused_for_good(e):
                dead.update(dict.fromkeys(keys[key], f"read: {e}"))
            else:
                retry.update(keys[key])
            continue
        ids[item] = keys[key]
        kind = "manifest" if isinstance(item, Manifest) else "revision" if is_revision(item.pointer) else "tag"
        groups[kind, upsert].append(item)

    # An item that failed is left out of every later statement: a manifest's row marks its entries complete.
    failed: dict = {}
    try:
        for build, kind, upsert in [
            (maker.tag_delete, "tag", False),
            (maker.revision_delete, "revision", False),
            (maker.manifest_delete, "manifest", False),
            (maker.entry_delete, "manifest", False),
            (maker.entry_upsert, "manifest", True),
            (maker.manifest_upsert, "manifest", True),
            (maker.tag_upsert, "tag", True),
            (maker.revision_upsert, "revision", True),
        ]:
            _run(runner, context, deadline, build, groups[kind, upsert], failed)
    except (botocore.exceptions.BotoCoreError, botocore.exceptions.ClientError):
        # Athena refusing for good is the stack failing, not the messages: none is dead-lettered.
        logger.exception("Athena refused the set's statements; returning the batch")
        return {"batchItemFailures": [{"itemIdentifier": record["messageId"]} for record in records]}

    for item, reason in failed.items():
        for message_id in ids[item]:
            if reason:
                dead[message_id] = reason
            else:
                retry.add(message_id)
    # Every item of several failing, in its read or its statements, is the stack failing, not the messages: none is
    # dead-lettered.
    if len(ids) + unread > 1 and ids.keys() <= failed.keys():
        retry.update(dead)
        dead.clear()
    # A FIFO queue keeps a message group's order only if nothing after a failed message of the group succeeds.
    stopped, failures = set(), []
    for record in records:
        message_id, group = record["messageId"], record["attributes"]["MessageGroupId"]
        if (
            group in stopped
            or message_id in retry
            or (message_id in dead and not _dead_letter(dead_letter_queue, context, record, dead[message_id]))
        ):
            stopped.add(group)
            failures.append({"itemIdentifier": message_id})
    return {"batchItemFailures": failures}
