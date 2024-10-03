# Tabulator Configuration for Quilt

> This feature requires Quilt stack version 1.55.0 or higher

## Overview

Tabulator aggregates tabular data objects across multiple packages using AWS Athena.
Admins define schemas and data sources for CSV, TSV, Parquet, and other formats,
enabling users to run SQL queries directly on the contents of Quilt packages.

The configuration can be written in YAML and managed using the
`quilt3.admin.tabulator_config.set()` function or via the Quilt Admin UI.

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
  logical_key: "salmon/(?P<sample_id>[^/]+)/quant*\\.genes\\.sf$"
parser:
  format: csv
  delimiter: "\t"
```

1. The `ccle-tsv` table is defined with a schema containing five columns:
   `Name`, `Length`, `EffectiveLength`, `TPM`, and `NumReads`.
2. Currently, the only supported source type is `quilt`.
3. The table is sourced from Quilt packages whose names match the regular
   expression `ccle/.*`, using those files whose logical keys match the
   regular expression `salmon/([^/]+)/quant.genes.sf$`.
4. The named group `sample_id` is extracted from the logical key and used as an
   additional column of type `Utf8` in the table.
5. The parser is configured to read the data as CSV with tab-delimited fields.
   Other supported formats include `parquet`.

### Warnings

1. All files in the package that match the logical key must have the same
   schema as defined in the configuration.
2. Querying very large datasets can be expensive (~dollars per terabyte).
   Be sure to set up appropriate cost controls and monitoring.

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
