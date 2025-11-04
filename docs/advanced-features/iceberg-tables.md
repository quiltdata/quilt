# Querying packages with Iceberg tables

> **NOTE:** This feature requires Quilt Platform version 1.64.0 or higher.

Quilt automatically maintains Apache Iceberg tables that provide high-efficiency,
externally queryable access to package information. This is particularly useful
for buckets that contain thousands of packages or queries that span multiple buckets.

You can query package revisions, tags, file entries, and metadata using
Amazon Athena or external data warehouses that support Iceberg
(e.g., Databricks, Snowflake).

## Tables

Four tables are available:

- `package_revision` - Package revisions with timestamps
- `package_tag` - Named package tags (e.g., "latest", "v1.0")
- `package_manifest` - Package-level metadata and commit messages
- `package_entry` - Individual file entries within packages

## Example: Get entries and metadata for the latest version of a package

The Iceberg tables are in the database specified by the `IcebergDatabase`
resource in your CloudFormation stack.

```sql
SELECT
  e.logical_key,
  e.physical_key,
  e.size,
  e.metadata
FROM package_tag t
JOIN package_entry e
  ON t.bucket = e.bucket AND t.top_hash = e.top_hash
WHERE t.bucket = 'my-bucket'
  AND t.pkg_name = 'analytics/results'
  AND t.tag_name = 'latest'
```

## Example: Find latest packages matching specific metadata

```sql
SELECT
  t.bucket,
  t.pkg_name,
  t.tag_name,
  m.metadata
FROM package_tag t
JOIN package_manifest m
  ON t.bucket = m.bucket AND t.top_hash = m.top_hash
WHERE t.tag_name = 'latest'
  AND json_extract_scalar(m.metadata, '$.experiment_id') = 'EXP-123'
  AND json_extract_scalar(m.metadata, '$.status') = 'complete'
```

## See also

- [Query](../Catalog/Query.md): Use the Catalog's Queries tab
- [Athena](athena.md): Query package manifests using AWS Athena
- [Tabulator](tabulator.md): Query tabular data within packages
