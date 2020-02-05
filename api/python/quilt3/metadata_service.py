import athena
from tabulate import tabulate





def setup(bucket, db_name="default", verbose=False):
    glue_client = athena.get_glue_client()
    athena_client = athena.get_athena_client()
    create_tables_and_views_if_nonexistent(glue_client, athena_client, bucket, db_name=db_name, verbose=verbose)
    _recover_partitions(athena_client, bucket, db_name=db_name, verbose=verbose)

def recover_partitions(bucket, db_name="default", verbose=False):
    athena_client = athena.get_athena_client()
    _recover_partitions(athena_client, bucket, db_name=db_name, verbose=verbose)

def query(sql, bucket, db_name="default", verbose=False):
    def vlog(*s):
        if verbose:
            print(*s)

    athena_client = athena.get_athena_client()
    vlog(f"Running SQL against {db_name} database:\n\n{sql}")
    col_headers, rows = athena.query_and_wait(athena_client, sql, db_name, get_output_location(bucket))
    vlog("\nQuery results:")
    vlog(tabulate(rows, headers=col_headers))
    return col_headers, rows



def create_tables_and_views_if_nonexistent(glue_client, athena_client, bucket, db_name="default", verbose=False):

    def vlog(*s):
        if verbose:
            print(*s)

    output_location = get_output_location(bucket)

    if not athena.database_exists(glue_client, db_name):
        vlog(f"Database '{db_name}' doesn't exist, creating it.")
        athena.create_database(glue_client, db_name)
    else:
        vlog(f"Database '{db_name}' already exists")


    if not athena.table_exists(glue_client, db_name, table_name(bucket)):
        vlog(f"Table '{db_name}.{table_name(bucket)}' doesn't exist, creating it.")
        # Query and wait raises exception if doesn't succeed
        athena.query_and_wait(athena_client, table_creation_sql(bucket), db_name, output_location)
    else:
        vlog(f"Table '{db_name}.{table_name(bucket)}' already exists")


    if not athena.table_exists(glue_client, db_name, view_name(bucket)):
        vlog(f"View '{db_name}.{view_name(bucket)}' doesn't exist, creating it.")
        # Query and wait raises exception if doesn't succeed
        athena.query_and_wait(athena_client, view_creation_sql(db_name, bucket), db_name, output_location)
    else:
        vlog(f"View '{db_name}.{view_name(bucket)}' already exists")










def table_creation_sql(bucket):
    return f"""\
CREATE EXTERNAL TABLE `{table_name(bucket)}`(
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
  's3://{bucket}/.quilt/v2/manifests'
TBLPROPERTIES (
  'has_encrypted_data'='false')
    """


def table_name(bucket):
    return f"quilt_manifests_{bucket.replace('-', '_')}"


def view_creation_sql(db_name, bucket):
    return f"""\
CREATE VIEW {view_name(bucket)} AS
WITH
manifest_table as (
  SELECT concat(usr, '/', pkg) AS package
  , manifest_commit_message
  , regexp_extract("$path",'[ \w-]+?(?=\.)') AS hash
  FROM "{db_name}"."{table_name(bucket)}"
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
  FROM "{db_name}"."{table_name(bucket)}"
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
    """

def view_name(bucket):
    return f"quilt_metadata_service_{bucket.replace('-', '_')}"












def _recover_partitions(athena_client, bucket, db_name="default", verbose=False):
    sql = f"MSCK REPAIR TABLE {table_name(bucket)}"
    if verbose:
        print(f"Recovering partitions: {sql}")
    athena.query_and_wait(athena_client, sql, db_name, get_output_location(bucket))


def get_output_location(bucket):
    return f"s3://{bucket}/.quilt/v2/athena-results/"





if __name__ == '__main__':
    verbose = True
    bucket = "armand-dotquilt-dev"
    db_name = "default2"

    setup(bucket, db_name, verbose=verbose)
    # recover_partitions(bucket, db_name, verbose=verbose)
    query(f"SELECT * FROM {db_name}.{view_name(bucket)} LIMIT 10", bucket, db_name=db_name, verbose=verbose)