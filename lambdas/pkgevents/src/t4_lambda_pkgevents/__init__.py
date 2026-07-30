import json
import re
import time

import boto3

from t4_lambda_shared.utils import get_quilt_logger

EXPECTED_POINTER_SIZE = 64

# S3 sends this to the notification queue when a bucket's notification
# configuration is created; it carries no 'Records'.
TEST_EVENT = 's3:TestEvent'

event_bridge = boto3.client('events')
s3 = boto3.client('s3')
logger = get_quilt_logger()


class EventsQueue:
    MAX_SIZE = 10

    def __init__(self):
        self._events = []
        self._message_ids = []
        self._failed_message_ids = set()

    def append(self, event, message_id):
        self._events.append(event)
        self._message_ids.append(message_id)
        if len(self) >= self.MAX_SIZE:
            self._flush()

    def _flush(self):
        events = self._events
        message_ids = self._message_ids
        self._events = []
        self._message_ids = []
        resp = event_bridge.put_events(Entries=events)
        if resp['FailedEntryCount']:
            # response entries are in the same order as the request entries
            for message_id, entry in zip(message_ids, resp['Entries'], strict=True):
                if 'ErrorCode' in entry:
                    logger.warning('failed to publish event from message %s: %s', message_id, entry)
                    self._failed_message_ids.add(message_id)

    def flush(self):
        """Flush pending events and return ids of the messages whose events failed to publish."""
        if self:
            self._flush()
        return self._failed_message_ids

    def __len__(self):
        return len(self._events)

    def __bool__(self):
        return bool(self._events)


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


def iter_s3_events(sqs_records, failed_message_ids):
    """Yield (message id, S3 event) pairs, dropping S3 test events and
    reporting messages of unexpected shape as failed."""
    for record in sqs_records:
        try:
            body = json.loads(record['body'])
        except json.JSONDecodeError:
            body = None
        if isinstance(body, dict) and body.get('Event') == TEST_EVENT:
            # arrives on every bucket add, not worth logging
            continue
        if not isinstance(body, dict) or 'Records' not in body:
            # S3 is the expected producer, not the only possible one: report
            # whatever else lands here as failed so it ends up in the DLQ
            # instead of being deleted without a trace
            logger.warning('no S3 records in message %s', record['messageId'])
            failed_message_ids.add(record['messageId'])
            continue
        for s3_event in body['Records']:
            yield record['messageId'], s3_event


def handler(event, context):
    failed_message_ids = set()
    queue = EventsQueue()
    for message_id, s3_event in iter_s3_events(event['Records'], failed_message_ids):
        if message_id in failed_message_ids:
            # the whole message will be retried, so don't publish the rest
            # of its events now -- that'd make even more duplicates
            continue
        try:
            pkg_event = pkg_created_event(s3_event)
        except Exception:
            logger.exception('failed to process S3 event from message %s', message_id)
            failed_message_ids.add(message_id)
            continue
        if pkg_event is not None:
            queue.append(pkg_event, message_id)

    failed_message_ids |= queue.flush()
    # Messages not listed here are considered processed and get deleted from
    # the queue, so on an error that can't be attributed to specific messages
    # (e.g. a failed put_events call) we must raise, failing the whole batch.
    return {
        'batchItemFailures': [
            {'itemIdentifier': message_id} for message_id in failed_message_ids
        ],
    }
