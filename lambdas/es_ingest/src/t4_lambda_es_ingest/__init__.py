import collections
import json
import os
import random
import time

import boto3
import elasticsearch

from quilt_shared.es import make_elastic
from t4_lambda_shared.utils import get_quilt_logger

s3_client = boto3.client("s3")
es = make_elastic(os.environ["ES_ENDPOINT"])
logger = get_quilt_logger()


EXPECTED_ES_RESPONSE_TIME = 10  # seconds


class BulkDocumentError(Exception):
    pass


class TooManyRequestsError(Exception):
    pass


def sleep_until_timeout(context):
    """Sleep until the lambda timeout"""
    remaining = context.get_remaining_time_in_millis() / 1000 - 1
    logger.warning("Sleeping for %s seconds just before lambda timeout", remaining)
    # good night, sweet prince
    time.sleep(remaining)


def bulk(context, es, data: bytes):
    t0 = time.time()
    try:
        resp = es.bulk(
            data,
            # Return per-item errors so failures can be diagnosed. Successful
            # items have no `error` field, so they're pruned from the response,
            # keeping the (common) no-error case compact.
            filter_path="errors,items.*.error",
            # wait as much as possible because it's better die trying than just die
            # leave a second to avoid lambda timeout
            request_timeout=context.get_remaining_time_in_millis() / 1000 - 1,
        )
    except elasticsearch.exceptions.TransportError as e:
        if e.status_code == 429:
            # at this point ES seems to be *very* overloaded, so we just sleep until lambda timeout
            logger.warning("Got a 429 Too Many Requests error, sleeping until lambda timeout")
            sleep_until_timeout(context)
            raise TooManyRequestsError
        raise

    t1 = time.time()
    delta = t1 - t0
    logger.info("Bulk request took %s seconds", delta)
    overtime = delta - EXPECTED_ES_RESPONSE_TIME
    if overtime > 0:
        # if the request took so long ES seems to be overloaded, so it's better to sleep
        # now to avoid 429 Too Many Requests error later causing lambda failure and retry
        time_to_sleep = min(
            random.uniform(overtime / 2, overtime) + 15,
            context.get_remaining_time_in_millis() / 1000 - 1,
        )
        logger.warning("Sleeping for %s seconds to avoid ES overload", time_to_sleep)
        time.sleep(time_to_sleep)
    if resp["errors"]:
        # Aggregate by error: failures are usually systematic (e.g. one bad
        # mapping affecting many documents), so this keeps the logs and message
        # compact in the common case.
        failures = collections.Counter(
            (op, error.get("type"), error.get("reason"))
            for item in resp.get("items", [])
            for op, details in item.items()
            if (error := details.get("error"))
        )
        if failures:
            for (op, error_type, reason), count in failures.items():
                # %r so a user-controlled `reason` (ES echoes field names/values)
                # can't forge log lines via embedded newlines.
                logger.error("Bulk %s failed (x%s): %r: %r", op, count, error_type, reason)
            detail = (
                f"{failures.total()} document(s) failed in bulk request "
                f"({len(failures)} distinct error(s))"
            )
        else:
            # `errors` is set but no per-item error details came back. This
            # shouldn't happen for ES 6.8 (failed items always carry an `error`),
            # but log the raw response so the failure stays diagnosable instead
            # of raising with no detail.
            logger.error("Bulk reported errors but no per-item error details were found: %s", resp)
            detail = "bulk reported errors but no per-item error details were found"
        # TODO: ignore index_not_found_exception for delete operations?
        raise BulkDocumentError(detail)


def handler(event, context):
    logger.debug("Invoked with event: %s", event)
    assert len(event["Records"]) == 1, "Expected exactly on SQS message"
    (event,) = event["Records"]
    event = json.loads(event["body"])

    bucket = event["detail"]["bucket"]["name"]
    key = event["detail"]["object"]["key"]
    version_id = event["detail"]["object"].get("version-id")
    params = {"Bucket": bucket, "Key": key}
    if version_id:
        params["VersionId"] = version_id

    data = s3_client.get_object(**params)["Body"].read()
    bulk(context, es, data)
    s3_client.delete_object(**params)
