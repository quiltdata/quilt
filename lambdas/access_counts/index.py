"""
Lambda function that runs Athena queries over CloudTrail logs and .quilt/named_packages/
and creates summaries of object and package access events.
"""

from datetime import datetime, timedelta, timezone
import os
import textwrap
import time

import boto3

ATHENA_DATABASE = os.environ['ATHENA_DATABASE']
# Bucket where CloudTrail logs are located.
CLOUDTRAIL_BUCKET = os.environ['CLOUDTRAIL_BUCKET']
# Bucket where query results will be stored.
QUERY_RESULT_BUCKET = os.environ['QUERY_RESULT_BUCKET']
# Directory where the summary files will be stored.
ACCESS_COUNTS_OUTPUT_DIR = os.environ['ACCESS_COUNTS_OUTPUT_DIR']

# A temporary directory where Athena query results will be written.
QUERY_TEMP_DIR = 'AthenaQueryResults'

# Pre-processed CloudTrail logs, persistent across different runs of the lambda.
OBJECT_ACCESS_LOG_DIR = 'ObjectAccessLog'

# Timestamp for the dir above.
LAST_UPDATE_KEY = f'{OBJECT_ACCESS_LOG_DIR}.last_updated_ts.txt'

# Athena does not allow us to write more than 100 partitions at once.
MAX_OPEN_PARTITIONS = 100


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
""")  # noqa: E501

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
    LOCATION 's3://{sql_escape(QUERY_RESULT_BUCKET)}/{sql_escape(OBJECT_ACCESS_LOG_DIR)}/'
    TBLPROPERTIES ('parquet.compression'='SNAPPY')
""")

REPAIR_OBJECT_ACCESS_LOG = textwrap.dedent("""
    MSCK REPAIR TABLE object_access_log
""")

INSERT_INTO_OBJECT_ACCESS_LOG = textwrap.dedent("""\
    INSERT INTO object_access_log
    SELECT eventname, bucket, key, date_format(eventtime, '%Y-%m-%d') AS date
    FROM (
        SELECT
            eventname,
            from_iso8601_timestamp(eventtime) AS eventtime,
            json_extract_scalar(requestparameters, '$.bucketName') AS bucket,
            json_extract_scalar(requestparameters, '$.key') AS key
        FROM cloudtrail
        WHERE useragent != 'athena.amazonaws.com' AND useragent NOT LIKE '%quilt3-lambdas-es-indexer%'
    )
    -- Filter out non-S3 events, or S3 events like ListBucket that have no object
    -- Select the correct time range
    WHERE bucket IS NOT NULL AND key IS NOT NULL AND
          eventtime >= from_unixtime({{start_ts:f}}) AND eventtime < from_unixtime({{end_ts:f}})
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

# All GROUP BY statements are supposed to be:
# - in the order from most unique values to least unique
# - integers rather than strings

OBJECT_ACCESS_COUNTS = textwrap.dedent("""\
    SELECT
        eventname,
        bucket,
        key,
        CAST(histogram(date) AS JSON) AS counts
    FROM object_access_log
    GROUP BY 3, 2, 1
""")

PACKAGE_ACCESS_COUNTS = textwrap.dedent("""\
    SELECT
        eventname,
        package_hashes.bucket AS bucket,
        name,
        CAST(histogram(date) AS JSON) AS counts
    FROM object_access_log JOIN package_hashes
    ON object_access_log.bucket = package_hashes.bucket AND key = concat('.quilt/packages/', hash)
    GROUP BY 3, 2, 1
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
    GROUP BY 4, 3, 2, 1
""")

BUCKET_ACCESS_COUNTS = textwrap.dedent("""\
    SELECT
        eventname,
        bucket,
        CAST(histogram(date) AS JSON) AS counts
    FROM object_access_log
    GROUP BY 2, 1
""")


EXTS_ACCESS_COUNTS = textwrap.dedent("""\
    SELECT
        eventname,
        bucket,
        ext,
        CAST(histogram(date) AS JSON) AS counts
    FROM (
        SELECT
            eventname,
            bucket,
            lower(CASE
                WHEN cardinality(parts) > 2 AND lower(element_at(parts, -1)) = 'gz'
                    THEN concat(element_at(parts, -2), '.', element_at(parts, -1))
                WHEN cardinality(parts) >= 2 THEN element_at(parts, -1)
                ELSE ''
                END
            ) AS ext,
            date
        FROM (
            SELECT
                eventname,
                bucket,
                split(substr(element_at(split(key, '/'), -1), 2), '.') AS parts,
                date
            FROM object_access_log
        )
    )
    GROUP BY 3, 2, 1
""")


athena = boto3.client('athena')
s3 = boto3.client('s3')


def start_query(query_string):
    output = 's3://%s/%s/' % (QUERY_RESULT_BUCKET, QUERY_TEMP_DIR)

    response = athena.start_query_execution(
        QueryString=query_string,
        QueryExecutionContext=dict(Database=ATHENA_DATABASE),
        ResultConfiguration=dict(OutputLocation=output)
    )
    print("Started query:", response)

    execution_id = response['QueryExecutionId']

    return execution_id


def query_finished(execution_id):
    response = athena.get_query_execution(QueryExecutionId=execution_id)
    print("Query status:", response)
    state = response['QueryExecution']['Status']['State']

    if state == 'RUNNING' or state == 'QUEUED':
        return False
    elif state == 'SUCCEEDED':
        return True
    elif state == 'FAILED':
        raise Exception("Query failed! QueryExecutionId=%r" % execution_id)
    elif state == 'CANCELLED':
        raise Exception("Query cancelled! QueryExecutionId=%r" % execution_id)
    else:
        assert False, "Unexpected state: %s" % state


# Athena limitation for DDL queries.
MAX_CONCURRENT_QUERIES = 20


def run_multiple_queries(query_list):
    results = [None] * len(query_list)

    remaining_queries = list(enumerate(query_list))
    remaining_queries.reverse()  # Just to make unit tests more sane: we use pop() later, so keep the order the same.
    pending_execution_ids = set()

    while remaining_queries or pending_execution_ids:
        # Remove completed queries. Make a copy of the set before iterating over it.
        for execution_id in list(pending_execution_ids):
            if query_finished(execution_id):
                pending_execution_ids.remove(execution_id)

        # Start new queries.
        while remaining_queries and len(pending_execution_ids) < MAX_CONCURRENT_QUERIES:
            idx, query = remaining_queries.pop()
            execution_id = start_query(query)
            results[idx] = execution_id
            pending_execution_ids.add(execution_id)

        time.sleep(5)

    assert all(results)

    return results


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


def now():
    """Only exists for unit testing, cause patching datetime.utcnow() is pretty much impossible."""
    return datetime.now(timezone.utc)


def handler(event, context):
    # End of the CloudTrail time range we're going to look at. Subtract 15min
    # because events can be delayed by that much.
    end_ts = now() - timedelta(minutes=15)

    # Start of the CloudTrail time range: the end timestamp from the previous run, or a year ago if it's the first run.
    try:
        timestamp_str = s3.get_object(Bucket=QUERY_RESULT_BUCKET, Key=LAST_UPDATE_KEY)['Body'].read()
        start_ts = datetime.fromtimestamp(float(timestamp_str), timezone.utc)
    except s3.exceptions.NoSuchKey as ex:
        start_ts = end_ts - timedelta(days=365)
        # We start from scratch, so make sure we don't have any old data.
        delete_dir(QUERY_RESULT_BUCKET, OBJECT_ACCESS_LOG_DIR)

    # We can't write more than 100 days worth of data at a time due to Athena's partitioning limitations.
    # Moreover, we don't want the lambda to time out, so just process 100 days
    # and let the next invocation handle the rest.
    end_ts = min(end_ts, start_ts + timedelta(days=MAX_OPEN_PARTITIONS-1))

    # Delete the temporary directory where Athena query results are written to.
    delete_dir(QUERY_RESULT_BUCKET, QUERY_TEMP_DIR)

    # Create a CloudTrail table, but only with partitions for the last N days, to avoid scanning all of the data.
    # A bucket can have data for multiple accounts and multiple regions, so those need to be handled first.
    partition_queries = []
    for account_response in s3.list_objects_v2(
            Bucket=CLOUDTRAIL_BUCKET, Prefix='AWSLogs/', Delimiter='/').get('CommonPrefixes') or []:
        account = account_response['Prefix'].split('/')[1]
        for region_response in s3.list_objects_v2(
                Bucket=CLOUDTRAIL_BUCKET,
                Prefix=f'AWSLogs/{account}/CloudTrail/', Delimiter='/').get('CommonPrefixes') or []:
            region = region_response['Prefix'].split('/')[3]
            date = start_ts.date()
            while date <= end_ts.date():
                query = ADD_CLOUDTRAIL_PARTITION.format(
                    account=sql_escape(account),
                    region=sql_escape(region),
                    year=date.year,
                    month=date.month,
                    day=date.day
                )
                partition_queries.append(query)
                date += timedelta(days=1)

    # Drop old Athena tables from previous runs.
    # (They're in the DB owned by the stack, so safe to do.)
    run_multiple_queries([DROP_CLOUDTRAIL, DROP_OBJECT_ACCESS_LOG, DROP_PACKAGE_HASHES])

    # Create new Athena tables.
    run_multiple_queries([CREATE_CLOUDTRAIL, CREATE_OBJECT_ACCESS_LOG, CREATE_PACKAGE_HASHES])

    # Load object access log partitions, after the object access log table is created.
    # Create CloudTrail partitions, after the CloudTrail table is created.
    run_multiple_queries([REPAIR_OBJECT_ACCESS_LOG] + partition_queries)

    # Delete the old timestamp: if the INSERT query or put_object fail, make sure we regenerate everything next time,
    # instead of ending up with duplicate logs.
    s3.delete_object(Bucket=QUERY_RESULT_BUCKET, Key=LAST_UPDATE_KEY)

    # Scan CloudTrail and insert new data into "object_access_log".
    insert_query = INSERT_INTO_OBJECT_ACCESS_LOG.format(start_ts=start_ts.timestamp(), end_ts=end_ts.timestamp())
    run_multiple_queries([insert_query])

    # Save the end timestamp.
    s3.put_object(
        Bucket=QUERY_RESULT_BUCKET, Key=LAST_UPDATE_KEY, Body=str(end_ts.timestamp()), ContentType='text/plain')

    queries = [
        ('Objects', OBJECT_ACCESS_COUNTS),
        ('Packages', PACKAGE_ACCESS_COUNTS),
        ('PackageVersions', PACKAGE_VERSION_ACCESS_COUNTS),
        ('Bucket', BUCKET_ACCESS_COUNTS),
        ('Exts', EXTS_ACCESS_COUNTS)
    ]

    execution_ids = run_multiple_queries([query for _, query in queries])

    for (filename, _), execution_id in zip(queries, execution_ids):
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
