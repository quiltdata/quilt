<!-- markdownlint-disable -->

The [Quilt web catalog
search](../walkthrough/working-with-the-catalog#search) is powered
by Elasticsearch. To write specialized queries against your data
stored in Amazon S3 buckets you may wish to connect directly to
your Quilt Elasticsearch cluster.

> Note that Quilt is currently pinned to Elasticsearch 6.7

Each Amazon S3 bucket connected to Quilt has two Elasticsearch indexes
with the following aliases:
1. `YOUR_BUCKET_NAME`: Contains one document per object in the bucket.
2. `YOUR_BUCKET_NAME_packages`: Contains one document per package revision in the bucket.

## Querying Elasticsearch with Python

You can use the [`Elasticsearch`
API](https://www.elastic.co/guide/en/elasticsearch/reference/6.7/) to
query your cluster.

<!--pytest.mark.skip-->
```python
from aws_requests_auth.boto_utils import BotoAWSRequestsAuth
from elasticsearch import Elasticsearch, RequestsHttpConnection

es_host = "check.aws.console.for.your.host.us-east-1.es.amazonaws.com"

auth = BotoAWSRequestsAuth(
    aws_host=es_host,
    aws_region='us-east-1',
    aws_service='es'
)

elastic = Elasticsearch(
    hosts=[
        {"host": f"{es_host}", "port": 443}
    ],
    http_auth=auth,
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection,
    timeout=27
)

query = rbody = {
    "query": {
        # query body here
    }
}

elastic.search(
    index="*_packages", # search all package indexes in this stack
    body=rbody,
    _source=['*'], # return all fields in your documents
    size=1000,
)
```
