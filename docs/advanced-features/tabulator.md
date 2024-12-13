<!-- markdownlint-disable-next-line first-line-h1 -->
> NOTE: This feature requires Quilt stack version 1.55.0 or higher

Tabulator aggregates tabular data objects across multiple packages using AWS
Athena. Admins define schemas and data sources for CSV, TSV, or Parquet files,
enabling users to run SQL queries directly on the contents of Quilt packages.
You can even use named capture groups to extract additional columns from
the logical key and package name.

The configuration is written in YAML and managed using the
`quilt3.admin.tabulator`
[APIs](../api-reference/Admin.md#quilt3.admin.tabulator) or via the
Quilt Admin UI:

![Admin UI for setting Tabulator configuration](../imgs/admin-tabulator-config.png)

## Configuration

Each Tabulator configuration is written in YAML, following the structure
outlined below.

### Example

```yaml
schema:
  - name: name  # must match ^[a-z_][a-z0-9_]*$
    type: STRING  # usually BOOLEAN, INT, FLOAT, DOUBLE, STRING, DATE, TIMESTAMP
  - name: length
    type: INT
  - name: effective_length
    type: FLOAT
  - name: tpm
    type: FLOAT
  - name: num_reads
    type: FLOAT
source:
  type: quilt-packages  # currently the only supported type
  package_name: "^ccle/(?<date>[^_]+)_(?<study_id>[^_]+)_nfcore_rnaseq$"
  logical_key: "salmon/(?<sample_id>[^/]+)/quant*\\.genes\\.sf$"
parser:
  format: csv  # or `parquet`
  delimiter: "\t"
  header: true
```

1. **Schema**: The schema defines the columns in the table. Each column must
   have a name and a type. The name must match the regular expression
   `^[a-z_][a-z0-9_]*$`. For CSV/TSVs, these names do not need to match the
   column names in the document. For Parquet, they must match except for case.
   However, if column names are present in a CSV/TSV, you must set `header` to
   `true` in the parser configuration.
1. **Types**: Must be uppercase and match the
   [Apache Arrow Data Types](https://docs.aws.amazon.com/athena/latest/ug/data-types.html)
   used by Amazon Athena. Valid types are BOOLEAN, TINYINT, SMALLINT, INT,
   BIGINT, FLOAT, DOUBLE, STRING, BINARY, DATE, TIMESTAMP.
1. **Source**: The source defines the packages and objects to query. The `type`
   must be `quilt-packages`. The `package_name` is a regular expression that
   matches the package names to include. The `logical_key` is a regular
   expression that matches the keys of the objects to include. The regular
   expression may include named capture groups that will be added as columns
   to the table.
1. **Parser**: The parser defines how to read the files. The `format` must be
   one of `csv` or `parquet`. The optional `delimiter` (defaults to ',') is the
   character used to separate fields in the CSV file. The optional `header`
   field (defaults to 'false') is a boolean that indicates whether the first row
   of the CSV file contains column names.

### Added columns

In addition to the columns defined in the schema, Tabulator will add:

- any named capture groups from the logical key regular expression
- `$pkg_name` for the package name
- `$logical_key` for the object as referenced by the package
- `$physical_key` for the underlying S3 URI
- `$top_hash` for the revision of the package containing the object (currently
  we query only the `latest` package revision)

### Using Athena to Access Tabulator

Due to the way permissions are configured, Tabulator cannot be accessed from
the AWS Console or Athena views by default
(unless [unrestricted access](#unrestricted-access) is enabled).
You must access Tabulator via the Quilt stack in order to query those tables.
This can be done by users via the per-bucket
"Queries" tab in the Quilt Catalog, or programmatically via `quilt3`. See
"Usage" below for more details.

### Caveats

1. **Schema Consistency**: All files in the package that match the logical key
   must have the same schema as defined in the configuration.
2. **Memory Usage**: Tabulator may fail on large files (> 10 GB), files with
   large rows (> 100 KB), and large numbers of files (> 10000). Additionally,
   Athena has a 16 MB limit per row.
3. **Cost Management**: Querying very large datasets can be expensive
   (approximately dollars per terabyte). Be sure to set up appropriate cost
   controls and monitoring.
4. **Concurrency**: Tabulator will attempt to process each file concurrently,
   but may be limited by the concurrency of Athena or the federation lambda in
   the
   [region](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/discover)
   where the query is running. If you are experiencing slow performance, it may
   be because the concurrency is too low. You can increase the concurrency in
   [that
   region](https://us-east-1.console.aws.amazon.com/servicequotas/home/services/lambda/quotas/L-B99A9384)'s
   AWS Service Quotas console.
5. **Athena VPC**: If you are using a VPC endpoint for Athena, you must ensure
   it is accessible from the Quilt stack and Tabulator lambda.

## Usage

Once the configuration is set, users can query the tables using the Athena tab
from the Quilt Catalog. Note that because Tabulator runs with elevated
permissions, it cannot be accessed from the AWS Console by default
(unless [unrestricted access](#unrestricted-access) is enabled).

For example, to query the `ccle_tsv` table from the appropriate workgroup in
the `quilt-tf-stable` stack, where the database (bucket name) is `udp-spec`:

```sql
SELECT * FROM "quilt-tf-stable-tabulator"."udp-spec"."ccle_tsv"
```

You can join this with any other Athena table, including the package and
object tables automatically created by Quilt. For example, this is the package
table:

```sql
SELECT * FROM "userathenadatabase-1qstaay0czbf"."udp-spec_packages-view"
LIMIT 10
```

We can then join on `PKG_NAME` to add the `user_meta` field from the package
metadata to the tabulated results:

```sql
SELECT
  "ccle_tsv".*,
  "udp-spec_packages-view".user_meta
FROM "quilt-tf-stable-tabulator"."udp-spec"."ccle_tsv"
JOIN "userathenadatabase-1qstaay0czbf"."udp-spec_packages-view"
ON "ccle_tsv".pkg_name = "udp-spec_packages-view".pkg_name
```

### From Outside the Quilt Catalog

To call Tabulator from outside the Queries tab, you must use `quilt3` to
authenticate against the stack using `config()` and `login()`, which opens a web
page from which you must paste in the appropriate access token. Use
`get_boto3_session()` to get a session with the same permissions as your Quilt
Catalog user, then use the `boto3` Athena client to run queries.

> If [unrestricted access](#unrestricted-access) is enabled, you can use any
> AWS credentials providing access to Athena resources associated with Tabulator.

Here is a complete example:

<!--pytest.mark.skip-->
```python
import quilt3
import time

DOMAIN = 'stable'
WORKGROUP = f'QuiltUserAthena-tf-{DOMAIN}-NonManagedRoleWorkgroup'
FULL_TABLE = f'"quilt-tf-{DOMAIN}-tabulator"."udp-spec"."ccle_tsv"'
QUERY = f'SELECT * FROM {FULL_TABLE} LIMIT 10'

quilt3.config(f'https://{DOMAIN}.quilttest.com/')
quilt3.login()
session = quilt3.get_boto3_session()
athena_client = session.client('athena')

response = athena_client.start_query_execution(
    QueryString=QUERY,
    WorkGroup=WORKGROUP
)
query_execution_id = response['QueryExecutionId']
print(f'Query execution ID: {query_execution_id}')

while True:
    execution_response = athena_client.get_query_execution(QueryExecutionId=query_execution_id)
    state = execution_response['QueryExecution']['Status']['State']
    if state in ('SUCCEEDED', 'FAILED', 'CANCELLED'):
        break
    print(f'\tQuery state: {state}')
    time.sleep(1)
print(f'Query finished with state: {state}')

if state == 'SUCCEEDED':
    results = athena_client.get_query_results(QueryExecutionId=query_execution_id)
    for row in results['ResultSet']['Rows']:
        print([field.get('VarCharValue') for field in row['Data']])
else:
    print(f'Query did not succeed. Final state: {state}')
```

## Unrestricted Access

> Available since Quilt Platform version 1.57

By default, Tabulator is only accessible via a session provided by the Quilt Catalog,
and the access is scoped to the permissions of the Catalog user associated with
that session. However, an admin can enable **unrestricted access** to Tabulator,
deferring all access control to AWS. The underlying data in S3 is accessed using
the Tabulator's dedicated "unrestricted" role, which has read-only access to all
the S3 buckets attached to the given stack. This allows querying the data directly
from the AWS Console or Athena views, given the caller has the necessary permissions
to access Athena resources associated with Tabulator.

![Tabulator Settings](../imgs/admin-tabulator-settings.png)

### Permissions & Configuration

In order to access Tabulator in unrestricted mode, the caller must:

1. Provide a workgroup with output location set and compatible with that of the
   Tabulator (`s3://${UserAthenaResultsBucket}/athena-results/non-managed-roles/`).

2. Have the following permissions:

   - Athena query execution on the designated workgroup
   - Access to the Tabulator data catalog
   - Invoking the Tabulator Lambda function
   - Read access to the Tabulator bucket for spill files
   - Read/write access to the Athena results bucket

Here is an example CloudFormation template that creates the necessary resources:

```yaml
AWSTemplateFormatVersion: 2010-09-09
Description: "Resources for accessing Tabulator in unrestricted mode"

Parameters:
  UserAthenaResultsBucket:
    Type: String
    Description: "UserAthenaResultsBucket from the Quilt stack hosting the Tabulator"
  TabulatorBucket:
    Type: String
    Description: "TabulatorBucket from the Quilt stack hosting the Tabulator"
  TabulatorDataCatalogArn:
    Type: String
    Description: |
      ARN of the TabulatorDataCatalog from the Quilt stack hosting the Tabulator
  TabulatorLambdaArn:
    Type: String
    Description: "ARN of the TabulatorLambda from the Quilt stack hosting the Tabulator"

Resources:
  AthenaWorkGroup:
    Type: AWS::Athena::WorkGroup
    Properties:
      Name: "TabulatorUnrestrictedAccessDogfood"
      Description: "Workgroup for testing Tabulator with unrestricted access"
      WorkGroupConfiguration:
        EnforceWorkGroupConfiguration: true
        ResultConfiguration:
          OutputLocation: !Sub "s3://${UserAthenaResultsBucket}/athena-results/non-managed-roles/"
  TabulatorAccessRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: 2012-10-17
        Statement:
          - Effect: Allow
            Principal:
              AWS: "*"
            Action: sts:AssumeRole
      Policies:
        - PolicyName: TabulatorAccess
          PolicyDocument:
            Version: 2012-10-17
            Statement:
              - Effect: Allow
                Action:
                  - athena:BatchGetNamedQuery
                  - athena:BatchGetQueryExecution
                  - athena:GetNamedQuery
                  - athena:GetQueryExecution
                  - athena:GetQueryResults
                  - athena:GetWorkGroup
                  - athena:StartQueryExecution
                  - athena:StopQueryExecution
                  - athena:ListNamedQueries
                  - athena:ListQueryExecutions
                Resource: !Sub "arn:${AWS::Partition}:athena:${AWS::Region}:${AWS::AccountId}:workgroup/${AthenaWorkGroup}"
              - Effect: Allow
                Action:
                  - athena:ListWorkGroups
                  - athena:ListDataCatalogs
                  - athena:ListDatabases
                Resource: "*"
              - Effect: Allow
                Action: athena:GetDataCatalog
                Resource: !Ref TabulatorDataCatalogArn
              - Effect: Allow
                Action: lambda:InvokeFunction
                Resource: !Ref TabulatorLambdaArn
              - Effect: Allow
                Action:
                  - s3:GetBucketLocation
                  - s3:GetObject
                  - s3:PutObject
                  - s3:AbortMultipartUpload
                  - s3:ListMultipartUploadParts
                Resource:
                  - !Sub "arn:aws:s3:::${UserAthenaResultsBucket}"
                  - !Sub "arn:aws:s3:::${UserAthenaResultsBucket}/athena-results/non-managed-roles/*"
              - Effect: Allow
                Action:
                  - s3:GetObject
                  - s3:ListBucket
                Resource:
                  - !Sub "arn:aws:s3:::${TabulatorBucket}"
                  - !Sub "arn:aws:s3:::${TabulatorBucket}/spill/unrestricted/*"

Outputs:
  RoleArn:
    Description: "ARN of the created IAM role"
    Value: !GetAtt TabulatorAccessRole.Arn
```
