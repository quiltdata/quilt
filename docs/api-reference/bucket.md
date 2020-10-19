# quilt3.Bucket

Bucket interface for Quilt.

**\_\_init\_\_**

Creates a Bucket object.

**Arguments**

* **bucket\_uri\(str\)**:  URI of bucket to target. Must start with 's3://'

**Returns**

A new Bucket

## Bucket.search\(self, query, limit=10\) <a id="Bucket.search"></a>

Execute a search against the configured search endpoint.

**Arguments**

* **query \(str\)**:  query string to search
* **limit \(number\)**:  maximum number of results to return. Defaults to 10

Query Syntax: By default, a normal plaintext search will be executed over the query string. You can use field-match syntax to filter on exact matches for fields in your metadata. The syntax for field match is `user_meta.$field_name:"exact_match"`.

**Returns**

a list of objects with the following structure:

```text
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

## Bucket.put\_file\(self, key, path\) <a id="Bucket.put\_file"></a>

Stores file at path to key in bucket.

**Arguments**

* **key\(str\)**:  key in bucket to store file at
* **path\(str\)**:  string representing local path to file

**Returns**

None

**Raises**

* if no file exists at path
* if copy fails

## Bucket.put\_dir\(self, key, directory\) <a id="Bucket.put\_dir"></a>

Stores all files in the `directory` under the prefix `key`.

**Arguments**

* **key\(str\)**:  prefix to store files under in bucket
* **directory\(str\)**:  path to directory to grab files from

**Returns**

None

**Raises**

* if writing to bucket fails

## Bucket.keys\(self\) <a id="Bucket.keys"></a>

Lists all keys in the bucket.

**Returns**

List of strings

## Bucket.delete\(self, key\) <a id="Bucket.delete"></a>

Deletes a key from the bucket.

**Arguments**

* **key\(str\)**:  key to delete

**Returns**

None

**Raises**

* if delete fails

## Bucket.delete\_dir\(self, path\) <a id="Bucket.delete\_dir"></a>

Delete a directory and all of its contents from the bucket.

**Arguments**

* **path \(str\)**:  path to the directory to delete

## Bucket.ls\(self, path=None, recursive=False\) <a id="Bucket.ls"></a>

List data from the specified path.

**Arguments**

* **path \(str\)**:  bucket path to list
* **recursive \(bool\)**:  show subdirectories and their contents as well

**Returns**

`list`: Return value structure has not yet been permanently decided Currently, it's a `tuple` of `list` objects, containing the `following`: \(directory info, file/object info, delete markers\).

## Bucket.fetch\(self, key, path\) <a id="Bucket.fetch"></a>

Fetches file \(or files\) at `key` to `path`.

If `key` ends in '/', then all files with the prefix `key` will match and will be stored in a directory at `path`.

Otherwise, only one file will be fetched and it will be stored at `path`.

**Arguments**

* **key\(str\)**:  key in bucket to fetch
* **path\(str\)**:  path in local filesystem to store file or files fetched

**Returns**

None

**Raises**

* if path doesn't exist
* if download fails

## Bucket.select\(self, key, query, raw=False\) <a id="Bucket.select"></a>

Selects data from an S3 object.

**Arguments**

* **key\(str\)**:  key to query in bucket
* **query\(str\)**:  query to execute \(SQL by default\)
* **query\_type\(str\)**:  other query type accepted by S3 service
* **raw\(bool\)**:  return the raw \(but parsed\) response

**Returns**

`pandas.DataFrame`: results of query

