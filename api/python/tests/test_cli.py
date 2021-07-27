from unittest import mock
from unittest.mock import patch

import pytest

from quilt3 import main

from .utils import QuiltTestCase

create_parser = main.create_parser


patch_package_class = mock.patch('quilt3.main.Package', autospec=True)


class CommandLineTestCase(QuiltTestCase):
    """
    Base TestCase class, sets up a CLI parser
    """
    @classmethod
    def setUpClass(cls):
        parser = create_parser()
        cls.parser = parser


class QuiltCLITestCase(CommandLineTestCase):
    def test_quilt_config(self):
        args = self.parser.parse_args(['config', 'https://foo.bar'])
        assert args.catalog_url == 'https://foo.bar'

    def test_push(self):
        name = 'test/name'
        dir_path = 'test/dir/path'

        with patch_package_class as mocked_package_class:
            main.main(('push', '--dir', dir_path, name))

            mocked_package_class.assert_called_once_with()
            mocked_package = mocked_package_class.return_value
            mocked_package.set_dir.assert_called_once_with('.', dir_path, meta=None)
            mocked_package.push.assert_called_once_with(name, registry=None, dest=None, message=None, workflow=...)


@pytest.mark.parametrize(
    'meta_data, expected_meta',
    [
        (None, None),
        ('{"test": "meta"}', {"test": "meta"}),
    ]
)
def test_push_with_meta_data(
    meta_data,
    expected_meta,
):
    name = 'test/name'
    dir_path = 'test/dir/path'

    with patch_package_class as mocked_package_class, \
         mock.patch('quilt3.main.parse_arg_json', wraps=main.parse_arg_json) as mocked_parse_json_arg:

        # '--registry' defaults to configured remote registry hence optional.
        if meta_data:
            main.main(('push', '--dir', dir_path, name, '--meta', meta_data))
            mocked_parse_json_arg.assert_called_once_with(meta_data)
        else:
            main.main(('push', '--dir', dir_path, name))
            mocked_parse_json_arg.assert_not_called()
        mocked_package_class.assert_called_once_with()
        mocked_package = mocked_package_class.return_value
        mocked_package.set_dir.assert_called_once_with('.', dir_path, meta=expected_meta)
        mocked_package.push.assert_called_once_with(name, dest=None, message=None, registry=None, workflow=...)


@pytest.mark.parametrize(
    'meta_data',
    [
        '{invalid: meta}',
        "{'single': 'quotation'}",
        '{"test": "meta", }',
    ]
)
def test_push_with_meta_data_error(
    meta_data,
    capsys
):
    name = 'test/name'

    with patch_package_class as mocked_package_class, \
         mock.patch('quilt3.main.parse_arg_json', wraps=main.parse_arg_json) as mocked_parse_json_arg:

        with pytest.raises(SystemExit):
            main.main(('push', '--dir', '.', name, '--meta', meta_data))
        # check for expected stderr exception message
        captured = capsys.readouterr()
        assert 'is not a valid json string' in captured.err
        mocked_parse_json_arg.assert_called_once_with(meta_data)
        mocked_package_class.assert_not_called()


@pytest.mark.parametrize(
    'workflow_input, expected_workflow',
    [
        (None, ...),
        ('', None),
        ('test-workflow', 'test-workflow'),
    ]
)
def test_push_workflow(workflow_input, expected_workflow):
    name = 'test/name'
    dir_path = 'test/dir/path'

    with patch_package_class as mocked_package_class:
        workflow_args = () if workflow_input is None else ('--workflow', workflow_input)
        main.main(('push', '--dir', dir_path, *workflow_args, name))

        mocked_package_class.assert_called_once_with()
        mocked_package = mocked_package_class.return_value
        mocked_package.set_dir.assert_called_once_with('.', dir_path, meta=None)
        mocked_package.push.assert_called_once_with(
            name, dest=None, message=None, registry=None, workflow=expected_workflow,
        )


def test_list_packages(capsys):
    registry = 's3://my_test_bucket/'
    pkg_names = ['foo/bar', 'foo/bar1', 'foo1/bar']
    with patch('quilt3.backends.s3.S3PackageRegistryV1.list_packages') as list_packages_mock:
        list_packages_mock.return_value = pkg_names
        main.main(('list-packages', registry))

        list_packages_mock.assert_called_once_with()
        captured = capsys.readouterr()
        assert captured.out.split() == pkg_names
