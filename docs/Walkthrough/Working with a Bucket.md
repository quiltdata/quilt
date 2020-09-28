Quilt allows you to create, read, and write packages both on your local filesystem and on S3 buckets configured to work with Quilt3. For convenience, we provide a simple API for working with S3 buckets that serves as an alternative to [boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html).

## Connecting to a bucket

To connect to an S3 `Bucket`:


```python
import quilt3
b = quilt3.Bucket("s3://quilt-example")
```

This requires that the bucket is configured to work with Quilt 3. Unless this bucket is public, you will also first need to log into the catalog that controls this bucket:


```python
# only need to run this once
# ie quilt3.config('https://your-catalog-homepage/')
quilt3.config('https://open.quiltdata.com/')

# follow the instructions to finish login
quilt3.login()
```

## Introspecting a bucket

To see the contents of a `Bucket`, use `keys`:


```python
b.keys()
# [...a list of objects in the bucket...]
```

## Reading from a bucket

To download a file or folder from a bucket use `fetch`:


```python
# b.fetch("path/to/directory", "path/to/local")
b.fetch("aleksey/hurdat/", "./aleksey/")
b.fetch("README.md", "./read.md")
```

## Writing to a bucket

You can write data to a bucket.


```python
# put a file to a bucket
b.put_file("read.md", "./read.md")

# or put everything in a directory at once
b.put_dir("stuff", "./aleksey")
```

Note that `set` operations on a `Package` are `put` operations on a `Bucket`.

## Deleting objects in a bucket


```python
# always be careful when deleting

# delete a fle
b.delete("read.md")

# delete a directory
b.delete_dir("stuff/")
```

## Searching in a bucket

You can search for individual objects using `search`.

Note that this feature is currently only supported for buckets backed by a Quilt catalog instance. Before performing a search you must first configure a connection to that instance using `quilt3.config`.


```python
# for example
quilt3.config(navigator_url="https://open.quiltdata.com")
```

Quilt supports unstructured search:


```python
b.search("thor")
# ...all files containing the word "thor"...
```

As well as structured search on metadata (note that this feature is experimental):


```python
b.search("user_meta.name:'thor'")
# ...all files annotated {'name': 'thor'}...
```
