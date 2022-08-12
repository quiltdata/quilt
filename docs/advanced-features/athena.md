# Querying package metadata with Athena
Quilt stores package data and metadata in S3. Metadata lives in a per-package manifest file
in a each bucket's `.quilt/` directory.


You can therefore query package metadata wth SQL engines like AWS Athena.
Users can write SQL queries to select packages (or files from within packages)
using predicates based on package or object-level metadata.

## Prerequisites: Athena setup

To get enable Athena, you need to set up a role with policy allowing Athena.
Steps required to do this:

1. Create Athena policy.
Go to [console.aws.amazon.com/iam](https://console.aws.amazon.com/iam), and create new policy with this JSON.
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "athena:*"
            ],
            "Resource": [
                "*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "glue:CreateDatabase",
                "glue:DeleteDatabase",
                "glue:GetDatabase",
                "glue:GetDatabases",
                "glue:UpdateDatabase",
                "glue:CreateTable",
                "glue:DeleteTable",
                "glue:BatchDeleteTable",
                "glue:UpdateTable",
                "glue:GetTable",
                "glue:GetTables",
                "glue:BatchCreatePartition",
                "glue:CreatePartition",
                "glue:DeletePartition",
                "glue:BatchDeletePartition",
                "glue:UpdatePartition",
                "glue:GetPartition",
                "glue:GetPartitions",
                "glue:BatchGetPartition"
            ],
            "Resource": [
                "*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetBucketLocation",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:ListBucketMultipartUploads",
                "s3:ListMultipartUploadParts",
                "s3:AbortMultipartUpload",
                "s3:CreateBucket",
                "s3:PutObject",
                "s3:PutBucketPublicAccessBlock"
            ],
            "Resource": [
                "arn:aws:s3:::aws-athena-query-results-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::athena-examples*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket",
                "s3:GetBucketLocation",
                "s3:ListAllMyBuckets"
            ],
            "Resource": [
                "*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "sns:ListTopics",
                "sns:GetTopicAttributes"
            ],
            "Resource": [
                "*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudwatch:PutMetricAlarm",
                "cloudwatch:DescribeAlarms",
                "cloudwatch:DeleteAlarms"
            ],
            "Resource": [
                "*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "lakeformation:GetDataAccess"
            ],
            "Resource": [
                "*"
            ]
        }
    ]
}
```
2. Attach this policy to your CloudFormation stack.
Go to the [CloudFormation console](https://console.aws.amazon.com/cloudformation), select stack, click "Update", and fill ARN to "ManagedUserRoleExtraPolicies" field.
3. Add "un-managed" Athena policy to Quilt catalog.
Go to https://your-quilt-stack/admin, scroll to "Policies", click on "+" button. Click "Manually set ARN" and enter ARN of Athena policy.
4. Attach policy to an existing Quilt role, or create a new role and attach policy to it.

See [Users and roles](../Catalog/Admin.md) for detailed overview on access control management in Quilt.

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
SELECT * FROM  "quilt_package_objects_YOUR_BUCKET_view" AS
WHERE substr(logical_key, -5)='.tiff'
-- extract and query package-level metadata
AND json_extract_scalar(meta, '$.user_meta.nucmembsegmentationalgorithmversion') LIKE '1.3%'
AND json_array_contains(json_extract(meta, '$.user_meta.cellindex'), '5');
```
