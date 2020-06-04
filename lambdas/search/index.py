"""
Sends the request to ElasticSearch.

TODO: Implement a higher-level search API.
"""
import os
from itertools import filterfalse, tee

from aws_requests_auth.boto_utils import BotoAWSRequestsAuth
from elasticsearch import Elasticsearch, RequestsHttpConnection

from t4_lambda_shared.decorator import api
from t4_lambda_shared.utils import get_default_origins, make_json_response

MAX_QUERY_DURATION = '15s'
NUM_PREVIEW_IMAGES = 100
NUM_PREVIEW_FILES = 100
COMPRESSION_EXTS = ['.gz']
IMG_EXTS = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.bmp',
    '.tiff',
    '.tif',
]
SAMPLE_EXTS = [
    '.parquet',
    '.csv',
    '.tsv',
    '.txt',
    '.vcf',
    '.xls',
    '.xlsx',
    '.ipynb',
    '.md',
    '.json',
]
README_KEYS = ['README.md', 'README.txt', 'README.ipynb']
SUMMARIZE_KEY = 'quilt_summarize.json'


@api(cors_origins=get_default_origins())
def lambda_handler(request):
    """
    Proxy the request to the elastic search.
    """

    action = request.args.get('action')
    indexes = request.args.get('index')
    terminate_after = os.getenv('MAX_DOCUMENTS_PER_SHARD')

    if action == 'search':
        query = request.args.get('query', '')
        body = {
            "query": {
                "simple_query_string": {
                    "query": query,
                    "fields": ['content', 'comment', 'key_text', 'meta_text']
                }
            }
        }
        # TODO: should be user settable; we should proably forbid `content` (can be huge)
        _source = ['key', 'version_id', 'updated', 'last_modified', 'size', 'user_meta']
        size = 1000
    elif action == 'stats':
        body = {
            "query": {"match_all": {}},
            "aggs": {
                "totalBytes": {"sum": {"field": 'size'}},
                "exts": {
                    "terms": {"field": 'ext'},
                    "aggs": {"size": {"sum": {"field": 'size'}}},
                },
            }
        }
        size = 1000
        _source = []
        # Consider all documents when computing counts, etc.
        terminate_after = None
    elif action == 'images':
        body = {
            'query': {'terms': {'ext': IMG_EXTS}},
            'collapse': {
                'field': 'key',
                'inner_hits': {
                    'name': 'latest',
                    'size': 1,
                    'sort': [{'last_modified': 'desc'}],
                    '_source': ['key', 'version_id'],
                },
            },
        }
        size = NUM_PREVIEW_IMAGES
        _source = []
    elif action == 'sample':
        body = {
            'query': {
                'bool': {
                    'must': [{'terms': {'ext': SAMPLE_EXTS}}],
                    'must_not': [
                        {'terms': {'key': README_KEYS + [SUMMARIZE_KEY]}},
                        {'wildcard': {'key': '*/' + SUMMARIZE_KEY}},
                    ],
                },
            },
            'collapse': {
                'field': 'key',
                'inner_hits': {
                    'name': 'latest',
                    'size': 1,
                    'sort': [{'last_modified': 'desc'}],
                    '_source': ['key', 'version_id'],
                },
            },
        }
        size = NUM_PREVIEW_FILES
        _source = []
    else:
        return make_json_response(400, {"title": "Invalid action"})

    es_host = os.environ['ES_HOST']
    region = os.environ['AWS_REGION']
    index_overrides = os.getenv('INDEX_OVERRIDES', '')

    auth = BotoAWSRequestsAuth(
        aws_host=es_host,
        aws_region=region,
        aws_service='es'
    )

    es_client = Elasticsearch(
        hosts=[{'host': es_host, 'port': 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection
    )

    to_search = f"{indexes},{index_overrides}" if index_overrides else indexes
    result = es_client.search(
        to_search,
        body,
        _source=_source,
        size=size,
        terminate_after=terminate_after,
        timeout=MAX_QUERY_DURATION
    )

    return make_json_response(200, result)

def post_process(result: dict, action: str) -> dict:
    """post process result from elastic conditional on action
    Sample expected response from ES:
    {
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
    """
    if action == "stats":
        counts = result["aggregations"]["exts"]["buckets"]
        non_gz, gz = partition(
            lambda c: any(c.get("key", "").lower() in ext for ext in COMPRESSION_EXTS),
            counts
        )
        ext_counts = {}
        # ES reports double extensions e.g. file.foo.ext, get down to just .ext
        # for any .ext that is not .gz
        # populate ext_counts
        for record in non_gz:
            _, ext = os.path.splitext(f"fakename{record['key']}")
            if ext not in ext_counts:
                ext_counts[ext] = {'doc_count': 0, 'size': 0}
            ext_counts[ext]['doc_count'] += record.get('doc_count', 0)
            ext_counts[ext]['size'] += record.get('size', {}).get('value', 0)

        corrected = [
            {
                'key': ext,
                'doc_count': val['doc_count'],
                'size': {'value': val['size']}
            }
            for ext, val in ext_counts.items()
        ]
        # rewrite aggregation buckets so gz aggregates use two-level extensions
        # and all other extensions are single-level
        result["aggregations"]["exts"]["buckets"] = corrected.extend(gz)

    return result

def partition(pred, iterable):
    """Use a predicate to partition entries into false entries and true entries
    partition(is_odd, range(10)) --> 0 2 4 6 8   and  1 3 5 7 9
    from https://docs.python.org/dev/library/itertools.html#itertools-recipes
    """
    t1, t2 = tee(iterable)
    return filterfalse(pred, t1), filter(pred, t2)
