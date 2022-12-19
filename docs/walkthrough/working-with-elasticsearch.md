<!-- markdownlint-disable -->

## About ElasticSearch

The [Quilt web catalog
search](../walkthrough/working-with-the-catalog#search) is powered
by ElasticSearch. To write specialized queries against your data
stored in Amazon S3 buckets you may wish to connect directly to
your Quilt ElasticSearch cluster.

> Note that Quilt is currently pinned to ElasticSearch 6.7

Each Amazon S3 bucket connected to Quilt has two ElasticSearch indexes:
1. `<s3-bucket>`: For S3 object documents
2. `<s3-bucket>_packages`: For Quilt data package documents

Provided you have IAM permissions, you can write queries against
the indexes which will search across all your Amazon S3 buckets
connected to Quilt.

## Connecting to your indexes

Before writing your specialized queries, you will need to ensure
that you have authenticated and have access to AWS resources. The
best way to do this is to [configure your AWS CLI
credentials](https://docs.quiltdata.com/more/faq#do-i-have-to-login-via-quilt3-to-use-the-quilt-apis-how-do-i-push-to-quilt-from-a-headless-environme).

<!--pytest.mark.skip-->
```bash
% export AWS_PROFILE=<your-aws-profile>
```

You can then connect directly to the ElasticSearch cluster to write
custom queries. This is faster than writing queries to multiple S3
buckets due to how registries are laid out in Amazon S3. 

### Example

Below is an example using Python to search the Quilt data package 
documents index (`*_packages`) across all S3 buckets (`*`), 
returning the top `1000` results.

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

to_search = "*_packages"
_source = ['*']

elastic.search(
    index=to_search,
    body=rbody,
    _source=_source,
    size=1000,
)
```
