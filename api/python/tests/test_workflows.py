import unittest
from unittest import mock

from quilt3 import workflows


class WorkflowValidatorConfigDataVersionSupportTest(unittest.TestCase):
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

        patcher = mock.patch.object(workflows.WorkflowValidator, 'CONFIG_DATA_VERSION', self.version)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_supported(self):
        assert self.supported_versions

        for v in self.supported_versions:
            with self.subTest(version=v):
                assert workflows.WorkflowValidator.is_supported_config_data_version(v) is True

    def test_not_supported(self):
        assert self.not_supported_versions

        for v in self.not_supported_versions:
            with self.subTest(version=v):
                assert workflows.WorkflowValidator.is_supported_config_data_version(v) is False


class WorkflowValidatorGetVersionStrTest(unittest.TestCase):
    def test_version_str(self):
        data = {
            'version': '41.0.0',
        }
        assert workflows.WorkflowValidator.get_config_data_version_str(data) == '41.0.0'

    def test_version_object(self):
        data = {
            'version': {
                'ext1': '40.0.0',
                'base': '41.0.0',
                'ext2': '42.0.0',
            }
        }
        assert workflows.WorkflowValidator.get_config_data_version_str(data) == '41.0.0'


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
