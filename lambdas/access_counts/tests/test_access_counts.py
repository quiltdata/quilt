from datetime import datetime, timedelta, timezone
from io import BytesIO
import os
from unittest import TestCase
from unittest.mock import patch

from botocore.stub import Stubber


class TestAccessCounts(TestCase):
    """Tests S3 Select"""
    def setUp(self):
        self.env_patcher = patch.dict(os.environ, {
            'AWS_ACCESS_KEY_ID': 'test_key',
            'AWS_SECRET_ACCESS_KEY': 'test_secret',
            'AWS_DEFAULT_REGION': 'ng-north-1',
            'ATHENA_DATABASE': 'athena-db',
            'CLOUDTRAIL_BUCKET': 'cloudtrail-bucket',
            'QUERY_RESULT_BUCKET': 'results-bucket',
            'ACCESS_COUNTS_OUTPUT_DIR': 'AccessCounts',
        })
        self.env_patcher.start()

        import index

        self.s3_stubber = Stubber(index.s3)
        self.s3_stubber.activate()

        self.athena_stubber = Stubber(index.athena)
        self.athena_stubber.activate()

    def tearDown(self):
        self.athena_stubber.deactivate()
        self.s3_stubber.deactivate()
        self.env_patcher.stop()

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
        import index

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
            method='list_objects_v2',
            expected_params={
                'Bucket': 'results-bucket',
                'Prefix': 'AthenaQueryResults',
                'MaxKeys': 1000,
            },
            service_response={}
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
                'Bucket': 'cloudtrail-bucket',
                'Prefix': 'AWSLogs/123456/CloudTrail/',
                'Delimiter': '/',
            },
            service_response={
                'CommonPrefixes': [{
                    'Prefix': 'AWSLogs/123456/CloudTrail/ng-north-1/'
                }]
            }
        )

        self._run_queries([index.DROP_CLOUDTRAIL, index.DROP_OBJECT_ACCESS_LOG, index.DROP_PACKAGE_HASHES])

        self._run_queries([index.CREATE_CLOUDTRAIL, index.CREATE_OBJECT_ACCESS_LOG, index.CREATE_PACKAGE_HASHES])

        self._run_queries([
            index.REPAIR_OBJECT_ACCESS_LOG,
            index.ADD_CLOUDTRAIL_PARTITION.format(account='123456', region='ng-north-1', year=2009, month=2, day=12),
            index.ADD_CLOUDTRAIL_PARTITION.format(account='123456', region='ng-north-1', year=2009, month=2, day=13),
        ])

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

        self._run_queries([
            index.OBJECT_ACCESS_COUNTS,
            index.PACKAGE_ACCESS_COUNTS,
            index.PACKAGE_VERSION_ACCESS_COUNTS,
            index.BUCKET_ACCESS_COUNTS,
            index.EXTS_ACCESS_COUNTS
        ])

        for idx, name in enumerate(['Objects', 'Packages', 'PackageVersions', 'Bucket', 'Exts']):
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
                    'Key': f'AccessCounts/{name}.csv',
                },
                service_response={}
            )

        with patch('index.now', return_value=now), \
             patch('time.sleep', return_value=None):
            index.handler(None, None)
