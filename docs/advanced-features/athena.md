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

### Package Objects and Object-Level Metadata
The DDL below creates a view that contains package contents, including:
* logical_key
* physical_keys
* object hash
* object metadata

```sql
CREATE OR REPLACE VIEW "quilt_package_objects_{bucket}_view" AS
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
      "quilt_manifests_{bucket}" as manifest
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
FROM mv
JOIN
  "quilt_packages_{bucket}_view" as npv
ON
  npv."hash" = mv."tophash"
```