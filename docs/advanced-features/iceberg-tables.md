<!-- markdownlint-disable -->

# Querying packages with Iceberg tables

> This feature requires Quilt Platform version 1.64.0 or higher

Quilt automatically caches package information in Apache Iceberg tables to provide a high-efficiency, externally-queryable source of information suitable for data warehouses.

Four tables are available:

- `package_revision` - package revisions with timestamps
- `package_tag` - named package tags (e.g., "latest")
- `package_manifest` - package-level metadata and commit messages
- `package_entry` - individual file entries within packages

## When to use Iceberg tables

Use Iceberg tables for:
- Large-scale analysis across many packages
- Tracking package evolution over time
- Complex joins combining revisions, tags, manifests, and entries

For simple queries on a single package, the standard Athena views
(e.g., `YOUR-BUCKET_packages-view`) may be more convenient.

## Example: Find all versions of a package

```sql
SELECT
  pkg_name,
  timestamp,
  top_hash
FROM "your-iceberg-database"."package_revision"
WHERE bucket = 'my-bucket'
  AND pkg_name = 'analytics/results'
ORDER BY timestamp DESC
```

## Example: Query package metadata

```sql
SELECT
  r.pkg_name,
  r.timestamp,
  m.message,
  m.metadata
FROM "your-iceberg-database"."package_manifest" m
JOIN "your-iceberg-database"."package_revision" r
  ON m.bucket = r.bucket AND m.top_hash = r.top_hash
WHERE m.message LIKE '%experiment%'
ORDER BY r.timestamp DESC
```

## Example: Find large files across packages

```sql
SELECT
  r.pkg_name,
  e.logical_key,
  e.size,
  e.physical_key
FROM "your-iceberg-database"."package_entry" e
JOIN "your-iceberg-database"."package_revision" r
  ON e.bucket = r.bucket AND e.top_hash = r.top_hash
WHERE e.logical_key LIKE '%.csv'
  AND e.size > 1073741824
ORDER BY e.size DESC
```

## Accessing from the Catalog

Use the Queries tab in the Quilt Catalog to run Athena queries against Iceberg tables.
Ask your administrator for the Glue database name containing the Iceberg tables.

## See also

- [Query](../Catalog/Query.md): Use the Catalog's Queries tab
- [Athena](athena.md): Query package metadata with AWS Athena
- [Tabulator](tabulator.md): Query tabular data within packages
