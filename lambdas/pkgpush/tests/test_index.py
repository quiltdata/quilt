import contextlib
import hashlib
import io
import json
import os
import unittest
from http import HTTPStatus
from unittest import mock

import boto3
import index
from botocore.stub import Stubber
from flask import Response

from quilt3.backends import get_package_registry
from quilt3.packages import Package, PackageEntry
from quilt3.util import PhysicalKey
from t4_lambda_shared.decorator import Request


def hash_data(data):
    return hashlib.sha256(data).hexdigest()


class PackagePromoteTestBase(unittest.TestCase):
    credentials = {
        'access_key': mock.sentinel.TEST_ACCESS_KEY,
        'secret_key': mock.sentinel.TEST_SECRET_KEY,
        'session_token': mock.sentinel.TEST_SESSION_TOKEN,
    }
    handler = staticmethod(index.promote_package)
    parent_bucket = 'parent-bucket'
    src_registry = f's3://{parent_bucket}'
    parent_pkg_name = 'parent/pkg-name'
    parent_commit_message = 'parent commit message'
    dst_bucket = 'dest-bucket'
    dst_registry = f's3://{dst_bucket}'
    dst_pkg_name = 'dest/pkg-name'
    dst_pkg_loc_params = {
        'registry': dst_registry,
        'name': dst_pkg_name,
    }
    mock_timestamp = 1600298935.9767091
    mock_timestamp_pointer_name = '1600298935'
    file_size = 1
    files_number = 2

    @classmethod
    def get_file_data(cls, pk: PhysicalKey):
        return hashlib.sha256(str(pk).encode()).digest()[:1] * cls.file_size

    @classmethod
    def get_file_hash(cls, pk: PhysicalKey):
        return hashlib.sha256(cls.get_file_data(pk)).hexdigest()

    @classmethod
    def get_file_meta(cls, pk: PhysicalKey):
        return {f'meta-{pk}': f'value-{pk}'}

    @classmethod
    def get_pkg_entry(cls, path):
        pk = PhysicalKey.from_url(f's3://{cls.parent_bucket}/{path}?versionId=obj{path}Version')
        return PackageEntry(
            pk,
            cls.file_size,
            {'type': 'SHA256', 'value': cls.get_file_hash(pk)},
            cls.get_file_meta(pk),
        )

    @classmethod
    def prepare_prefix_pkg_entries(cls, prefix, files_range, lk_prefix=''):
        return {
            lk_prefix + str(x): cls.get_pkg_entry(f'{prefix}{x}')
            for x in files_range
        }

    @classmethod
    def get_pkg_entries(cls):
        return cls.prepare_prefix_pkg_entries('test/pkg/', range(cls.files_number))

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        auth_endpoint_patcher = mock.patch.dict(os.environ, {'AUTH_ENDPOINT': 'https://example.com/auth/endpoint'})
        auth_endpoint_patcher.start()

        pkg = Package()
        pkg._set_commit_message(cls.parent_commit_message)
        pkg._workflow = {
            'config': f's3://{cls.parent_bucket}/.quilt/workflows/config.yml?versionId=configVersion',
            'id': 'gamma',
            'schemas': {'top-secret': f's3://{cls.parent_bucket}/top-secret.schema.json?versionId=schemaVersion'},
        }
        pkg.set_meta({'meta': 'old meta'})
        cls.entries = cls.get_pkg_entries()
        for lk, entry in cls.entries.items():
            pkg.set(lk, entry)
        manifest_buf = io.BytesIO()
        pkg._dump(manifest_buf)
        cls.parent_manifest = manifest_buf.getvalue()
        cls.parent_top_hash = pkg.top_hash
        cls.src_params = {
            'parent': {
                'registry': cls.src_registry,
                'name': cls.parent_pkg_name,
                'top_hash': cls.parent_top_hash,
            },
        }

    @staticmethod
    def make_lambda_s3_stubber():
        return Stubber(index.s3)

    def setUp(self):
        super().setUp()
        self.headers = {
            'content-type': 'application/json',
        }
        self.s3_stubber = Stubber(boto3.client('s3'))
        self.s3_stubber.activate()
        self.addCleanup(self.s3_stubber.deactivate)

        s3_client_patcher = mock.patch(
            'quilt3.data_transfer.S3ClientProvider.find_correct_client',
            lambda *args, **kwargs: self.s3_stubber.client,
        )
        s3_client_patcher.start()
        self.addCleanup(s3_client_patcher.stop)

        user_session_mock = mock.NonCallableMagicMock(spec_set=boto3.session.Session)
        user_session_mock.client.return_value = self.s3_stubber.client
        get_user_boto_session_patcher = mock.patch('index.get_user_boto_session', return_value=user_session_mock)
        self.get_user_boto_session_mock = get_user_boto_session_patcher.start()
        self.addCleanup(get_user_boto_session_patcher.stop)

    @contextlib.contextmanager
    def mock_successors(self, successors):
        workflow_validator_mock = mock.MagicMock()
        workflow_validator_mock.config = {
            'successors': successors,
        }
        src_registry = get_package_registry(self.src_registry)

        def side_effect(registry_url):
            if registry_url == self.src_registry:
                return src_registry
            return mock.DEFAULT

        with mock.patch.object(src_registry, 'get_workflow_validator', return_value=workflow_validator_mock), \
             mock.patch('index.get_package_registry', side_effect=side_effect, wraps=get_package_registry):
            yield

    @classmethod
    def _make_event(cls, body, credentials):
        return {
            'httpMethod': 'POST',
            'path': '/foo',
            'pathParameters': {},
            'queryStringParameters': credentials,
            'headers': None,
            'body': body,
            'isBase64Encoded': False,
        }

    def make_request_wrapper(self, params, *, credentials, **kwargs):
        return Request(
            self._make_event(json.dumps(params), credentials=credentials),
        )

    def make_request_base(self, data, *, credentials, **kwargs):
        # This is a function before it gets wrapped with @api decorator.
        # FIXME: find a cleaner way for this.
        status, body, headers = self.handler.__wrapped__(
            self.make_request_wrapper(data, credentials=credentials, **kwargs)
        )
        # Wrap in Flask response to ease migration from/to Flask.
        return Response(body, status, headers)

    @mock.patch('time.time', mock.MagicMock(return_value=mock_timestamp))
    def make_request(self, params, **kwargs):
        self.get_user_boto_session_mock.reset_mock()
        with mock.patch('quilt3.telemetry.reset_session_id') as reset_session_id_mock:
            response = self.make_request_base(params, credentials=self.credentials, **kwargs)

        self.get_user_boto_session_mock.assert_called_once_with(
            aws_access_key_id=mock.sentinel.TEST_ACCESS_KEY,
            aws_secret_access_key=mock.sentinel.TEST_SECRET_KEY,
            aws_session_token=mock.sentinel.TEST_SESSION_TOKEN,
        )
        reset_session_id_mock.assert_called_once_with()

        return response

    def setup_s3_load_pkg_source(self):
        self.s3_stubber.add_response(
            'head_object',
            service_response={
                'VersionId': 'parentManifestVersion',
                'ContentLength': len(self.parent_manifest),
            },
            expected_params={
                'Bucket': self.parent_bucket,
                'Key': f'.quilt/packages/{self.parent_top_hash}',
            },
        )
        self.s3_stubber.add_response(
            'get_object',
            service_response={
                'VersionId': 'manifestVersion',
                'ContentLength': len(self.parent_manifest),
                'Body': io.BytesIO(self.parent_manifest),
            },
            expected_params={
                'Bucket': self.parent_bucket,
                'Key': f'.quilt/packages/{self.parent_top_hash}',
                'VersionId': 'parentManifestVersion',
            },
        )

    def setup_s3(self, expected_pkg, *, copy_data):
        manifest = io.BytesIO()
        expected_pkg.dump(manifest)
        top_hash = expected_pkg.top_hash

        self.setup_s3_load_pkg_source()

        if copy_data:
            for src, (lk, dst) in zip(self.entries.values(), expected_pkg.walk()):
                self.s3_stubber.add_response(
                    method='copy_object',
                    service_response={
                        'VersionId': 'dst_' + src.physical_key.version_id,
                    },
                    expected_params={
                        'CopySource': {
                            'Bucket': src.physical_key.bucket,
                            'Key': src.physical_key.path,
                            'VersionId': src.physical_key.version_id,
                        },
                        'Bucket': self.dst_bucket,
                        'Key': f'{self.dst_pkg_name}/{lk}',
                    }
                )

        # Push new manifest.
        self.s3_stubber.add_response(
            'put_object',
            service_response={
            },
            expected_params={
                'Bucket': self.dst_bucket,
                'Key': f'.quilt/packages/{top_hash}',
                'Body': manifest.getvalue(),
            },
        )
        self.s3_stubber.add_response(
            'put_object',
            service_response={
            },
            expected_params={
                'Body': top_hash.encode(),
                'Bucket': self.dst_bucket,
                'Key': f'.quilt/named_packages/{self.dst_pkg_name}/{str(int(self.mock_timestamp))}'
            }
        )
        self.s3_stubber.add_response(
            'put_object',
            service_response={
                'ResponseMetadata': {'RequestId': 'foo'},
            },
            expected_params={
                'Body': top_hash.encode(),
                'Bucket': self.dst_bucket,
                'Key': f'.quilt/named_packages/{self.dst_pkg_name}/latest'
            }
        )

    def prepare_pkg(self, *, copy_data):
        expected_pkg = Package()
        pkg_entries = self.entries.items()
        if copy_data:
            pkg_entries = [
                (
                    lk,
                    e.with_physical_key(PhysicalKey(
                        self.dst_bucket, f'{self.dst_pkg_name}/{lk}', 'dst_' + e.physical_key.version_id)
                    ),
                )
                for lk, e in pkg_entries
            ]
        for lk, entry in pkg_entries:
            expected_pkg.set(lk, entry)
        expected_pkg._set_commit_message(None)
        return expected_pkg


class PackagePromoteTest(PackagePromoteTestBase):
    max_files_const = 'PROMOTE_PKG_MAX_FILES'

    def setUp(self):
        super().setUp()
        data_transfer_multi_threads_patcher = mock.patch(
            'quilt3.data_transfer.MAX_CONCURRENCY',
            1,
        )
        data_transfer_multi_threads_patcher.start()
        self.addCleanup(data_transfer_multi_threads_patcher.stop)

    @mock.patch('quilt3.workflows.validate', lambda *args, **kwargs: None)
    def test(self):
        params = {
            **self.src_params,
            **self.dst_pkg_loc_params,
        }
        test_params = (
            ({'copy_data': False}, False),
            ({'copy_data': True}, True),
            ({}, True),
        )
        for config_params, expected_copy_data in test_params:
            with self.subTest(config_params=config_params, expected_copy_data=expected_copy_data):
                expected_pkg = self.prepare_pkg(copy_data=expected_copy_data)
                top_hash = expected_pkg.top_hash
                self.setup_s3(expected_pkg=expected_pkg, copy_data=expected_copy_data)

                with self.mock_successors({self.dst_registry: config_params}):
                    response = self.make_request(params)
                    assert (response.status_code, response.json) == (
                        200,
                        {
                            'status': 200,
                            'top_hash': top_hash,
                        },
                    )

    def test_no_auth(self):
        resp = self.make_request_base({}, credentials={})
        assert (resp.status_code, resp.data) == (
            HTTPStatus.BAD_REQUEST,
            b'{"message": "access_key, secret_key, session_token are required."}'
        )

    @mock.patch('quilt3.workflows.validate', lambda *args, **kwargs: None)
    def test_dst_is_not_successor(self):
        params = {
            **self.src_params,
            **self.dst_pkg_loc_params,
        }
        test_params = (
            {'s3://random-bucket': {}},
            {},
        )
        for successors in test_params:
            with self.subTest(successors=successors):
                with self.mock_successors(successors):
                    response = self.make_request(params)
                    assert (response.status_code, response.json) == (
                        400,
                        {
                            'message': f'{self.dst_registry} is not configured as successor.',
                        },
                    )

    @mock.patch('quilt3.workflows.validate', lambda *args, **kwargs: None)
    def test_invalid_successor(self):
        params = {
            **self.src_params,
            **self.dst_pkg_loc_params,
        }
        test_params = (
            's3:/random-bucket',
            'file:///some/path',
        )
        for registry_url in test_params:
            with self.subTest(registry_url=registry_url):
                with self.mock_successors({registry_url: {}}):
                    response = self.make_request(params)
                    assert (response.status_code, response.json) == (
                        400,
                        {
                            'message': f'{registry_url} is not a valid S3 package registry.',
                        },
                    )

    @mock.patch('quilt3.workflows.validate', lambda *args, **kwargs: None)
    def test_files_exceeded(self):
        params = {
            **self.src_params,
            **self.dst_pkg_loc_params,
        }
        expected_pkg = self.prepare_pkg(copy_data=True)
        self.setup_s3(expected_pkg=expected_pkg, copy_data=True)

        with self.mock_successors({self.dst_registry: {'copy_data': True}}), \
             mock.patch(f'index.{self.max_files_const}', 1):
            response = self.make_request(params)
            msg = (
                f"Package has {self.files_number} files, "
                f"but max supported number with `copy_data: true` is 1"
            )
            assert (response.status_code, response.json) == (
                400,
                {
                    'message': msg,
                },
            )

    @mock.patch('index.PROMOTE_PKG_MAX_MANIFEST_SIZE', 1)
    @mock.patch('quilt3.workflows.validate', lambda *args, **kwargs: None)
    def test_manifest_max_size(self):
        params = {
            **self.src_params,
            **self.dst_pkg_loc_params,
        }
        for copy_data in (False, True):
            self.s3_stubber.add_response(
                'head_object',
                service_response={
                    'VersionId': 'parentManifestVersion',
                    'ContentLength': 42,
                },
                expected_params={
                    'Bucket': self.parent_bucket,
                    'Key': f'.quilt/packages/{self.parent_top_hash}',
                },
            )

            with self.mock_successors({self.dst_registry: {'copy_data': copy_data}}):
                response = self.make_request(params)
                msg = 'Manifest size of 42 exceeds supported limit of 1'
                assert (response.status_code, response.json) == (
                    400,
                    {
                        'message': msg,
                    },
                )


@mock.patch('index.PROMOTE_PKG_MAX_PKG_SIZE', 1)
class PackagePromoteTestSizeExceeded(PackagePromoteTestBase):
    file_size = 2
    files_number = 1

    @mock.patch('quilt3.workflows.validate', lambda *args, **kwargs: None)
    def test_copy_data(self):
        params = {
            **self.src_params,
            **self.dst_pkg_loc_params,
        }
        expected_pkg = self.prepare_pkg(copy_data=True)
        self.setup_s3(expected_pkg=expected_pkg, copy_data=True)

        with self.mock_successors({self.dst_registry: {'copy_data': True}}):
            response = self.make_request(params)
            msg = (
                f"Total package size is {self.file_size}, "
                f"but max supported size with `copy_data: true` is 1"
            )
            assert (response.status_code, response.json) == (
                400,
                {
                    'message': msg,
                },
            )

    @mock.patch('quilt3.workflows.validate', lambda *args, **kwargs: None)
    def test_no_copy_data(self):
        params = {
            **self.src_params,
            **self.dst_pkg_loc_params,
        }
        expected_pkg = self.prepare_pkg(copy_data=False)
        top_hash = expected_pkg.top_hash
        self.setup_s3(expected_pkg=expected_pkg, copy_data=False)

        with self.mock_successors({self.dst_registry: {'copy_data': False}}):
            response = self.make_request(params)
            assert (response.status_code, response.json) == (
                200,
                {
                    'status': 200,
                    'top_hash': top_hash,
                },
            )


class PackageFromFolderTest(PackagePromoteTest):
    handler = staticmethod(index.package_from_folder)
    max_files_const = 'PKG_FROM_FOLDER_MAX_FILES'

    # Not relevant.
    test_manifest_max_size = None

    @classmethod
    def get_file_meta(cls, pk: PhysicalKey):
        return {}

    @classmethod
    def setUpClass(cls):
        cls.pkg_entries1 = cls.prepare_prefix_pkg_entries('path1/', files_range=range(2), lk_prefix='lk1/')
        cls.pkg_entries2 = {'lk2': cls.get_pkg_entry('path2')}
        cls.pkg_entries3 = cls.prepare_prefix_pkg_entries('path3/', files_range=range(3), lk_prefix='lk3/')

        super().setUpClass()

        cls.src_params = {
            'registry': cls.src_registry,
            'entries': [
                {
                    'logical_key': 'lk1',
                    'path': 'path1/',
                    'is_dir': True,
                },
                {
                    'logical_key': 'lk2',
                    'path': 'path2',
                    'is_dir': False,
                },
                {
                    'logical_key': 'lk3',
                    'path': 'path3/',
                    'is_dir': True,
                },
            ],
        }
        cls.dst_pkg_loc_params = {
            'dst': cls.dst_pkg_loc_params,
        }

    @classmethod
    def get_pkg_entries(cls):
        return {
            **cls.pkg_entries1,
            **cls.pkg_entries2,
            **cls.pkg_entries3,
        }

    def setup_s3_get_dir_info(self, prefix, entries):
        self.s3_stubber.add_response(
            'list_object_versions',
            service_response={
                'Versions': [
                    {
                        'Key': entry.physical_key.path,
                        'VersionId': entry.physical_key.version_id,
                        'IsLatest': True,
                        'Size': entry.size,
                    }
                    for lk, entry in entries.items()
                ],
            },
            expected_params={
                'Bucket': self.parent_bucket,
                'Prefix': prefix,
            },
        )

    def setup_s3_get_non_dir_info(self, entry):
        self.s3_stubber.add_response(
            'head_object',
            service_response={
                'VersionId': entry.physical_key.version_id,
                'ContentLength': entry.size,
            },
            expected_params={
                'Bucket': self.parent_bucket,
                'Key': entry.physical_key.path,
            },
        )

    def setup_s3_load_pkg_source(self):
        # Setup version IDs retrieval.
        self.setup_s3_get_dir_info('path1/', self.pkg_entries1)
        self.setup_s3_get_non_dir_info(self.pkg_entries2['lk2'])
        self.setup_s3_get_dir_info('path3/', self.pkg_entries3)

        # Setup data retrieval for hashing.
        for lk, entry in self.entries.items():
            self.s3_stubber.add_response(
                'get_object',
                service_response={
                    'Body': io.BytesIO(self.get_file_data(entry.physical_key)),
                },
                expected_params={
                    'Bucket': self.parent_bucket,
                    'Key': entry.physical_key.path,
                    'VersionId': entry.physical_key.version_id,
                },
            )


class PackageTestCase(PackagePromoteTestBase):
    """
    test Package Create endpoint
    """
    handler = staticmethod(index.create_package)
    path = 'data/sample.csv'
    version_id = '1234'
    physical_key = PhysicalKey(
        bucket=PackagePromoteTestBase.parent_bucket,
        path=path,
        version_id=version_id,
    )
    user_request_obj_bucket = 'service-bucket'  # Set in conftest.py.
    user_request_obj_key = 'user-requests/create-package'
    user_request_obj_version_id = 'test-user-request-version-id'
    file_data = b'test file data'
    file_data_size = len(file_data)
    file_data_hash = hash_data(file_data)
    meta = {
        'donut': {
            'type': 'glazed'
        }
    }
    package_entry = {
        'logical_key': path,
        'physical_key': str(physical_key),
        'size': file_data_size,
        'hash': file_data_hash,
    }
    package_entries = [package_entry]

    def make_request_base(self, data, **kwargs):
        stream = io.BytesIO(data)
        with self.make_lambda_s3_stubber() as stubber, \
             mock.patch.object(stubber.client, 'download_fileobj') as mock_download_fileobj, \
             mock.patch('tempfile.TemporaryFile', return_value=stream):
            # Check object size.
            stubber.add_response(
                'head_object',
                service_response={
                    'ContentLength': len(data),
                },
                expected_params={
                    'Bucket': self.user_request_obj_bucket,
                    'Key': self.user_request_obj_key,
                    'VersionId': self.user_request_obj_version_id,
                }
            )
            result = super().make_request_base(self.user_request_obj_version_id, **kwargs)
            mock_download_fileobj.assert_called_once_with(
                self.user_request_obj_bucket,
                self.user_request_obj_key,
                stream,
                ExtraArgs={'VersionId': self.user_request_obj_version_id},
            )
            stubber.assert_no_pending_responses()
            return result

    def make_request(self, params, **kwargs):
        return super().make_request(
            '\n'.join(map(json.dumps, params)).encode()
        )

    @contextlib.contextmanager
    def _mock_package_build(self, entries, message, mock_timestamp, expected_workflow=...):
        # Use a test package to verify manifest entries
        test_pkg = Package()
        test_pkg.set_meta(self.meta)

        # Mock hashing package objects
        for entry in entries:
            pkey = PhysicalKey.from_url(entry['physical_key'])
            hash_obj = {'type': 'SHA256', 'value': entry['hash']}
            test_entry = PackageEntry(pkey, entry['size'], hash_obj, entry.get('meta'))
            test_pkg.set(entry['logical_key'], entry=test_entry)

        mocked_workflow_data = 'some-workflow-data'
        test_pkg._workflow = mocked_workflow_data

        # build the manifest from the test_package
        test_pkg._set_commit_message(message)
        manifest = io.BytesIO()
        test_pkg._dump(manifest)
        manifest.seek(0)

        self.s3_stubber.add_response(
            'put_object',
            service_response={
                'ResponseMetadata': {'RequestId': 'foo'},
            },
            expected_params={
                'Body': manifest.read(),
                'Bucket': self.dst_bucket,
                'Key': f'.quilt/packages/{test_pkg.top_hash}',
            },
        )
        self.s3_stubber.add_response(
            'put_object',
            service_response={
                'ResponseMetadata': {'RequestId': 'foo'},
            },
            expected_params={
                'Body': str.encode(test_pkg.top_hash),
                'Bucket': self.dst_bucket,
                'Key': f'.quilt/named_packages/user/atestpackage/{str(int(mock_timestamp))}',
            },
        )
        self.s3_stubber.add_response(
            'put_object',
            service_response={
                'ResponseMetadata': {'RequestId': 'foo'},
            },
            expected_params={
                'Body': str.encode(test_pkg.top_hash),
                'Bucket': self.dst_bucket,
                'Key': '.quilt/named_packages/user/atestpackage/latest',
            },
        )
        with mock.patch('quilt3.packages.calculate_sha256', return_value=[]) as calculate_sha256_mock, \
             mock.patch('quilt3.workflows.validate', return_value=mocked_workflow_data) as workflow_validate_mock:
            yield
        calculate_sha256_mock.assert_called_once_with([], [])
        workflow_validate_mock.assert_called_once_with(
            registry=get_package_registry(self.dst_registry),
            workflow=expected_workflow,
            meta=self.meta,
            message=message,
        )

    def test_create_package_browser_hash(self):
        """
        Test creating a package with valid inputs including hashes
        from the browser.
        """
        message = 'includes metadata'
        params = {
            'name': 'user/atestpackage',
            'registry': self.dst_registry,
            'message': message,
            'meta': self.meta,
        }

        mock_timestamp = 1600298935.9767091
        with self._mock_package_build(self.package_entries, message, mock_timestamp), \
             mock.patch('time.time') as time_mock:
            time_mock.return_value = mock_timestamp
            pkg_response = self.make_request([
                params,
                *self.package_entries,
            ])
            assert pkg_response.status_code == 200

    @mock.patch('quilt3.workflows.validate', lambda *args, **kwargs: None)
    def test_object_level_meta(self):
        entry1 = {
            'logical_key': 'obj1',
            'physical_key': str(self.physical_key),
            'size': self.file_data_size,
            'hash': self.file_data_hash,
            'meta': {
                'user_meta': {'obj1-user-meta-prop': 'obj1-user-meta-val'},
            },
        }
        entry2 = {
            **entry1,
            'logical_key': 'obj2',
            'meta': {
                'user_meta': {'obj2-user-meta-prop': 'obj2-user-meta-val'},
                'non-user-meta': 42,
            },
        }
        entries = [
            entry1,
            entry2,
        ]
        params = {
            'name': 'user/atestpackage',
            'registry': self.dst_registry,
            'meta': self.meta,
        }

        mock_timestamp = 1600298935.9767091
        with self._mock_package_build(entries, None, mock_timestamp), \
             mock.patch('time.time', return_value=mock_timestamp):
            pkg_response = self.make_request([
                params,
                *entries,
            ])
            print('API Response:')
            print(pkg_response.json)
            assert pkg_response.status_code == 200

    def test_workflow_param(self):
        message = 'includes metadata'
        base_params = {
            'name': 'user/atestpackage',
            'registry': self.dst_registry,
            'message': message,
            'meta': self.meta,
        }
        for params, expected_workflow in (
            ({**base_params}, ...),
            ({**base_params, 'workflow': None}, None),
            ({**base_params, 'workflow': 'some-workflow'}, 'some-workflow'),
        ):
            with self.subTest(params=params, expected_workflow=expected_workflow):
                mock_timestamp = 1600298935.9767091
                with self._mock_package_build(self.package_entries, message, mock_timestamp, expected_workflow), \
                     mock.patch('time.time') as time_mock:
                    time_mock.return_value = mock_timestamp
                    pkg_response = self.make_request([
                        params,
                        *self.package_entries,
                    ])
                    print('API Response:')
                    print(pkg_response.json)
                    assert pkg_response.status_code == 200

    def test_schema_validation(self):
        """
        Test that schema validation fails requests with
        missing or incorrect parameters.
        """
        # Test no name
        pkg_response = self.make_request([
            {
                'registry': self.dst_registry,
                'message': 'test package',
            },
            *self.package_entries,
        ])
        assert pkg_response.status_code == 400

        # Test no registry
        pkg_response = self.make_request([
            {
                'name': 'user/atestpackage',
                'message': 'test package',
            },
            *self.package_entries,
        ])
        assert pkg_response.status_code == 400

    @mock.patch('quilt3.workflows.validate', lambda *args, **kwargs: None)
    def test_missing_required_entries_properties(self):
        for prop_name in ('logical_key', 'physical_key'):
            with self.subTest(prop_name=prop_name):
                entry = self.package_entry.copy()
                entry.pop(prop_name)
                pkg_response = self.make_request([
                    {
                        'name': 'user/atestpackage',
                        'registry': self.dst_registry,
                        'message': 'test package',
                    },
                    entry,
                ])
                assert pkg_response.status_code == 400
                assert pkg_response.get_json()['message'] == f"'{prop_name}' is a required property"

    @mock.patch('quilt3.workflows.validate', lambda *args, **kwargs: None)
    def test_invalid_parameters(self):
        """
        Test that validation fails requests with
        incorrect parameters.
        """
        # Test Invalid package name
        pkg_response = self.make_request([
            {
                'name': 'invalid package name',
                'registry': self.dst_registry,
                'message': 'test package',
            },
            *self.package_entries,
        ])
        assert pkg_response.status_code == 400

        # Test non-s3-registry (e.g., use bucket name not url)
        pkg_response = self.make_request([
            {
                'name': 'invalid/registry',
                'registry': self.dst_bucket,
                'message': 'test package',
            },
            *self.package_entries,
        ])
        assert pkg_response.status_code == 400
        assert pkg_response.json['message'] == f'{self.dst_bucket} is not a valid S3 package registry.'

        # Test entries with file path (not URL)
        bad_pkey = 'foo/bar.csv'
        pkg_response = self.make_request([
            {
                'name': 'invalid/entries',
                'registry': self.dst_registry,
                'message': 'test package',
            },
            {
                'logical_key': self.path,
                'physical_key': bad_pkey,
                'size': self.file_data_size,
                'hash': self.file_data_hash,
            },
        ])
        assert pkg_response.status_code == 400
        assert pkg_response.json['message'] == f'{bad_pkey} is not a valid s3 URL.'

        # Test entries with a valid local URL
        local_pkey = 'file:///foo/bar.csv'
        pkg_response = self.make_request([
            {
                'name': 'invalid/entries',
                'registry': self.dst_registry,
                'message': 'test package',
            },
            {
                'logical_key': 'foo/bar.csv',
                'physical_key': local_pkey,
                'size': self.file_data_size,
                'hash': self.file_data_hash,
            },
        ])
        assert pkg_response.status_code == 400
        assert pkg_response.json['message'] == f'{local_pkey} is not in S3.'

    @mock.patch('quilt3.workflows.validate', lambda *args, **kwargs: None)
    def test_build_error(self):
        """
        Test handling a boto error during package build
        """
        params = {
            'name': 'user/atestpackage',
            'registry': self.dst_registry,
            'message': 'includes metadata',
            'meta': self.meta,
        }

        mock_error_code = 'SomeClientError'
        mock_service_msg = 'Some error details'
        mock_http_code = 403
        self.s3_stubber.add_client_error(
            'put_object',
            service_error_code=mock_error_code,
            service_message=mock_service_msg,
            http_status_code=mock_http_code
        )
        pkg_response = self.make_request([
            params,
            *self.package_entries,
        ])
        assert pkg_response.status_code == mock_http_code
        assert mock_error_code in pkg_response.json['message']
        assert mock_service_msg in pkg_response.json['message']
