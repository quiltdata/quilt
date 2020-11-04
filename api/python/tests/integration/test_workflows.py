import contextlib
import textwrap

import pytest
from tests.utils import QuiltTestCase

from quilt3 import workflows
from quilt3.backends import get_package_registry
from quilt3.data_transfer import put_bytes
from quilt3.util import PhysicalKey, QuiltException


@contextlib.contextmanager
def get_v1_conf_data(conf_data, **files):
    conf_data = textwrap.dedent(conf_data)
    root = get_package_registry().root.join('schemas')
    pks = list(map(root.join, files))
    for pk, data in zip(pks, files.values()):
        put_bytes(data.encode(), pk)
    conf_data = conf_data.format(**dict(zip(files, pks)))
    yield f'version: "1"\n{conf_data}'


@contextlib.contextmanager
def mock_conf_data(conf_data):
    workflow_conf_pk = get_package_registry().workflow_conf_pk
    put_bytes(conf_data.encode(), workflow_conf_pk)
    yield


@contextlib.contextmanager
def mock_conf_v1(conf_data, **files):
    with get_v1_conf_data(conf_data, **files) as data:
        with mock_conf_data(data):
            yield


class WorkflowTest(QuiltTestCase):
    def _validate(self, registry=None, workflow=..., meta=None, message=None):
        registry = get_package_registry(registry)
        meta = meta or {}
        return workflows.validate(registry=registry, workflow=workflow, meta=meta, message=message)

    def test_no_conf_workflow_not_specified(self):
        assert self._validate() is None

    def test_no_conf_workflow_not_specified_s3(self):
        bucket = 'some-bucket'
        self.s3_stubber.add_client_error(
            'get_object',
            service_error_code='NoSuchKey',
            expected_params={
                'Bucket': bucket,
                'Key': '.quilt/workflows/config.yml',
            },
            http_status_code=404,
        )
        assert self._validate(registry='s3://some-bucket') is None

    def s3_mock_config(self, data, pkg_registry):
        self.s3_stubber.add_response(
            method='get_object',
            service_response={
                'VersionId': 'some-version',
                'Body': self.s3_streaming_body(data.encode()),
            },
            expected_params={
                'Bucket': pkg_registry.root.bucket,
                'Key': pkg_registry.workflow_conf_pk.path,
            }
        )

    def test_no_conf_workflow_specified(self):
        for workflow in (None, 'some-string'):
            with self.subTest(workflow=workflow):
                with pytest.raises(QuiltException) as excinfo:
                    self._validate(workflow=workflow)
                assert repr(workflow) in str(excinfo.value)
                assert "no workflows config exist" in str(excinfo.value)

    @mock_conf_data(',')
    def test_conf_invalid_yaml(self):
        for workflow in (None, 'some-string', ...):
            with self.subTest(workflow=workflow):
                with pytest.raises(QuiltException, match=r"Couldn't parse workflows config as YAML."):
                    self._validate(workflow=workflow)

    @mock_conf_data('')
    def test_conf_invalid(self):
        err_msg = r"Workflows config failed validation: None is not of type 'object'."
        for workflow in (None, 'some-string', ...):
            with self.subTest(workflow=workflow):
                with pytest.raises(QuiltException, match=err_msg):
                    self._validate(workflow=workflow)

    @mock_conf_v1('''
        workflows:
          w1:
            name: Name
    ''')
    def test_workflow_is_required_not_specified(self):
        for workflow in (None, ...):
            with self.subTest(workflow=workflow):
                with pytest.raises(QuiltException, match=r'Workflow is required, but none specified.'):
                    self._validate(workflow=workflow)

    @mock_conf_v1('''
        default_workflow: w1
        workflows:
          w1:
            name: Name
    ''')
    def test_workflow_is_required_default_set(self):
        assert self._validate() == {
            'id': 'w1',
            'config': str(get_package_registry().workflow_conf_pk),
        }

        with pytest.raises(QuiltException, match=r'Workflow is required, but none specified.'):
            self._validate(workflow=None)

    @mock_conf_v1('''
        workflows:
          w1:
            name: Name
    ''')
    def test_missing_workflow(self):
        with pytest.raises(QuiltException, match=r"There is no 'w2' workflow in config."):
            self._validate(workflow='w2')

    @mock_conf_v1('''
        workflows:
          w1:
            name: Name
            metadata_schema: schema-id
    ''')
    def test_missing_schema(self):
        with pytest.raises(QuiltException, match=r"There is no 'schema-id' in schemas."):
            self._validate(workflow='w1')

    @mock_conf_v1('''
        workflows:
          w1:
            name: Name
            metadata_schema: schema-id
        schemas:
          schema-id:
            url: {schema1}
    ''', schema1='{"$ref": "other-schema"}')
    def test_schema_with_ref(self):
        with pytest.raises(QuiltException, match=r"Currently we don't support \$ref in schema."):
            self._validate(workflow='w1')

    @mock_conf_v1('''
        workflows:
          w1:
            name: Name
            metadata_schema: schema-id
        schemas:
          schema-id:
            url: {schema1}
    ''', schema1='{"type": "string"}')
    def test_schema_validation_invalid_meta(self):
        with pytest.raises(QuiltException, match=r"Metadata failed validation: {} is not of type 'string'."):
            self._validate(workflow='w1', meta={})

    @mock_conf_v1('''
        workflows:
          w1:
            name: Name
            metadata_schema: schema-id
        schemas:
          schema-id:
            url: {schema1}
    ''', schema1='{"type": "string"}')
    def test_schema_validation_valid_meta(self):
        assert self._validate(workflow='w1', meta="some-data") == {
            'id': 'w1',
            'config': str(get_package_registry().workflow_conf_pk),
            'schemas': {
                'schema-id': str(get_package_registry().root.join('schemas/schema1')),
            }
        }

    def test_schema_validation_valid_meta_s3(self):
        with get_v1_conf_data('''
            workflows:
              w1:
                name: Name
                metadata_schema: schema-id
            schemas:
              schema-id:
                url: s3://schema-bucket/schema-key
        ''') as data:
            self.s3_mock_config(data, get_package_registry('s3://some-bucket'))
            self.s3_stubber.add_response(
                method='get_object',
                service_response={
                    'VersionId': 'schema-version',
                    'Body': self.s3_streaming_body(b'{"type": "string"}'),
                },
                expected_params={
                    'Bucket': 'schema-bucket',
                    'Key': 'schema-key',
                }
            )
            assert self._validate(registry='s3://some-bucket', workflow='w1', meta="some-data") == {
                'id': 'w1',
                'config': 's3://some-bucket/.quilt/workflows/config.yml?versionId=some-version',
                'schemas': {
                    'schema-id': 's3://schema-bucket/schema-key?versionId=schema-version',
                }
            }

    def test_remote_registry_local_schema(self):
        with get_v1_conf_data('''
            workflows:
              w1:
                name: Name
                metadata_schema: schema-id
            schemas:
              schema-id:
                url: file:///local/path
        ''') as data:
            self.s3_mock_config(data, get_package_registry('s3://some-bucket'))
            schema_pk = PhysicalKey.from_path('/local/path')
            error_msg = rf"Local schema '{schema_pk}' can't be used on the remote registry."
            with pytest.raises(QuiltException, match=error_msg):
                self._validate(registry='s3://some-bucket', workflow='w1')

    @mock_conf_v1('''
        workflows:
          w1:
            name: Name
            is_message_required: true
    ''')
    def test_is_message_required(self):
        assert self._validate(workflow='w1', message='some message') == {
            'id': 'w1',
            'config': str(get_package_registry().workflow_conf_pk),
        }

        error_msg = r'Commit message is required by workflow, but none was provided.'
        for message in (None, ''):
            with self.subTest(message=message):
                with pytest.raises(QuiltException, match=error_msg):
                    self._validate(workflow='w1')
