import itertools
import json
from io import BytesIO

import pytest
from botocore.stub import Stubber
from index import s3, pkg_created_event


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
            {
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
