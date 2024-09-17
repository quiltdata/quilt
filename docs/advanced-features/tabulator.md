# Tabulator Configuration for Quilt

> This feature requires Quilt stack version 1.55.0 or higher

## Overview

Tabulator allows Quilt Admins to configure tables for querying tabular data objects across multiple packages using AWS Athena. Admins can define schemas and data sources for CSV, TSV, Parquet, and other formats, enabling users to run SQL queries directly on Quilt packages.

The configuration is written in YAML and can be managed using the `quilt3.admin.tabulator_config.set()` function or via the Quilt Admin UI.

![Admin UI for setting Tabulator configuration](../imgs/admin-tabulator-config.png)

> Note: Tables defined by the configuration must match the format and schema of the data stored in the corresponding Quilt packages.

> Note: The configuration must be explicitly set by an Admin, but end-users will be able to query the tables without needing to know the underlying configuration details.

## Configuration

The configuration is written in YAML, following the structure outlined below.

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

1. **Tables Section**: Each table entry represents a table to be created in Athena.
    - `test_csv`: This is the name of the table that will be created in Athena.

2. **Schema Definition**: Each table must define a schema to describe the structure of the tabular data.
    - `schema`: This section lists the columns (`col1`, `col2`) and their data types (`Utf8`, `Float16`).

3. **Source Definition**: Specifies where the data for the table is coming from.
    - `source`: Defines the Quilt package containing the data.
        - `package_name`: Uses a regular expression to match the package names (e.g., "pre1/.*").
        - `logical_key`: Uses a regular expression to match the files within those packages (e.g., ".*\.csv" for CSV files).

4. **Parser Definition**: Specifies how to parse the data files.
    - `parser`: Defines the format of the files (e.g., CSV, TSV) and any necessary parsing rules such as the `delimiter`.

## Querying Data

Once configured, users can run SQL queries via Athena on the tabular data. Tables will automatically include the `package_handle` as a foreign key, allowing for easy cross-package querying.

### Example Query

```sql
SELECT * FROM test_csv
```
