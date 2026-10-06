import json
import logging
import os
import random
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from functools import partial

import boto3
import botocore.exceptions

import quilt_shared.const
from quilt_shared.athena import AthenaQueryBaseException, QueryRunner
from quilt_shared.iceberg_queries import QueryMaker
from quilt_shared.iceberg_stack_queries import Manifest, Pointer, PointerKey, StackQueryMaker, is_revision

athena = boto3.client("athena")
s3 = boto3.client("s3")
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
# Runs of a statement whose Athena API calls are refused, on top of botocore's own retries of each call.
API_ATTEMPTS = 3


def _execute(runner: QueryRunner, context, sqls: list[str]) -> bool:
    """Whether the statements ran: not when time ran short or Athena kept refusing its API calls."""
    for attempt in range(API_ATTEMPTS):
        if attempt:
            time.sleep(random.uniform(0, 2 ** (attempt - 1)))
        if context.get_remaining_time_in_millis() < STATEMENT_BUDGET_MS:
            logger.warning("Too little of the invocation left to start a statement")
            return False
        try:
            runner.run_multiple_queries(sqls)
            return True
        except botocore.exceptions.ClientError:
            logger.warning("Athena refused a call", exc_info=True)
    return False


def _run(runner: QueryRunner, context, build, items, failed: set):
    for statement in build([i for i in items if i not in failed]):
        try:
            if not _execute(runner, context, [statement.sql]):
                failed.update(statement.items)
            continue
        except AthenaQueryBaseException:
            logger.exception("Retrying a failed statement's %d items one at a time", len(statement.items))
        # In turn: run together, they would race one another's commits.
        for n, item in enumerate(statement.items):
            try:
                ran = _execute(runner, context, [s.sql for s in build([item])])
            except AthenaQueryBaseException:
                logger.exception("Failed to write %s", item)
                failed.add(item)
                continue
            if not ran:
                failed.update(statement.items[n:])
                break


def _read(bucket: str, key: str) -> tuple[PointerKey | Pointer | Manifest, bool]:
    """The item an object's current state makes, and whether it is upserted rather than deleted."""
    item = parse_key(bucket, key)
    first_line = get_first_line(bucket, key)
    if first_line and isinstance(item, PointerKey):
        item = Pointer(*item, first_line.decode())
    return item, bool(first_line)


def set_handler(event, context):
    logger.debug("Invoked with event: %s", event)
    # Only the set's function is given the stack database, so it is not read at import.
    database = os.environ["QUILT_STACK_DATABASE"]
    maker = StackQueryMaker(database=database, user_athena_db=QUILT_USER_ATHENA_DATABASE)
    # The set's role cannot reach the Iceberg database, so its queries run in the stack database.
    run = partial(
        _run, QueryRunner(logger=logger, athena=athena, database=database, workgroup=QUILT_ICEBERG_WORKGROUP), context
    )

    # An object is read as it now stands, so a batch's events for one key are one item.
    keys: dict[tuple[str, str], list[str]] = {}
    retry = set()
    for record in event["Records"]:
        try:
            keys.setdefault(decode_record(record), []).append(record["messageId"])
        except Exception:
            logger.exception("Failed to decode message %s", record["messageId"])
            retry.add(record["messageId"])
    with ThreadPoolExecutor(max_workers=10) as pool:  # botocore's default connection pool size
        reads = {key: pool.submit(_read, *key) for key in keys}

    ids, groups = {}, defaultdict(list)
    for key, read in reads.items():
        try:
            item, upsert = read.result()
        except Exception:
            logger.exception("Failed to read s3://%s/%s", *key)
            retry.update(keys[key])
            continue
        ids[item] = keys[key]
        kind = "manifest" if isinstance(item, Manifest) else "revision" if is_revision(item.pointer) else "tag"
        groups[kind, upsert].append(item)

    # An item that failed is left out of every later statement: a manifest's row marks its entries complete.
    failed: set = set()
    run(maker.tag_delete, groups["tag", False], failed)
    run(maker.revision_delete, groups["revision", False], failed)
    run(maker.manifest_delete, groups["manifest", False], failed)
    run(maker.entry_delete, groups["manifest", False], failed)
    run(maker.entry_upsert, groups["manifest", True], failed)
    run(maker.manifest_upsert, groups["manifest", True], failed)
    run(maker.tag_upsert, groups["tag", True], failed)
    run(maker.revision_upsert, groups["revision", True], failed)

    retry.update(message_id for item in failed for message_id in ids[item])
    # A FIFO queue keeps a message group's order only if nothing after a failed message of the group succeeds.
    stopped = set()
    for record in event["Records"]:
        if (group := record.get("attributes", {}).get("MessageGroupId")) is None:
            continue
        if record["messageId"] in retry:
            stopped.add(group)
        elif group in stopped:
            retry.add(record["messageId"])
    return {
        "batchItemFailures": [
            {"itemIdentifier": record["messageId"]} for record in event["Records"] if record["messageId"] in retry
        ]
    }
