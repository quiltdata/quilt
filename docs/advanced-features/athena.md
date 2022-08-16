# Querying package metadata with Athena
Quilt stores package data and metadata in S3. Metadata lives in a per-package manifest file in each bucket's `.quilt/` directory.

You can therefore query package metadata wth SQL engines like AWS Athena.
Users can write SQL queries to select packages (or files from within packages)
using predicates based on package or object-level metadata.

## Note: Executing Documentation Code  
If you import your AWS credentials for use by `boto3`, you can edit and execute code directly from the notebook version of this document.
You can alternatively copy and paste it into your Python editor.
<!--pytest.mark.skip-->


```python
%%capture
#%env AWS_PROFILE=default
%pip install boto3
```

This allows you to configure AWS services by calling Python objects:


```python
import boto3,json,re,time
SESSION = boto3.session.Session()
print(SESSION)
REGION=SESSION.region_name

ATHENA = boto3.client('athena')
IAM = boto3.resource('iam')
S3 = boto3.client('s3')

def stat(response): print(response["ResponseMetadata"]["HTTPStatusCode"])
```

    Session(region_name='us-east-1')


## I. Create Athena Configuration: Workgroup, Bucket, and Database

Quilt expects a dedicated bucket for the output from Athena queries, which is best to setup in its own workgroup and database.

1. Create the output Bucket `<mycompany>-quilt-athena-output`
2. Create a `QuiltWorkgroup` that uses that Bucket
3. Create an Athena Database `quilt-metadata` for that Workgroup

Later we will explicitly grant Quilt access to that Bucket.
<!--pytest-codeblocks:cont-->


```python
COMPANY="mycompany"
ATHENA_BUCKET=f"{COMPANY}-quilt-athena-output"
ATHENA_DATABASE="quilt_metadata"
ATHENA_URL="s3://"+ATHENA_BUCKET
ATHENA_WORKGROUP="QuiltQueries"

ARN_PREFIX="arn:aws:s3:::"
ARN_ATHENA=ARN_PREFIX+ATHENA_BUCKET

# Create bucket in default region

location = {'LocationConstraint': REGION} if REGION != 'us-east-1' else {}
bucket = S3.create_bucket(
    Bucket=ATHENA_BUCKET,
    #CreateBucketConfiguration=location,
)
stat(bucket)
#print(bucket)

# Create Workgroup which outputs to that Bucket (if needed)

lwg = ATHENA.list_work_groups()
wgs = [ wg['Name'] for wg in lwg['WorkGroups'] ]

if ATHENA_WORKGROUP not in wgs:
    cwg = ATHENA.create_work_group(Name=ATHENA_WORKGROUP, Description='Quilt uses this for Athena SQL Queries')
    stat(cwg)

# Configure Workgroup to use that Bucket
uwg = ATHENA.update_work_group(
    WorkGroup=ATHENA_WORKGROUP,
    ConfigurationUpdates={
        'ResultConfigurationUpdates': {
            'OutputLocation': ATHENA_URL,
        },
    },
)
stat(uwg)

# Create new GLUE Database

sqe = ATHENA.start_query_execution(
    QueryString=f'create database {ATHENA_DATABASE}',
    ResultConfiguration={'OutputLocation': ATHENA_URL+'/queries/'})
stat(sqe)
```

    200
    200
    200


## II. Granting Access to Athena

By default, Quilt runs with very conservative permissions that do not allow access to [Amazon Athena](https://docs.aws.amazon.com/athena/latest/ug/what-is.html). To enable Athena SQL queries by your Quilt users, you must:

1. Create a new Athena policy.

The standard [AmazonAthenaFullAccess](https://console.aws.amazon.com/iam/home#/policies/arn:aws:iam::aws:policy/AmazonAthenaFullAccess) policy is more permissive than necessary.  For production usage, we recommend creating a policy limited to only the above Database:
<!--pytest-codeblocks:cont-->


```python
# https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/iam.html#IAM.ServiceResource.create_policy
# https://docs.aws.amazon.com/athena/latest/ug/workgroups-access.html

# TODO: Replace aws-athena-query-results-*

AthenaQuiltAccess={
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
                        "glue:GetDatabase",
                        "glue:GetDatabases",
                        "glue:CreateTable",
                        "glue:DeleteTable",
                        "glue:UpdateTable",
                        "glue:GetTable",
                        "glue:GetTables",
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
                        ARN_ATHENA
                    ]
                },

            ]
}
try: 
    AthenaQuiltPolicy = IAM.create_policy(
        PolicyName='AthenaQuiltAccess',
        PolicyDocument=json.dumps(AthenaQuiltAccess),
        Description='Minimal Athena Access policy for Quilt'
    )
    print(AthenaQuiltPolicy)
except:
    print("Policy AthenaQuiltAccess already exists")    
```

    Policy AthenaQuiltAccess already exists


2. Attach this policy to your CloudFormation stack.
 
This needs to be done manually by your AWS Administrator:

    a. Go to the [CloudFormation console](https://console.aws.amazon.com/cloudformation)
    b. Select the Quilt stack
    c. Click "Update"
    d. Add the above ARN to the "ManagedUserRoleExtraPolicies" field.
    e. Save
    
3. Add that AWS policy as a Quilt catalog Policy

This needs to be done manually by a Quilt Administrator:

    a. Login to your Quilt instance at, e.g. https://quilt.mycompany.com
    b. Click on "Admin Settings" in the upper right
    c. Scroll down to the "Policies" section on the bottom
    d. Click on the "+" to create a new Policy
    e. Set Title to "AthenaQuiltAccess"
    f. Check "Manually set ARN" and enter ARN of Athena policy.
    f. Click "Create"
    
4. Attach that Policy to a (new) Quilt Role

You cannot attach a policy to the "Custom" Roles, so you will usually need to first create a new Role:

    a. From "Admin Settings", scroll to "Roles"
    b. Click on the "+" to create a new Role
    c. Set Name to e.g., "AthenaAccessRole"
    d. Click on "No policies attached.  Attach a policy…"
    e. Select the "AthenaQuiltAccess" policy from before
    f. Click "Create"

See [Users and roles](../Catalog/Admin.md) for more details on access control management in Quilt.

## III. Defining Per-Bucket Metadata Tables in Athena
The next step is enabling Athena to query the package contents and metadata
for a specific Quilt bucket, by creating proxy tables and views that represent those files:
<!--pytest-codeblocks:cont-->


```python
QUILT_BUCKET="quilt-example"   # Use your own
QUILT_URL="s3://"+QUILT_BUCKET # With S3 Prefix

BUCKET_ID=QUILT_BUCKET.replace('-','_')
MANIFEST_TABLE=f"{BUCKET_ID}_quilt_manifests"
PACKAGES_TABLE=f"{BUCKET_ID}_quilt_packages"
PACKAGES_VIEW=f"{BUCKET_ID}_quilt_packages_view"
OBJECTS_VIEW=f"{BUCKET_ID}_quilt_objects_view"
DDL = {}
```

### A. Manifests table
The following Athena DDL will build a table of all the manifests in that bucket
(all package-level and object-level metadata).
<!--pytest-codeblocks:cont-->


```python
DDL[MANIFEST_TABLE] = f"""
CREATE EXTERNAL TABLE IF NOT EXISTS `{MANIFEST_TABLE}`(
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
TBLPROPERTIES (
  'has_encrypted_data'='false',
  'transient_lastDdlTime'='1605312102')
"""
```

### B. Package metadata table
Package names and top hashes are not stored in the manifests. Rather they are stored in pointer files in the `.quilt/named_packages` folder.
The following DDL creates a table from these pointer files to make package
top hashes available in Athena.
<!--pytest-codeblocks:cont-->


```python
DDL[PACKAGES_TABLE] = f"""
CREATE EXTERNAL TABLE IF NOT EXISTS `{PACKAGES_TABLE}`(
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
  'transient_lastDdlTime'='1557626200')
"""
```

### C. View of package-level metadata
The DDL below creates a view that contains package-level information including: 
* User
* Package name
* Tophash
* Timestamp
* Commit message
<!--pytest-codeblocks:cont-->


```python
SLASH=r'\/([^\/]+)'
S1=r'\/'
S3_MATCH=f'^s3:{S1}{SLASH}{SLASH}{SLASH}{SLASH}'
DDL[PACKAGES_VIEW] = f"""
CREATE OR REPLACE VIEW {PACKAGES_VIEW} AS
WITH
  npv AS (
    SELECT
      regexp_extract("$path", '{S3_MATCH}', 4) as user,
      regexp_extract("$path", '{S3_MATCH}{SLASH}', 5) as name,
      regexp_extract("$path", '[^/]+$') as timestamp,
      {PACKAGES_TABLE}."hash"
      FROM {PACKAGES_TABLE}
  ),
  mv AS (
    SELECT
      regexp_extract("$path", '[^/]+$') as tophash,
        manifest."meta",
        manifest."message"
      FROM
        {MANIFEST_TABLE} as manifest
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
"""

```

### D. View of object-Level metadata
The DDL below creates a view that contains package contents, including:
* logical_key
* physical_keys
* object hash
* object metadata
<!--pytest-codeblocks:cont-->


```python
DDL[OBJECTS_VIEW] = f"""
CREATE OR REPLACE VIEW {OBJECTS_VIEW} AS
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
      {MANIFEST_TABLE} as manifest
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
  {PACKAGES_VIEW} as npv
ON
  npv."hash" = mv."tophash"
"""
```

You can run the following Python code to create the preceding tables and views:
<!--pytest-codeblocks:cont-->


```python
print(f"\nCreate Athena Tables and Views for {QUILT_BUCKET}:\n")
for key in DDL:
    resp = ATHENA.start_query_execution(QueryString=DDL[key])
    print(f" - {key}: ", end ="")
    stat(resp)
```

    
    Create Athena Tables and Views for quilt-example:
    
     - quilt_example_quilt_manifests: 200
     - quilt_example_quilt_packages: 200
     - quilt_example_quilt_packages_view: 200
     - quilt_example_quilt_objects_view: 200


## Example: Querying package-level metadata

Suppose we wish to find all .tiff files produced by algorithm version 1.3
with a cell index of 5.
<!--pytest-codeblocks:cont-->


```python
ATHENA_TEST = f"""
SELECT * FROM {OBJECTS_VIEW}
WHERE substr(logical_key, -5)='.tiff'
-- extract and query package-level metadata
AND json_extract_scalar(meta, '$.user_meta.nucmembsegmentationalgorithmversion') LIKE '1.3%'
AND json_array_contains(json_extract(meta, '$.user_meta.cellindex'), '5');
"""
```

You can enter that Query directly in the Athena Query Editor using the QuiltWorkgroup, from the Queries -> Athena SQL tab, or using the following Python code:
<!--pytest-codeblocks:cont-->


```python
# https://www.ilkkapeltola.fi/2018/04/simple-way-to-query-amazon-athena-in.html
QUERY_ID='QueryExecutionId'
TAIL_PATH=re.compile(r'.*\/(.*)')

def athena_await(resp, max_execution = 10):
    id = resp[QUERY_ID]
    state = 'RUNNING'
    while (max_execution > 0 and state in ['RUNNING', 'QUEUED']):
        max_execution = max_execution - 1
        response = ATHENA.get_query_execution(QueryExecutionId = id)
        if 'QueryExecution' in response and \
                'Status' in response['QueryExecution'] and \
                'State' in response['QueryExecution']['Status']:
            state = response['QueryExecution']['Status']['State']
            if state == 'FAILED':
                return False
            elif state == 'SUCCEEDED':
                s3_path = response['QueryExecution']['ResultConfiguration']['OutputLocation']
                print('athena_await.s3_path:', s3_path)
                filename = TAIL_PATH.findall(s3_path)[0]
                return filename
        print(f"\tathena_await[{max_execution}]={state}")
        time.sleep(1)

    return False

def athena_results(resp):
    id = resp[QUERY_ID]
    raw = ATHENA.get_query_results(QueryExecutionId=id)
    if raw.get('ResponseMetadata', {}).get('HTTPStatusCode') == 200 and 'Rows' in raw.get('ResultSet', {}):
        data = [x['Data']for x in raw['ResultSet']['Rows']]
        cols = [d.get('VarCharValue') for d in data[0]]
        rows = [[d.get('VarCharValue') for d in row] for row in data[1:]]
        return (cols, rows)
    else:
        return "Query in progress..."

print("\nTest Athena Query:")
print('WorkGroup', ATHENA_WORKGROUP)
resp = ATHENA.start_query_execution(
    WorkGroup=ATHENA_WORKGROUP,
    QueryString=ATHENA_TEST,
    ResultConfiguration={'OutputLocation': ATHENA_URL}
)
print('athena_await', athena_await(resp))
results = athena_results(resp)
print('results')
print(results)
```

    
    Test Athena Query:
    WorkGroup QuiltQueries
    	athena_await[9]=QUEUED
    	athena_await[8]=RUNNING
    	athena_await[7]=RUNNING
    	athena_await[6]=RUNNING
    	athena_await[5]=RUNNING
    athena_await.s3_path: s3://mycompany-quilt-athena-output/21de87e8-88cc-4b6b-ace6-7d213f9a707c.csv
    athena_await 21de87e8-88cc-4b6b-ace6-7d213f9a707c.csv
    results
    (['user', 'name', 'timestamp', 'tophash', 'logical_key', 'physical_keys', 'hash', 'meta', 'user_meta'], [])

