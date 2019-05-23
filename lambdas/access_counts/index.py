"""
Lambda function that runs Athena queries over CloudTrail logs and .quilt/named_packages/
and creates summaries of object and package access events.
"""

import os
import textwrap
import time

import boto3

ATHENA_DATABASE = os.environ['ATHENA_DATABASE']
# Bucket where query results will be stored.
QUERY_RESULT_BUCKET = os.environ['QUERY_RESULT_BUCKET']
# A temporary directory where Athena query results will be written.
QUERY_TEMP_DIR = os.environ['QUERY_TEMP_DIR']
# Directory where the summary files will be stored.
ACCESS_COUNTS_OUTPUT_DIR = os.environ['ACCESS_COUNTS_OUTPUT_DIR']


def sql_escape(s):
    return s.replace("'", "''")


DROP_OBJECT_ACCESS_LOG = """DROP TABLE IF EXISTS object_access_log"""
DROP_PACKAGE_HASHES = """DROP TABLE IF EXISTS package_hashes"""

CREATE_OBJECT_ACCESS_LOG = textwrap.dedent(f"""\
    CREATE TABLE object_access_log
    WITH (
        format = 'Parquet',
        parquet_compression = 'SNAPPY',
        external_location = 's3://{sql_escape(QUERY_RESULT_BUCKET)}/{sql_escape(QUERY_TEMP_DIR)}/object_access_log/'
    )
    AS
    SELECT eventname, date_format(from_iso8601_timestamp(eventtime), '%Y-%m-%d') AS date, bucket, key
    FROM (
        SELECT
            eventname,
            eventtime,
            json_extract_scalar(requestparameters, '$.bucketName') AS bucket,
            json_extract_scalar(requestparameters, '$.key') AS key
        FROM cloudtrail
    )
    -- Filter out non-S3 events, or S3 events like ListBucket that have no object
    WHERE bucket IS NOT NULL AND key IS NOT NULL
""")

CREATE_PACKAGE_HASHES = textwrap.dedent(f"""\
    CREATE TABLE package_hashes
    WITH (
        format = 'Parquet',
        parquet_compression = 'SNAPPY',
        external_location = 's3://{sql_escape(QUERY_RESULT_BUCKET)}/{sql_escape(QUERY_TEMP_DIR)}/package_hashes/'
    )
    AS
    SELECT DISTINCT
        -- Parse a file path like `s3://BUCKET/.quilt/named_packages/USER_NAME/PACKAGE_NAME/VERSION`.
        -- Only take package names and hashes, without versions, to avoid duplicates.
        split_part("$path", '/', 3) AS bucket,
        concat(split_part("$path", '/', 6), '/', split_part("$path", '/', 7)) AS name,
        hash
    FROM named_packages
""")

OBJECT_ACCESS_COUNTS = textwrap.dedent("""\
    SELECT
        eventname,
        bucket,
        key,
        CAST(histogram(date) AS JSON) AS counts
    FROM object_access_log
    GROUP BY eventname, bucket, key
""")

PACKAGE_ACCESS_COUNTS = textwrap.dedent("""\
    SELECT
        eventname,
        package_hashes.bucket AS bucket,
        name,
        CAST(histogram(date) AS JSON) AS counts
    FROM object_access_log JOIN package_hashes
    ON object_access_log.bucket = package_hashes.bucket AND key = concat('.quilt/packages/', hash)
    GROUP BY eventname, package_hashes.bucket, name
""")

PACKAGE_VERSION_ACCESS_COUNTS = textwrap.dedent("""\
    SELECT
        eventname,
        package_hashes.bucket AS bucket,
        name,
        hash,
        CAST(histogram(date) AS JSON) AS counts
    FROM object_access_log JOIN package_hashes
    ON object_access_log.bucket = package_hashes.bucket AND key = concat('.quilt/packages/', hash)
    GROUP BY eventname, package_hashes.bucket, name, hash
""")


athena = boto3.client('athena')
s3 = boto3.client('s3')


def run_query(query_string):
    output = 's3://%s/%s/' % (QUERY_RESULT_BUCKET, QUERY_TEMP_DIR)

    response = athena.start_query_execution(
        QueryString=query_string,
        QueryExecutionContext=dict(Database=ATHENA_DATABASE),
        ResultConfiguration=dict(OutputLocation=output)
    )
    print("Started query:", response)

    execution_id = response['QueryExecutionId']

    return execution_id


def wait_for_query(execution_id):
    while True:
        response = athena.get_query_execution(QueryExecutionId=execution_id)
        print("Query status:", response)
        state = response['QueryExecution']['Status']['State']

        if state == 'RUNNING':
            pass
        elif state == 'SUCCEEDED':
            break
        elif state == 'FAILED':
            raise Exception("Query failed! QueryExecutionId=%r" % execution_id)
        elif state == 'CANCELLED':
            raise Exception("Query cancelled! QueryExecutionId=%r" % execution_id)
        else:
            assert False, "Unexpected state: %s" % state

        time.sleep(5)


def delete_temp_dir():
    params = dict(
        Bucket=QUERY_RESULT_BUCKET,
        Prefix=QUERY_TEMP_DIR,
        MaxKeys=1000,  # The max we're allowed to delete at once.
    )
    while True:
        list_response = s3.list_objects_v2(**params)
        contents = list_response.get('Contents')
        if not contents:
            break

        delete_response = s3.delete_objects(
            Bucket=QUERY_RESULT_BUCKET,
            Delete=dict(
                Objects=[dict(
                    Key=obj['Key']
                ) for obj in contents]
            )
        )
        errors = delete_response.get('Errors')
        if errors:
            print(errors)
            raise Exception("Failed to delete the temporary directory")

        if list_response['IsTruncated']:
            params.update(dict(
                ContinuationToken=list_response['ContinuationToken']
            ))
        else:
            break


def handler(event, context):
    delete_temp_dir()

    # Drop old Athen tables from previous runs.
    # (They're in the DB owned by the stack, so safe to do.)
    for query_id in [run_query(DROP_OBJECT_ACCESS_LOG), run_query(DROP_PACKAGE_HASHES)]:
        wait_for_query(query_id)

    for query_id in [run_query(CREATE_OBJECT_ACCESS_LOG), run_query(CREATE_PACKAGE_HASHES)]:
        wait_for_query(query_id)

    queries = [
        ('Objects', OBJECT_ACCESS_COUNTS),
        ('Packages', PACKAGE_ACCESS_COUNTS),
        ('PackageVersions', PACKAGE_VERSION_ACCESS_COUNTS),
    ]

    execution_ids = [(filename, run_query(query)) for filename, query in queries]

    for filename, execution_id in execution_ids:
        wait_for_query(execution_id)
        src_key = f'{QUERY_TEMP_DIR}/{execution_id}.csv'
        dest_key = f'{ACCESS_COUNTS_OUTPUT_DIR}/{filename}.csv'

        s3.copy(
            CopySource=dict(
                Bucket=QUERY_RESULT_BUCKET,
                Key=src_key
            ),
            Bucket=QUERY_RESULT_BUCKET,
            Key=dest_key
        )
