"""
Test the ES service that talks to ES for stats, queries, etc.
"""
import json
import os
from unittest import TestCase
from unittest.mock import patch
from urllib.parse import urlencode

import responses
from index import lambda_handler, post_process

ES_STATS_RESPONSES = {
    'all_gz': {
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
                    {'key': '.csv.gz', 'doc_count': 149011, 'size': {'value': 52630080862.0}},
                    {'key': '.json.gz', 'doc_count': 15643, 'size': {'value': 910035640.0}}
                ]
            }
        }
    },
    'no_gz': {
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
    },
    'some_gz': {
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
                    {'key': '.csv.gz', 'doc_count': 149011, 'size': {'value': 52630080862.0}},
                    {'key': '.bar.js', 'doc_count': 143724, 'size': {'value': 715229022.0}},
                    {'key': '', 'doc_count': 44744, 'size': {'value': 14009020283.0}},
                    {'key': '.ipynb', 'doc_count': 18379, 'size': {'value': 5765196199.0}},
                    {'key': '.baz.js', 'doc_count': 16668, 'size': {'value': 88149434.0}},
                    {'key': '.d.ts', 'doc_count': 16440, 'size': {'value': 151459434.0}},
                    {'key': '.json.gz', 'doc_count': 15643, 'size': {'value': 910035640.0}},
                    {'key': '.js.map', 'doc_count': 9594, 'size': {'value': 178589610.0}},
                    {'key': '.ts', 'doc_count': 5178, 'size': {'value': 10703322.0}},
                    {'key': '.ts.map', 'doc_count': 3486, 'size': {'value': 2949678.0}}
                ]
            }
        }
    }
}


def check_stats_record_format(record):
    """check that the aggregation buckets have the expected format"""
    assert {'key', 'doc_count', 'size'} == set(record.keys())
    assert set(record['size'].keys()) == {'value'}
    assert isinstance(record['key'], str)
    assert isinstance(record['doc_count'], int)
    assert isinstance(record['size']['value'], float)

    return True


class TestSearch(TestCase):
    """Tests Search functions"""
    def setUp(self):
        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=True)
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

    def test_post_process_stats_all_gz(self):
        """test stats when all *.gz in bucket"""
        es_response = ES_STATS_RESPONSES['all_gz']
        processed = post_process(es_response, 'stats')
        assert es_response == processed, 'No processing expected'
        # we shouldn't change anything in this case
        assert es_response == processed, \
            'Unexpected side-effect, post_processing should have no effect'

    def test_post_process_stats_no_gz(self):
        """test stats when no *.gz in bucket"""
        es_response = ES_STATS_RESPONSES['no_gz']
        processed = post_process(es_response, 'stats')
        assert set(processed.keys()) == set(es_response.keys()), 'Unexpected top-level key change'
        # we shouldn't change any of these values
        for key in ['took', 'timed_out', '_shards', 'hits']:
            assert es_response[key] == processed[key], 'Unexpected side-effect'
        # expected extensions after processing
        expected_exts = {
            '.ipynb',
            '.jpg',
            '.json',
            '.js',
            '.map',
            '.md',
            '.ts',
            '',
        }
        actual_stats = processed['aggregations']['exts']['buckets']
        assert all(check_stats_record_format(r) for r in actual_stats), \
            "Mangled bucket records"
        actual_exts = set(s['key'] for s in actual_stats)
        assert actual_exts == expected_exts, 'Unexpected extension set'
        # check math on .md files
        dot_md = [r for r in actual_stats if r['key'] == '.md']
        assert len(dot_md) == 1, 'Each uncompressed extension should be unique'
        md_stats = dot_md[0]
        raw_stats = es_response['aggregations']['exts']['buckets']
        assert md_stats['doc_count'] == raw_stats[4]['doc_count'], \
            'Unexpected doc_count for .md'
        assert md_stats['size']['value'] == raw_stats[4]['size']['value'], \
            'Unexpected size for .md'
        # check math on .ts files
        dot_ts = [r for r in actual_stats if r['key'] == '.ts']
        assert len(dot_ts) == 1, 'Each noncompressed extension should be unique'
        ts_stats = dot_ts[0]
        assert ts_stats['doc_count'] == sum(raw_stats[i]['doc_count'] for i in (5, 8)), \
            'Unexpected doc_count for .ts'
        assert ts_stats['size']['value'] == sum(raw_stats[i]['size']['value'] for i in (5, 8)), \
            'Unexpected size for .ts'

    def test_post_process_stats_some_gz(self):
        """test stats when some *.gz in bucket"""
        es_response = ES_STATS_RESPONSES['some_gz']
        processed = post_process(es_response, 'stats')
        assert set(processed.keys()) == set(es_response.keys()), 'Unexpected top-level key change'
        # we shouldn't change any of these values
        for key in ['took', 'timed_out', '_shards', 'hits']:
            assert es_response[key] == processed[key], 'Unexpected side-effect'
        # expected extensions after processing
        expected_exts = {
            '.csv.gz',
            '.json.gz',
            '.ipynb',
            '.js',
            '.map',
            '.ts',
            '',
        }
        actual_stats = processed['aggregations']['exts']['buckets']
        assert all(check_stats_record_format(r) for r in actual_stats), \
            "Mangled bucket records"
        actual_exts = set(s['key'] for s in actual_stats)
        assert actual_exts == expected_exts, 'Unexpected extension set'
        # make sure *.gz are unchanged
        gzs = [r for r in actual_stats if r['key'].endswith('.gz')]
        assert gzs == [
            {'key': '.csv.gz', 'doc_count': 149011, 'size': {'value': 52630080862.0}},
            {'key': '.json.gz', 'doc_count': 15643, 'size': {'value': 910035640.0}}
        ], 'Unexpected alteration of compressed extensions'
        # make sure not(*.gz) are aggregated
        non_gzs = [r for r in actual_stats if not r['key'].endswith('.gz')]
        assert {r['key'] for r in non_gzs} == {'', '.ts', '.map', '.js', '.ipynb'}, \
            'Unexpected alteration of non-compressed extensions'
        assert len(non_gzs) == 5, 'Unexpected number of non-compressed extensions'
        # check math on .js files
        dot_js = [r for r in non_gzs if r['key'] == '.js']
        assert len(dot_js) == 1, 'Each uncompressed extension should be unique'
        js_stats = dot_js[0]
        raw_stats = es_response['aggregations']['exts']['buckets']
        assert js_stats['doc_count'] == sum(raw_stats[i]['doc_count'] for i in (1, 4)), \
            'Unexpected doc_count for .js'
        assert js_stats['size']['value'] == sum(raw_stats[i]['size']['value'] for i in (1, 4)), \
            'Unexpected size for .js'
        # check math on .map files
        dot_map = [r for r in non_gzs if r['key'] == '.map']
        assert len(dot_map) == 1, 'Each noncompressed extension should be unique'
        map_stats = dot_map[0]
        assert map_stats['doc_count'] == sum(raw_stats[i]['doc_count'] for i in (7, 9)), \
            'Unexpected doc_count for .map'
        assert map_stats['size']['value'] == sum(raw_stats[i]['size']['value'] for i in (7, 9)), \
            'Unexpected size for .map'

    def test_packages(self):
        """test packages action"""
        query = {
            'action': 'packages',
            'index': 'bucket_packages',
            'body': {'custom': 'body'},
            'size': 42,
            'from': 10,
            '_source': ','.join(['great', 'expectations']),
        }

        url = f'https://www.example.com:443/{query["index"]}/_search?' + urlencode({
            k: v for k, v in query.items() if k in [
                'size', 'from', '_source'
            ]
        })

        def _callback(request):
            payload = json.loads(request.body)
            # check that user can override body
            assert payload == query['body']

            return 200, {}, json.dumps({'results': 'blah'})

        self.requests_mock.add_callback(
            responses.GET,
            url,
            callback=_callback,
            content_type='application/json',
            match_querystring=True,
        )

        event = self._make_event(query)
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 200
        assert json.loads(resp['body']) == {'results': 'blah'}

    def test_packages_bad(self):
        """test packages action with known bad index param"""
        query = {
            'action': 'packages',
            'index': 'bucket',
            'body': {'custom': 'body'},
            'size': 42,
            '_source': ['great', 'expectations']
        }
        # try a known bad query
        event = self._make_event(query)
        resp = lambda_handler(event, None)
        assert resp['statusCode'] == 500

    def test_packages_bad_from(self):
        """test packages action with known bad from param"""
        for from_value in [-1, 'one']:
            query = {
                'action': 'packages',
                'index': 'bucket_packages',
                'body': {'custom': 'body'},
                'size': 42,
                # this should barf
                'from': from_value,
                '_source': ['great', 'expectations']
            }
            # try a known bad query
            event = self._make_event(query)
            resp = lambda_handler(event, None)
            assert resp['statusCode'] == 500
            assert 'int' in resp['body']

    @patch.dict(os.environ, {'MAX_DOCUMENTS_PER_SHARD': '538'})
    def test_search(self):
        """test standard search function"""
        url = 'https://www.example.com:443/bucket/_search?' + urlencode({
            'size': 1000,
            'from': 0,
            '_source': ','.join([
                'key',
                'version_id',
                'updated',
                'last_modified',
                'size',
                'user_meta',
                'comment',
                'handle',
                'hash',
                'tags',
                'metadata',
                'pointer_file',
                'delete_marker',
            ]),
            'terminate_after': 538,
        })

        def _callback(request):
            payload = json.loads(request.body)
            assert payload['query']
            assert payload['query']['query_string']
            assert payload['query']['query_string']['fields']
            assert payload['query']['query_string']['query']

            return 200, {}, json.dumps({'results': 'blah'})

        self.requests_mock.add_callback(
            responses.GET,
            url,
            callback=_callback,
            content_type='application/json',
            match_querystring=True,
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

    def test_search_retry(self):
        """test standard search function"""
        url = 'https://www.example.com:443/bucket/_search?' + urlencode({
            'size': 1000,
            'from': 0,
            '_source': ','.join([
                'key',
                'version_id',
                'updated',
                'last_modified',
                'size',
                'user_meta',
                'comment',
                'handle',
                'hash',
                'tags',
                'metadata',
                'pointer_file',
                'delete_marker',
            ]),
            'terminate_after': 10000,
        })

        def _callback(request):
            payload = json.loads(request.body)
            assert payload['query']
            if retry < 2:
                assert payload['query']['query_string']
                assert payload['query']['query_string']['fields']
                assert payload['query']['query_string']['query']
            else:
                assert payload['query']['simple_query_string']

            return 200, {}, json.dumps({'results': 'blah'})

        self.requests_mock.add_callback(
            responses.GET,
            url,
            callback=_callback,
            content_type='application/json',
            match_querystring=True,
        )

        for retry in [0, 1, 2, 3]:

            query = {
                'action': 'search',
                'index': 'bucket',
                'query': '123',
                'retry': retry,
            }

            event = self._make_event(query)
            resp = lambda_handler(event, None)
            assert resp['statusCode'] == 200
            assert json.loads(resp['body']) == {'results': 'blah'}

    def test_stats(self):
        """test overview statistics"""
        url = 'https://www.example.com:443/bucket/_search?' + urlencode({
            '_source': 'false',  # must match JSON; False will fail match_querystring
            'size': 0,
            'from': 0,
        })

        def _callback(request):
            payload = json.loads(request.body)
            assert payload == {
                "query": {"term": {"delete_marker": False}},
                "aggs": {
                    "totalBytes": {"sum": {"field": 'size'}},
                    "exts": {
                        "terms": {"field": 'ext'},
                        "aggs": {"size": {"sum": {"field": 'size'}}},
                    },
                    # TODO: move this to a separate action (pkg_stats)
                    "totalPackageHandles": {"value_count": {"field": "handle"}},
                }
            }
            # use 'all_gz' since it's not altered by the handler
            return 200, {}, json.dumps(ES_STATS_RESPONSES['all_gz'])

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
        assert json.loads(resp['body']) == ES_STATS_RESPONSES['all_gz']
