import itertools
import json
from io import BytesIO
from unittest import mock

import pytest
from botocore.stub import Stubber

from t4_lambda_pkgevents import (
    PUT_EVENTS_MAX_ENTRIES,
    handler,
    pkg_created_event,
    publish,
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
                "bucket": {
                    "name": "test-bucket",
                },
            },
        }
    ) is None


@pytest.mark.parametrize(
    "pointer_file",
    (
        "1451631600",
        "9999999999",
    ),
)
def test_pkg_created_event(pointer_file):
    bucket_name = 'test-bucket'
    handle = 'a/b'
    key = f".quilt/named_packages/{handle}/{pointer_file}"
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


@mock.patch("t4_lambda_pkgevents.publish", return_value=frozenset())
@mock.patch("t4_lambda_pkgevents.pkg_created_event", wraps=str)
def test_handler(pkg_created_event_mock, publish_mock):
    event = {
        'Records': [
            {
                'messageId': f'message-{idx}',
                'body': json.dumps(
                    {
                        'Records': records
                    }
                )
            }
            for idx, records in enumerate(
                (
                    (0, 1),
                    (2, 3, 4),
                    (5,)
                )
            )
        ]
    }
    assert handler(event, None) == {'batchItemFailures': []}
    assert pkg_created_event_mock.call_args_list == [((x,),) for x in range(6)]
    publish_mock.assert_called_once_with(
        [
            (f'message-{idx}', str(x))
            for x, idx in zip(range(6), (0, 0, 1, 1, 1, 2), strict=True)
        ]
    )


@mock.patch("t4_lambda_pkgevents.logger")
@mock.patch("t4_lambda_pkgevents.publish", return_value=frozenset())
@mock.patch("t4_lambda_pkgevents.pkg_created_event", wraps=str)
def test_handler_drops_test_events_silently(
    pkg_created_event_mock, publish_mock, logger_mock
):
    test_event_body = json.dumps(
        {
            'Service': 'Amazon S3',
            'Event': 's3:TestEvent',
            'Time': '2026-07-30T00:38:18.000Z',
            'Bucket': 'test-bucket',
            'RequestId': 'AAAAAAAAAAAAAAAA',
            'HostId': 'aaaaaaaaaaaaaaaa',
        }
    )
    event = {
        'Records': [
            {'messageId': 'message-0', 'body': json.dumps({'Records': (0, 1)})},
            {'messageId': 'message-1', 'body': test_event_body},
            {'messageId': 'message-2', 'body': json.dumps({'Records': (2,)})},
        ]
    }
    assert handler(event, None) == {'batchItemFailures': []}
    assert pkg_created_event_mock.call_args_list == [((x,),) for x in range(3)]
    publish_mock.assert_called_once_with(
        [
            (message_id, str(x))
            for x, message_id in zip(range(3), ('message-0', 'message-0', 'message-2'), strict=True)
        ]
    )
    # a test event arrives on every bucket add, it must not be logged
    logger_mock.warning.assert_not_called()
    logger_mock.exception.assert_not_called()


@pytest.mark.parametrize(
    'bad_body',
    (
        json.dumps({'Event': 'unexpected'}),
        'not JSON',
        'null',
        '[]',
        '"s3:TestEvent"',
    ),
)
@mock.patch("t4_lambda_pkgevents.publish", return_value=frozenset())
@mock.patch("t4_lambda_pkgevents.pkg_created_event", wraps=str)
def test_handler_reports_messages_without_records_as_failed(
    pkg_created_event_mock, publish_mock, bad_body
):
    event = {
        'Records': [
            {'messageId': 'message-0', 'body': json.dumps({'Records': (0,)})},
            {'messageId': 'message-1', 'body': bad_body},
        ]
    }
    assert handler(event, None) == {'batchItemFailures': [{'itemIdentifier': 'message-1'}]}
    assert pkg_created_event_mock.call_args_list == [((0,),)]
    publish_mock.assert_called_once_with([('message-0', '0')])


@mock.patch("t4_lambda_pkgevents.publish", return_value=frozenset())
@mock.patch("t4_lambda_pkgevents.pkg_created_event")
def test_handler_reports_message_with_failing_event(
    pkg_created_event_mock, publish_mock
):
    pkg_created_event_mock.side_effect = (None, Exception('boom'), None)
    event = {
        'Records': [
            # the event after the failing one must not be processed
            {'messageId': 'message-0', 'body': json.dumps({'Records': (0, 1, 2)})},
            {'messageId': 'message-1', 'body': json.dumps({'Records': (3,)})},
        ]
    }
    assert handler(event, None) == {'batchItemFailures': [{'itemIdentifier': 'message-0'}]}
    assert pkg_created_event_mock.call_args_list == [((x,),) for x in (0, 1, 3)]
    publish_mock.assert_called_once_with([])


@mock.patch("t4_lambda_pkgevents.publish", return_value=frozenset({'message-0'}))
@mock.patch("t4_lambda_pkgevents.pkg_created_event", wraps=str)
def test_handler_reports_publish_failures(
    pkg_created_event_mock, publish_mock
):
    event = {
        'Records': [
            {'messageId': 'message-0', 'body': json.dumps({'Records': (0,)})},
        ]
    }
    assert handler(event, None) == {'batchItemFailures': [{'itemIdentifier': 'message-0'}]}


def test_publish_success():
    with mock.patch("t4_lambda_pkgevents.event_bridge.put_events") as put_events_mock:
        put_events_mock.return_value = {'FailedEntryCount': 0}
        entries = [(f'message-{x}', x) for x in range(PUT_EVENTS_MAX_ENTRIES + 1)]

        assert publish(entries) == set()
        assert put_events_mock.call_args_list == [
            mock.call(Entries=list(range(PUT_EVENTS_MAX_ENTRIES))),
            mock.call(Entries=[PUT_EVENTS_MAX_ENTRIES]),
        ]


def test_publish_nothing():
    with mock.patch("t4_lambda_pkgevents.event_bridge.put_events") as put_events_mock:
        assert publish([]) == set()
        put_events_mock.assert_not_called()


def test_publish_failed_entries():
    with mock.patch("t4_lambda_pkgevents.event_bridge.put_events") as put_events_mock:
        first_entries = [{'EventId': str(x)} for x in range(PUT_EVENTS_MAX_ENTRIES)]
        first_entries[3] = {'ErrorCode': 'ThrottlingException', 'ErrorMessage': 'try later'}
        put_events_mock.side_effect = (
            {'FailedEntryCount': 1, 'Entries': first_entries},
            {
                'FailedEntryCount': 1,
                'Entries': [{'ErrorCode': 'InternalFailure', 'ErrorMessage': 'oops'}],
            },
        )
        entries = [(f'message-{x}', x) for x in range(PUT_EVENTS_MAX_ENTRIES + 1)]

        assert publish(entries) == {'message-3', f'message-{PUT_EVENTS_MAX_ENTRIES}'}
        assert put_events_mock.call_count == 2
