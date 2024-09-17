Here is the revised version with the API call information moved into the **Overview** section, and the **Configuration** section focused solely on the YAML file:

---

# Tabulator Configuration for Quilt

> This feature requires Quilt stack version 1.55.0 or higher

## Overview

Tabulator allows Quilt admins to configure tables for querying tabular data
objects across multiple packages using AWS Athena. Admins can define schemas
and data sources for CSV, TSV, Parquet, and other formats, enabling users to
run SQL queries directly on Quilt packages.

The configuration can be written in YAML and managed using the
`quilt3.admin.tabulator_config.set()` function or via the Quilt Admin UI.

The API call for setting up the Tabulator configuration accepts three parameters:

1. `bucket_name: str`: The name of the S3 bucket to be searched, e.g., "udp-spec".
2. `table_name: str`: The name of the table to be created, e.g., "ccle-tsv".
3. `config: str`: The configuration for the table as a YAML string.

![Admin UI for setting Tabulator configuration](../imgs/admin-tabulator-config.png)


## Configuration

Each Tabulator configuration is written in YAML, following the structure
outlined below:

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

1. The `ccle-tsv` table is defined with a schema containing five columns:
   `Name`, `Length`, `EffectiveLength`, `TPM`, and `NumReads`.
2. The table is sourced from Quilt packages whose names match the regular
   expression `ccle/.*`, using those files whose logical keys match the
   regular expression `quant.genes.sf$`. Currently, the only supported source
   type is `quilt`.
3. The parser is configured to read the data as CSV with tab-delimited fields.
   Other supported formats include `parquet`.

> Note: All files in the package that match the logical key must have the same
> schema as defined in the configuration.

## Usage

Once the configuration is set, users can query the tables using the Athena tab
from the Quilt Catalog. Note that because Tabulator runs with elevated
permissions, it cannot be accessed from the AWS Console.

For example, to query the `ccle-tsv` table from the appropriate workgroup in
the 'quilt-tf-dev-federator' stack:

```sql
SELECT * FROM "quilt-tf-dev-federator-tabulator"."udp-spec"."ccle-tsv"
```

You can join this with any other Athena table, including the package and
object tables automatically created by Quilt. For example, this is the package
table:

```sql
SELECT * FROM "userathenadatabase-1qstaay0czbf"."udp-spec_packages-view"
WHERE PKG_NAME IS NOT NULL
```

We can then join on PKG_NAME to add the `user_meta` field from the package
metadata to the tabulated results:

```sql
SELECT
  "ccle-tsv".*,
  "udp-spec_packages-view".user_meta
FROM "quilt-tf-dev-federator-tabulator"."udp-spec"."ccle-tsv"
JOIN "userathenadatabase-1qstaay0czbf"."udp-spec_packages-view"
ON "ccle-tsv".PKG_NAME = "udp-spec_packages-view".PKG_NAME
```
