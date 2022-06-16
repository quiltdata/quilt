# Querying Package Metadata with AWS Athena
Quilt stores package data and metadata together in S3. That makes the metadata and package specifications available for querying and analysis through Query-in-place SQL engines like AWS Athena. Users can write SQL queries to select packages (or files from within packages) using predicates based on package or object-level metadata.

## Defining Package Tables and Views in Athena
The first step in configuring Athena to query the package contents and metadata is to define a set of tables that represent the package information, including the various columns and how they map onto the manifest files that contain the package definitions in Quilt.

### Manifests Table
In Quilt, each package's contents and metadata are stored in a manifest file in S3. The following Athena DDL will build a table of all the manifests (all packages' contents and metadata). 

```sql
CREATE EXTERNAL TABLE `quilt_manifests_{bucket}`(
  `logical_key` string COMMENT 'from deserializer', 
  `physical_keys` array<string> COMMENT 'from deserializer', 
  `size` string COMMENT 'from deserializer', 
  `hash` struct<type:string,value:string> COMMENT 'from deserializer', 
  `meta` string COMMENT 'from deserializer', 
  `user_meta` string COMMENT 'from deserializer', 
  `message` string COMMENT 'from deserializer', 
  `version` string COMMENT 'from deserializer')
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

### Package Pointers Table
Package names and top hashes are not stored in the manifests. Instead, they're recorded in pointer files in the `.quilt/named_packages` folder in the bucket. The following DDL creates a table from these pointer files to make the package top hashes available in Athena as well.

```sql
CREATE EXTERNAL TABLE `quilt_named_packages_{bucket}`(
  `hash` string)
ROW FORMAT DELIMITED 
  FIELDS TERMINATED BY ',' 
STORED AS INPUTFORMAT 
  'org.apache.hadoop.mapred.TextInputFormat' 
OUTPUTFORMAT 
  'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
LOCATION
  's3://{bucket}/.quilt/named_packages'
TBLPROPERTIES (
  'has_encrypted_data'='false', 
  'transient_lastDdlTime'='1557626200')
  ```

### Package-Level Metadata
To reference package names, which are recorded in the pointer file paths, create a view using the DDL below. The `user` and `name` fields are extracted separately into their own columns.

```sql
CREATE VIEW "quilt_named_packages_{bucket}_view" AS SELECT
"$path" as path,
regexp_extract("$path", '^s3:\/\/([^\\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)', 4) as user,
regexp_extract("$path", '^s3:\/\/([^\\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)', 5) as name,
regexp_extract("$path", '[^/]+$') as timestamp,
"{prefix}_{bucket}"."hash"
FROM "named_packages_{bucket}"
```

The following DDL creates a view to query the package-level metadata (associated with whole packages rather than individual files).

```sql
CREATE VIEW "quilt_manifests_{bucket}_view" AS
SELECT
  regexp_extract("$path", '[^/]+$') as tophash,
  manifests."message"
FROM "quilt_manifests_{bucket}" as manifests
WHERE manifests."logical_key" IS NULL
```

Joining the two views above produces a complete picture of the package-level metadata.

```sql
SELECT
  npv."user",
  npv."name",
  npv."timestamp",
  mv."tophash",
  mv."message"
FROM "quilt_named_packages_{bucket}" as npv
JOIN "quilt_manifests_{bucket}_view" as mv
ON npv."hash" = mv."tophash"
```