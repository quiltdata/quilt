import os
from datetime import datetime, timedelta, timezone
from io import BytesIO
from unittest import TestCase
from unittest.mock import patch

from botocore.session import Session
from botocore.stub import Stubber

from t4_lambda_access_counts import index


def _normalize_sql(sql):
    return ' '.join(sql.split())


class TestAccessCounts(TestCase):
    """Tests S3 Select"""
    def setUp(self):
        self.s3_stubber = Stubber(index.s3)
        self.s3_stubber.activate()

        self.athena_stubber = Stubber(index.athena)
        self.athena_stubber.activate()

    def tearDown(self):
        self.athena_stubber.deactivate()
        self.s3_stubber.deactivate()

    def _start_query(self, query, execution_id):
        self.athena_stubber.add_response(
            method='start_query_execution',
            expected_params={
                'QueryExecutionContext': {
                    'Database': 'athena-db'
                },
                'QueryString': query,
                'ResultConfiguration': {'OutputLocation': 's3://results-bucket/AthenaQueryResults/'}
            },
            service_response={
                'QueryExecutionId': execution_id
            },
        )

    def _end_query(self, execution_id=None):
        self.athena_stubber.add_response(
            method='get_query_execution',
            expected_params={
                'QueryExecutionId': execution_id
            } if execution_id is not None else None,
            service_response={
                'QueryExecution': {
                    'Status': {
                        'State': 'SUCCEEDED'
                    }
                }
            }
        )

    def _run_queries(self, queries):
        for idx, query in enumerate(queries):
            self._start_query(query, str(idx))

        for _ in queries:
            self._end_query()

    def test_access_counts(self):
        now = datetime.fromtimestamp(1234567890, timezone.utc)
        end_ts = now - timedelta(minutes=15)
        start_ts = now - timedelta(days=1)

        self.s3_stubber.add_response(
            method='get_object',
            expected_params={
                'Bucket': 'results-bucket',
                'Key': 'ObjectAccessLog.last_updated_ts.txt',
            },
            service_response={
                'Body': BytesIO(str(start_ts.timestamp()).encode()),
            }
        )

        self.s3_stubber.add_response(
            method='get_object',
            expected_params={
                'Bucket': 'results-bucket',
                'Key': 'ObjectAccessLog.schema_version.txt',
            },
            service_response={
                'Body': BytesIO(index.OBJECT_ACCESS_LOG_SCHEMA_VERSION.encode()),
            }
        )

        self.s3_stubber.add_response(
            method='list_objects_v2',
            expected_params={
                'Bucket': 'cloudtrail-bucket',
                'Prefix': 'AWSLogs/',
                'Delimiter': '/',
            },
            service_response={
                'CommonPrefixes': [{
                    'Prefix': 'AWSLogs/123456/'
                }]
            }
        )

        self.s3_stubber.add_response(
            method='list_objects_v2',
            expected_params={
                'Bucket': 'results-bucket',
                'Prefix': 'AthenaQueryResults',
                'MaxKeys': 1000,
            },
            service_response={}
        )

        self._run_queries([index.DROP_CLOUDTRAIL, index.DROP_OBJECT_ACCESS_LOG, index.DROP_PACKAGE_HASHES])

        cloudtrail_query = index.CREATE_CLOUDTRAIL.format(
            bucket='cloudtrail-bucket',
            accounts='123456',
            regions=','.join(Session().get_available_regions('s3')),
            start_date='2009/02/12',
            end_date='2009/02/13',
        )
        self._run_queries([cloudtrail_query, index.CREATE_OBJECT_ACCESS_LOG, index.CREATE_PACKAGE_HASHES])

        self._run_queries([index.REPAIR_OBJECT_ACCESS_LOG])

        self.s3_stubber.add_response(
            method='delete_object',
            expected_params={
                'Bucket': 'results-bucket',
                'Key': 'ObjectAccessLog.last_updated_ts.txt',
            },
            service_response={}
        )

        self._run_queries([
            index.INSERT_INTO_OBJECT_ACCESS_LOG.format(start_ts=start_ts.timestamp(), end_ts=end_ts.timestamp()),
        ])

        self.s3_stubber.add_response(
            method='put_object',
            expected_params={
                'Bucket': 'results-bucket',
                'Key': 'ObjectAccessLog.last_updated_ts.txt',
                'ContentType': 'text/plain',
                'Body': str(end_ts.timestamp()),
            },
            service_response={}
        )
        self.s3_stubber.add_response(
            method='put_object',
            expected_params={
                'Bucket': 'results-bucket',
                'Key': 'ObjectAccessLog.schema_version.txt',
                'ContentType': 'text/plain',
                'Body': index.OBJECT_ACCESS_LOG_SCHEMA_VERSION,
            },
            service_response={}
        )

        self._run_queries([
            index.OBJECT_ACCESS_COUNTS,
            index.PACKAGE_ACCESS_COUNTS,
            index.PACKAGE_VERSION_ACCESS_COUNTS,
            index.BUCKET_ACCESS_COUNTS,
            index.EXTS_ACCESS_COUNTS,
            index.USER_PACKAGE_ACCESS_COUNTS,
        ])

        for idx, (output_dir, name) in enumerate([
            ('AccessCounts', 'Objects'),
            ('AccessCounts', 'Packages'),
            ('AccessCounts', 'PackageVersions'),
            ('AccessCounts', 'Bucket'),
            ('AccessCounts', 'Exts'),
            ('UserAccessCounts', 'Users'),
        ]):
            self.s3_stubber.add_response(
                method='head_object',
                expected_params={
                    'Bucket': 'results-bucket',
                    'Key': f'AthenaQueryResults/{idx}.csv',
                },
                service_response={
                    'ContentLength': 123
                }
            )
            self.s3_stubber.add_response(
                method='copy_object',
                expected_params={
                    'CopySource': {
                        'Bucket': 'results-bucket',
                        'Key': f'AthenaQueryResults/{idx}.csv',
                    },
                    'Bucket': 'results-bucket',
                    'Key': f'{output_dir}/{name}.csv',
                },
                service_response={}
            )

        with patch('t4_lambda_access_counts.index.now', return_value=now), \
             patch('time.sleep', return_value=None):
            index.handler(None, None)

    def test_username_sql(self):
        object_access_sql = _normalize_sql(index.CREATE_OBJECT_ACCESS_LOG)
        assert 'eventname STRING, bucket STRING, key STRING, username STRING' in object_access_sql

        insert_sql = _normalize_sql(index.INSERT_INTO_OBJECT_ACCESS_LOG)
        assert 'SELECT eventname, bucket, key, username, date_format(eventtime' in insert_sql
        assert "coalesce(nullif(split_part(useridentity.principalId, ':', 2), ''), 'unknown') AS username" in insert_sql

        user_counts_sql = _normalize_sql(index.USER_PACKAGE_ACCESS_COUNTS)
        assert 'eventname, bucket, username, name, CAST(map_agg(date, count) AS JSON) AS counts' in user_counts_sql
        assert 'GROUP BY 5, 4, 3, 2, 1' in user_counts_sql
        assert 'GROUP BY 4, 3, 2, 1' in user_counts_sql
        assert 'AccessCounts' != index.USER_ACCESS_COUNTS_OUTPUT_DIR

    def test_get_earliest_cloudtrail_ts(self):
        self.s3_stubber.add_response(
            method='list_objects_v2',
            expected_params={
                'Bucket': 'cloudtrail-bucket',
                'Prefix': 'AWSLogs/123456/CloudTrail/us-east-1/',
                'MaxKeys': 10,
            },
            service_response={
                'Contents': [
                    {'Key': 'AWSLogs/123456/CloudTrail/us-east-1/'},
                    {'Key': 'AWSLogs/123456/CloudTrail/us-east-1/2020/06/01/log.json.gz'},
                ],
            },
        )
        self.s3_stubber.add_response(
            method='list_objects_v2',
            expected_params={
                'Bucket': 'cloudtrail-bucket',
                'Prefix': 'AWSLogs/123456/CloudTrail/us-west-2/',
                'MaxKeys': 10,
            },
            service_response={
                'Contents': [
                    {'Key': 'AWSLogs/123456/CloudTrail/us-west-2/2019/05/31/log.json.gz'},
                ],
            },
        )

        assert index.get_earliest_cloudtrail_ts(
            ['123456'],
            ['us-east-1', 'us-west-2'],
        ) == datetime(2019, 5, 31, tzinfo=timezone.utc)
