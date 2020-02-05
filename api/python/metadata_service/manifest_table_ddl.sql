CREATE EXTERNAL TABLE `quilt_manifests_armand_dotquilt_dev`(
  `logical_key` string,
  `size` int,
  `physical_keys` string,
  `meta` string,
  `manifest_commit_message` string,
  `object_hash` struct<
                       `type`:string,
                       `value`: string
                      >
  )
PARTITIONED BY (
  `usr` string,
  `pkg` string,
  `hash_prefix` string)
ROW FORMAT SERDE
  'org.openx.data.jsonserde.JsonSerDe'
WITH SERDEPROPERTIES (
  'mapping.manifest_commit_message'='message',
  'mapping.object_hash'='hash'
  )
STORED AS INPUTFORMAT
  'org.apache.hadoop.mapred.TextInputFormat'
OUTPUTFORMAT
  'org.apache.hadoop.hive.ql.io.IgnoreKeyTextOutputFormat'
LOCATION
  's3://armand-dotquilt-dev/.quilt/v2/manifests'
TBLPROPERTIES (
  'has_encrypted_data'='false')