import json
import os
from unittest import TestCase
from unittest.mock import patch
from urllib.parse import urlencode

import responses

from index import lambda_handler, post_process


class TestS3Select(TestCase):
    """Tests S3 Select"""
    def setUp(self):
        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        self.requests_mock.start()

        self.env_patcher = patch.dict(os.environ, {
            'AWS_ACCESS_KEY_ID': 'test_key',
            'AWS_SECRET_ACCESS_KEY': 'test_secret',
            'AWS_REGION': 'ng-north-1',
            'ES_HOST': 'www.example.com',
            'MAX_DOCUMENTS_PER_SHARD': '10000',
        })
        self.env_patcher.start()

    def tearDown(self):
        self.env_patcher.stop()
        self.requests_mock.stop()

    @classmethod
    def _make_event(cls, query):
        return {
            'httpMethod': 'GET',
            'path': '/lambda',
            'pathParameters': {},
            'queryStringParameters': query or None,
            'headers': None,
            'body': None,
            'isBase64Encoded': False,
        }

    def test_post_process_stats(self):
        es_response = {
            'took': 22,
            'timed_out': False,
            '_shards': {'total': 5, 'successful': 5, 'skipped': 0, 'failed': 0},
            'hits': {'total': 450147, 'max_score': 0.0, 'hits': []},
            'aggregations': {
                'totalBytes': {'value': 103112621206.0},
                'exts': {
                    'doc_count_error_upper_bound': 206,
                    'sum_other_doc_count': 27280,
                    'buckets': [
                        {'key': '.jpg', 'doc_count': 149011, 'size': {'value': 52630080862.0}},
                        {'key': '.js', 'doc_count': 143724, 'size': {'value': 715229022.0}},
                        {'key': '', 'doc_count': 44744, 'size': {'value': 14009020283.0}},
                        {'key': '.ipynb', 'doc_count': 18379, 'size': {'value': 5765196199.0}},
                        {'key': '.md', 'doc_count': 16668, 'size': {'value': 88149434.0}},
                        {'key': '.d.ts', 'doc_count': 16440, 'size': {'value': 151459434.0}},
                        {'key': '.json', 'doc_count': 15643, 'size': {'value': 910035640.0}},
                        {'key': '.js.map', 'doc_count': 9594, 'size': {'value': 178589610.0}},
                        {'key': '.ts', 'doc_count': 5178, 'size': {'value': 10703322.0}},
                        {'key': '.ts.map', 'doc_count': 3486, 'size': {'value': 2949678.0}}
                    ]
                }
            }
        }
        processed = post_process(es_response, 'stats')
        assert set(processed.keys()) == set(es_response.keys()), 'Unexpected top-level key change'
        # we shouldn't change any of these values
        for key in ['took', 'timed_out', '_shards', 'hits']:
            assert es_response[key] == processed[key], 'Unexpected side-effect'
 
    def test_search(self):
        url = 'https://www.example.com:443/bucket/_search?' + urlencode(dict(
            timeout='15s',
            size=1000,
            terminate_after=10000,
            _source=','.join(['key', 'version_id', 'updated', 'last_modified', 'size', 'user_meta']),
        ))

        def _callback(request):
            payload = json.loads(request.body)
            assert payload == {
                'query': {
                    'simple_query_string': {
                        'fields': [
                            'content',
                            'comment',
                            'key_text',
                            'meta_text'
                        ],
                        'query': '123'
                    }
                }
            }
            return 200, {}, json.dumps({'results': 'blah'})

        self.requests_mock.add_callback(
            responses.GET,
            url,
            callback=_callback,
            content_type='application/json',
            match_querystring=True
        )

        query = {
            'action': 'search',
            'index': 'bucket',
            'query': '123',
        }

        event = self._make_event(query)
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 200
        assert json.loads(resp['body']) == {'results': 'blah'}

    def test_stats(self):
        url = 'https://www.example.com:443/bucket/_search?' + urlencode(dict(
            timeout='15s',
            size=0,
            _source='',
        ))

        def _callback(request):
            payload = json.loads(request.body)
            assert payload == {
                "query": {"match_all": {}},
                "aggs": {
                    "totalBytes": {"sum": {"field": 'size'}},
                    "exts": {
                        "terms": {"field": 'ext'},
                        "aggs": {"size": {"sum": {"field": 'size'}}},
                    },
                }
            }
            return 200, {}, json.dumps({'results': 'blah'})

        self.requests_mock.add_callback(
            responses.GET,
            url,
            callback=_callback,
            content_type='application/json',
            match_querystring=True
        )

        query = {
            'action': 'stats',
            'index': 'bucket',
        }

        event = self._make_event(query)
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 200
        assert json.loads(resp['body']) == {'results': 'blah'}
