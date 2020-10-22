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
# returns a list of objects in the bucket
b.keys()
```

## Reading from a bucket

To download a file or folder from a bucket use `fetch`:


```python
# b.fetch("path/to/directory", "path/to/local")
b.fetch("aleksey/hurdat/", "./aleksey/")
b.fetch("README.md", "./read.md")
```

    100%|██████████| 4.07M/4.07M [00:13<00:00, 304kB/s]   
    100%|██████████| 1.55k/1.55k [00:01<00:00, 972B/s]


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




    <QuiltConfig at '/Users/gregezema/Library/Application Support/Quilt/config.yml' {
        "navigator_url": "https://open.quiltdata.com",
        "default_local_registry": "file:///Users/gregezema/Library/Application%20Support/Quilt/packages",
        "default_remote_registry": null,
        "default_install_location": null,
        "registryUrl": "https://open-registry.quiltdata.com",
        "telemetry_disabled": false,
        "s3Proxy": "https://open-s3-proxy.quiltdata.com",
        "apiGatewayEndpoint": "https://sttuv8u2u4.execute-api.us-east-1.amazonaws.com/prod",
        "binaryApiGatewayEndpoint": "https://ap8tbn363c.execute-api.us-east-1.amazonaws.com/prod",
        "default_registry_version": 1
    }>



Quilt supports unstructured search:


```python
# returns all files containing the word "thor"
b.search("thor")
```




    {'took': 16,
     'timed_out': False,
     '_shards': {'total': 5, 'successful': 5, 'skipped': 0, 'failed': 0},
     'hits': {'total': 10,
      'max_score': 5.5741544,
      'hits': [{'_index': 'quilt-example-reindex-v8bc2377',
        '_type': '_doc',
        '_id': 'dima/node_modules2/highlight.js/README.md:KOGAC2bPIY9o7vQ3d3ryrD04VpGPmaH2',
        '_score': 5.5741544,
        '_source': {'size': 19316,
         'comment': '',
         'version_id': 'KOGAC2bPIY9o7vQ3d3ryrD04VpGPmaH2',
         'last_modified': '2019-12-12T01:33:15+00:00',
         'updated': '2019-12-12T01:33:15.209387',
         'key': 'dima/node_modules2/highlight.js/README.md'}},
       {'_index': 'quilt-example-reindex-v8bc2377',
        '_type': '_doc',
        '_id': 'akarve/amazon-reviews/camera-reviews.parquet:yoLoCR6tdnqE141f5F4EvbFbn2J12AJt',
        '_score': 0.080087036,
        '_source': {'user_meta': {},
         'size': 100764599,
         'comment': '',
         'version_id': 'yoLoCR6tdnqE141f5F4EvbFbn2J12AJt',
         'last_modified': '2019-10-08T02:53:01+00:00',
         'updated': '2019-10-08T02:53:31.040985',
         'key': 'akarve/amazon-reviews/camera-reviews.parquet'}}]}}



As well as structured search on metadata (note that this feature is experimental):


```python
# returns all files annotated {'name': 'thor'}
b.search("user_meta.name:'thor'")
```




    {'took': 0,
     'timed_out': False,
     '_shards': {'total': 5, 'successful': 5, 'skipped': 0, 'failed': 0},
     'hits': {'total': 0, 'max_score': None, 'hits': []}}


