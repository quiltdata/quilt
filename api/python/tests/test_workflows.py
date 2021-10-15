import re
import unittest
from unittest import mock

import jsonschema
import pytest
from tests.utils import QuiltTestCase

from quilt3 import Package, workflows


class WorkflowConfigConfigDataVersionSupportTest(unittest.TestCase):
    version = (1, 1, 1)
    supported_versions = [
        (1, 0, 0),
        (1, 0, 1),
        (1, 1, 0),
        (1, 1, 1),
    ]
    not_supported_versions = [
        (2, 0, 0),
        (2, 0, 1),
        (2, 1, 0),
        (2, 1, 1),
    ]

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.version = workflows.ConfigDataVersion._make(cls.version)
        cls.supported_versions = list(map(workflows.ConfigDataVersion._make, cls.supported_versions))
        cls.not_supported_versions = list(map(workflows.ConfigDataVersion._make, cls.not_supported_versions))

    def setUp(self):
        super().setUp()

        patcher = mock.patch.object(workflows.WorkflowConfig, 'CONFIG_DATA_VERSION', self.version)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_supported(self):
        assert self.supported_versions

        for v in self.supported_versions:
            with self.subTest(version=v):
                assert workflows.WorkflowConfig.is_supported_config_data_version(v) is True

    def test_not_supported(self):
        assert self.not_supported_versions

        for v in self.not_supported_versions:
            with self.subTest(version=v):
                assert workflows.WorkflowConfig.is_supported_config_data_version(v) is False


class WorkflowConfigGetVersionStrTest(unittest.TestCase):
    def test_version_str(self):
        data = {
            'version': '41.0.0',
        }
        assert workflows.WorkflowConfig.get_config_data_version_str(data) == '41.0.0'

    def test_version_object(self):
        data = {
            'version': {
                'ext1': '40.0.0',
                'base': '41.0.0',
                'ext2': '42.0.0',
            }
        }
        assert workflows.WorkflowConfig.get_config_data_version_str(data) == '41.0.0'


class ConfigDataVersionParseTest(unittest.TestCase):
    versions = {
        '1': (1, 0, 0),
        '1.0': (1, 0, 0),
        '1.0.0': (1, 0, 0),
        '1.0.1': (1, 0, 1),
        '1.1': (1, 1, 0),
        '1.1.1': (1, 1, 1),
    }

    def test(self):
        for version_string, expected_version in self.versions.items():
            expected_version = workflows.ConfigDataVersion._make(expected_version)
            with self.subTest(version_string=version_string, expected_version=expected_version):
                assert workflows.ConfigDataVersion.parse(version_string) == expected_version


class WorkflowValidatorTestMixin:
    def get_workflow_validator(self, **kwargs):
        return workflows.WorkflowValidator(
            **{
                'data_to_store': None,
                'is_message_required': False,
                'pkg_name_pattern': None,
                'metadata_validator': None,
                'entries_validator': None,
                **kwargs,
            }
        )


class WorkflowValidatorTest(unittest.TestCase, WorkflowValidatorTestMixin):
    JSON_SCHEMA_VALIDATOR_CLS = jsonschema.Draft7Validator

    def test_validate(self):
        pkg_name = 'test/name'
        msg = 'test message'
        meta = {'some': 'meta'}
        pkg = Package()
        pkg.set_meta(meta)

        workflow_validator = self.get_workflow_validator(data_to_store=mock.sentinel.data_to_store)
        methods_to_mock = (
            'validate_name',
            'validate_message',
            'validate_metadata',
            'validate_entries',
        )
        with mock.patch.multiple(workflows.WorkflowValidator, **dict.fromkeys(methods_to_mock, mock.DEFAULT)) as mocks:
            assert workflow_validator.validate(
                name=pkg_name,
                pkg=pkg,
                message=msg,
            ) is mock.sentinel.data_to_store

            mocks['validate_name'].assert_called_once_with(pkg_name)
            mocks['validate_message'].assert_called_once_with(msg)
            mocks['validate_metadata'].assert_called_once_with(meta)
            mocks['validate_entries'].assert_called_once_with(pkg)

    def test_validate_name_noop(self):
        workflow_validator = self.get_workflow_validator(pkg_name_pattern=None)
        workflow_validator.validate_name('foobar')

    def test_validate_name(self):
        workflow_validator = self.get_workflow_validator(pkg_name_pattern=re.compile(r'oob'))
        workflow_validator.validate_name('foobar')

    def test_validate_name_fail(self):
        workflow_validator = self.get_workflow_validator(pkg_name_pattern=re.compile(r'^oob'))
        with pytest.raises(workflows.WorkflowValidationError):
            workflow_validator.validate_name('foobar')

    def test_validate_message_not_required(self):
        workflow_validator = self.get_workflow_validator(is_message_required=False)
        for msg in (
            None,
            '',
            'message',
        ):
            with self.subTest(message=msg):
                workflow_validator.validate_message(msg)

    def test_validate_message_required(self):
        workflow_validator = self.get_workflow_validator(is_message_required=True)
        workflow_validator.validate_message('message')

    def test_validate_message_required_fail(self):
        workflow_validator = self.get_workflow_validator(is_message_required=True)
        for msg in (
            None,
            '',
        ):
            with self.subTest(message=msg):
                with pytest.raises(workflows.WorkflowValidationError):
                    workflow_validator.validate_message(msg)

    def test_validate_metadata_noop(self):
        workflow_validator = self.get_workflow_validator()
        workflow_validator.validate_metadata({})

    def test_validate_metadata(self):
        workflow_validator = self.get_workflow_validator(metadata_validator=self.JSON_SCHEMA_VALIDATOR_CLS(True))
        workflow_validator.validate_metadata({})

    def test_validate_metadata_fail(self):
        workflow_validator = self.get_workflow_validator(metadata_validator=self.JSON_SCHEMA_VALIDATOR_CLS(False))
        with pytest.raises(workflows.WorkflowValidationError):
            workflow_validator.validate_metadata({})

    @mock.patch.object(workflows.WorkflowValidator, 'get_pkg_entries_for_validation')
    def test_validate_pkg_entries_noop(self, get_pkg_entries_for_validation_mock):
        workflow_validator = self.get_workflow_validator()
        workflow_validator.validate_entries(Package())

        get_pkg_entries_for_validation_mock.assert_not_called()

    @mock.patch.object(workflows.WorkflowValidator, 'get_pkg_entries_for_validation')
    def test_validate_pkg_entries(self, get_pkg_entries_for_validation_mock):
        pkg = Package()

        workflow_validator = self.get_workflow_validator(entries_validator=self.JSON_SCHEMA_VALIDATOR_CLS(True))
        workflow_validator.validate_entries(pkg)

        get_pkg_entries_for_validation_mock.assert_called_once_with(pkg)

    @mock.patch.object(workflows.WorkflowValidator, 'get_pkg_entries_for_validation')
    def test_validate_pkg_entries_fail(self, get_pkg_entries_for_validation_mock):
        pkg = Package()

        workflow_validator = self.get_workflow_validator(entries_validator=self.JSON_SCHEMA_VALIDATOR_CLS(False))
        with pytest.raises(workflows.WorkflowValidationError):
            workflow_validator.validate_entries(pkg)

        get_pkg_entries_for_validation_mock.assert_called_once_with(pkg)


class GetPkgEntriesForValidationTest(QuiltTestCase, WorkflowValidatorTestMixin):
    def test(self):
        entries_data = {
            'b/a': bytes(1),
            'a/b': bytes(2),
            'c': bytes(3),
        }
        pkg = Package()
        for lk, data in entries_data.items():
            pkg.set(lk, data)

        workflow_validator = self.get_workflow_validator()
        assert workflow_validator.get_pkg_entries_for_validation(pkg) == [
            {
                'logical_key': 'a/b',
                'size': 2,
            },
            {
                'logical_key': 'b/a',
                'size': 1,
            },
            {
                'logical_key': 'c',
                'size': 3,
            },
        ]
