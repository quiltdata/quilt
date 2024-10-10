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

A more complex example is available in [this yaml file](./tabulator-example.yaml).

1. **Schema**: The schema defines the columns in the table. Each column must
   have a name and a type. The name must match the regular expression
   `^[a-z_][a-z0-9_]*$`.  It does not need to match the column names in the
   document.  However, if the column names are present in the document, you must
   set `header` to `true` in the parser configuration.
2. **Types**:  Must be uppercase and match the [Apache Arrow Data
Types](https://github.com/awslabs/aws-athena-query-federation/tree/master/athena-federation-sdk#datatypes)
used by Amazon Athena.  Valid types are BOOLEAN, TINYINT, SMALLINT, INT, BIGINT,
FLOAT, DOUBLE, STRING, BINARY, DATE, TIMESTAMP.
3. **Source**: The source defines the packages and objects to query. The `type`
   must be `quilt-packages`. The `package_name` is a regular expression that
   matches the package names to include. The `logical_key` is a regular
   expression that matches the keys of the objects to include. The regular
   expression may include named capture groups that will be added as columns
   to the table.
4. **Parser**: The parser defines how to read the files. The `format` must be
   one of `csv` or `parquet`. The optional `delimiter` is the character used to
   separate fields in the CSV file. The optional `header` field is a boolean
   that indicates whether the first row of the CSV file contains column names.

### Added columns

In addition to the columns defined in the schema, Tabulator will add:

- any named capture groups from the logical key regular expression
- `$pkg_name` for the package name
- `$logical_key` for the object as referenced by the package
- `$physical_key` for the underlying S3 URI
- `$top_hash` for the revision of the package containing the object (which is
  currently always `latest`)

### Caveats

1. **Schema Consistency**: All files in the package that match the logical key
   must have the same schema as defined in the configuration.
2. **Memory Usage**: Tabulator may fail on large files (> 10 GB), files with
   large rows (> 100 KB), and large numbers of files (> 10000). Additionally,
   Athena has a 16 MB limit per row.
3. **Cost Management**: Querying very large datasets can be expensive
   (approximately dollars per terabyte). Be sure to set up appropriate cost
   controls and monitoring.
4. **Access Restrictions**: Due to the way permissions are configured, Tabulator
   cannot be accessed from the AWS Console or views. You must access Tabulator
   via the Quilt Catalog in order to query the tables.
5. **Concurrency**: Tabulator will attempt to process each file concurrently,
   but may be limited by the concurrency of Athena or the federation lambda in
   the
   [region](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/discover)
   where the query is running. If you are experiencing slow performance, it may
   be because the concurrency is too low. You can increase the concurrency in
   [that
   region](https://us-east-1.console.aws.amazon.com/servicequotas/home/services/lambda/quotas/L-B99A9384)'s
   AWS Service Quotas console.

## Usage

Once the configuration is set, users can query the tables using the Athena tab
from the Quilt Catalog. Note that because Tabulator runs with elevated
permissions, it cannot be accessed from the AWS Console.

For example, to query the `ccle-tsv` table from the appropriate workgroup in
the `quilt-tf-dev-federator` stack:

```sql
SELECT * FROM "quilt-tf-dev-federator-tabulator"."udp-spec"."ccle-tsv"
```

You can join this with any other Athena table, including the package and
object tables automatically created by Quilt. For example, this is the package
table:

```sql
SELECT * FROM "userathenadatabase-1qstaay0czbf"."udp-spec_packages-view"
WHERE pkg_name IS NOT NULL
```

We can then join on PKG_NAME to add the `user_meta` field from the package
metadata to the tabulated results:

```sql
SELECT
  "ccle-tsv".*,
  "udp-spec_packages-view".user_meta
FROM "quilt-tf-dev-federator-tabulator"."udp-spec"."ccle-tsv"
JOIN "userathenadatabase-1qstaay0czbf"."udp-spec_packages-view"
ON "ccle-tsv".pkg_name = "udp-spec_packages-view".pkg_name
```
