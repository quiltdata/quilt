import itertools
import json
import re

import boto3
from dateutil.parser import isoparse

event_bridge = boto3.client('events')
s3 = boto3.client('s3')


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
        event_bridge.put_events(Entries=events)

    def flush(self):
        if self:
            self._flush()

    def __len__(self):
        return len(self._events)

    def __bool__(self):
        return bool(self._events)


PKG_POINTER_REGEX = re.compile(r'\.quilt/named_packages/([\w-]+/[\w-]+)/(.{10})')


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
    etag = obj['eTag']
    version_id = obj['versionId']
    pkg_hash = s3.get_object(Bucket=bucket, Key=key, IfMatch=etag, VersionId=version_id)['Body'].read().decode()
    return {
        'Time': isoparse(s3_event['eventTime']),
        'Source': 'quiltdata.pkg',
        'DetailType': 'created',
        'Resources': [
            bucket_obj['arn'],
            # TODO: add stack ARN?
        ],
        'Detail': json.dumps({
            'bucket': bucket,
            'handle': pkg_name,
            'top_hash': pkg_hash,
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
