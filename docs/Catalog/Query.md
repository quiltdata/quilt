<!-- markdownlint-disable-next-line first-line-h1 -->
[Amazon Athena](https://aws.amazon.com/athena/) is an interactive query service
that makes it easy to analyze data in Amazon S3 using standard SQL. Athena is
serverless, so there is no infrastructure to manage, and you pay only for the
queries that you run.

The Catalog's Queries tab allows you to run Athena queries against your S3
buckets, and any other data sources your users have access to. There are
prebuilt tables for packages and objects, and you can create your own tables and
views. See, for example, [Tabulator](../advanced-features/tabulator.md).

NOTE: This page describes how to use Athena for precise querying of specific
tables and fields. For full-text searching using Elasticsearch, see the
[Search](Search.md) page.

## Basics

"Run query" executes the selected query and waits for the result.

![ui](../imgs/athena-ui.png)

 Individual users will also see their past queries, and easily re-run them.

![history](../imgs/athena-history.png)

## Example: query package-level metadata

Suppose we wish to find all packages produced by algorithm version 1.3 with a
cell index of 5.

```sql
SELECT * FROM "YOUR-BUCKET_packages-view"
-- extract and query package-level metadata
WHERE json_extract_scalar(meta, 
  '$.user_meta.nucmembsegmentationalgorithmversion') LIKE '1.3%'
AND json_array_contains(json_extract(meta, '$.user_meta.cellindex'), '5');
```

## Example: query object-level metadata

Suppose we wish to find all .tiff files produced by algorithm version 1.3
with a cell index of 5.

```sql
SELECT * FROM "YOUR-BUCKET_objects-view"
WHERE substr(logical_key, -5) = '.tiff'
-- extract and query object-level metadata
AND json_extract_scalar(meta, 
  '$.user_meta.nucmembsegmentationalgorithmversion') LIKE '1.3%'
AND json_array_contains(json_extract(meta, '$.user_meta.cellindex'), '5');
```

## Configuration

Athena queries saved from the AWS Console for a given workgroup will be
available in the Quilt Catalog for all users to run.

Administrators can hide the "Queries" tab by setting `ui > nav > queries: false`
([learn more](./Preferences.md)).
