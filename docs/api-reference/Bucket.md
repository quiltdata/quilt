
# Bucket(bucket\_uri)  {#Bucket}
Bucket interface for Quilt.

**\_\_init\_\_**

Creates a Bucket object.

__Arguments__

* __bucket_uri(str)__:  URI of bucket to target. Must start with 's3://'

__Returns__

A new Bucket

## Bucket.search(self, query: Union[str, dict], limit: int = 10) -> List[dict]  {#Bucket.search}

Execute a search against the configured search endpoint.

__Arguments__

* __query__:  query string to query if passed as `str`, DSL query body if passed as `dict`
* __limit__:  maximum number of results to return. Defaults to 10

Query Syntax:
    [Query String Query](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl-query-string-query.html)
    [Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl.html)

Index schemas and search examples can be found in the
[Quilt Search documentation](https://docs.quilt.bio/quilt-platform-catalog-user/search).

__Returns__

search results


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

