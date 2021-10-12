import unittest
from unittest import mock

from quilt3 import workflows, Package


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


class WorkflowValidatorTest(unittest.TestCase):
    def get_workflow_validator(self, **kwargs):
        return workflows.WorkflowValidator(
            **{
                'data_to_store': None,
                'is_message_required': False,
                'handle_pattern': None,
                'metadata_validator': None,
                'entries_validator': None,
                **kwargs,
            }
        )

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
