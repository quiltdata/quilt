"""
Tests for the ES indexer. This function consumes events from SQS.
"""
from copy import deepcopy

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

BASE_DIR = Path(__file__).parent / 'data'

# See the following AWS docs for event structure:
EVENT_CORE = {
    "awsRegion": "us-east-1",
    "eventName": "ObjectCreated:Put",
    "eventSource": "aws:s3",
    "eventTime": "2020-05-22T00:32:20.515Z",
    "eventVersion": "2.1",
    "requestParameters": {"sourceIPAddress": "127.0.0.1"},
    "responseElements": {
        "x-amz-id-2": "EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH",
        "x-amz-request-id": "EXAMPLE123456789"
    },
    "s3": {
        "bucket": {
            "arn": "arn:aws:s3:::test-bucket",
            "name": "test-bucket",
            "ownerIdentity": {
                "principalId": "EXAMPLE"
            }
        },
        "configurationId": "testConfigRule",
        "object": {
            "key": "hello+world.txt",
            "sequencer": "0A1B2C3D4E5F678901"
        },
        "s3SchemaVersion": "1.0"
    },
    "userIdentity": {"principalId": "EXAMPLE"}
}


def make_event(
        name,
        eTag="123456",
        key="hello+world.txt",
        size=100,
        versionId="1313131313131.Vier50HdNbi7ZirO65"
):
    """this function builds event types off of EVENT_CORE and adds fields
    to match organic AWS events"""
    if name == "ObjectCreated:Put":
        return _make_event(
            name,
            eTag=eTag,
            key=key,
            size=size
        )
    elif name == "ObjectRemoved:Delete":
        return _make_event(name)
    elif name == "ObjectRemoved:DeleteMarkerCreated":
        return _make_event(
            name,
            eTag=eTag,
            key=key,
            versionId=versionId
        )
    else:
        raise ValueError(f"Unexpected event type: {name}")

def _make_event(name, eTag="", key="", size=0, versionId=""):
    """make events in the pattern of
    https://docs.aws.amazon.com/AmazonS3/latest/dev/notification-content-structure.html
    and
    AWS Lambda > Console > Test Event
    """
    e = deepcopy(EVENT_CORE)
    e["eventName"] = name

    if key:
        e["s3"]["object"]["key"] = key
    if eTag:
        e["s3"]["object"]["eTag"] = eTag
    if size:
        e["s3"]["object"]["size"] = size
    if versionId:
        e["s3"]["object"]["versionId"] = versionId

    return e


class MockContext():
    def get_remaining_time_in_millis(self):
        return 30000


class TestIndex(TestCase):
    def setUp(self):
        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        self.requests_mock.start()

        # Create a dummy S3 client that (hopefully) can't do anything.
        self.s3_client = boto3.client('s3', config=Config(signature_version=UNSIGNED))

        self.s3_client_patcher = patch(
            __name__ + '.index.make_s3_client',
            return_value=self.s3_client
        )
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

    def _get_contents(self, name, ext):
        return index.get_contents(
            'test-bucket', name, ext,
            etag='etag', version_id=None, s3_client=self.s3_client, size=123,
        )

    def test_infer_extensions(self):
        """ensure we are guessing file types well"""
        # parquet
        assert index.infer_extensions("s3/some/file.c000", ".c000") == ".parquet", \
            "Expected .c0000 to infer as .parquet"
        # parquet, nonzero part number
        assert index.infer_extensions("s3/some/file.c001", ".c001") == ".parquet", \
            "Expected .c0001 to infer as .parquet"
        # -c0001 file
        assert index.infer_extensions("s3/some/file-c0001", "") == ".parquet", \
            "Expected -c0001 to infer as .parquet"
        # -c00111 file (should never happen)
        assert index.infer_extensions("s3/some/file-c000121", "") == "", \
            "Expected -c000121 not to infer as .parquet"
        # .txt file, should be unchanged
        assert index.infer_extensions("s3/some/file-c0000.txt", ".txt") == ".txt", \
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
        Check that the indexer does not barf when it gets an S3 test notification.
        """
        event = {
            "Records": [{
                "body": json.dumps({
                    "Message": json.dumps({
                        "Service": "Amazon S3",
                        "Event": "s3:TestEvent",
                        "Time": "2014-10-13T15:57:02.089Z",
                        "Bucket": "test-bucket",
                        "RequestId": "5582815E1AEA5ADF",
                        "HostId": "8cLeGAmw098X5cv4Zkwcmo8vvZa3eH3eKxsPzbB9wrR+YstdA6Knx4Ip8EXAMPLE"
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
        records = {
            "Records": [{
                "body": json.dumps({
                    "Message": json.dumps({
                        "Records": [make_event(event_name)]
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
            response_key = 'delete' if event_name.startswith(index.EVENT_PREFIX["Removed"]) else 'index'
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

        index.handler(records, MockContext())

    def test_unsupported_contents(self):
        assert self._get_contents('foo.exe', '.exe') == ""
        assert self._get_contents('foo.exe.gz', '.exe.gz') == ""

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

        assert self._get_contents('foo.txt', '.txt') == "Hello World!"

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

        assert self._get_contents('foo.txt.gz', '.txt.gz') == "Hello World!"

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

        assert "model.fit" in self._get_contents('foo.ipynb', '.ipynb')

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

        assert "Model results visualization" in self._get_contents('foo.ipynb.gz', '.ipynb.gz')

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

        contents = self._get_contents('foo.parquet', '.parquet')
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
