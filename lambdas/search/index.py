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


@api(cors_origins=get_default_origins())
def lambda_handler(request):
    """
    Proxy the request to the elastic search.
    """
    action = request.args.get('action')
    index = request.args.get('index')

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
            "query": { "match_all": {} },
            "aggs": {
                "totalBytes": { "sum": { "field": 'size' } },
                "exts": {
                    "terms": { "field": 'ext' },
                    "aggs": { "size": { "sum": { "field": 'size' } } },
                },
                "updated": { "max": { "field": 'updated' } },
            }
        }
        size = 0
        _source = []
    else:
        return make_json_response(400, {"title": "Invalid action"})

    es_host = os.environ['ES_HOST']
    region = os.environ['AWS_REGION']

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

    result = es_client.search(index, body, _source=_source, size=size, timeout=MAX_QUERY_DURATION)

    return make_json_response(200, result)
