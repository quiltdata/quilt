import json
import logging
import os

import boto3

import quilt_shared.const
from quilt_shared.athena import QueryRunner
from quilt_shared.iceberg_queries import QueryMaker


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


def process_s3_event(event):
    assert len(event["Records"]) == 1, "Expected exactly one SQS message"
    (record,) = event["Records"]
    event_body = json.loads(record["body"])
    s3_event = event_body["detail"]["s3"]
    bucket = s3_event["bucket"]["name"]
    key = s3_event["object"]["key"]
    return bucket, key


def generate_queries(bucket, key, first_line):
    if key.startswith(quilt_shared.const.NAMED_PACKAGES_PREFIX):
        pkg_name, pointer_name = key.removeprefix(quilt_shared.const.NAMED_PACKAGES_PREFIX).rsplit("/", 1)
        if first_line:
            return [
                (
                    query_maker.package_revision_add_single
                    if pointer_name.isnumeric()
                    else query_maker.package_tag_add_single
                )(bucket=bucket, pkg_name=pkg_name, pointer=pointer_name, top_hash=first_line.decode())
            ]
        else:
            return [
                (
                    query_maker.package_revision_delete_single
                    if pointer_name.isnumeric()
                    else query_maker.package_tag_delete_single
                )(bucket=bucket, pkg_name=pkg_name, pointer=pointer_name)
            ]
    elif key.startswith(quilt_shared.const.MANIFESTS_PREFIX):
        top_hash = key.removeprefix(quilt_shared.const.MANIFESTS_PREFIX)
        if first_line:
            return [
                query_maker.package_manifest_add_single(bucket=bucket, top_hash=top_hash),
                query_maker.package_entry_add_single(bucket=bucket, top_hash=top_hash),
            ]
        else:
            return [
                query_maker.package_manifest_delete_single(bucket=bucket, top_hash=top_hash),
                query_maker.package_entry_delete_single(bucket=bucket, top_hash=top_hash),
            ]
    else:
        raise ValueError(f"Unexpected key prefix: {key}")


def handler(event, context):
    logger.debug("Invoked with event: %s", event)
    bucket, key = process_s3_event(event)
    first_line = get_first_line(bucket, key)
    queries = generate_queries(bucket, key, first_line)

    query_runner.run_multiple_queries(queries)
