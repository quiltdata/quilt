import functools
import json

import botocore.exceptions
import jsonschema
import pkg_resources
import yaml

from quilt3.data_transfer import get_bytes_and_effective_pk

from .. import util
from ..backends import PackageRegistry


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


class WorkflowValidator:
    def __init__(self, config: dict, physical_key: util.PhysicalKey):
        """
        Args:
            config: validated workflow config or `None` if there is no config
            physical_key: from where config was loaded
        """
        self.config = config
        self.physical_key = physical_key

    @classmethod
    def load(cls, pk: util.PhysicalKey):
        data = None
        try:
            data, pk = get_bytes_and_effective_pk(pk)
        except FileNotFoundError:
            pass
        except botocore.exceptions.ClientError as e:
            if e.response['Error']['Code'] != 'NoSuchKey':
                raise util.QuiltException(f"Couldn't load workflows config. {e}.")
        if data is None:
            return

        try:
            # TODO: raise if objects contain duplicate properties
            config = yaml.safe_load(data.decode())
        except yaml.YAMLError as e:
            raise util.QuiltException("Couldn't parse workflows config as YAML.") from e
        conf_validator = _get_conf_validator()
        try:
            conf_validator(config)
        except jsonschema.ValidationError as e:
            raise util.QuiltException(f'Workflows config failed validation: {e.message}.') from e

        return cls(config, pk)

    def validate(self, workflow, meta, message):
        if workflow is ...:
            workflow = self.config.get('default_workflow')

        result = {
            'id': workflow,
            'config': str(self.physical_key),
        }
        if workflow is None:
            if self.config.get('is_workflow_required', True):
                raise util.QuiltException('Workflow required, but none specified.')
            return result

        workflows_data = self.config['workflows']
        if workflow not in workflows_data:
            raise util.QuiltException(f'There is no {workflow!r} workflow in config.')
        workflow_data = workflows_data[workflow]
        metadata_schema_id = workflow_data.get('metadata_schema')
        if metadata_schema_id:
            schemas = self.config.get('schemas', {})
            if metadata_schema_id not in schemas:
                raise util.QuiltException(f'There is no {metadata_schema_id!r} in schemas.')
            schema_url = schemas[metadata_schema_id]['url']
            try:
                schema_pk = util.PhysicalKey.from_url(schema_url)
            except util.URLParseError as e:
                raise util.QuiltException(f"Couldn't parse URL {schema_url!r}. {e}.")
            if schema_pk.is_local() and not self.physical_key.is_local():
                raise util.QuiltException(f"Local schema {str(schema_pk)!r} can't be used on the remote registry.")

            handled_exception = (OSError if schema_pk.is_local() else botocore.exceptions.ClientError)
            try:
                schema_data, schema_pk_to_store = get_bytes_and_effective_pk(schema_pk)
            except handled_exception as e:
                raise util.QuiltException(f"Couldn't load schema at {schema_pk}. {e}.")
            try:
                schema = _load_schema_json(schema_data.decode())
            except json.JSONDecodeError as e:
                raise util.QuiltException(f"Couldn't parse {schema_pk} as JSON. {e}.")

            validator_cls = jsonschema.Draft7Validator
            if isinstance(schema, dict) and '$schema' in schema:
                meta_schema = schema['$schema']
                if not isinstance(meta_schema, str):
                    raise util.QuiltException('$schema must be a string.')
                validator_cls = SUPPORTED_META_SCHEMAS.get(meta_schema)
                if validator_cls is None:
                    raise util.QuiltException(f"Unsupported meta-schema: {meta_schema}.")
            try:
                jsonschema.validate(meta, schema, cls=validator_cls)
            except jsonschema.ValidationError as e:
                raise util.QuiltException(f"Metadata failed validation: {e.message}.")
            result['schemas'] = {metadata_schema_id: str(schema_pk_to_store)}
        if workflow_data.get('is_message_required', False) and not message:
            raise util.QuiltException('Commit message is required by workflow, but none was provided.')

        return result


def validate(*, registry: PackageRegistry, workflow, meta, message):
    # workflow is ... => no workflow provided by user;
    # workflow is None => don't use any workflow.
    if not (workflow in (None, ...) or isinstance(workflow, str)):
        raise TypeError

    workflow_validator = registry.get_workflow_validator()
    if workflow_validator is None:
        if workflow is ...:
            return
        raise util.QuiltException(f'{workflow!r} workflow is specified, but no workflows config exist.')

    return workflow_validator.validate(workflow, meta, message)
