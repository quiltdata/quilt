import json
import logging
import os
import time

import boto3

import quilt_shared.const

athena = boto3.client("athena")
logger = logging.getLogger("quilt-lambda-iceberg")
logger.setLevel(os.environ.get("QUILT_LOG_LEVEL", "WARNING"))

QUILT_USER_ATHENA_DATABASE = os.getenv("QUILT_USER_ATHENA_DATABASE")
QUILT_ICEBERG_GLUE_DB = os.getenv("QUILT_ICEBERG_GLUE_DB")
QUILT_ICEBERG_BUCKET = os.getenv("QUILT_ICEBERG_BUCKET")
QUILT_ICEBERG_WORKGROUP = os.getenv("QUILT_ICEBERG_WORKGROUP")


def make_query_package_revision(*, bucket: str, pkg_name: str, pointer: str, delete: bool) -> str:
    # TODO: support delete
    return f"""
        MERGE INTO package_revision AS t
        USING (
            SELECT
                '{bucket}' AS registry,
                pkg_name,
                top_hash,
                from_unixtime(CAST(timestamp AS bigint)),
                message,
                user_meta AS metadata
            FROM "{QUILT_USER_ATHENA_DATABASE}"."{bucket}_packages-view"
            WHERE pkg_name = '{pkg_name}' AND timestamp = '{pointer}'
            LIMIT 1
        ) AS s
        ON t.registry = s.registry AND t.pkg_name = s.pkg_name AND t.timestamp = s.timestamp
        WHEN MATCHED THEN
            UPDATE SET top_hash = s.top_hash, message = s.message, metadata = s.metadata
        WHEN NOT MATCHED THEN
            INSERT (registry, pkg_name, top_hash, timestamp, message, metadata)
            VALUES (s.registry, s.pkg_name, s.top_hash, s.timestamp, s.message, s.metadata)
    """


def make_query_package_tag(*, bucket: str, pkg_name: str, pointer: str, delete: bool) -> str:
    # TODO: support delete
    return f"""
        MERGE INTO package_tag AS t
        USING (
            SELECT
                '{bucket}' AS registry,
                pkg_name,
                timestamp AS tag_name,
                top_hash
            FROM "{QUILT_USER_ATHENA_DATABASE}"."{bucket}_packages-view"
            WHERE pkg_name = '{pkg_name}' AND timestamp = '{pointer}'
            LIMIT 1
        ) AS s
        ON t.registry = s.registry AND t.pkg_name = s.pkg_name AND t.tag_name = s.tag_name
        WHEN MATCHED THEN
            UPDATE SET top_hash = s.top_hash
        WHEN NOT MATCHED THEN
            INSERT (registry, pkg_name, tag_name, top_hash)
            VALUES (s.registry, s.pkg_name, s.tag_name, s.top_hash)
    """


def make_query_package_entry(*, bucket: str, top_hash: str, delete: bool) -> str:
    # TODO: support delete
    return f"""
        MERGE INTO package_entry AS t
        USING (
            SELECT
                '{bucket}' AS registry,
                '{top_hash}',
                logical_key,
                physical_keys[1],
                concat(
                    CASE hash.type
                    WHEN 'SHA256' THEN '1220'
                    WHEN 'sha2-256-chunked' THEN '90ea0220'
                    END,
                    hash.value
                ) AS multihash,
                size,
                meta AS metadata
            FROM "{QUILT_USER_ATHENA_DATABASE}"."{bucket}_manifests"
            WHERE $path = '{quilt_shared.const.MANIFESTS_PREFIX}{top_hash}'
                AND logical_key IS NOT NULL
        ) AS s
        ON t.registry = s.registry AND t.top_hash = s.top_hash AND t.logical_key = s.logical_key
        WHEN MATCHED THEN
            UPDATE SET physical_key = s.physical_key, multihash = s.multihash, size = s.size, metadata = s.metadata
        WHEN NOT MATCHED THEN
            INSERT (registry, top_hash, logical_key, physical_key, multihash, size, metadata)
            VALUES (s.registry, s.top_hash, s.logical_key, s.physical_key, s.multihash, s.size, s.metadata)
    """


def handler(event, context):
    logger.debug("Invoked with event: %s", event)
    assert len(event["Records"]) == 1, "Expected exactly on SQS message"
    (event,) = event["Records"]
    event = json.loads(event["body"])

    event_name = event["detail"]["eventName"]
    s3_event = event["detail"]["s3"]
    bucket = s3_event["bucket"]["name"]
    key = s3_event["object"]["key"]

    if event_name.startswith("ObjectCreated:"):
        delete = False
    elif event_name.startswith("ObjectDeleted:"):
        delete = True
    else:
        raise ValueError(f"Unexpected event name: {event_name}")

    if key.startswith(quilt_shared.const.NAMED_PACKAGES_PREFIX):
        pkg_name, pointer_name = key.removeprefix(".quilt/named_packages/").rsplit("/", 1)
        if pointer_name.isnumeric():
            query = make_query_package_revision(bucket=bucket, pkg_name=pkg_name, pointer=pointer_name, delete=delete)
        else:
            query = make_query_package_tag(bucket=bucket, pkg_name=pkg_name, pointer=pointer_name, delete=delete)
    elif key.startswith(quilt_shared.const.MANIFESTS_PREFIX):
        top_hash = key.removeprefix(quilt_shared.const.MANIFESTS_PREFIX)
        query = make_query_package_entry(bucket=bucket, top_hash=top_hash, delete=delete)
    else:
        raise ValueError(f"Unexpected key prefix: {key}")

    logger.info("Executing query: %s", query)
    resp = athena.start_query_execution(
        QueryString=query,
        QueryExecutionContext={"Database": QUILT_ICEBERG_GLUE_DB},
        WorkGroup=QUILT_ICEBERG_WORKGROUP,
    )
    query_execution_id = resp["QueryExecutionId"]
    logger.info("Started query execution: %s", query_execution_id)
    # wait for query to complete
    while True:
        resp = athena.get_query_execution(QueryExecutionId=query_execution_id)
        state = resp["QueryExecution"]["Status"]["State"]
        if state in ("FAILED", "CANCELLED"):
            reason = resp["QueryExecution"]["Status"].get("StateChangeReason", "<no reason provided>")
            raise RuntimeError(f"Query execution {query_execution_id} failed: {reason}")
        if state == "SUCCEEDED":
            logger.info("Query execution %s succeeded", query_execution_id)
            break
        logger.info("Query execution %s is in state %s, waiting...", query_execution_id, state)
        time.sleep(1)
