import textwrap

import pytest
from tests.utils import QuiltTestCase

from quilt3 import workflows
from quilt3.backends import get_package_registry
from quilt3.data_transfer import put_bytes
from quilt3.util import PhysicalKey, QuiltException


def get_v1_conf_data(conf_data):
    conf_data = textwrap.dedent(conf_data)
    return f'version: "1"\n{conf_data}'


def set_local_conf_data(conf_data):
    put_bytes(conf_data.encode(), get_package_registry().workflow_conf_pk)


def create_local_tmp_schema(data):
    pk = get_package_registry().root.join('schemas/schema')
    put_bytes(data.encode(), pk)
    return pk


class WorkflowTest(QuiltTestCase):
    def _validate(self, registry=None, workflow=..., meta=None, message=None):
        registry = get_package_registry(registry)
        meta = meta or {}
        return workflows.validate(registry=registry, workflow=workflow, meta=meta, message=message)

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
        assert self._validate(registry=f's3://{bucket}') is None

    def test_no_conf_workflow_specified(self):
        for workflow in (None, 'some-string'):
            with self.subTest(workflow=workflow):
                with pytest.raises(QuiltException) as excinfo:
                    self._validate(workflow=workflow)
                assert repr(workflow) in str(excinfo.value)
                assert "no workflows config exist" in str(excinfo.value)

    def test_conf_invalid_yaml(self):
        set_local_conf_data(',')
        for workflow in (None, 'some-string', ...):
            with self.subTest(workflow=workflow):
                with pytest.raises(QuiltException, match=r"Couldn't parse workflows config as YAML."):
                    self._validate(workflow=workflow)

    def test_conf_load_error_s3(self):
        bucket = 'some-bucket'
        self.s3_stubber.add_client_error(
            'get_object',
            service_error_code='AccessDenied',
            expected_params={
                'Bucket': bucket,
                'Key': '.quilt/workflows/config.yml',
            },
            http_status_code=403,
        )
        with pytest.raises(QuiltException, match=r"Couldn't load workflows config."):
            self._validate(registry=f's3://{bucket}')

    def test_conf_invalid(self):
        set_local_conf_data('')
        err_msg = r"Workflows config failed validation: None is not of type 'object'."
        for workflow in (None, 'some-string', ...):
            with self.subTest(workflow=workflow):
                with pytest.raises(QuiltException, match=err_msg):
                    self._validate(workflow=workflow)

    def test_workflow_is_required_not_specified(self):
        set_local_conf_data(get_v1_conf_data('''
            workflows:
              w1:
                name: Name
        '''))
        for workflow in (None, ...):
            with self.subTest(workflow=workflow):
                with pytest.raises(QuiltException, match=r'Workflow required, but none specified.'):
                    self._validate(workflow=workflow)

    def test_workflow_is_required_default_set(self):
        set_local_conf_data(get_v1_conf_data('''
            default_workflow: w1
            workflows:
              w1:
                name: Name
        '''))

        assert self._validate() == {
            'id': 'w1',
            'config': str(get_package_registry().workflow_conf_pk),
        }

        with pytest.raises(QuiltException, match=r'Workflow required, but none specified.'):
            self._validate(workflow=None)

    def test_workflow_not_required_not_specified(self):
        set_local_conf_data(get_v1_conf_data('''
            is_workflow_required: false
            workflows:
              w1:
                name: Name
        '''))
        for workflow in (None, ...):
            with self.subTest(workflow=workflow):
                assert self._validate(workflow=workflow) == {
                    'id': None,
                    'config': str(get_package_registry().workflow_conf_pk),
                }

    def test_workflow_not_required_default_set(self):
        set_local_conf_data(get_v1_conf_data('''
            is_workflow_required: false
            default_workflow: w1
            workflows:
              w1:
                name: Name
        '''))

        assert self._validate() == {
            'id': 'w1',
            'config': str(get_package_registry().workflow_conf_pk),
        }

        assert self._validate(workflow=None) == {
            'id': None,
            'config': str(get_package_registry().workflow_conf_pk),
        }

    def test_missing_workflow(self):
        set_local_conf_data(get_v1_conf_data('''
            workflows:
              w1:
                name: Name
        '''))

        with pytest.raises(QuiltException, match=r"There is no 'w2' workflow in config."):
            self._validate(workflow='w2')

    def test_missing_schema(self):
        set_local_conf_data(get_v1_conf_data('''
            workflows:
              w1:
                name: Name
                metadata_schema: schema-id
        '''))

        with pytest.raises(QuiltException, match=r"There is no 'schema-id' in schemas."):
            self._validate(workflow='w1')

    def test_schema_invalid_meta_schema(self):
        set_local_conf_data(get_v1_conf_data('''
            workflows:
              w1:
                name: Name
                metadata_schema: schema-id
            schemas:
              schema-id:
                url: %s
        ''' % create_local_tmp_schema('{"$schema": 42}')))
        with pytest.raises(QuiltException, match=r'\$schema must be a string.'):
            self._validate(workflow='w1')

    def test_schema_invalid_json(self):
        tmp_schema = create_local_tmp_schema('"')
        set_local_conf_data(get_v1_conf_data('''
            workflows:
              w1:
                name: Name
                metadata_schema: schema-id
            schemas:
              schema-id:
                url: %s
        ''' % tmp_schema))
        with pytest.raises(QuiltException, match=fr"Couldn't parse {tmp_schema} as JSON."):
            self._validate(workflow='w1')

    def test_schema_load_error(self):
        schema_pk = get_package_registry().root.join('nonexistent-schema')
        set_local_conf_data(get_v1_conf_data('''
            workflows:
              w1:
                name: Name
                metadata_schema: schema-id
            schemas:
              schema-id:
                url: %s
        ''' % schema_pk))
        with pytest.raises(QuiltException, match=fr"Couldn't load schema at {schema_pk}"):
            self._validate(workflow='w1')

    def test_schema_load_error_s3(self):
        schema_pk = PhysicalKey.from_url('s3://schema-bucket/schema-key')
        data = get_v1_conf_data('''
            workflows:
              w1:
                name: Name
                metadata_schema: schema-id
            schemas:
              schema-id:
                url: %s
        ''' % schema_pk)
        registry = get_package_registry('s3://some-bucket')
        self.s3_mock_config(data, registry)
        self.s3_stubber.add_client_error(
            'get_object',
            service_error_code='NoSuchKey',
            expected_params={
                'Bucket': 'schema-bucket',
                'Key': 'schema-key',
            },
            http_status_code=404,
        )
        with pytest.raises(QuiltException, match=fr"Couldn't load schema at {schema_pk}"):
            self._validate(registry=registry, workflow='w1')

    def test_schema_with_ref(self):
        set_local_conf_data(get_v1_conf_data('''
            workflows:
              w1:
                name: Name
                metadata_schema: schema-id
            schemas:
              schema-id:
                url: %s
        ''' % create_local_tmp_schema('{"$ref": "other-schema"}')))

        with pytest.raises(QuiltException, match=r"Currently we don't support \$ref in schema."):
            self._validate(workflow='w1')

    def test_schema_validation_invalid_meta(self):
        set_local_conf_data(get_v1_conf_data('''
            workflows:
              w1:
                name: Name
                metadata_schema: schema-id
            schemas:
              schema-id:
                url: %s
        ''' % create_local_tmp_schema('{"type": "string"}')))

        with pytest.raises(QuiltException, match=r"Metadata failed validation: {} is not of type 'string'."):
            self._validate(workflow='w1', meta={})

    def test_schema_validation_valid_meta(self):
        set_local_conf_data(get_v1_conf_data('''
            workflows:
              w1:
                name: Name
                metadata_schema: schema-id
            schemas:
              schema-id:
                url: %s
        ''' % create_local_tmp_schema('{"type": "string"}')))

        assert self._validate(workflow='w1', meta="some-data") == {
            'id': 'w1',
            'config': str(get_package_registry().workflow_conf_pk),
            'schemas': {
                'schema-id': str(get_package_registry().root.join('schemas/schema')),
            },
        }

    def test_schema_validation_valid_meta_s3(self):
        schema_urls = {
            's3://schema-bucket/schema-key?versionId=schema-version': {
                'Bucket': 'schema-bucket',
                'Key': 'schema-key',
                'VersionId': 'schema-version',
            },
            's3://schema-bucket/schema-key': {
                'Bucket': 'schema-bucket',
                'Key': 'schema-key',
            },
        }
        for schema_url, expected_params in schema_urls.items():
            data = get_v1_conf_data('''
                workflows:
                  w1:
                    name: Name
                    metadata_schema: schema-id
                schemas:
                  schema-id:
                    url: %s
            ''' % schema_url)
            with self.subTest(schema_url=schema_url):
                self.s3_mock_config(data, get_package_registry('s3://some-bucket'))
                self.s3_stubber.add_response(
                    method='get_object',
                    service_response={
                        'VersionId': 'schema-version',
                        'Body': self.s3_streaming_body(b'{"type": "string"}'),
                    },
                    expected_params=expected_params,
                )
                assert self._validate(registry='s3://some-bucket', workflow='w1', meta="some-data") == {
                    'id': 'w1',
                    'config': 's3://some-bucket/.quilt/workflows/config.yml?versionId=some-version',
                    'schemas': {
                        'schema-id': 's3://schema-bucket/schema-key?versionId=schema-version',
                    },
                }

    def test_remote_registry_local_schema(self):
        data = get_v1_conf_data('''
            workflows:
              w1:
                name: Name
                metadata_schema: schema-id
            schemas:
              schema-id:
                url: file:///local/path
        ''')
        registry = 's3://some-bucket'
        self.s3_mock_config(data, get_package_registry(registry))
        schema_pk = PhysicalKey.from_path('/local/path')
        error_msg = rf"Local schema '{schema_pk}' can't be used on the remote registry."
        with pytest.raises(QuiltException, match=error_msg):
            self._validate(registry=registry, workflow='w1')

    def test_is_message_required(self):
        set_local_conf_data(get_v1_conf_data('''
            workflows:
              w1:
                name: Name
                is_message_required: true
        '''))

        assert self._validate(workflow='w1', message='some message') == {
            'id': 'w1',
            'config': str(get_package_registry().workflow_conf_pk),
        }

        error_msg = r'Commit message is required by workflow, but none was provided.'
        for message in (None, ''):
            with self.subTest(message=message):
                with pytest.raises(QuiltException, match=error_msg):
                    self._validate(workflow='w1')

    def test_invalid_url(self):
        for url in (',', 'http://example.com', 's3://'):
            with self.subTest(url=url):
                set_local_conf_data(get_v1_conf_data(f'''
                    workflows:
                      w1:
                        name: Name
                        metadata_schema: schema-id
                    schemas:
                      schema-id:
                        url: "{url}"
                '''))
                with pytest.raises(QuiltException, match=fr"Couldn't parse URL '{url}'."):
                    self._validate(workflow='w1')

    def test_unsupported_meta_schema(self):
        for meta_schema in (
            'http://json-schema.org/draft-07/schema',
            'http://json-schema.org/draft-06/schema#',
        ):
            with self.subTest(meta_schema=meta_schema):
                set_local_conf_data(get_v1_conf_data('''
                    workflows:
                      w1:
                        name: Name
                        metadata_schema: schema-id
                    schemas:
                      schema-id:
                        url: %s
                ''' % create_local_tmp_schema(f'{{"$schema": "{meta_schema}"}}')))
                with pytest.raises(QuiltException, match=fr"Unsupported meta-schema: {meta_schema}."):
                    self._validate(workflow='w1')

    def test_supported_meta_schema(self):
        for meta_schema in (
            'http://json-schema.org/draft-07/schema#',
        ):
            with self.subTest(meta_schema=meta_schema):
                set_local_conf_data(get_v1_conf_data('''
                    workflows:
                      w1:
                        name: Name
                        metadata_schema: schema-id
                    schemas:
                      schema-id:
                        url: %s
                ''' % create_local_tmp_schema(f'{{"$schema": "{meta_schema}"}}')))
                assert self._validate(workflow='w1') == {
                    'id': 'w1',
                    'config': str(get_package_registry().workflow_conf_pk),
                    'schemas': {
                        'schema-id': str(get_package_registry().root.join('schemas/schema')),
                    },
                }

    def test_successors(self):
        set_local_conf_data(get_v1_conf_data('''
            workflows:
              w1:
                name: Name
            successors:
              s3://some-bucket:
                title: successor title
        '''))
        assert self._validate(workflow='w1') == {
            'id': 'w1',
            'config': str(get_package_registry().workflow_conf_pk),
        }
