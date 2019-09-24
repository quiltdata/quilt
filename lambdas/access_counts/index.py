"""
Lambda function that runs Athena queries over CloudTrail logs and .quilt/named_packages/
and creates summaries of object and package access events.
"""

from datetime import datetime, timedelta
import os
import textwrap
import time

import boto3

ATHENA_DATABASE = os.environ['ATHENA_DATABASE']
# Bucket where CloudTrail logs are located.
CLOUDTRAIL_BUCKET = os.environ['CLOUDTRAIL_BUCKET']
# Bucket where query results will be stored.
QUERY_RESULT_BUCKET = os.environ['QUERY_RESULT_BUCKET']
# A temporary directory where Athena query results will be written.
QUERY_TEMP_DIR = os.environ['QUERY_TEMP_DIR']
# Directory where the summary files will be stored.
ACCESS_COUNTS_OUTPUT_DIR = os.environ['ACCESS_COUNTS_OUTPUT_DIR']

DAYS_TO_UPDATE = 7


def sql_escape(s):
    return s.replace("'", "''")


DROP_CLOUDTRAIL = """DROP TABLE IF EXISTS cloudtrail"""
DROP_OBJECT_ACCESS_LOG = """DROP TABLE IF EXISTS object_access_log"""
DROP_PACKAGE_HASHES = """DROP TABLE IF EXISTS package_hashes"""

CREATE_CLOUDTRAIL = textwrap.dedent(f"""\
    CREATE EXTERNAL TABLE cloudtrail (
        eventVersion STRING,
        userIdentity STRUCT<
            type: STRING,
            principalId: STRING,
            arn: STRING,
            accountId: STRING,
            invokedBy: STRING,
            accessKeyId: STRING,
            userName: STRING,
            sessionContext: STRUCT<
                attributes: STRUCT<
                    mfaAuthenticated: STRING,
                    creationDate: STRING>,
                sessionIssuer: STRUCT<
                    type: STRING,
                    principalId: STRING,
                    arn: STRING,
                    accountId: STRING,
                    userName: STRING>>>,
        eventTime STRING,
        eventSource STRING,
        eventName STRING,
        awsRegion STRING,
        sourceIpAddress STRING,
        userAgent STRING,
        errorCode STRING,
        errorMessage STRING,
        requestParameters STRING,
        responseElements STRING,
        additionalEventData STRING,
        requestId STRING,
        eventId STRING,
        resources ARRAY<STRUCT<
            arn: STRING,
            accountId: STRING,
            type: STRING>>,
        eventType STRING,
        apiVersion STRING,
        readOnly STRING,
        recipientAccountId STRING,
        serviceEventDetails STRING,
        sharedEventID STRING,
        vpcEndpointId STRING
    )
    PARTITIONED BY (account STRING, region STRING, year STRING, month STRING, day STRING)
    ROW FORMAT SERDE 'com.amazon.emr.hive.serde.CloudTrailSerde'
    STORED AS INPUTFORMAT 'com.amazon.emr.cloudtrail.CloudTrailInputFormat'
    OUTPUTFORMAT 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
    LOCATION 's3://{sql_escape(CLOUDTRAIL_BUCKET)}/AWSLogs/'
    TBLPROPERTIES ('classification'='cloudtrail')
""")

ADD_CLOUDTRAIL_PARTITION = textwrap.dedent(f"""\
    ALTER TABLE cloudtrail
    ADD PARTITION (account = '{{account}}', region = '{{region}}', year = '{{year:04d}}', month = '{{month:02d}}', day = '{{day:02d}}')
    LOCATION 's3://{sql_escape(CLOUDTRAIL_BUCKET)}/AWSLogs/{{account}}/CloudTrail/{{region}}/{{year:04d}}/{{month:02d}}/{{day:02d}}/'
""")

CREATE_OBJECT_ACCESS_LOG = textwrap.dedent(f"""\
    CREATE EXTERNAL TABLE object_access_log (
        eventname STRING,
        bucket  STRING,
        key STRING
    )
    PARTITIONED BY (date STRING)
    ROW FORMAT SERDE 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe'
    STORED AS INPUTFORMAT 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat'
    OUTPUTFORMAT 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat'
    LOCATION 's3://{sql_escape(QUERY_RESULT_BUCKET)}/ObjectAccessLog/'
    TBLPROPERTIES ('parquet.compression'='SNAPPY')
""")

INSERT_INTO_OBJECT_ACCESS_LOG = textwrap.dedent(f"""\
    INSERT INTO object_access_log
    SELECT eventname, bucket, key, date_format(from_iso8601_timestamp(eventtime), '%Y-%m-%d') AS date
    FROM (
        SELECT
            eventname,
            eventtime,
            json_extract_scalar(requestparameters, '$.bucketName') AS bucket,
            json_extract_scalar(requestparameters, '$.key') AS key
        FROM cloudtrail
        WHERE useragent != 'athena.amazonaws.com' AND useragent NOT LIKE '%quilt3-lambdas-es-indexer%'
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

BUCKET_ACCESS_COUNTS = textwrap.dedent("""\
    SELECT
        eventname,
        bucket,
        CAST(histogram(date) AS JSON) AS counts
    FROM object_access_log
    GROUP BY eventname, bucket
""")


EXTS_ACCESS_COUNTS = textwrap.dedent("""\
    SELECT
        eventname,
        bucket,
        ext,
        CAST(histogram(date) AS JSON) AS counts
    FROM (
        SELECT eventname, bucket, lower(IF(cardinality(parts) > 1, element_at(parts, -1), '')) AS ext, date
        FROM (
            SELECT
                eventname,
                bucket,
                split(element_at(split(key, '/'), -1), '.') AS parts,
                date
            FROM object_access_log
        )
    )
    GROUP BY eventname, bucket, ext
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


def delete_dir(bucket, prefix):
    params = dict(
        Bucket=bucket,
        Prefix=prefix,
        MaxKeys=1000,  # The max we're allowed to delete at once.
    )
    paginator = s3.get_paginator('list_objects_v2')
    for list_response in paginator.paginate(**params):
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
            raise Exception(f"Failed to delete dir: bucket={bucket!r}, prefix={prefix!r}")


def handler(event, context):
    today = datetime.utcnow().date()
    dates = [today - timedelta(days=d) for d in range(DAYS_TO_UPDATE)]

    # Delete the temporary directory where Athena query results are written to.
    delete_dir(QUERY_RESULT_BUCKET, QUERY_TEMP_DIR)

    # Delete the last N days of processed logs, since we're going to re-generate them.
    for date in dates:
        prefix = f'ObjectAccessLog/date={date}'
        delete_dir(QUERY_RESULT_BUCKET, prefix)

    # Create a CloudTrail table, but only with partitions for the last N days, to avoid scanning all of the data.
    # A bucket can have data for multiple accounts and multiple regions, so those need to be handled first.
    partition_queries = []
    for account_response in s3.list_objects_v2(Bucket=CLOUDTRAIL_BUCKET, Prefix='AWSLogs/', Delimiter='/').get('CommonPrefixes') or []:
        account = account_response['Prefix'].split('/')[1]
        for region_response in s3.list_objects_v2(Bucket=CLOUDTRAIL_BUCKET, Prefix=f'AWSLogs/{account}/CloudTrail/', Delimiter='/').get('CommonPrefixes') or []:
            region = region_response['Prefix'].split('/')[3]
            for date in dates:
                query = ADD_CLOUDTRAIL_PARTITION.format(
                    account=account,
                    region=region,
                    year=date.year,
                    month=date.month,
                    day=date.day
                )
                partition_queries.append(query)

    # Drop old Athena tables from previous runs.
    # (They're in the DB owned by the stack, so safe to do.)
    for query_id in [run_query(DROP_CLOUDTRAIL), run_query(DROP_OBJECT_ACCESS_LOG), run_query(DROP_PACKAGE_HASHES)]:
        wait_for_query(query_id)

    # Create new Athena tables.
    for query_id in [run_query(CREATE_CLOUDTRAIL), run_query(CREATE_OBJECT_ACCESS_LOG), run_query(CREATE_PACKAGE_HASHES)]:
        wait_for_query(query_id)

    # Create CloudTrail partitions, after the CloudTrail table is created.
    for query_id in [run_query(q) for q in partition_queries]:
        wait_for_query(query_id)

    # Scan CloudTrail and insert new data into "object_access_log".
    wait_for_query(run_query(INSERT_INTO_OBJECT_ACCESS_LOG))

    queries = [
        ('Objects', OBJECT_ACCESS_COUNTS),
        ('Packages', PACKAGE_ACCESS_COUNTS),
        ('PackageVersions', PACKAGE_VERSION_ACCESS_COUNTS),
        ('Bucket', BUCKET_ACCESS_COUNTS),
        ('Exts', EXTS_ACCESS_COUNTS)
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
