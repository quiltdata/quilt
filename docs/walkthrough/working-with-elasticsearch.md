<!-- markdownlint-disable -->

Each Quilt stack includes an Elasticsearch cluster that indexes
objects and packages. To write specialized queries against your
data stored in Amazon S3 buckets you may wish to connect directly
to your Quilt Elasticsearch cluster.

Each Amazon S3 bucket connected to Quilt implies two Elasticsearch index aliases:
1. `YOUR_BUCKET_NAME`: Contains one document per object in the bucket.
2. `YOUR_BUCKET_NAME_packages`: Contains one document per package revision in the bucket.

> Quilt uses Amazon Elasticsearch version 6.7

## Query Elasticsearch with Python

You can use [`elasticsearch
6.3.1`](https://elasticsearch-py.readthedocs.io/en/6.3.1/) as
follows:

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
    _source=['*'], # return all document fields
    size=1000,
)
```
