CREATE VIEW "quilt-metadata-service-armand-dotquilt-dev" AS
WITH
manifest_table as (
  SELECT concat(usr, '/', pkg) AS package
  , manifest_commit_message
  , regexp_extract("$path",'[ \w-]+?(?=\.)') AS hash
  FROM "default"."quilt-manifests-armand-dotquilt-dev"
  WHERE logical_key IS NULL
),
entry_table as (
  SELECT logical_key
  , concat(usr, '/', pkg) AS "entry_table_package"
  , size
  , object_hash.type as object_hash_type
  , object_hash.value as object_hash
  , hash_prefix
  , meta
  , regexp_extract("$path", '[ \w-]+?(?=\.)') AS "entry_table_hash"
  , replace(replace(physical_keys, '["'), '"]') as physical_key
  FROM "default"."quilt-manifests-armand-dotquilt-dev"
  WHERE logical_key IS NOT NULL
)
SELECT
logical_key
, physical_key
, size
, object_hash_type
, object_hash
, package
, manifest_commit_message
, hash
, meta
FROM entry_table
JOIN manifest_table
ON entry_table.entry_table_package = manifest_table.package
AND entry_table.entry_table_hash = manifest_table.hash;