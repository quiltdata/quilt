"""
Sends the request to ElasticSearch.

TODO: Implement a higher-level search API.
"""
import os

from aws_requests_auth.boto_utils import BotoAWSRequestsAuth
from elasticsearch import Elasticsearch, RequestsHttpConnection

from t4_lambda_shared.decorator import api
from t4_lambda_shared.utils import get_default_origins, make_json_response

MAX_QUERY_DURATION = '15s'
NUM_PREVIEW_IMAGES = 100
NUM_PREVIEW_FILES = 100
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
                "simple_query_string" : {
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
        size = 0
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
