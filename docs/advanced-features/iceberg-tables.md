# Querying packages with Iceberg tables

> **NOTE:** This feature requires Quilt Platform version 1.70.0 or higher.

Quilt automatically maintains Apache Iceberg tables that provide high-efficiency,
externally queryable access to package information. This is particularly useful
for buckets that contain thousands of packages or for queries that span multiple
buckets.

You can query package revisions, tags, file entries, and metadata using
Amazon Athena or external data warehouses that support Iceberg
(e.g., Databricks, Snowflake).

## Tables

For each bucket registered with Quilt, four per-bucket tables are maintained in
the Iceberg Glue database (the `IcebergDatabase` resource in your stack):

- `{bucket}_package_revision` — package revisions with timestamps
- `{bucket}_package_tag` — named package tags (e.g., `latest`, `v1.0`)
- `{bucket}_package_manifest` — package-level metadata and commit messages
- `{bucket}_package_entry` — individual file entries within packages

The bucket is encoded in the table name, so the tables do not carry a
`bucket` column. Every Quilt role automatically receives Athena read access to
the per-bucket tables for the buckets it can read — managed users are scoped
to their readable buckets via the registry-applied session policy; non-managed
roles have stack-wide access by design.

## Example: Get entries and metadata for the latest version of a package

```sql
SELECT
  e.logical_key,
  e.physical_key,
  e.size,
  e.metadata
FROM "my-bucket_package_tag" t
JOIN "my-bucket_package_entry" e
  ON t.top_hash = e.top_hash
WHERE t.pkg_name = 'analytics/results'
  AND t.tag_name = 'latest'
```

## Example: Find latest packages matching specific metadata

```sql
SELECT
  t.pkg_name,
  t.tag_name,
  m.metadata
FROM "my-bucket_package_tag" t
JOIN "my-bucket_package_manifest" m
  ON t.top_hash = m.top_hash
WHERE t.tag_name = 'latest'
  AND json_extract_scalar(m.metadata, '$.experiment_id') = 'EXP-123'
  AND json_extract_scalar(m.metadata, '$.status') = 'complete'
```

## Cross-bucket queries

To search across multiple buckets, `UNION ALL` the per-bucket tables explicitly:

```sql
SELECT 'bucket-a' AS bucket, pkg_name, tag_name, top_hash
FROM "bucket-a_package_tag"
WHERE tag_name = 'latest'
UNION ALL
SELECT 'bucket-b' AS bucket, pkg_name, tag_name, top_hash
FROM "bucket-b_package_tag"
WHERE tag_name = 'latest'
```

## See also

- [Query](../Catalog/Query.md): Use the Catalog's Queries tab
- [Athena](athena.md): Query package manifests using AWS Athena
- [Tabulator](tabulator.md): Query tabular data within packages
