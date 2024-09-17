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

The per-bucket configuration is written in YAML, following the structure outlined
below.

### Example

```yaml
version: "1.0"
tables:
  test_csv:
    schema:  
      - name: col1  
        type: Utf8  
      - name: col2  
        type: Float16  
    source:  
      type: quilt  
      package_name: "pre1/.*"  
      logical_key: ".*\.csv"  
    parser:  
      format: csv  
      delimiter: "\t"
```

1. The `test_csv` table is defined with a schema containing two columns: `col1`
   of type `Utf8` and `col2` of type `Float16`.
1. The table is sourced from Quilt packages with names matching the regular expression
   `pre1/.*` and containing files with names matching the regular expression `.*\.csv`.
   Currently the only supported source type is `quilt`.
1. The parser is configured to read the data as CSV with tab-delimited fields. Other
   supported formats include `parquet`.

## Usage

Once the configuration is set, users can query the tables using Athena from the
Quilt Catalog:

```sql
SELECT * FROM per_bucket_database.test_csv
```

You can join this with any other Athena table, including the package and object
tables automatically created by Quilt. For example, to join that table with the
`bucket_package_view` using the `package_name` field:

```sql
SELECT * FROM per_bucket_database.test_csv
JOIN per_bucket_database.bucket_package_view
ON test_csv.package_name = bucket_package_view.package
```
