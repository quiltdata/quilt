# Querying package metadata with Athena
Quilt stores package data and metadata in S3. Metadata lives in a per-package manifest file
in a each bucket's `.quilt/` directory.

You can therefore query package metadata wth SQL engines like AWS Athena.
Users can write SQL queries to select packages (or files from within packages)
using predicates based on package or object-level metadata.

Packages can be created from the resulting tabular data.
To be able to create a package,
the table must contain the columns `logical_key`, `physical_keys` and `size` as shown below.
(See also [Mental Model](https://docs.quiltdata.com/mentalmodel))

## Defining package tables and views in Athena
The first step in configuring Athena to query the package contents and metadata
is to define a set of tables that represent the package metadata fields as columns.

### Manifests table
The following Athena DDL will build a table of all the manifests in a given bucket
(all package-level and object-level metadata). 

```sql
CREATE EXTERNAL TABLE `quilt_manifests_YOUR_BUCKET`(
  `logical_key` string, 
  `physical_keys` array<string>, 
  `size` string, 
  `hash` struct<type:string,value:string>, 
  `meta` string, 
  `user_meta` string, 
  `message` string, 
  `version` string)
ROW FORMAT SERDE 
  'org.openx.data.jsonserde.JsonSerDe' 
WITH SERDEPROPERTIES ( 
  'ignore.malformed.json'='true') 
STORED AS INPUTFORMAT 
  'org.apache.hadoop.mapred.TextInputFormat' 
OUTPUTFORMAT 
  'org.apache.hadoop.hive.ql.io.IgnoreKeyTextOutputFormat'
LOCATION
  's3://{bucket}/.quilt/packages'
TBLPROPERTIES (
  'has_encrypted_data'='false', 
  'transient_lastDdlTime'='1605312102')
```

### Package metadata table
Package names and top hashes are not stored in the manifests. Rather they are stored in pointer files in the `.quilt/named_packages` folder.
The following DDL creates a table from these pointer files to make package
top hashes available in Athena.

```sql
CREATE EXTERNAL TABLE `quilt_named_packages_YOUR_BUCKET`(
  `hash` string)
ROW FORMAT DELIMITED 
  FIELDS TERMINATED BY ',' STORED AS INPUTFORMAT 
  'org.apache.hadoop.mapred.TextInputFormat' 
OUTPUTFORMAT 
  'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
LOCATION
  's3://{bucket}/.quilt/named_packages'
TBLPROPERTIES (
  'has_encrypted_data'='false', 
  'transient_lastDdlTime'='1557626200')
```

### View of package-level metadata
The DDL below creates a view that contains package-level information including: 
* User
* Package name
* Tophash
* Timestamp
* Commit message

```sql
CREATE OR REPLACE VIEW "quilt_packages_{bucket}_view" AS
WITH
  npv AS (
    SELECT
      regexp_extract("$path", '^s3:\/\/([^\\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)', 4) as user,
      regexp_extract("$path", '^s3:\/\/([^\\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)', 5) as name,
      regexp_extract("$path", '[^/]+$') as timestamp,
      "quilt_named_packages_{bucket}"."hash"
      FROM "quilt_named_packages_{bucket}"
  ),
  mv AS (
    SELECT
      regexp_extract("$path", '[^/]+$') as tophash,
        manifest."meta",
        manifest."message"
      FROM
        "quilt_manifests_{bucket}" as manifest
      WHERE manifest."logical_key" IS NULL
  )
SELECT
  npv."user",
  npv."name",
  npv."hash",
  npv."timestamp",
  mv."message",
  mv."meta"
FROM npv
JOIN
  mv
ON
  npv."hash" = mv."tophash" 
```

### View of object-Level metadata
The DDL below creates a view that contains package contents, including:
* logical_key
* physical_keys
* object hash
* object metadata

```sql
CREATE OR REPLACE VIEW "quilt_package_objects_YOUR_BUCKET_view" AS
WITH
  mv AS (
    SELECT
      regexp_extract("$path", '[^/]+$') as tophash,
      manifest."logical_key",
      manifest."physical_keys",
      manifest."size",
      manifest."hash",
      manifest."meta",
      manifest."user_meta"
    FROM
      "quilt_manifests_YOUR_BUCKET" as manifest
    WHERE manifest."logical_key" IS NOT NULL
  )
SELECT
  npv."user",
  npv."name",
  npv."timestamp",
  mv."tophash",
  mv."logical_key",
  mv."physical_keys",
  mv."hash",
  mv."meta",
  mv."user_meta"
  mv."size"
FROM mv
JOIN
  "quilt_packages_{bucket}_view" as npv
ON
  npv."hash" = mv."tophash"
```

## Example: query package-level metadata

Suppose we wish to find all .tiff files produced by algorithm version 1.3
with a cell index of 5.

```sql
SELECT * FROM  "quilt_package_objects_YOUR_BUCKET_view"
WHERE substr(logical_key, -5)='.tiff'
-- extract and query package-level metadata
AND json_extract_scalar(meta, '$.user_meta.nucmembsegmentationalgorithmversion') LIKE '1.3%'
AND json_array_contains(json_extract(meta, '$.user_meta.cellindex'), '5');
```
