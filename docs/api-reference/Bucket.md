
# Bucket API Reference

The `Bucket` class provides a high-level interface for working with S3 buckets in Quilt. It enables searching, file operations, and package management within specific buckets.

## Quick Start

```python
import quilt3

# Create bucket interface
bucket = quilt3.Bucket('s3://my-bucket')

# Search for files
results = bucket.search('*.csv', limit=20)

# Upload files
bucket.put_file('data/dataset.csv', './local_file.csv')

# List objects
objects = bucket.ls()

# Download files
bucket.fetch('data/dataset.csv', './downloaded_file.csv')
```

# Bucket(bucket\_uri)  {#Bucket}

**Bucket interface for Quilt**

Creates a Bucket object for interacting with an S3 bucket.

**Arguments:**
- `bucket_uri(str)`: URI of bucket to target. Must start with 's3://'

**Returns:** A new Bucket object

**Examples:**

```python
import quilt3

# Create bucket interface
bucket = quilt3.Bucket('s3://my-data-bucket')

# Create bucket with specific configuration
bucket = quilt3.Bucket('s3://enterprise-bucket')

# Verify bucket access
try:
    objects = bucket.ls()
    print(f"Successfully connected to bucket with {len(objects)} objects")
except Exception as e:
    print(f"Bucket access failed: {e}")

# Get bucket information
print(f"Bucket URI: {bucket._uri}")
```

## Bucket.search(self, query: Union[str, dict], limit: int = 10) -> List[dict]  {#Bucket.search}

Execute a search against the configured search endpoint using Elasticsearch.

**Arguments:**
- `query`: Query string (str) or DSL query body (dict)
- `limit`: Maximum number of results to return (default: 10)

**Returns:** List of search result dictionaries

**Query Syntax:**
- [Query String Query](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl-query-string-query.html)
- [Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl.html)

**Examples:**

```python
import quilt3

bucket = quilt3.Bucket('s3://my-data-bucket')

# Basic text search
results = bucket.search('machine learning', limit=20)
for result in results:
    print(f"File: {result['key']}")
    print(f"Score: {result['score']}")

# Search for specific file types
csv_files = bucket.search('extension:csv', limit=50)
print(f"Found {len(csv_files)} CSV files")

# Search with wildcards
results = bucket.search('data_*.parquet')

# Complex query string
results = bucket.search('type:dataset AND size:>1MB')

# DSL query for advanced search
dsl_query = {
    "query": {
        "bool": {
            "must": [
                {"match": {"content": "neural network"}},
                {"range": {"size": {"gte": 1000000}}}
            ]
        }
    }
}
results = bucket.search(dsl_query, limit=100)

# Search by metadata
results = bucket.search('metadata.department:research')

# Filter by date range
results = bucket.search('last_modified:[2024-01-01 TO 2024-12-31]')

# Process search results
for result in results:
    print(f"Key: {result['key']}")
    print(f"Size: {result.get('size', 'Unknown')}")
    print(f"Last modified: {result.get('last_modified', 'Unknown')}")
    if 'metadata' in result:
        print(f"Metadata: {result['metadata']}")
```


## Bucket.put\_file(self, key, path)  {#Bucket.put\_file}

Stores file at path to key in bucket.

__Arguments__

* __key(str)__:  key in bucket to store file at
* __path(str)__:  string representing local path to file

__Returns__

None

__Raises__

* if no file exists at path
* if copy fails


## Bucket.put\_dir(self, key, directory)  {#Bucket.put\_dir}

Stores all files in the `directory` under the prefix `key`.

__Arguments__

* __key(str)__:  prefix to store files under in bucket
* __directory(str)__:  path to directory to grab files from

__Returns__

None

__Raises__

* if writing to bucket fails


## Bucket.keys(self)  {#Bucket.keys}

Lists all keys in the bucket.

__Returns__

List of strings


## Bucket.delete(self, key)  {#Bucket.delete}

Deletes a key from the bucket.

__Arguments__

* __key(str)__:  key to delete

__Returns__

None

__Raises__

* if delete fails


## Bucket.delete\_dir(self, path)  {#Bucket.delete\_dir}
Delete a directory and all of its contents from the bucket.

__Arguments__

* __path (str)__:  path to the directory to delete


## Bucket.ls(self, path=None, recursive=False)  {#Bucket.ls}
List data from the specified path.

__Arguments__

* __path (str)__:  bucket path to list
* __recursive (bool)__:  show subdirectories and their contents as well

__Returns__

``list``: Return value structure has not yet been permanently decided
Currently, it's a `tuple` of `list` objects, containing the
`following`: (directory info, file/object info, delete markers).


## Bucket.fetch(self, key, path)  {#Bucket.fetch}

Fetches file (or files) at `key` to `path`.

If `key` ends in '/', then all files with the prefix `key` will match and
will be stored in a directory at `path`.

Otherwise, only one file will be fetched and it will be stored at `path`.

__Arguments__

* __key(str)__:  key in bucket to fetch
* __path(str)__:  path in local filesystem to store file or files fetched

__Returns__

None

__Raises__

* if path doesn't exist
* if download fails


## Bucket.select(self, key, query, raw=False)  {#Bucket.select}

Selects data from an S3 object.

__Arguments__

* __key(str)__:  key to query in bucket
* __query(str)__:  query to execute (SQL by default)
* __query_type(str)__:  other query type accepted by S3 service
* __raw(bool)__:  return the raw (but parsed) response

__Returns__

`pandas.DataFrame`: results of query

