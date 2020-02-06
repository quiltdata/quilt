# Metadata Service Notes

## New .quilt layout

Full manifest:
```
$REGISTRY/.quilt/v2/manifests/usr=usr/pkg=pkg/hash_prefix=12/123456789abcdef.jsonl
```

Pointer file containing tophash of latest manifest. 
```
$REGISTRY/.quilt/v2/pointers/usr=usr/pkg=pkg/latest
```

This can be expanded to support tags other than `latest`.

## User-facing API

There are three main APIs for interacting with metadata. If a user is using the new `.quilt` layout in the registry `s3://armand-dotquilt-dev`, to start using metadata service, a user needs to run:

```
metadata_service.setup("armand-dotquilt-dev")
```

This will create the Athena table/view and recover partitions. By default, we use the Glue database `default`, but that can be changed via the `db_name` argument. `setup()` check if the database and tables already exist and does nothing except recover partitions if they do.

You can then run a SQL query via:

```
col_headers, rows = metadata_service.query("SELECT * FROM defaut.metadata_service_armand_dotquilt_dev LIMIT 10", "armand-dotquilt-dev")
``` 

Using verbose=True in the above command will pretty print the results as a table.

Due to the partitioning, new manifests will not be picked up by the query until the partitions are loaded into the metastore. This can be done via:

```metadata_service.recover_partitions(bucket)```


### Naming
If a user is using the registry `s3://armand-dotquilt-dev`, a table `quilt_manifests_armand_dotquilt_dev` and a view `quilt_metadata_service_armand_dotquilt_dev` will be created (see `metadata_service.py`, `table_name()`/`view_name()`).

Note: Metadata service currently only works for users who use the default registry path, i.e. `s3://my-bucket/.quilt/`. This could be changed by changing the create table SQL statement, but there would be Athena table naming conflicts if you have two registries in the same bucket (i.e. `s3://my-bucket/.quilt/` and `s3//my-bucket/custom/path/.quilt/` would require two different Athena tables, but metadata service would try to give them both the name `quilt_metadata_service_my_bucket`).

### Boto3
Currently, metadata service uses boto3 in the simplest way (see `athena.py`, `get_glue_client()`/`get_athena_client()`). 

### SQL syntactic sugar

WIP. See `presto_sql.py`

## Athena
## Table/view structures

CURRENT STATUS NOTE: Only the third view discussed below is currently available, but the other two would be easy to add. Adding them would improve performance, but would not add any missing functionality.
 
The underlying technology is Athena. There are two views that can be queried:

1. Manifests themselves
    - How many versions are there of this package?
    - List all versions of this package.
    - Find all versions of this package created in the last two days
2. Entries in manifests  
    - How many entries are there in this version of this package?
    - Calculate total size of all objects in this version of this package
    - Look at file type breakdown in this package

   __You may want to combine the two views. This is a valuable but more expensive operation exposed via a third view:__

3. Entries along with which manifest they are in
    - Which version of this package contain this s3 object+version?
    - What is the average number of keys across version of this package?

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
rows = MetadataQuery(bucket='armand-dotquilt-dev').raw_sql("""\
SELECT logical_key
   , physical_key
   , size
   , object_hash_type
   , object_hash
   , package
   , manifest_commit_message
   , hash
   , meta -- user defined metadata for each logical_key (work with meta using Presto JSON tools)
FROM "default"."quilt_metadata_service_armand_dotquilt_dev" 
WHERE package='test/glue'
AND hash_prefix='1a' -- Leverage partitions to speed up the query if you want to query a specific manifest hash
AND hash='1a527eccc30d9a775e3c06031190a76de7263047543b31c5d8136273ba793476'
LIMIT 100;
""").execute()
```

Presto JSON tools: https://prestodb.github.io/docs/current/functions/json.html

### Structured SQL

```python
from quilt3 import MetadataQuery
rows = MetadataQuery(
            bucket="armand-dotquilt-dev",
            package="test/glue", 
            tophash="1a527eccc30d9a775e3c06031190a76de7263047543b31c5d8136273ba793476"
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
engine = MetadataQuery(bucket='armand_dotquilt_dev').sqlalchemy_engine
table = Table('quilt_metadata_service_armand_dotquilt_dev', MetaData(bind=engine), autoload=True)
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