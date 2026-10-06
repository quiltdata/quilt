import json
import logging
import os
import re
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from functools import partial

import boto3

import quilt_shared.const
from quilt_shared.athena import AthenaQueryBaseException, QueryRunner
from quilt_shared.iceberg_queries import QueryMaker
from quilt_shared.iceberg_stack_queries import Manifest, Pointer, PointerKey, StackQueryMaker, is_revision

athena = boto3.client("athena")
s3 = boto3.client("s3")
sqs = boto3.client("sqs")
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


def parse_key(bucket, key) -> PointerKey | Manifest:
    if key.startswith(quilt_shared.const.NAMED_PACKAGES_PREFIX):
        pkg_name, pointer = key.removeprefix(quilt_shared.const.NAMED_PACKAGES_PREFIX).rsplit("/", 1)
        return PointerKey(bucket, pkg_name, pointer)
    if key.startswith(quilt_shared.const.MANIFESTS_PREFIX):
        return Manifest(bucket, key.removeprefix(quilt_shared.const.MANIFESTS_PREFIX))
    raise ValueError(f"Unexpected key prefix: {key}")


def generate_queries(bucket, key, first_line):
    item = parse_key(bucket, key)
    if isinstance(item, PointerKey):
        pkg_name, pointer_name = item.pkg_name, item.pointer
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
    else:
        top_hash = item.top_hash
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


def handler(event, context):
    logger.debug("Invoked with event: %s", event)
    bucket, key = process_s3_event(event)
    first_line = get_first_line(bucket, key)
    queries = generate_queries(bucket, key, first_line)

    query_runner.run_multiple_queries(queries)


# The time an invocation must have left to start a statement: one statement's run, QueryRunner's commit retries
# included.
STATEMENT_BUDGET_MS = 60_000
# Left after QueryRunner's deadline, to stop its queries, dead-letter messages and respond.
DEADLINE_MARGIN_MS = 10_000
_TOP_HASH = re.compile("[0-9a-f]{64}")


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


def _run(runner: QueryRunner, context, deadline: float, build, items, *, failed: set, dead: dict):
    for statement in build([i for i in items if i not in failed]):
        try:
            if not _execute(runner, context, deadline, statement.sql):
                failed.update(statement.items)
            continue
        except AthenaQueryBaseException:
            logger.exception("Retrying a failed statement's %d items one at a time", len(statement.items))
        # In turn: run together, they would race one another's commits.
        for n, item in enumerate(statement.items):
            try:
                ran = all(_execute(runner, context, deadline, s.sql) for s in build([item]))
            except AthenaQueryBaseException as e:
                logger.exception("Failed to write %s", item)
                failed.add(item)
                if e.query_execution["Status"].get("AthenaError", {}).get("Retryable") is False:
                    dead[item] = f"statement: {e}"
                continue
            if not ran:
                failed.update(statement.items[n:])
                break


def _read(bucket: str, key: str) -> tuple[PointerKey | Pointer | Manifest, bool]:
    """The item an object's current state makes, and whether it is upserted rather than deleted."""
    try:
        item = parse_key(bucket, key)
    except ValueError:
        item = None
    if isinstance(item, Manifest):
        valid = _TOP_HASH.fullmatch(item.top_hash)
    else:
        valid = item and len(names := item.pkg_name.split("/")) == 2 and all(names) and item.pointer
    if not valid:
        raise _Invalid(f"not a package's pointer or manifest: {key}")
    first_line = get_first_line(bucket, key)
    if first_line and isinstance(item, PointerKey):
        top_hash = first_line.decode(errors="replace")
        if not _TOP_HASH.fullmatch(top_hash):
            raise _Invalid(f"a pointer whose content is not a top hash: {key}")
        item = Pointer(*item, top_hash)
    return item, bool(first_line)


def _dead_letter(queue_url: str, record, reason: str) -> bool:
    try:
        sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=record["body"],
            MessageGroupId=record["attributes"]["MessageGroupId"],
            MessageDeduplicationId=record["messageId"],
            MessageAttributes={"reason": {"DataType": "String", "StringValue": reason[:1024]}},
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
    # An item that failed is left out of every later statement: a manifest's row marks its entries complete.
    failed: set = set()
    dead_items: dict = {}  # failed items no retry can write, with why
    run = partial(
        _run,
        # The set's role cannot reach the Iceberg database, so its queries run in the stack database.
        QueryRunner(logger=logger, athena=athena, database=database, workgroup=QUILT_ICEBERG_WORKGROUP),
        context,
        time.monotonic() + (context.get_remaining_time_in_millis() - DEADLINE_MARGIN_MS) / 1000,
        failed=failed,
        dead=dead_items,
    )

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

    ids, groups = {}, defaultdict(list)
    for key, read in reads.items():
        try:
            item, upsert = read.result()
        except _Invalid as e:
            logger.warning("Failed to read s3://%s/%s: %s", *key, e)
            dead.update(dict.fromkeys(keys[key], f"input: {e}"))
            continue
        except Exception:
            logger.exception("Failed to read s3://%s/%s", *key)
            retry.update(keys[key])
            continue
        ids[item] = keys[key]
        kind = "manifest" if isinstance(item, Manifest) else "revision" if is_revision(item.pointer) else "tag"
        groups[kind, upsert].append(item)

    run(maker.tag_delete, groups["tag", False])
    run(maker.revision_delete, groups["revision", False])
    run(maker.manifest_delete, groups["manifest", False])
    run(maker.entry_delete, groups["manifest", False])
    run(maker.entry_upsert, groups["manifest", True])
    run(maker.manifest_upsert, groups["manifest", True])
    run(maker.tag_upsert, groups["tag", True])
    run(maker.revision_upsert, groups["revision", True])

    retry.update(message_id for item in failed.difference(dead_items) for message_id in ids[item])
    dead.update((message_id, reason) for item, reason in dead_items.items() for message_id in ids[item])
    # Every item of several failing is the stack failing, not the messages: none is dead-lettered.
    if len(records) > 1 and all(item in failed for item in ids):
        retry.update(dead)
        dead.clear()
    # A FIFO queue keeps a message group's order only if nothing after a failed message of the group succeeds.
    stopped = set()
    for record in records:
        message_id, group = record["messageId"], record["attributes"]["MessageGroupId"]
        if group in stopped:
            retry.add(message_id)
        elif message_id in retry or (
            message_id in dead and not _dead_letter(dead_letter_queue, record, dead[message_id])
        ):
            retry.add(message_id)
            stopped.add(group)
    return {
        "batchItemFailures": [
            {"itemIdentifier": record["messageId"]} for record in records if record["messageId"] in retry
        ]
    }
