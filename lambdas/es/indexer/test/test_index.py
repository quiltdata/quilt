"""
Tests for the ES indexer
"""
from datetime import datetime
from io import BytesIO
import json
import os
from unittest import TestCase
from unittest.mock import ANY, patch

import boto3
from botocore import UNSIGNED
from botocore.client import Config
from botocore.stub import Stubber
import responses

from .. import index


class MockContext():
    def get_remaining_time_in_millis(self):
        return 30000


class TestIndex(TestCase):
    def setUp(self):
        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        self.requests_mock.start()

        # Create a dummy S3 client that (hopefully) can't do anything.
        self.s3_client = boto3.client('s3', config=Config(signature_version=UNSIGNED))

        self.s3_client_patcher = patch(__name__ + '.index.make_s3_client', return_value=self.s3_client)
        self.s3_client_patcher.start()

        self.s3_stubber = Stubber(self.s3_client)
        self.s3_stubber.activate()

        self.env_patcher = patch.dict(os.environ, {
            'ES_HOST': 'example.com',
            'AWS_ACCESS_KEY_ID': 'test_key',
            'AWS_SECRET_ACCESS_KEY': 'test_secret',
            'AWS_DEFAULT_REGION': 'ng-north-1',
        })
        self.env_patcher.start()

    def tearDown(self):
        self.env_patcher.stop()

        self.s3_stubber.assert_no_pending_responses()
        self.s3_stubber.deactivate()
        self.s3_client_patcher.stop()

        self.requests_mock.stop()

    def test_test_event(self):
        event = {
            "Records": [{
                "body": json.dumps({
                    "Message": json.dumps({
                        "Event": "s3:TestEvent"
                    })
                })
            }]
        }

        index.handler(event, None)

    def test_index(self):
        event = {
            "Records": [{
                "body": json.dumps({
                    "Message": json.dumps({
                        "Records": [{
                            "eventName": "s3:ObjectCreated:Put",
                            "s3": {
                                "bucket": {
                                    "name": "test-bucket"
                                },
                                "object": {
                                    "key": "hello+world.txt",
                                    "eTag": "123456"
                                }
                            }
                        }]
                    })
                })
            }]
        }

        now = datetime.now()

        metadata = {
            'helium': json.dumps({
                'comment': 'blah',
                'user_meta': {
                    'foo': 'bar'
                },
                'x': 'y'
            })
        }

        self.s3_stubber.add_response(
            method='head_object',
            service_response={
                'Metadata': metadata,
                'ContentLength': 100,
                'LastModified': now,
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'hello world.txt',
                'IfMatch': '123456',
            }
        )

        self.s3_stubber.add_response(
            method='get_object',
            service_response={
                'Metadata': metadata,
                'ContentLength': 100,
                'LastModified': now,
                'Body': BytesIO(b'Hello World!'),
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'hello world.txt',
                'IfMatch': '123456',
                'Range': 'bytes=0-2000',
            }
        )

        def es_callback(request):
            actions = [json.loads(line) for line in request.body.splitlines()]
            assert actions == [{
                'index': {
                    '_index': 'test-bucket',
                    '_type': '_doc',
                    '_id': 'hello world.txt:None'
                },
            }, {
                'comment': 'blah',
                'content': 'Hello World!',
                'etag': '123456',
                'event': 's3:ObjectCreated:Put',
                'ext': '.txt',
                'key': 'hello world.txt',
                'last_modified': now.isoformat(),
                'meta_text': 'blah  {"x": "y"} {"foo": "bar"}',
                'size': 100,
                'system_meta': {'x': 'y'},
                'target': '',
                'updated': ANY,
                'user_meta': {'foo': 'bar'},
                'version_id': None
            }]

            response = {
                'items': [{
                    'index': {
                        'status': 200
                    }
                }]
            }
            return (200, {}, json.dumps(response))

        self.requests_mock.add_callback(
            responses.POST,
            'https://example.com:443/_bulk',
            callback=es_callback,
            content_type='application/json'
        )

        index.handler(event, MockContext())
