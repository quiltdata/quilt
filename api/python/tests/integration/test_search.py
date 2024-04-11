# pip install elasticsearch==6.3.1
from aws_requests_auth.boto_utils import BotoAWSRequestsAuth
from elasticsearch import Elasticsearch, RequestsHttpConnection


def search(body: dict = {}) -> dict:
    es_host = "https://vpc-quilt-staging-g36hebl7hml3cekeznuy7mwdqe.us-east-1.es.amazonaws.com"

    auth = BotoAWSRequestsAuth(aws_host=es_host, aws_region="us-east-1", aws_service="es")

    elastic = Elasticsearch(
        hosts=[{"host": f"{es_host}", "port": 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=27,
    )

    rbody = {
        "query": body
    }

    result = elastic.search(
        index="*_packages",  # search all package indexes in this stack
        body=rbody,
        _source=["*"],  # return all document fields
        size=1000,
    )

    return result


def test_search():
    body = {
        "match": {
            "package_name": "elasticsearch"
        }
    }
    assert search(body) == {
        "took": 1,
        "timed_out": False,
        "_shards": {
            "total": 1,
            "successful": 1,
            "skipped": 0,
            "failed": 0
        },
        "hits": {
            "total": 1,
            "max_score": 1.0,
            "hits": [
                {
                    "_index": "2021-01-01_packages",
                    "_type": "_doc",
                    "_id": "1",
                    "_score": 1.0,
                    "_source": {
                        "package_name": "elasticsearch",
                        "version": "7.10.1",
                        "description": "Open Source, Distributed, RESTful Search Engine",
                        "license": "Apache-2.0",
                        "author": "Elasticsearch",
                        "created_at": "2021-01-01T00:00:00Z"
                    }
                }
            ]
        }
    }
