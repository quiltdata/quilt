import itertools
import json
import re

import boto3

from t4_lambda_shared.utils import get_quilt_logger

EXPECTED_POINTER_SIZE = 64

event_bridge = boto3.client('events')
s3 = boto3.client('s3')
logger = get_quilt_logger()


class PutEventsException(Exception):
    pass


class EventsQueue:
    MAX_SIZE = 10

    def __init__(self):
        self._events = []

    def append(self, event):
        self._events.append(event)
        if len(self) >= self.MAX_SIZE:
            self._flush()

    def _flush(self):
        events = self._events
        self._events = []
        resp = event_bridge.put_events(Entries=events)
        if resp['FailedEntryCount']:
            raise PutEventsException(resp)

    def flush(self):
        if self:
            self._flush()

    def __len__(self):
        return len(self._events)

    def __bool__(self):
        return bool(self._events)


PKG_POINTER_REGEX = re.compile(r'\.quilt/named_packages/([\w-]+/[\w-]+)/([0-9]{10})')


def pkg_created_event(s3_event):
    if not s3_event['eventName'].startswith('ObjectCreated:'):
        return
    s3_event_obj = s3_event['s3']
    obj = s3_event_obj['object']
    key = obj['key']
    match = PKG_POINTER_REGEX.fullmatch(key)
    if not match:
        return
    pkg_name, pointer_name = match.groups()
    if not '1451631600' <= pointer_name <= '1767250800':
        return
    bucket_obj = s3_event_obj['bucket']
    bucket = bucket_obj['name']
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


def handler(event, context):
    s3_events = itertools.chain.from_iterable(
        json.loads(record['body'])['Records']
        for record in event['Records']
    )
    queue = EventsQueue()
    for event in filter(None, map(pkg_created_event, s3_events)):
        queue.append(event)

    queue.flush()
