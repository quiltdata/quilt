import functools
import json
import re
import typing

import botocore.exceptions
import jsonschema
import pkg_resources
import yaml

from quilt3.data_transfer import get_bytes_and_effective_pk

from .. import util
from ..backends import PackageRegistry


class ConfigDataVersion(typing.NamedTuple):
    major: int
    minor: int
    patch: int

    @classmethod
    def parse(cls, version_str: str):
        """
        Parse valid version string.
        """
        return cls._make(((*map(int, version_str.split('.')), 0, 0)[:3]))

    def __str__(self):
        return '%s.%s.%s' % self


JSONSchemaError = typing.Union[jsonschema.ValidationError, jsonschema.SchemaError]


class WorkflowErrorBase(util.QuiltException):
    schema_validation_error: JSONSchemaError = None

    @classmethod
    def from_schema_validation_error(cls, message: str, err: JSONSchemaError):
        obj = cls(f'{message}: {err.message}.')
        obj.schema_validation_error = err
        return obj


class ConfigurationError(WorkflowErrorBase):
    pass


class UnsupportedConfigurationVersionError(ConfigurationError):
    def __init__(self, version: ConfigDataVersion):
        self.version = version
        super().__init__(f"Version '{version}' is not supported")


class WorkflowValidationError(WorkflowErrorBase):
    pass


@functools.lru_cache(maxsize=None)
def _get_conf_validator():
    schema = json.loads(pkg_resources.resource_string(__name__, 'config-1.schema.json'))
    return jsonschema.Draft7Validator(schema).validate


SUPPORTED_META_SCHEMAS = {
    'http://json-schema.org/draft-07/schema#': jsonschema.Draft7Validator,
}


def _schema_load_object_hook(o):
    if '$ref' in o:
        raise util.QuiltException("Currently we don't support $ref in schema.")
    return o


_load_schema_json = json.JSONDecoder(object_hook=_schema_load_object_hook).decode


class WorkflowConfig:
    CONFIG_DATA_VERSION = ConfigDataVersion(1, 1, 0)

    def __init__(self, config: dict, physical_key: util.PhysicalKey):
        """
        Args:
            config: validated workflow config or `None` if there is no config
            physical_key: from where config was loaded
        """
        self.config = config
        self.physical_key = physical_key
        self.loaded_schemas_by_id = {}
        self.loaded_schemas = {}

    @staticmethod
    def get_config_data_version_str(data: dict) -> str:
        version_obj = data['version']
        assert isinstance(version_obj, (str, dict))
        return version_obj if isinstance(version_obj, str) else version_obj['base']

    @classmethod
    def is_supported_config_data_version(cls, version: ConfigDataVersion):
        return cls.CONFIG_DATA_VERSION >= version

    @classmethod
    def load(cls, pk: util.PhysicalKey):
        data = None
        try:
            data, pk = get_bytes_and_effective_pk(pk)
        except FileNotFoundError:
            pass
        except botocore.exceptions.ClientError as e:
            if e.response['Error']['Code'] != 'NoSuchKey':
                raise ConfigurationError(f"Couldn't load workflows config. {e}.")
        if data is None:
            return

        try:
            # TODO: raise if objects contain duplicate properties
            config = yaml.safe_load(data.decode())
        except yaml.YAMLError as e:
            raise ConfigurationError("Couldn't parse workflows config as YAML.") from e
        conf_validator = _get_conf_validator()
        try:
            conf_validator(config)
        except jsonschema.ValidationError as e:
            raise ConfigurationError.from_schema_validation_error('Workflows config failed validation', e) from e

        version_str = cls.get_config_data_version_str(config)
        version = ConfigDataVersion.parse(version_str)
        if not cls.is_supported_config_data_version(version):
            raise UnsupportedConfigurationVersionError(version)

        return cls(config, pk)

    def get_pk_for_schema_id(self, schema_id: str) -> util.PhysicalKey:
        schemas = self.config.get('schemas', {})
        if schema_id not in schemas:
            raise ConfigurationError(f'There is no {schema_id!r} in schemas.')
        schema_url = schemas[schema_id]['url']
        try:
            schema_pk = util.PhysicalKey.from_url(schema_url)
        except util.URLParseError as e:
            raise ConfigurationError(f"Couldn't parse URL {schema_url!r}.") from e
        if schema_pk.is_local() and not self.physical_key.is_local():
            raise ConfigurationError(f"Local schema {str(schema_pk)!r} can't be used on the remote registry.")

        return schema_pk

    def load_schema(self, schema_pk: util.PhysicalKey) -> (bytes, util.PhysicalKey):
        handled_exception = (OSError if schema_pk.is_local() else botocore.exceptions.ClientError)
        try:
            return get_bytes_and_effective_pk(schema_pk)
        except handled_exception as e:
            raise ConfigurationError(f"Couldn't load schema at {schema_pk}.") from e

    def make_validator_from_schema(self, schema_id):
        if schema_id in self.loaded_schemas_by_id:
            return self.loaded_schemas_by_id[schema_id][0]

        schema_pk = self.get_pk_for_schema_id(schema_id)
        if str(schema_pk) in self.loaded_schemas:
            self.loaded_schemas_by_id[schema_id] = self.loaded_schemas[str(schema_pk)]
            return self.loaded_schemas_by_id[schema_id][0]

        schema_data, schema_pk_to_store = self.load_schema(schema_pk)
        try:
            schema = _load_schema_json(schema_data.decode())
        except json.JSONDecodeError as e:
            raise ConfigurationError(f"Couldn't parse {schema_pk} as JSON.") from e

        validator_cls = jsonschema.Draft7Validator
        if isinstance(schema, dict) and '$schema' in schema:
            meta_schema = schema['$schema']
            if not isinstance(meta_schema, str):
                raise ConfigurationError('$schema must be a string.')
            validator_cls = SUPPORTED_META_SCHEMAS.get(meta_schema)
            if validator_cls is None:
                raise ConfigurationError(f"Unsupported meta-schema: {meta_schema}.")

        try:
            validator_cls.check_schema(schema)
        except jsonschema.SchemaError as e:
            raise ConfigurationError.from_schema_validation_error(f'Schema {schema_id!r} is not valid', e) from e

        validator = validator_cls(schema)
        self.loaded_schemas_by_id[schema_id] = self.loaded_schemas[str(schema_pk)] = (validator, schema_pk_to_store)
        return validator

    def get_workflow_validator(self, workflow):
        if workflow is ...:
            workflow = self.config.get('default_workflow')

        workflows_data = self.config['workflows']
        if workflow is None:
            if self.config.get('is_workflow_required', True):
                raise util.QuiltException('Workflow required, but none specified.')
            workflow_data = {}
        elif workflow not in workflows_data:
            raise util.QuiltException(f'There is no {workflow!r} workflow in config.')
        else:
            workflow_data = workflows_data[workflow]

        pkg_name_pattern = workflow_data.get('handle_pattern')
        pkg_name_pattern = re.compile(pkg_name_pattern) if pkg_name_pattern else None

        metadata_schema_id = workflow_data.get('metadata_schema')
        metadata_validator = self.make_validator_from_schema(metadata_schema_id) if metadata_schema_id else None

        entries_schema_id = workflow_data.get('entries_schema')
        entries_validator = self.make_validator_from_schema(entries_schema_id) if entries_schema_id else None

        is_message_required = workflow_data.get('is_message_required', False)

        data_to_store = {
            'id': workflow,
            'config': str(self.physical_key),
        }
        if self.loaded_schemas:
            data_to_store['schemas'] = {
                schema_id: str(x[1])
                for schema_id, x in self.loaded_schemas_by_id.items()
            }

        return WorkflowValidator(
            data_to_store=data_to_store,
            is_message_required=is_message_required,
            pkg_name_pattern=pkg_name_pattern,
            metadata_validator=metadata_validator,
            entries_validator=entries_validator,
        )


class WorkflowValidator(typing.NamedTuple):
    data_to_store: dict
    is_message_required: bool
    pkg_name_pattern: typing.Optional[typing.Pattern[str]]
    metadata_validator: typing.Any
    entries_validator: typing.Any

    def validate_name(self, name):
        if self.pkg_name_pattern and not self.pkg_name_pattern.search(name):
            raise WorkflowValidationError("Package name doesn't match required pattern.")

    def validate_message(self, message):
        if self.is_message_required and not message:
            raise WorkflowValidationError('Commit message is required by workflow, but none was provided.')

    def validate_metadata(self, meta):
        if self.metadata_validator is None:
            return
        try:
            self.metadata_validator.validate(meta)
        except jsonschema.ValidationError as e:
            raise WorkflowValidationError.from_schema_validation_error('Metadata failed validation', e) from e

    def validate_entries(self, pkg):
        if self.entries_validator is None:
            return
        try:
            self.entries_validator.validate(self.get_pkg_entries_for_validation(pkg))
        except jsonschema.ValidationError as e:
            raise WorkflowValidationError.from_schema_validation_error('"Package entries failed validation', e) from e

    def get_pkg_entries_for_validation(self, pkg):
        # TODO: this should be validated without fully populating array.
        return [
            {
                'logical_key': lk,
                'size': e.size
            }
            for lk, e in pkg.walk()
        ]

    def validate(self, *, name, pkg, message):
        self.validate_message(message)
        self.validate_name(name)
        self.validate_metadata(pkg.meta)
        self.validate_entries(pkg)

        return self.data_to_store


def validate(*, registry: PackageRegistry, workflow, name, pkg, message):
    # workflow is ... => no workflow provided by user;
    # workflow is None => don't use any workflow.
    if not (workflow in (None, ...) or isinstance(workflow, str)):
        raise TypeError

    workflow_config = registry.get_workflow_config()
    if workflow_config is None:
        if workflow is ...:
            return
        raise util.QuiltException(f'{workflow!r} workflow is specified, but no workflows config exist.')

    workflow_validator = workflow_config.get_workflow_validator(workflow)
    return workflow_validator.validate(name=name, pkg=pkg, message=message)
