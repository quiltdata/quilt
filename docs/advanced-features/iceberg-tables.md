<!-- markdownlint-disable -->

# Querying packages with Iceberg tables

> NOTE: This feature requires Quilt Platform version 1.64.0 or higher

Quilt automatically maintains Apache Iceberg tables that provide high-efficiency,
externally-queryable access to package information. You can query package revisions,
tags, file entries, and metadata using standard SQL tools (Athena, Spark, Trino)
without accessing the Quilt Catalog.

Four tables are available:

- `package_revision` - package revisions with timestamps
- `package_tag` - named package tags (e.g., "latest", "v1.0")
- `package_manifest` - package-level metadata and commit messages
- `package_entry` - individual file entries within packages

## Example: Get entries and metadata for the latest version of a package

The Iceberg tables are in the database specified by the `UserAthenaDatabaseName`
output in your CloudFormation stack (the same database as the standard package views).

```sql
SELECT
  e.logical_key,
  e.physical_key,
  e.size,
  m.metadata
FROM package_tag t
JOIN package_manifest m
  ON t.bucket = m.bucket AND t.top_hash = m.top_hash
JOIN package_entry e
  ON t.bucket = e.bucket AND t.top_hash = e.top_hash
WHERE t.bucket = 'my-bucket'
  AND t.pkg_name = 'analytics/results'
  AND t.tag_name = 'latest'
```

## Example: Find all packages matching specific metadata

```sql
SELECT
  r.bucket,
  r.pkg_name,
  r.timestamp,
  m.metadata
FROM package_manifest m
JOIN package_revision r
  ON m.bucket = r.bucket AND m.top_hash = r.top_hash
WHERE json_extract_scalar(m.metadata, '$.experiment_id') = 'EXP-123'
  AND json_extract_scalar(m.metadata, '$.status') = 'complete'
ORDER BY r.timestamp DESC
```

## Accessing from external tools

Iceberg tables can be queried from any SQL engine that supports Iceberg format:

- **AWS Athena**: Use the Queries tab in the Quilt Catalog
- **Apache Spark**: Configure Iceberg catalog to point to the Glue database
- **Trino/Presto**: Connect to the Glue catalog
- **AWS Glue**: Use the Glue database directly in ETL jobs

## See also

- [Query](../Catalog/Query.md): Use the Catalog's Queries tab
- [Athena](athena.md): Query package metadata with AWS Athena
- [Tabulator](tabulator.md): Query tabular data within packages
