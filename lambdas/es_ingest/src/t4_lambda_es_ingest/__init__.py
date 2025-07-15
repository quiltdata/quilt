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
            filter_path="errors",
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
        # TODO: log errors from items.*.error?
        # TODO: ignore index_not_found_exception for delete operations?
        raise BulkDocumentError


def handler(event, context):
    logger.debug("Invoked with event: %s", event)
    assert len(event["Records"]) == 1, "Expected exactly on SQS message"
    (event,) = event["Records"]
    event = json.loads(event["body"])
    assert len(event["Records"]) == 1, "Expected exactly one S3 event record"
    (event,) = event["Records"]

    bucket = event["s3"]["bucket"]["name"]
    key = event["s3"]["object"]["key"]
    version_id = event["s3"]["object"].get("versionId")
    params = {"Bucket": bucket, "Key": key}
    if version_id:
        params["VersionId"] = version_id

    data = s3_client.get_object(**params)["Body"].read()
    bulk(context, es, data)
    s3_client.delete_object(**params)
