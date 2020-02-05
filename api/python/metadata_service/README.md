# Metadata Service Notes

## New .quilt layout

Full manifest:
```
$REGISTRY/.quilt/v2/manifests/usr=usr/pkg=pkg/hash_prefix=12/123456789abcdef.jsonl
```

Pointer file containing tophash of latest manifest
```
$REGISTRY/.quilt/v2/pointers/usr=usr/pkg=pkg/latest
```


## Table structures

The underlying technology is Athena. There are two views that can be queried:

1. Manifests themselves
    - `quilt_metadata_service_manifests`
    - How many versions are there of this package?
    - List all versions of this package.
    - Find all versions of this package created in the last two days
2. Entries in manifests  
    - `quilt_metadata_service_entries`
    - How many entries are there in this version of this package?
    - Calculate total size of all objects in this version of this package
    - Look at file type breakdown in this package

   __You may want to combine the two tables. This is a valuable but more expensive operation exposed via a third view:__

3. Entries along with which manifest they are in
    - `quilt_metadata_service_combined`
    - Which version of this package contain this s3 object+version?
    - What is the average number of keys across version of this package?

The underlying data is partitioned by `usr` and `pkg` and then by the first two characters of the manifest `tophash`.

## Usage

You can use the metadata tables in any way that you can consume Athena with the [`pyathena`](https://github.com/laughingman7743/PyAthena) library. We provide a couple utilities to make this easy.

1. Raw SQL
2. Structured SQL (convenience tool for writing raw SQL that automatically leverages partitioning to improve performance)
3. SQLAlchemy engine
4. The `pyathena.Connection` object is exposed, which is [Python DB API 2.0 (PEP 249)](https://www.python.org/dev/peps/pep-0249) compliant.

Between the SQLAlchemy engine and the DBAPI2.0 compliant connection, you will be able to query metadata from many other clients, for example `pandas.read_sql`.

### Raw SQL

```python
from quilt3 import MetadataQuery
rows = MetadataQuery(bucket='quilt-ml-data').raw_sql("""\
SELECT logical_key
   , physical_key
   , size
   , object_hash_type
   , object_hash
   , package
   , manifest_commit_message
   , hash
   , meta -- user defined metadata for each logical_key (work with meta using Presto JSON tools)
FROM "default"."quilt_metadata_service_combined" 
WHERE package='coco-train2017'
AND hash_prefix='ca' -- Leverage partitions to speed up the query if you want to query a specific manifest hash
AND hash='ca67d9dc4105d6fbaf3279c949a91f0e739063252cbfb9bc0ab64d315203e3a3'
LIMIT 100;
""").execute()
```

Presto JSON tools: https://prestodb.github.io/docs/current/functions/json.html

### Structured SQL

```python
from quilt3 import MetadataQuery
rows = MetadataQuery(
            bucket="quilt-ml-data",
            table="quilt_metadata_service_combined",
            package="coco-train2017", 
            tophash="ca67d9dc4105d6fbaf3279c949a91f0e739063252cbfb9bc0ab64d315203e3a3"
        ).select([
            "logical_key",
            "physical_key",
            "size",
            "object_hash_type",
            "object_hash",
            "package", # Package name
            "manifest_commit_message", 
            "hash" # manifest top hash
            "meta" # user defined metadata for each logical_key (work with meta using Presto JSON tools)
        ]).where([
            "'size' > 1000000"
        ]).limit(
            100
        ).execute()
```
Note `table`, `package` and `tophash` are optional, but if you pass one or more of them in, `MetadataQuery` can automatically leverage Athena partitioning to execute a more performant query.

##### Explore metadata

We provide some utilities that wrap Presto JSON operations as native Python code:

```python
meta = PrestoJsonSugar()
rows = MetadataQuery(
            bucket="quilt-ml-data",
            table="quilt_metadata_service_combined",
            package="coco-train2017", 
            tophash="ca67d9dc4105d6fbaf3279c949a91f0e739063252cbfb9bc0ab64d315203e3a3"
        ).select([
            "logical_key",
            meta["user_meta"]["coco_meta"]["annotation_info"]["category.names"].name_col_as("objects_in_image"),
            meta["user_meta"]["split"].name_col_as("split"),
            "package",
            "physical_key"
        ]).where([
            meta["user_meta"]["coco_meta"]["annotation_info"]["category.names"].contains('car'),
            meta["user_meta"]["split"] == 'train2017',
            meta["user_meta"]["filetype"].is_in(['jpg', 'png'])
        ]).execute()
```




### SQLAlchemy


```python
from quilt3 import MetadataQuery
from sqlalchemy.sql.schema import Table, MetaData
engine = MetadataQuery(bucket='quilt-ml-data').sqlalchemy_engine
table = Table('quilt_metadata_service_combined', MetaData(bind=engine), autoload=True)
results = table.select().limit(100).execute()
for row in results:
    print(row)
```

### pandas read_sql

```python
from quilt3 import MetadataQuery
import pandas as pd
df = pd.read_sql("""
SELECT logical_key
   , physical_key
   , size
   , object_hash_type
   , object_hash
   , package -- Package name
   , manifest_commit_message
   , hash -- manifest top hash
   , meta -- user defined metadata for each logical_key (work with meta using Presto JSON tools)
FROM "default"."quilt_metadata_service_combined" limit 10;
""", con=MetadataQuery(bucket='quilt-ml-data').pyathena_connection)
print(df.head())
```