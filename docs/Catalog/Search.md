<!-- markdownlint-disable MD013 -->
<!-- markdownlint-disable-next-line first-line-h1 -->
Each Quilt stack includes an Elasticsearch cluster that indexes objects and
packages as documents. The objects in Amazon S3 buckets connected to Quilt are
synchronized to an Elasticsearch cluster, which provides Quilt's search and
package listing features.

NOTE: This page is about full-text searching using Elasticsearch. For precise querying of specific fields, see the [Queries](Query.md) page.

## Indexing

Quilt maintains a near-realtime index of the objects in your S3
bucket in Elasticsearch.  Each bucket corresponds to one or more
Elasticsearch indexes. As objects are mutated in S3, Quilt uses an
event-driven system (via SNS and SQS) to update Elasticsearch.

There are two types of indexing in Quilt:

* *shallow* indexing includes object metadata (such as the file name and size)
* *deep* indexing includes object contents. Quilt supports deep
indexing for the following file extensions:
  * .csv, .html, .json, .md, .rmd, .rst, .tab, .txt, .tsv (plain-text formats)
  * .fcs (FlowJo)
  * .ipynb (Jupyter notebooks)
  * .parquet
  * .pdf
  * .pptx
  * .xls, .xlsx

### Search page

The search page in the catalog, accessible from the search button in the top menu bar, provides a convenient
way for searching objects and packages in an Amazon S3
bucket.

NOTE: Quilt uses Elasticsearch 6.7 [query string
syntax](https://www.elastic.co/guide/en/elasticsearch/reference/6.7/query-dsl-query-string-query.html#query-string-syntax).

The following are all valid search parameters:

#### Fields

| Syntax | Description | Example |
|- | - | - |
| `comment`| Package comment | `comment:TODO` |
| `content`| Object content | `content:Hello` |
| `ext`| Object extension | `ext:*.fastq.gz` |
| `handle`| Package name | `handle:examples\/metadata` |
| `hash`| Package hash | `hash:3192ac1*` |
| `key`| Object key | `key:phase*` |
| `key_text`| Analyzed object key | `key:"phase"` |
| `last_modified`| Last modified date | `last_modified:[2022-02-04 TO 2022-02-20]`|
| `metadata` | Package metadata | `metadata:dapi` |
| `size` | Object size in bytes | `size:>=4096` |
| `version_id` | Object version id | `version_id:t.LVVCx*` |
| `pointer_file` | Package revision tag in S3; either "latest" or a timestamp | `pointer_file:latest` |
| `package_stats.total_files` | Package total files | `package_stats.total_files:>100` |
| `package_stats.total_bytes` | Package total bytes | `package_stats.total_bytes:<100` |
| `workflow.id` | Package workflow ID | `workflow.id:verify-metadata` |

#### Logical operators and grouping

| Syntax | Description | Example |
|- | - | - |
| `AND` | Conjunction | `a AND b` |
| `OR` | Disjunction | `a OR b` |
| `NOT` | Negation | `NOT a` |
| `_exists_` | Matches any non-null value for the given field | `_exists_: content` |
| `()` | Group terms | `(a AND b) NOT c` |

#### Wildcard and regular expressions

| Syntax | Description | Example |
|- | - | - |
| `*` | Zero or more characters, avoid leading `*` (slows performance) | `ext:config.y*ml` |
| `?` | Exactly one character | `ext:React.?sx` |
| `//` | Regular expression (slows performance) | `content:/lmnb[12]/` |

### ELASTICSEARCH tab

When you click into a specific bucket, you can access the Elasticsearch tab to
run more complex queries. The Elasticsearch tab provides a more powerful search
interface than the search bar, allowing you to specify the Elasticsearch index
and query parameters.

![catalog-es-queries-default](../imgs/catalog-es-queries-default.png)

Quilt Elasticsearch queries support the following keys:

* `index` — comma-separated list of indexes to search ([learn
more](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/multi-index.html))
* `filter_path` — to reducing response nesting, ([learn
more](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/common-options.html#common-options-response-filtering))
* `_source` — boolean that adds or removes the `_source` field, or
a list of fields to return ([learn
more](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/search-request-source-filtering.html))
* `size` — limits the number of hits ([learn
more](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/search-uri-request.html))
* `from` — starting offset for pagination ([learn
more](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/search-uri-request.html))
* `body` — the search query body as a JSON dictionary ([learn
more](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/search-request-body.html))

### Secure Search

Secure Search adds object-level permission enforcement to search results. When enabled, it filters Elasticsearch hits by verifying the user's actual S3 permissions using HEAD requests. This ensures that users only see results they are authorized to access, providing stronger restrictions beyond just bucket-level indices.
