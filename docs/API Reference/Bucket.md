
# Bucket(self, bucket\_uri)  {#Bucket}
Bucket interface for Quilt 3.

**\_\_init\_\_**

Creates a Bucket object.

__Arguments__

* __bucket_uri(str)__:  URI of bucket to target. Must start with 's3://'

__Returns__

A new Bucket

## Bucket.config(self, config\_url=None)  {#Bucket.config}

Updates this bucket's search endpoint based on a federation config.


## Bucket.get\_user\_meta\_schema(self)  {#Bucket.get\_user\_meta\_schema}

Returns the current search mappings for user metadata from the search endpoint.


## Bucket.search(self, query, limit=10)  {#Bucket.search}

Execute a search against the configured search endpoint.

__Arguments__

* __query (str)__:  query string to search
* __limit (number)__:  maximum number of results to return. Defaults to 10

Query Syntax:
    By default, a normal plaintext search will be executed over the query string.
    You can use field-match syntax to filter on exact matches for fields in
        your metadata.
    The syntax for field match is `user_meta.$field_name:"exact_match"`.

__Returns__

either the request object (in case of an error) or
a list of objects with the following structure:
```
[{
`"key"`: <key of the object>,
`"version_id"`: <version_id of object version>,
`"operation"`: <"Create" or "Delete">,
`"meta"`: <metadata attached to object>,
`"size"`: <size of object in bytes>,
`"text"`: <indexed text of object>,
`"source"`: <source document for object (what is actually stored in ElasticSeach)>,
`"time"`: <timestamp for operation>,
}...]
```


## Bucket.deserialize(self, key)  {#Bucket.deserialize}

Deserializes object at key from bucket.

__Arguments__

* __key(str)__:  key in bucket to get

__Returns__

Deserialized object.

__Raises__

* `KeyError`:  if key does not exist
* `QuiltException`:  if deserialization fails in a known way
* if a deserializer raises an unexpected error


## Bucket.\_\_call\_\_(self, key)  {#Bucket.\_\_call\_\_}
Deserializes object at key from bucket. Syntactic sugar for `bucket.deserialize(key)`.

__Arguments__

* __key__:  Key of object to deserialize.


## Bucket.put(self, key, obj, meta=None)  {#Bucket.put}

Stores `obj` at key in bucket, optionally with user-provided metadata.

__Arguments__

* __key(str)__:  key in bucket to put object to
* __obj(serializable)__:  serializable object to store at key
* __meta(dict)__:  optional user-provided metadata to store


## Bucket.put\_file(self, key, path, meta=None)  {#Bucket.put\_file}

Stores file at path to key in bucket.

__Arguments__

* __key(str)__:  key in bucket to store file at
* __path(str)__:  string representing local path to file
Optional args:
    meta(dict): Quilt metadata to attach to file
        Must be less than 2KiB serialized

__Returns__

None

__Raises__

* if no file exists at path
* if copy fails


## Bucket.put\_dir(self, key, directory)  {#Bucket.put\_dir}

Stores all files in the `directory` under the prefix `key`.

__Arguments__

* __key(str)__:  prefix to store files under in bucket
* __directory(str)__:  path to local directory to grab files from

__Returns__

None

__Raises__

* if directory isn't a valid local directory
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

```list```: Return value structure has not yet been permanently decided
Currently, it's a ``tuple`` of ``list`` objects, containing the
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


## Bucket.get\_meta(self, key)  {#Bucket.get\_meta}

Gets the metadata associated with a `key` in the bucket.

__Arguments__

* __key(str)__:  key in bucket to get meta for

__Returns__

dict of meta

__Raises__

* if download fails


## Bucket.set\_meta(self, key, meta)  {#Bucket.set\_meta}

Sets user metadata on a `key` in the bucket.

__Arguments__

* __key(str)__:  key in bucket to set meta for
* __meta(dict)__:  value to set user metadata to

__Returns__

None

__Raises__

* if put to bucket fails


## Bucket.select(self, key, query, raw=False)  {#Bucket.select}

Selects data from an S3 object.

__Arguments__

* __key(str)__:  key to query in bucket
* __query(str)__:  query to execute (SQL by default)
* __query_type(str)__:  other query type accepted by S3 service
* __raw(bool)__:  return the raw (but parsed) response

__Returns__

`pandas.DataFrame`: results of query

