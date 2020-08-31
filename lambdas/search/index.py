"""
Sends the request to ElasticSearch.

TODO: Implement a higher-level search API.
"""
from copy import deepcopy
import os
from itertools import filterfalse, tee

from aws_requests_auth.boto_utils import BotoAWSRequestsAuth
from elasticsearch import Elasticsearch, RequestsHttpConnection

from t4_lambda_shared.decorator import api
from t4_lambda_shared.utils import get_default_origins, make_json_response

DEFAULT_SIZE = 1_000
MAX_QUERY_DURATION = '27s'  # Just shy of 29s API Gateway limit
NUM_PREVIEW_IMAGES = 100
NUM_PREVIEW_FILES = 20
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
    user_body = request.args.get('body', {})
    user_fields = request.args.get('fields', [])
    user_indexes = request.args.get('index', "")
    user_size = request.args.get('size', DEFAULT_SIZE)
    user_source = request.args.get('_source', [])
    terminate_after = None  # see if we can skip os.getenv('MAX_DOCUMENTS_PER_SHARD')

    if not user_indexes or not isinstance(user_indexes, str):
        raise ValueError("Request must include index=<comma-separated string of indices>")

    if action == 'packages':
        query = request.args.get('query', '')
        body = user_body or {
            "query": {
                "query_string": {
                    "analyze_wildcard": True,
                    "lenient": True,
                    "query": query,
                    # see enterprise/**/bucket.py for mappings
                    "fields": user_fields or [
                        # package
                        'comment', 'handle', 'handle_text^2', 'metadata_string', 'tags'
                    ]
                }
            }
        }
        if not all(i.endswith('_packages') for i in user_indexes.split(',')):
            raise ValueError("'packages' action searching indexes that don't end in '_packages'")
        _source = user_source
        size = user_size
    elif action == 'search':
        query = request.args.get('query', '')
        body = {
            "query": {
                "query_string": {
                    "analyze_wildcard": True,
                    "lenient": True,
                    "query": query,
                    # see enterprise/**/bucket.py for mappings
                    "fields": [
                        # object
                        'content', 'comment', 'key_text^2', 'meta_text',
                        # package, and boost the fields
                        'comment^2', 'handle^2', 'handle_text^2', 'metadata_string^2', 'tags^2'
                    ]
                }
            }
        }
        _source = [
            'key', 'version_id', 'updated', 'last_modified', 'size', 'user_meta',
            'comment', 'handle', 'hash', 'tags', 'metadata_string', 'pointer_file'
        ]
        size = DEFAULT_SIZE
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
        size = 0  # We still get all aggregates, just don't need the results
        _source = False
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
        _source = False
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
        _source = False
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

    to_search = f"{user_indexes},{index_overrides}" if index_overrides else user_indexes

    result = es_client.search(
        index=to_search,
        body=body,
        _source=_source,
        size=size,
        # try turning this off to consider all documents
        terminate_after=terminate_after,
        timeout=MAX_QUERY_DURATION
    )

    return make_json_response(200, post_process(result, action))


def post_process(result: dict, action: str) -> dict:
    """post process result from elastic conditional on action
    """
    if action == "stats":
        # don't modify the original to avoid side-effects
        result = deepcopy(result)
        counts = result["aggregations"]["exts"]["buckets"]
        non_gz, gz = partition(
            lambda c: any(c.get("key", "").lower().endswith(ext) for ext in COMPRESSION_EXTS),
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
        corrected.extend(gz)
        result["aggregations"]["exts"]["buckets"] = corrected

    return result


def partition(pred, iterable):
    """Use a predicate to partition entries into false entries and true entries
    partition(is_odd, range(10)) --> 0 2 4 6 8   and  1 3 5 7 9
    from https://docs.python.org/dev/library/itertools.html#itertools-recipes
    """
    t1, t2 = tee(iterable)
    return filterfalse(pred, t1), filter(pred, t2)
