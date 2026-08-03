import itertools
import json
import re
import time

import boto3

from t4_lambda_shared.utils import get_quilt_logger

EXPECTED_POINTER_SIZE = 64

# S3 sends this to the notification queue when a bucket's notification
# configuration is created; it carries no 'Records'.
TEST_EVENT = 's3:TestEvent'

PUT_EVENTS_MAX_ENTRIES = 10  # PutEvents API limit

event_bridge = boto3.client('events')
s3 = boto3.client('s3')
logger = get_quilt_logger()


PKG_POINTER_REGEX = re.compile(r'\.quilt/named_packages/([\w-]+/[\w-]+)/([0-9]{10})')


def pkg_created_event(s3_event):
    if not s3_event['eventName'].startswith('ObjectCreated:'):
        return
    s3_event_obj = s3_event['s3']
    bucket = s3_event_obj["bucket"]["name"]
    obj = s3_event_obj['object']
    key = obj['key']
    match = PKG_POINTER_REGEX.fullmatch(key)
    if not match:
        return
    pkg_name, pointer_name = match.groups()
    pointer_timestamp = int(pointer_name)
    if pointer_timestamp < 1451631600:
        logger.warning("pointer %r in bucket %r at %r is too old, skipping", pointer_name, bucket, key)
        return
    if pointer_timestamp > time.time():
        logger.warning("pointer %r in bucket %r at %r is in the future", pointer_name, bucket, key)
    try:
        resp = s3.get_object(Bucket=bucket, Key=key, Range=f'bytes=0-{EXPECTED_POINTER_SIZE - 1}')
    except s3.exceptions.NoSuchKey:
        logger.warning('pointer is created in bucket %r at %r, but not found', bucket, key)
        return
    if resp['ContentLength'] != EXPECTED_POINTER_SIZE:
        logger.warning('pointer in bucket %r at %r has %d bytes, but %d bytes expected',
                       bucket, key, resp['ContentLength'], EXPECTED_POINTER_SIZE)
        return

    return {
        'Time': s3_event['eventTime'],
        'Source': 'com.quiltdata',
        'DetailType': 'package-revision',
        'Resources': [
            # TODO: add stack ARN?
        ],
        'Detail': json.dumps({
            'version': '0.1',
            'type': 'created',
            'bucket': bucket,
            'handle': pkg_name,
            'topHash': resp['Body'].read().decode(),
        }),
    }


def get_s3_events(body):
    """Return the S3 events from an SQS message body ([] for S3 test events);
    raise for any other unexpected shape."""
    body = json.loads(body)
    if body.get('Event') == TEST_EVENT:
        # arrives on every bucket add, not worth logging
        return []
    return body['Records']


def publish(entries):
    """Publish (message id, event) pairs to EventBridge and return the ids of
    the messages whose events failed to publish."""
    failed_message_ids = set()
    for chunk in itertools.batched(entries, PUT_EVENTS_MAX_ENTRIES):
        resp = event_bridge.put_events(Entries=[event for _, event in chunk])
        if resp['FailedEntryCount']:
            # response entries are in the same order as the request entries
            for (message_id, _), resp_entry in zip(chunk, resp['Entries'], strict=True):
                if 'ErrorCode' in resp_entry:
                    logger.warning('failed to publish event from message %s: %s', message_id, resp_entry)
                    failed_message_ids.add(message_id)
    return failed_message_ids


def handler(event, context):
    failed_message_ids = set()
    entries = []
    for record in event['Records']:
        message_id = record['messageId']
        try:
            entries += [
                (message_id, pkg_event)
                for pkg_event in map(pkg_created_event, get_s3_events(record['body']))
                if pkg_event is not None
            ]
        except Exception:
            # unexpected message shape (S3 is the expected producer, not the only
            # possible one) or a failure while processing one of its events: fail
            # the message alone so it's retried and dead-lettered by itself,
            # ending up in the DLQ instead of being deleted without a trace
            logger.exception('failed to process message %s', message_id)
            failed_message_ids.add(message_id)

    failed_message_ids |= publish(entries)
    # Messages not listed here are considered processed and get deleted from the
    # queue, so an error that can't be attributed to specific messages (a failed
    # put_events call) must raise, failing the whole batch.
    return {
        'batchItemFailures': [
            {'itemIdentifier': message_id} for message_id in failed_message_ids
        ],
    }
