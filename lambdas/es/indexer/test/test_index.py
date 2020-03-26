"""
Tests for the ES indexer
"""
import datetime
from gzip import compress
from io import BytesIO
import json
import os
from pathlib import Path
from unittest import TestCase
from unittest.mock import ANY, patch

import boto3
from botocore import UNSIGNED
from botocore.client import Config
from botocore.stub import Stubber
import pytest
import responses

from .. import index


class MockContext():
    def get_remaining_time_in_millis(self):
        return 30000


BASE_DIR = Path(__file__).parent / 'data'
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

    def test_infer_extensions(self):
        """ensure we are guessing file types well"""
        # parquet
        assert index.infer_extensions("s3/some/file.c0000", ".c0000") == ".parquet", \
            "Expected .c0000 to infer as .parquet"
        # parquet, nonzero part number
        assert index.infer_extensions("s3/some/file.c0001", ".c0001") == ".parquet", \
            "Expected .c0001 to infer as .parquet"
        # -c0001 file
        assert index.infer_extensions("s3/some/file-c0001", "") == ".parquet", \
            "Expected -c0001 to infer as .parquet"
        # -c00111 file (should never happen)
        assert index.infer_extensions("s3/some/file-c00011", "") == "", \
            "Expected -c00011 not to infer as .parquet"
        # .txt file, should be unchanged
        assert index.infer_extensions("s3/some/file.txt", ".txt") == ".txt", \
            "Expected .txt to infer as .txt"

    def test_delete_event(self):
        """
        Check that the indexer doesn't blow up on delete events.
        """
        # don't mock head or get; they should never be called for deleted objects
        self._test_index_event("ObjectRemoved:Delete", mock_head=False, mock_object=False)

    def test_delete_marker_event(self):
        """
        Common event in versioned; buckets, should no-op
        """
        # don't mock head or get; this event should never call them
        self._test_index_event(
            "ObjectRemoved:DeleteMarkerCreated",
            # we should never call Elastic in this case
            mock_elastic=False,
            mock_head=False,
            mock_object=False
        )

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

    def test_index_file(self):
        """test indexing a single file"""
        self._test_index_event("ObjectCreated:Put")

    @patch(__name__ + '.index.get_contents')
    def test_index_exception(self, get_mock):
        """test indexing a single file that throws an exception"""
        class ContentException(Exception):
            pass
        get_mock.side_effect = ContentException("Unable to get contents")
        with pytest.raises(ContentException):
            # get_mock already mocks get_object, so don't mock it in _test_index_event
            self._test_index_event("ObjectCreated:Put", mock_object=False)

    def _test_index_event(
        self,
        event_name,
        mock_elastic=True,
        mock_head=True,
        mock_object=True
    ):
        """
        Reusable helper function to test indexing a single text file.
        """
        event = {
            "Records": [{
                "body": json.dumps({
                    "Message": json.dumps({
                        "Records": [{
                            "eventName": event_name,
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

        now = index.now_like_boto3()

        metadata = {
            'helium': json.dumps({
                'comment': 'blah',
                'user_meta': {
                    'foo': 'bar'
                },
                'x': 'y'
            })
        }

        if mock_head:
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

        if mock_object:
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
            response_key = 'delete' if event_name == index.OBJECT_DELETE else 'index'
            actions = [json.loads(line) for line in request.body.splitlines()]
            expected = [
                {
                    response_key: {
                        '_index': 'test-bucket',
                        '_type': '_doc',
                        '_id': 'hello world.txt:None'
                    }
                },
                {
                    'comment': 'blah',
                    'content': '' if not mock_object else 'Hello World!',
                    'etag': '123456',
                    'event': event_name,
                    'ext': '.txt',
                    'key': 'hello world.txt',
                    'last_modified': now.isoformat(),
                    'meta_text': 'blah  {"x": "y"} {"foo": "bar"}',
                    'size': 100,
                    'target': '',
                    'updated': ANY,
                    'version_id': None
                }
            ]

            if response_key == 'delete':
                # delete events do not include request body
                expected.pop()

            assert actions == expected, "Unexpected request to ElasticSearch"

            response = {
                'items': [{
                    response_key: {
                        'status': 200
                    }
                }]
            }
            return (200, {}, json.dumps(response))

        if mock_elastic:
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

        contents = index.get_contents('test-bucket', 'foo.exe.gz', '.exe.gz', etag='etag', version_id=None, s3_client=self.s3_client, size=123)
        assert contents == ""

    def test_get_plain_text(self):
        self.s3_stubber.add_response(
            method='get_object',
            service_response={
                'Metadata': {},
                'ContentLength': 123,
                'Body': BytesIO(b'Hello World!\nThere is more to know.'),
            },
            expected_params={
                'Bucket': 'test-bucket',
                'Key': 'foo.txt',
                'IfMatch': 'etag',
                'Range': f'bytes=0-{index.ELASTIC_LIMIT_BYTES}',
            }
        )

        contents = index.get_plain_text(
            'test-bucket',
            'foo.txt',
            compression=None,
            etag='etag',
            version_id=None,
            s3_client=self.s3_client,
            size=123
        )
        assert contents == "Hello World!\nThere is more to know."

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

        contents = index.get_contents('test-bucket', 'foo.txt.gz', '.txt.gz', etag='etag', version_id=None, s3_client=self.s3_client, size=123)
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

        contents = index.get_contents('test-bucket', 'foo.ipynb.gz', '.ipynb.gz', etag='etag', version_id=None, s3_client=self.s3_client, size=123)
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
        assert size <= index.ELASTIC_LIMIT_BYTES
        # spot check for contents
        assert "This is not even worth the money." in contents
        assert "As for results; I felt relief almost immediately." in contents
        assert "R2LO11IPLTDQDX" in contents

    # see PRE conditions in conftest.py
    @pytest.mark.extended
    def test_parquet_extended(self):
        directory = (BASE_DIR / 'amazon-reviews-pds')
        files = directory.glob('**/*.parquet')
        for f in files:
            print(f"Testing {f}")
            parquet = f.read_bytes()

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
