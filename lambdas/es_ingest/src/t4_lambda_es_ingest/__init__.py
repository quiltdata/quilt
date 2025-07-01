import json
import os
import random
import time

import boto3
import elasticsearch

from quilt_shared.es import make_elastic
from quilt_shared.log import get_quilt_logger

s3_client = boto3.client("s3")
es = make_elastic(os.environ["ES_ENDPOINT"])
logger = get_quilt_logger()


def handler(event, context):
    logger.debug("Batch indexer handler called with event: %s", event)
    assert len(event["Records"]) == 1, "Batch indexer handler expects exactly one record"
    (event,) = event["Records"]
    event = json.loads(event["body"])
    assert len(event["Records"]) == 1, "Batch indexer handler expects exactly one S3 event record"
    (event,) = event["Records"]

    bucket = event["s3"]["bucket"]["name"]
    key = event["s3"]["object"]["key"]
    # XXX: use version?

    class BulkDocumentError(Exception):
        pass

    class TooManyRequestsError(Exception):
        pass

    class LambdaTimeoutError(Exception):
        pass

    def sleep_until_timeout():
        """Sleep until the lambda timeout"""
        remaining = context.get_remaining_time_in_millis() / 1000 - 1
        logger.warning("Sleeping for %s seconds just before lambda timeout", remaining)
        # good night, sweet prince
        time.sleep(remaining)

    # # it looks like ES internal bulk API has a 60s timeout by default
    # # so we should wait hoping ES will be able to process the request
    # read_timeout = 61

    # @tenacity.retry(
    #     reraise=True,
    #     wait=tenacity.wait_random_exponential(min=8, multiplier=8),
    #     retry=tenacity.retry_if_exception_type(TooManyRequestsError),
    #     before_sleep=tenacity.before_log(logger, logging.WARNING),
    # )
    def bulk(context, es, data: bytes):
        # if context.get_remaining_time_in_millis() < read_timeout * 1000:
        #     logger.warning("Not enough time left to process bulk request, sleeping till lambda timeout")
        #     sleep_until_timeout()
        #     raise LambdaTimeoutError
        t0 = time.time()
        try:
            resp = es.bulk(
                data,
                filter_path="errors",
                request_timeout=context.get_remaining_time_in_millis() / 1000 - 1,
            )
        # except elasticsearch.exceptions.ConnectionTimeout as e:
        #     # At this point ES seems to start returning 5xx errors
        #     logger.warning("We got a connection timeout, sleeping until lambda timeout")
        #     sleep_until_timeout()
        #     raise
        except elasticsearch.exceptions.TransportError as e:
            if e.status_code == 429:
                logger.warning("Got a 429 Too Many Requests error, sleeping until lambda timeout")
                sleep_until_timeout()
                raise TooManyRequestsError
            raise

        t1 = time.time()
        delta = t1 - t0
        logger.info("Bulk request took %s seconds", delta)
        overtime = delta - 10
        if overtime > 0:
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

    data = s3_client.get_object(Bucket=bucket, Key=key)["Body"].read()
    bulk(context, es, data)
    s3_client.delete_object(Bucket=bucket, Key=key)
