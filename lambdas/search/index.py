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

    index = request.pathParameters['proxy']
    body = request.args.get('source')
    _source = request.args.get('_source')
    size = request.args.get('size', '1000')

    result = es_client.search(index, body, _source=_source, size=size, timeout=MAX_QUERY_DURATION)

    return make_json_response(200, result)
