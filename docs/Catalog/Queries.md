## Make complex searches requests

User can make complex search requests using Catalog UI. Each bucket has Queries tab with queries editor.

User can provide search query using Elastic Search 6.7 syntax. Search API syntax allows either request query or reducing, decluttering results. Default query placeholder will give you first look on capabilities of queries:

![](../imgs/catalog-es-queries-default.png)

Available root properties are:

- `index` stands for a comma-separated list of index names to search, [learn more](https://www.elastic.co/guide/en/elasticsearch/reference/7.10/search-search.html#search-search-api-path-params)
- `filter_path` used for reducing response, [learn more](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/common-options.html#common-options-response-filtering)
- `_source` boolean that adds or removes `_source` field, or a list of fields to return [learn more](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/search-request-source-filtering.html)
- `size` restricts number of hits [learn more](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/search-uri-request.html)
- `from` provides start page number for pagination [learn more](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/search-uri-request.html)
- `body` is actual search query body [learn more](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/search-request-body.html)

If user have recurring searches, administator is able to save this queries as JSON files. He can store list of saved queries at `s3://BUCKET/.quilt/queries/config.yaml`:

```yaml
version: "1"
queries:
  query-1:
    name: My first query
    description: Optional description
    url: s3://BUCKET/.quilt/queries/query-1.json
  query-2:
    name: Second query
    url: s3://BUCKET/.quilt/queries/query-2.json
```
