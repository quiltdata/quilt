Quilt allows you to create, read, and write packages both on your local filesystem and on S3 buckets configured to work with Quilt3. For convenience, we provide a simple API for working with S3 buckets that serves as an alternative to [boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html).

## Connecting to a bucket

To connect to an S3 `Bucket`:

```python
b = quilt3.Bucket("s3://my-bucket")
```

This requires that the bucket is configured to work with Quilt3.

## Introspecting a bucket

To see the contents of a `Bucket`, use `keys`:

```bash
$ python
>>> b.keys()
<<< [...a list of objects in the bucket...]
```

## Reading from a bucket

To download a file or folder from a bucket use `fetch`:

```python
b.fetch("path/to/directory", "path/to/local")
b.fetch("path/to/file", "path/to/local")
```

To read a file or folder out of a bucket directly into memory use `deserialize`:

```python
obj = b.deserialize("path/to/file")
obj = b("path/to/file")  # sugar
```

To read the metadata on an object, use `get_meta`:

```python
meta = b.get_meta("path/to/file")
```

## Writing to a bucket

You can write data to a bucket.

```python
# put a file to a bucket
b.put_file("foo.csv", "/path/to/local/disk/foo.csv", meta={"foo": "bar"})

# put an in-memory object to a bucket
b.put("my-dict.json", {"a": "b"}, meta={"how": "lazily"})

# or put everything in a directory at once
b.put_dir("stuff", "/path/to/folder/with/stuff/", meta={"origin": "unknown"})
```

Note that `set` operations on a `Package` are `put` operations on a `Bucket`.

## Deleting objects in a bucket

```python
# always be careful when deleting

# delete a fle
b.delete("foo.csv")

# delete a directory
b.delete_dir("foo/")
```

## Searching in a bucket

You can search for individual objects using `search`.

Note that this feature is currently only supported for buckets backed by a Quilt catalog instance. Before performing a search you must first configure a connection to that instance using `quilt3.config`.

```python
# for example
quilt3.config(navigator_url="https://allencell.quiltdata.com")
```

Quilt supports unstructured search:

```bash
$ python
>>> b.search("thor")
<<< ...all files containing the word "thor"...
```

As well as structured search on metadata (note that this feature is experimental):

```bash
$ python
>>> b.search("user_meta.name:'thor'")
<<< ...all files annotated {'name': 'thor'}...
```
