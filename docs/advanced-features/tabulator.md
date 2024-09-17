# Tabulator Configuration for Quilt

> This feature requires Quilt stack version 1.55.0 or higher

## Overview

Tabulator allows Quilt Admins to configure tables for querying tabular data
objects across multiple packages using AWS Athena. Admins can define schemas
and data sources for CSV, TSV, Parquet, and other formats, enabling users to
run SQL queries directly on Quilt packages.

The configuration is written in YAML and can be managed using the
`quilt3.admin.tabulator_config.set()` function or via the Quilt Admin UI.

![Admin UI for setting Tabulator configuration](../imgs/admin-tabulator-config.png)

> Note: Tables defined by the configuration must match the format and schema
> of the data stored in the corresponding Quilt packages.

> Note: The configuration must be explicitly set by an Admin, but end-users
> will be able to query the tables without needing to know the underlying
> configuration details.

## Configuration

Each tabulator is written in YAML, following the structure outlined
below. The configuration can be set using the `quilt3.admin.tabulator_config.set()`, which takes three parameters:

1. `bucket_name`: The name of the S3 bucket to be searched, e.g. "udp-spec".
2. `table_name`: The name of the table to be create, e.g. "ccle-tsv".
3. `config`: The configuration for the table as a YAML string (or object?).

### Example

```yaml
schema:
  - name: Name
    type: Utf8
  - name: Length
    type: Int32
  - name: EffectiveLength
    type: Float64
  - name: TPM
    type: Float64
  - name: NumReads
    type: Float64
source:
  type: quilt
  package_name: "^ccle/"
  logical_key: "quant\\.genes\\.sf$"
parser:
  format: csv
  delimiter: "\t"
```

1. The `ccle-tsv` table is defined with a schema containing
   five columns: `Name`, `Length`, `EffectiveLength`, `TPM`, and `NumReads`.
2. The table is sourced from Quilt packages whose names match the regular expression
   `ccle/.*` and only those files whose logical keys match the regular expression
   `quant.genes.sf$`.
   Currently the only supported source type is `quilt`.
3. The parser is configured to read the data as CSV with tab-delimited fields. Other
   supported formats include `parquet`.

## Usage

Once the configuration is set, users can query the tables using the Athena tab
from the Quilt Catalog. Note that because Tabulator runs with elevated
permissions, it cannot be accessed from the AWS Console.

For example, to query the `ccle-tsv` table, from the appropriate Workgroup in the
'quilt-tf-dev-federator' stack:

```sql
SELECT * FROM "quilt-tf-dev-federator-tabulator"."udp-spec"."ccle-tsv"
```

You can join this with any other Athena table, including the package and object
tables automatically created by Quilt. For example, this is the package table:

```sql
SELECT * FROM "userathenadatabase-1qstaay0czbf"."udp-spec_packages-view"
WHERE PKG_NAME is NOT NULL
```

We can then join on PKG_NAME to add the `user_meta` field from the package metadata
to the tabulated results:

```sql
SELECT
  "ccle-tsv".*,
  "udp-spec_packages-view".user_meta
FROM "quilt-tf-dev-federator-tabulator"."udp-spec"."ccle-tsv"
JOIN "userathenadatabase-1qstaay0czbf"."udp-spec_packages-view"
ON "ccle-tsv".PKG_NAME = "udp-spec_packages-view".PKG_NAME
```
