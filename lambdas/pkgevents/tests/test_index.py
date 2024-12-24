import itertools
import json
from io import BytesIO
from unittest import mock

import pytest
from botocore.stub import Stubber
from index import (
    EventsQueue,
    PutEventsException,
    handler,
    pkg_created_event,
    s3,
)


@pytest.mark.parametrize(
    'key',
    itertools.chain.from_iterable(
        (x, f'{x}/')
        for x in
        (
            ''
            'a',
            '.quilt'
            '.quilt/named_packages',
            '.quilt/named_packages/a',
            '.quilt/named_packages/a/b',
            '.quilt/named_packages/a/b/aaaaaaaaaa',
            '.quilt/named_packages/a/b/1451631599',
            '.quilt/named_packages/a/b/1451631600/',
            '.quilt/named_packages/a/b/1767250800/',
            '.quilt/named_packages/a/b/1767250801',
            '.quilt/named_packages//b/1451631600',
            '.quilt/named_packages/a//1451631600',
            '.quilt/named_packages/a/b/145163160߀',
        )
    )
)
def test_pkg_created_event_bad_key(key):
    assert pkg_created_event(
        {
            'eventName': 'ObjectCreated:Put',
            's3': {
                'object': {
                    'key': key,
                },
            },
        }
    ) is None


def test_pkg_created_event():
    bucket_name = 'test-bucket'
    handle = 'a/b'
    key = f'.quilt/named_packages/{handle}/1451631600'
    event_time = '2021-03-11T14:29:19.277067Z'
    top_hash = b'a' * 64
    event = {
        'eventName': 'ObjectCreated:Put',
        'eventTime': event_time,
        's3': {
            'object': {
                'key': key,
            },
            'bucket': {
                'name': bucket_name,
            },
        },
    }

    with Stubber(s3) as stubber:
        stubber.add_response(
            method='get_object',
            service_response={
                'Body': BytesIO(top_hash),
                'ContentLength': 64,
            },
            expected_params={
                'Bucket': bucket_name,
                'Key': key,
                'Range': 'bytes=0-63',
            }
        )

        assert pkg_created_event(
            event
        ) == {
            'Time': event_time,
            'Source': 'com.quiltdata',
            'DetailType': 'package-revision',
            'Resources': [],
            'Detail': json.dumps(
                {
                    'version': '0.1',
                    'type': 'created',
                    'bucket': bucket_name,
                    'handle': handle,
                    'topHash': top_hash.decode(),
                }
            ),
        }
        stubber.assert_no_pending_responses()

    for content_length in (63, 65):
        with Stubber(s3) as stubber:
            stubber.add_response(
                method='get_object',
                service_response={
                    'Body': BytesIO(top_hash),
                    'ContentLength': content_length,
                },
                expected_params={
                    'Bucket': bucket_name,
                    'Key': key,
                    'Range': 'bytes=0-63',
                }
            )

            assert pkg_created_event(event) is None
            stubber.assert_no_pending_responses()

    with Stubber(s3) as stubber:
        stubber.add_client_error(
            method='get_object',
            http_status_code=404,
            service_error_code='NoSuchKey',
            expected_params={
                'Bucket': bucket_name,
                'Key': key,
                'Range': 'bytes=0-63',
            }
        )

        assert pkg_created_event(event) is None
        stubber.assert_no_pending_responses()


@mock.patch('index.EventsQueue.flush')
@mock.patch('index.EventsQueue.append')
@mock.patch('index.pkg_created_event', wraps=str)
def test_handler(pkg_created_event_mock, queue_append_mock, queue_flush_mock):
    event = {
        'Records': [
            {
                'body': json.dumps(
                    {
                        'Records': records
                    }
                )
            }
            for records in (
                (0, 1),
                (2, 3, 4),
                (5,)
            )
        ]
    }
    handler(event, None)
    assert pkg_created_event_mock.call_args_list == [((x,),) for x in range(6)]
    assert queue_append_mock.call_args_list == [((str(x),),) for x in range(6)]
    queue_flush_mock.assert_called_once_with()


@pytest.mark.parametrize('failed_count', (0, 1))
def test_queue(failed_count):
    with mock.patch('index.event_bridge.put_events') as put_events_mock:
        put_events_mock.return_value = {'FailedEntryCount': failed_count}
        q = EventsQueue()
        for x in range(EventsQueue.MAX_SIZE - 1):
            q.append(x)
            put_events_mock.assert_not_called()

        if failed_count:
            with pytest.raises(PutEventsException):
                q.append(EventsQueue.MAX_SIZE - 1)
        else:
            q.append(EventsQueue.MAX_SIZE - 1)
            put_events_mock.assert_called_once_with(Entries=list(range(EventsQueue.MAX_SIZE)))
