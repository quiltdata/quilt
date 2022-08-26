# Querying package metadata with Athena
Quilt stores package data and metadata in S3. Metadata lives in a per-package manifest file
in each bucket's `.quilt/` directory.

You can therefore query package metadata wth SQL engines like [AWS Athena](https://aws.amazon.com/athena/).
Users can write SQL queries to select packages (or files from within packages)
using predicates based on package or object-level metadata.

Packages can be created from the resulting tabular data. 
To be able to create a package,
the table must contain the columns `logical_key`, `physical_keys` and `size` as shown below.
(See also [Mental Model](https://docs.quiltdata.com/mentalmodel))


## Note: Executing Documentation Code  
If you launch Jupyter from a shell containing your AWS credentials, you can edit and execute code directly from the [notebook version](https://github.com/quiltdata/quilt/blob/master/docs/advanced-features/athena.ipynb) of this document.
You can alternatively copy and paste code blocks into your Python editor.
<!--pytest.mark.skip-->


```python
%%capture
%pip install boto3
```

You should set COMPANY_NAME and QUILT_BUCKET so the examples work in your enviornment


```python
COMPANY_NAME = "yourcompany"
QUILT_BUCKET = "quilt-ernest-staging"  # Use one of your own, without the S3 URL prefix
```

This allows you to configure AWS services by calling Python objects:
<!--pytest-codeblocks:cont-->


```python
import boto3, json, pprint, re, time


def stat(response, label="response"):
    print(label + ": ", end="")
    print(response["ResponseMetadata"]["HTTPStatusCode"])


SESSION = boto3.session.Session()
REGION = SESSION.region_name
print(SESSION)

ATHENA = SESSION.client("athena", region_name=REGION)
IAM = SESSION.resource("iam")
S3 = SESSION.client("s3")
STS = SESSION.client("sts")
ACCOUNT_ID = STS.get_caller_identity()["Account"]

ARN_POLICY = f"arn:aws:iam::{ACCOUNT_ID}:policy/AthenaQuiltAccess"
```

    Session(region_name='us-east-1')


## I. Create Athena Configuration: Workgroup, Bucket, and Database

Quilt expects a dedicated bucket for the output from Athena queries, which is best to setup in its own workgroup and database:

1. Create the output Bucket `<yourcompany>-quilt-query-results`
2. Create a `quilt-query` workgroup that uses that Bucket
3. Create a `quilt_query` Athena Database for that Workgroup

Later we will explicitly grant Quilt access to that Bucket.
<!--pytest-codeblocks:cont-->


```python
ATHENA_DB = "quilt_query"
ATHENA_WORKGROUP = ATHENA_DB.replace("_", "-")
ATHENA_BUCKET = f"{COMPANY_NAME}-{ATHENA_WORKGROUP}-results"
ATHENA_URL = "s3://" + ATHENA_BUCKET
QUILT_URL = "s3://" + QUILT_BUCKET  # Adds S3 Prefix

ARN_ATHENA = f"arn:aws:s3:::{ATHENA_BUCKET}"
ARN_CATALOG = f"arn:aws:glue:{REGION}:{ACCOUNT_ID}:catalog"
ARN_DATACATALOG = f"arn:aws:glue:{REGION}:{ACCOUNT_ID}:datacatalog/*"
ARN_DATABASE = f"arn:aws:glue:{REGION}:{ACCOUNT_ID}:database/{ATHENA_DB}"
ARN_TABLE = f"arn:aws:glue:{REGION}:{ACCOUNT_ID}:table/{ATHENA_DB}"
ARN_QUILT = f"arn:aws:s3:::{QUILT_BUCKET}"
ARN_WORKGROUP = f"arn:aws:athena:{REGION}:{ACCOUNT_ID}:workgroup/{ATHENA_WORKGROUP}"

# Create bucket in default region

bucket = (
    S3.create_bucket(Bucket=ATHENA_BUCKET)
    if REGION == "us-east-1"
    else S3.create_bucket(Bucket=ATHENA_BUCKET, CreateBucketConfiguration=location)
)
stat(bucket, ATHENA_BUCKET)
# print(bucket)

# Create Workgroup which outputs to that Bucket (if needed)

wg_list = ATHENA.list_work_groups()
wg_names = [wg["Name"] for wg in wg_list["WorkGroups"]]

if ATHENA_WORKGROUP not in wg_names:
    wg_create = ATHENA.create_work_group(
        Name=ATHENA_WORKGROUP, Description="Quilt uses this for Athena SQL Queries"
    )
    stat(wg_create)

# Configure Workgroup to use that Bucket
wg_update = ATHENA.update_work_group(
    WorkGroup=ATHENA_WORKGROUP,
    ConfigurationUpdates={
        "ResultConfigurationUpdates": {
            "OutputLocation": ATHENA_URL,
        },
    },
)
stat(wg_update, "wg_update")

# Create new GLUE Database

db_create = ATHENA.start_query_execution(
    QueryString=f"create database {ATHENA_DB}",
    ResultConfiguration={"OutputLocation": ATHENA_URL + "/queries/"},
)
stat(db_create, "db_create")
print(ATHENA_URL)
# print(ARN_DATABASE)
```

    yourcompany-quilt-query-results: 200
    wg_update: 200
    db_create: 200
    s3://yourcompany-quilt-query-results


## II. Granting Access to Athena

By default, Quilt runs with very conservative permissions that do not allow access to [Amazon Athena](https://docs.aws.amazon.com/athena/latest/ug/what-is.html). To enable Athena SQL queries by your Quilt users, you must:

### A. Create a new Athena policy.

The standard [AmazonAthenaFullAccess](https://console.aws.amazon.com/iam/home#/policies/arn:aws:iam::aws:policy/AmazonAthenaFullAccess) policy is more permissive than necessary.  For production usage, we recommend creating a policy limited to only the above Bucket:
<!--pytest-codeblocks:cont-->


```python
# https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/iam.html#IAM.ServiceResource.create_policy
# https://docs.aws.amazon.com/athena/latest/ug/workgroups-access.html

AthenaQuiltAccess = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "GrantQuiltAthenaFullAccess",
            "Effect": "Allow",
            "Action": "athena:ListWorkGroups",
            "Resource": "*",
        },
        {
            "Sid": "GrantQuiltAthenaAccess",
            "Effect": "Allow",
            "Action": [
                "athena:Create*",
                "athena:Get*",
                "athena:ListDatabases",
                "athena:ListNamedQueries",
                "athena:ListPreparedStatements",
                "athena:ListQueryExecutions",
                "athena:StartQueryExecution",
            ],
            "Resource": [ARN_CATALOG, ARN_DATACATALOG, ARN_WORKGROUP],
        },
        {
            "Sid": "GrantQuiltGlueAccess",
            "Effect": "Allow",
            "Action": [
                "glue:GetDatabase",
                "glue:GetDatabases",
                "glue:GetTable",
                "glue:GetTables",
            ],
            "Resource": "*",
        },
        {
            "Sid": "GrantQuiltGlueWriteAccess",
            "Effect": "Allow",
            "Action": ["glue:CreateTable", "glue:DeleteTable", "glue:UpdateTable"],
            "Resource": [ARN_CATALOG, ARN_DATABASE, f"{ARN_TABLE}/*_quilt_*"],
        },
        {
            "Sid": "GrantQuiltAthenaBucketAccess",
            "Effect": "Allow",
            "Action": [
                "s3:GetBucketLocation",
                "s3:ListBucket",
                "s3:ListBucketMultipartUploads",
                "s3:ListMultipartUploadParts",
            ],
            "Resource": "*",
        },
        {
            "Sid": "GrantQuiltAthenaOutputAccess",
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
                "s3:PutBucketPublicAccessBlock",
            ],
            "Resource": [ARN_ATHENA, f"{ARN_ATHENA}/*"],
        },
    ],
}
# print(AthenaQuiltAccess)
```

If you have used that policy before, you should detatch and delete it before creating a new one:
<!--pytest-codeblocks:cont-->


```python
def delete_policy():
    try:
        old_policy = IAM.Policy(ARN_POLICY)
        for role in old_policy.attached_roles.all():
            # print(role)
            old_policy.detach_role(RoleName=role.role_name)
        old_policy.delete()
    except BaseException as err:
        print(f"Policy not found: {ARN_POLICY}")
        print(err)


# delete_policy()
policy = IAM.create_policy(
    PolicyName="AthenaQuiltAccess",
    PolicyDocument=json.dumps(AthenaQuiltAccess),
    Description="Minimal Athena Access policy for Quilt",
)
# print(policy)
```

### B. Add this policy to your CloudFormation stack.
 
This needs to be done manually by your AWS Administrator:

1. Go to the [CloudFormation console](https://console.aws.amazon.com/cloudformation)
2. Select the Quilt stack
3. Click "Update"
4. Select "Use current template" and click "Next"
5. Add the above ARN to the "ManagedUserRoleExtraPolicies" field
6. Click "Next" (possibly twice) to configure stack options
7. Check "I acknowledge that AWS CloudFormation might create IAM resources with custom names"
5. Click "Update stack" to save changes

### C. Add this Policy to Quilt and relevant Roles

You must have already created a `Source=Quilt` role in order to be able to add policies.See 'Extending built-in roles' in the [Users and roles](../Catalog/Admin.md) documentation for how to create a new role with access to all registered buckets, as the built-in Source=Custom roles have.
1. Login to your Quilt instance at, e.g. https://quilt.yourcompany.com
2. Click on "Admin Settings" in the upper right, under your Profile name
3. Scroll down to the "Policies" section on the bottom
4. Click on the "+" to create a new Policy
5. Set Title to "AthenaQuiltAccess"
6. Check "Manually set ARN" and enter ARN of Athena policy (from above)
7. Click "No associated roles. Attach current policy to roles…" and select the appropriate role(s)
8. Click "Create"

<!--pytest-codeblocks:cont-->

## III. Defining Per-Bucket Metadata Tables in Athena

For each Bucket you want to query with Athena, you need to create proxy tables and views for that package contents and metadata.  You can also create custom views that join across many such tables.

<!--pytest-codeblocks:cont-->


```python
BUCKET_ID = QUILT_BUCKET.replace("-", "_")
MANIFEST_TABLE = f"{BUCKET_ID}_quilt_manifests"
PACKAGES_TABLE = f"{BUCKET_ID}_quilt_packages"
PACKAGES_VIEW = f"{BUCKET_ID}_quilt_packages_view"
OBJECTS_VIEW = f"{BUCKET_ID}_quilt_objects_view"

DDL = {}
```

### A. Manifests table
The following Athena DDL will build a table of all the manifests in that bucket
(all package-level and object-level metadata).
<!--pytest-codeblocks:cont-->


```python
DDL[
    MANIFEST_TABLE
] = f"""
CREATE EXTERNAL TABLE `{ATHENA_DB}.{MANIFEST_TABLE}`(
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
  '{QUILT_URL}/.quilt/packages'
TBLPROPERTIES ('has_encrypted_data'='false');
"""
```

### B. Package metadata table
Package names and top hashes are not stored in the manifests. Rather they are stored in pointer files in the `.quilt/named_packages` folder.
The following DDL creates a table from these pointer files to make package
top hashes available in Athena.
<!--pytest-codeblocks:cont-->


```python
DDL[
    PACKAGES_TABLE
] = f"""
CREATE EXTERNAL TABLE `{ATHENA_DB}.{PACKAGES_TABLE}`(
  `hash` string)
ROW FORMAT DELIMITED
  FIELDS TERMINATED BY ',' STORED AS INPUTFORMAT
  'org.apache.hadoop.mapred.TextInputFormat'
OUTPUTFORMAT
  'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
LOCATION
  '{QUILT_URL}/.quilt/named_packages'
TBLPROPERTIES (
  'has_encrypted_data'='false',
  'transient_lastDdlTime'='1557626200');
"""
```

### C. View of package-level metadata
The DDL below creates a view that contains package-level information including: 
* User
* Package name
* Top hash
* Timestamp
* Commit message
<!--pytest-codeblocks:cont-->


```python
SLASH = r"\/([^\/]+)"
S1 = r"\/"
S3_MATCH = f"^s3:{S1}{SLASH}{SLASH}{SLASH}{SLASH}"
DDL[
    PACKAGES_VIEW
] = f"""
CREATE VIEW {ATHENA_DB}.{PACKAGES_VIEW} AS
WITH
  npv AS (
    SELECT
      regexp_extract("$path", '{S3_MATCH}', 4) as user,
      regexp_extract("$path", '{S3_MATCH}{SLASH}', 5) as name,
      regexp_extract("$path", '[^/]+$') as timestamp,
      {ATHENA_DB}.{PACKAGES_TABLE}."hash"
      FROM {ATHENA_DB}.{PACKAGES_TABLE}
  ),
  mv AS (
    SELECT
      regexp_extract("$path", '[^/]+$') as tophash,
        manifest."meta",
        manifest."message"
      FROM
        {ATHENA_DB}.{MANIFEST_TABLE} as manifest
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
  npv."hash" = mv."tophash";
"""
```

### D. View of object-Level metadata
The DDL below creates a view that contains package contents, including:
* logical key
* physical key
* object hash
* object metadata
<!--pytest-codeblocks:cont-->


```python
DDL[
    OBJECTS_VIEW
] = f"""
CREATE VIEW {ATHENA_DB}.{OBJECTS_VIEW} AS
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
      {ATHENA_DB}.{MANIFEST_TABLE} as manifest
    WHERE manifest."logical_key" IS NOT NULL
  )
SELECT
  npv."user",
  npv."name",
  npv."timestamp",
  mv."tophash",
  mv."logical_key",
  mv."physical_keys",
  mv."size",
  mv."hash",
  mv."meta",
  mv."user_meta"
FROM mv
JOIN
  {ATHENA_DB}.{PACKAGES_VIEW} as npv
ON
  npv."hash" = mv."tophash";
"""
```

## IV. Calling Athena

The best way to test this is to create a new Session using a profile with that role (note that it may take a minute for the new Policy to propagate). For example:
<!--pytest-codeblocks:cont-->


```python
print(boto3.session.Session().available_profiles)
# new_session = boto3.session.Session(profile_name='quilt')
# ATHENA = new_session.client("athena", region_name=REGION)
```

    ['default', 'quilt', 'managed', 'aneesh', 'ernest']



In order to call Athena, you must submit a query then wait for it to complete
<!--pytest-codeblocks:cont-->


```python
# https://www.ilkkapeltola.fi/2018/04/simple-way-to-query-amazon-athena-in.html
QUERY_ID = "QueryExecutionId"
TAIL_PATH = re.compile(r".*\/(.*)")


def athena_await(resp, max_execution=10):
    id = resp[QUERY_ID]
    state = "QUEUED"
    while max_execution > 0 and state in ["RUNNING", "QUEUED"]:
        max_execution = max_execution - 1
        response = ATHENA.get_query_execution(QueryExecutionId=id)
        if (
            "QueryExecution" in response
            and "Status" in response["QueryExecution"]
            and "State" in response["QueryExecution"]["Status"]
        ):
            status = response["QueryExecution"]["Status"]
            state = status["State"]
            print(f"\t#{max_execution} athena_await[{id}]={state}")

            if state == "FAILED":
                print(status)
                return False
            elif state == "SUCCEEDED":
                s3_path = response["QueryExecution"]["ResultConfiguration"][
                    "OutputLocation"
                ]
                print(f"athena_await[{id}].s3_path:", s3_path)
                filename = TAIL_PATH.findall(s3_path)[0]
                return filename
        time.sleep(1)

    return False


def athena_results(resp):
    id = resp[QUERY_ID]
    raw = ATHENA.get_query_results(QueryExecutionId=id)
    if raw.get("ResponseMetadata", {}).get(
        "HTTPStatusCode"
    ) == 200 and "Rows" in raw.get("ResultSet", {}):
        data = [x["Data"] for x in raw["ResultSet"]["Rows"]]
        if data and len(data) > 0:
            cols = [d.get("VarCharValue") for d in data[0]]
            rows = [[d.get("VarCharValue") for d in row] for row in data[1:]]
            return (cols, rows)
        else:
            return raw["ResultSet"]
    else:
        return f"Query {id} in progress..."


def athena_run(query):
    resp = ATHENA.start_query_execution(
        WorkGroup=ATHENA_WORKGROUP,
        QueryString=query,
        ResultConfiguration={"OutputLocation": ATHENA_URL},
    )
    success = athena_await(resp)
    print("\tathena_await", success)
    return athena_results(resp) if success else False
```

### A. Creating Athena Tables and Views

For example, you can run the following Python code to create the preceding tables and views:
<!--pytest-codeblocks:cont-->


```python
print(f"\n-- Generate Athena Tables and Views for {QUILT_BUCKET}:\n")
for key in DDL:
    print("\n-- " + key)
    drop_sql = f"DROP TABLE `{ATHENA_DB}.{key}`;"
    print(drop_sql)
    status = athena_run(drop_sql)
    print(DDL[key])
    status = athena_run(DDL[key])
    if not status:
        print("FAILED", end="\n\n")
```

    
    -- Generate Athena Tables and Views for quilt-ernest-staging:
    
    
    -- quilt_ernest_staging_quilt_manifests
    DROP TABLE `quilt_query.quilt_ernest_staging_quilt_manifests`;
    	#9 athena_await[32f888ba-30b4-4ab9-aa1e-fc0e9824820f]=QUEUED
    	#8 athena_await[32f888ba-30b4-4ab9-aa1e-fc0e9824820f]=SUCCEEDED
    athena_await[32f888ba-30b4-4ab9-aa1e-fc0e9824820f].s3_path: s3://yourcompany-quilt-query-results/32f888ba-30b4-4ab9-aa1e-fc0e9824820f.txt
    	athena_await 32f888ba-30b4-4ab9-aa1e-fc0e9824820f.txt
    
    CREATE EXTERNAL TABLE `quilt_query.quilt_ernest_staging_quilt_manifests`(
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
      's3://quilt-ernest-staging/.quilt/packages'
    TBLPROPERTIES ('has_encrypted_data'='false');
    
    	#9 athena_await[7a42bd28-b1ea-4e35-81d4-ba366a2f70c7]=RUNNING
    	#8 athena_await[7a42bd28-b1ea-4e35-81d4-ba366a2f70c7]=SUCCEEDED
    athena_await[7a42bd28-b1ea-4e35-81d4-ba366a2f70c7].s3_path: s3://yourcompany-quilt-query-results/7a42bd28-b1ea-4e35-81d4-ba366a2f70c7.txt
    	athena_await 7a42bd28-b1ea-4e35-81d4-ba366a2f70c7.txt
    
    -- quilt_ernest_staging_quilt_packages
    DROP TABLE `quilt_query.quilt_ernest_staging_quilt_packages`;
    	#9 athena_await[5e588432-f14c-43e1-9b4a-70907db4ada5]=QUEUED
    	#8 athena_await[5e588432-f14c-43e1-9b4a-70907db4ada5]=SUCCEEDED
    athena_await[5e588432-f14c-43e1-9b4a-70907db4ada5].s3_path: s3://yourcompany-quilt-query-results/5e588432-f14c-43e1-9b4a-70907db4ada5.txt
    	athena_await 5e588432-f14c-43e1-9b4a-70907db4ada5.txt
    
    CREATE EXTERNAL TABLE `quilt_query.quilt_ernest_staging_quilt_packages`(
      `hash` string)
    ROW FORMAT DELIMITED
      FIELDS TERMINATED BY ',' STORED AS INPUTFORMAT
      'org.apache.hadoop.mapred.TextInputFormat'
    OUTPUTFORMAT
      'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
    LOCATION
      's3://quilt-ernest-staging/.quilt/named_packages'
    TBLPROPERTIES (
      'has_encrypted_data'='false',
      'transient_lastDdlTime'='1557626200');
    
    	#9 athena_await[b837e2b6-49e3-4b24-8c37-2f1e5bf448a3]=RUNNING
    	#8 athena_await[b837e2b6-49e3-4b24-8c37-2f1e5bf448a3]=SUCCEEDED
    athena_await[b837e2b6-49e3-4b24-8c37-2f1e5bf448a3].s3_path: s3://yourcompany-quilt-query-results/b837e2b6-49e3-4b24-8c37-2f1e5bf448a3.txt
    	athena_await b837e2b6-49e3-4b24-8c37-2f1e5bf448a3.txt
    
    -- quilt_ernest_staging_quilt_packages_view
    DROP TABLE `quilt_query.quilt_ernest_staging_quilt_packages_view`;
    	#9 athena_await[97a02d65-3bfa-4352-8b53-033f0444c002]=QUEUED
    	#8 athena_await[97a02d65-3bfa-4352-8b53-033f0444c002]=SUCCEEDED
    athena_await[97a02d65-3bfa-4352-8b53-033f0444c002].s3_path: s3://yourcompany-quilt-query-results/97a02d65-3bfa-4352-8b53-033f0444c002.txt
    	athena_await 97a02d65-3bfa-4352-8b53-033f0444c002.txt
    
    CREATE VIEW quilt_query.quilt_ernest_staging_quilt_packages_view AS
    WITH
      npv AS (
        SELECT
          regexp_extract("$path", '^s3:\/\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)', 4) as user,
          regexp_extract("$path", '^s3:\/\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)\/([^\/]+)', 5) as name,
          regexp_extract("$path", '[^/]+$') as timestamp,
          quilt_query.quilt_ernest_staging_quilt_packages."hash"
          FROM quilt_query.quilt_ernest_staging_quilt_packages
      ),
      mv AS (
        SELECT
          regexp_extract("$path", '[^/]+$') as tophash,
            manifest."meta",
            manifest."message"
          FROM
            quilt_query.quilt_ernest_staging_quilt_manifests as manifest
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
      npv."hash" = mv."tophash";
    
    	#9 athena_await[1517661f-9cca-421b-b83c-2ec9702608d3]=RUNNING
    	#8 athena_await[1517661f-9cca-421b-b83c-2ec9702608d3]=SUCCEEDED
    athena_await[1517661f-9cca-421b-b83c-2ec9702608d3].s3_path: s3://yourcompany-quilt-query-results/1517661f-9cca-421b-b83c-2ec9702608d3.txt
    	athena_await 1517661f-9cca-421b-b83c-2ec9702608d3.txt
    
    -- quilt_ernest_staging_quilt_objects_view
    DROP TABLE `quilt_query.quilt_ernest_staging_quilt_objects_view`;
    	#9 athena_await[e1e2e34a-f774-4e2f-a60f-0458f3aec317]=QUEUED
    	#8 athena_await[e1e2e34a-f774-4e2f-a60f-0458f3aec317]=SUCCEEDED
    athena_await[e1e2e34a-f774-4e2f-a60f-0458f3aec317].s3_path: s3://yourcompany-quilt-query-results/e1e2e34a-f774-4e2f-a60f-0458f3aec317.txt
    	athena_await e1e2e34a-f774-4e2f-a60f-0458f3aec317.txt
    
    CREATE VIEW quilt_query.quilt_ernest_staging_quilt_objects_view AS
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
          quilt_query.quilt_ernest_staging_quilt_manifests as manifest
        WHERE manifest."logical_key" IS NOT NULL
      )
    SELECT
      npv."user",
      npv."name",
      npv."timestamp",
      mv."tophash",
      mv."logical_key",
      mv."physical_keys",
      mv."size",
      mv."hash",
      mv."meta",
      mv."user_meta"
    FROM mv
    JOIN
      quilt_query.quilt_ernest_staging_quilt_packages_view as npv
    ON
      npv."hash" = mv."tophash";
    
    	#9 athena_await[cbe9c563-46b1-42e9-82f3-4da6590cb78e]=RUNNING
    	#8 athena_await[cbe9c563-46b1-42e9-82f3-4da6590cb78e]=SUCCEEDED
    athena_await[cbe9c563-46b1-42e9-82f3-4da6590cb78e].s3_path: s3://yourcompany-quilt-query-results/cbe9c563-46b1-42e9-82f3-4da6590cb78e.txt
    	athena_await cbe9c563-46b1-42e9-82f3-4da6590cb78e.txt


### B. Querying package-level metadata

Suppose we wish to find all .tiff files produced by algorithm version 1.3
with a cell index of 5.
<!--pytest-codeblocks:cont-->


```python
ATHENA_TEST = f"""
SELECT * FROM {ATHENA_DB}.{OBJECTS_VIEW}
WHERE substr(logical_key, -5)='.tiff'
-- extract and query package-level metadata
AND json_extract_scalar(meta, '$.user_meta.nucmembsegmentationalgorithmversion') LIKE '1.3%'
AND json_array_contains(json_extract(meta, '$.user_meta.cellindex'), '5');
"""
```

You can enter that Query directly in the Athena Query Editor using the QuiltWorkgroup, from the Queries -> Athena SQL tab, or using the following Python code:
<!--pytest-codeblocks:cont-->


```python
print("\nTest Athena Query:")
print(ATHENA_TEST)
print("WorkGroup", ATHENA_WORKGROUP)
results = athena_run(ATHENA_TEST)
if results:
    print("results")
    pprint.pprint(results)
```

    
    Test Athena Query:
    
    SELECT * FROM quilt_query.quilt_ernest_staging_quilt_objects_view
    WHERE substr(logical_key, -5)='.tiff'
    -- extract and query package-level metadata
    AND json_extract_scalar(meta, '$.user_meta.nucmembsegmentationalgorithmversion') LIKE '1.3%'
    AND json_array_contains(json_extract(meta, '$.user_meta.cellindex'), '5');
    
    WorkGroup quilt-query
    	#9 athena_await[6a697c41-c520-47ca-903d-e7e7494474a5]=QUEUED
    	#8 athena_await[6a697c41-c520-47ca-903d-e7e7494474a5]=RUNNING
    	#7 athena_await[6a697c41-c520-47ca-903d-e7e7494474a5]=RUNNING
    	#6 athena_await[6a697c41-c520-47ca-903d-e7e7494474a5]=RUNNING
    	#5 athena_await[6a697c41-c520-47ca-903d-e7e7494474a5]=SUCCEEDED
    athena_await[6a697c41-c520-47ca-903d-e7e7494474a5].s3_path: s3://yourcompany-quilt-query-results/6a697c41-c520-47ca-903d-e7e7494474a5.csv
    	athena_await 6a697c41-c520-47ca-903d-e7e7494474a5.csv
    results
    (['user',
      'name',
      'timestamp',
      'tophash',
      'logical_key',
      'physical_keys',
      'size',
      'hash',
      'meta',
      'user_meta'],
     [])



```python

```
