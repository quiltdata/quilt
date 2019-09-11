"""
Tests for the ES indexer
"""
from datetime import datetime
from gzip import compress
from io import BytesIO
import json
import os
import pathlib
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


BASE_DIR = pathlib.Path(__file__).parent / 'data'


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
        """
        Check that the indexer doesn't do anything when it gets S3 test notification.
        """
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
        """
        Index a single text file.
        """
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
                'Range': f'bytes=0-{index.ELASTIC_LIMIT_BYTES}',
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

    def test_unsupported_contents(self):
        contents = index.get_contents('test-bucket', 'foo.exe', '.exe', etag='etag', version_id=None, s3_client=self.s3_client, size=123)
        assert contents == ""

        contents = index.get_contents('test-bucket', 'foo.exe.gz', '.gz', etag='etag', version_id=None, s3_client=self.s3_client, size=123)
        assert contents == ""

    def test_text_contents(self):
        self.s3_stubber.add_response(
            method='get_object',
            service_response={
                'Metadata': {},
                'ContentLength': 123,
                'Body': BytesIO(b'Hello World!'),
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'foo.txt',
                'IfMatch': 'etag',
                'Range': f'bytes=0-{index.ELASTIC_LIMIT_BYTES}',
            }
        )

        contents = index.get_contents('test-bucket', 'foo.txt', '.txt', etag='etag', version_id=None, s3_client=self.s3_client, size=123)
        assert contents == "Hello World!"

    def test_gzipped_text_contents(self):
        self.s3_stubber.add_response(
            method='get_object',
            service_response={
                'Metadata': {},
                'ContentLength': 123,
                'Body': BytesIO(compress(b'Hello World!')),
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'foo.txt.gz',
                'IfMatch': 'etag',
                'Range': f'bytes=0-{index.ELASTIC_LIMIT_BYTES}',
            }
        )

        contents = index.get_contents('test-bucket', 'foo.txt.gz', '.gz', etag='etag', version_id=None, s3_client=self.s3_client, size=123)
        assert contents == "Hello World!"

    def test_notebook_contents(self):
        notebook = (BASE_DIR / 'normal.ipynb').read_bytes()

        self.s3_stubber.add_response(
            method='get_object',
            service_response={
                'Metadata': {},
                'ContentLength': 123,
                'Body': BytesIO(notebook),
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'foo.ipynb',
                'IfMatch': 'etag',
            }
        )

        contents = index.get_contents('test-bucket', 'foo.ipynb', '.ipynb', etag='etag', version_id=None, s3_client=self.s3_client, size=123)
        assert "model.fit" in contents

    def test_gzipped_notebook_contents(self):
        notebook = compress((BASE_DIR / 'normal.ipynb').read_bytes())

        self.s3_stubber.add_response(
            method='get_object',
            service_response={
                'Metadata': {},
                'ContentLength': 123,
                'Body': BytesIO(notebook),
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'foo.ipynb.gz',
                'IfMatch': 'etag',
            }
        )

        contents = index.get_contents('test-bucket', 'foo.ipynb.gz', '.gz', etag='etag', version_id=None, s3_client=self.s3_client, size=123)
        assert "Model results visualization" in contents

    def test_parquet_contents(self):
        parquet = (BASE_DIR / 'amazon-reviews-1000.snappy.parquet').read_bytes()

        self.s3_stubber.add_response(
            method='get_object',
            service_response={
                'Metadata': {},
                'ContentLength': 123,
                'Body': BytesIO(parquet),
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'foo.parquet',
                'IfMatch': 'etag',
            }
        )

        contents = index.get_contents('test-bucket', 'foo.parquet', '.parquet', etag='etag', version_id=None, s3_client=self.s3_client, size=123)
        size = len(contents.encode('utf-8', 'ignore'))
        # we know the file is bigger than the limit
        assert size == index.ELASTIC_LIMIT_BYTES
        # spot check for contents
        assert "This is a great handy reference tool for all" in contents
        assert "I recieved a Marvel the Mustang for Christmas" in contents
        assert "40643586" in contents
