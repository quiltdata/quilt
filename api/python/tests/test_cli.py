import io
import json
from unittest import mock
from unittest.mock import patch

import pytest

from quilt3 import main
from quilt3._graphql_client import exceptions as gql_exceptions

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
            mocked_package_class.browse.side_effect = FileNotFoundError()

            main.main(('push', '--dir', dir_path, name))

            mocked_package_class.browse.assert_called_once_with(name, None)
            mocked_package_class.assert_called_once_with()
            mocked_package = mocked_package_class.return_value
            mocked_package.set_dir.assert_called_once_with('.', dir_path, meta=None)
            mocked_package.push.assert_called_once_with(
                name, registry=None, dest=None, message=None, workflow=..., force=False, dedupe=False
            )

    def test_push_force(self):
        name = 'test/name'
        dir_path = 'test/dir/path'

        with patch_package_class as mocked_package_class:
            mocked_package_class.browse.side_effect = FileNotFoundError()

            main.main(('push', '--dir', dir_path, name, '--force'))

            mocked_package_class.browse.assert_called_once_with(name, None)
            mocked_package_class.assert_called_once_with()
            mocked_package = mocked_package_class.return_value
            mocked_package.set_dir.assert_called_once_with('.', dir_path, meta=None)
            mocked_package.push.assert_called_once_with(
                name, registry=None, dest=None, message=None, workflow=..., force=True, dedupe=False
            )

    def test_push_dedupe(self):
        name = 'test/name'
        dir_path = 'test/dir/path'

        with patch_package_class as mocked_package_class:
            mocked_package_class.browse.side_effect = FileNotFoundError()

            main.main(('push', '--dir', dir_path, name, '--dedupe'))

            mocked_package_class.browse.assert_called_once_with(name, None)
            mocked_package_class.assert_called_once_with()
            mocked_package = mocked_package_class.return_value
            mocked_package.set_dir.assert_called_once_with('.', dir_path, meta=None)
            mocked_package.push.assert_called_once_with(
                name, registry=None, dest=None, message=None, workflow=..., force=False, dedupe=True
            )

    def test_push_existing(self):
        name = 'test/name'
        dir_path = 'test/dir/path'

        with patch_package_class as mocked_package_class:
            main.main(('push', '--dir', dir_path, name))

            mocked_package_class.browse.assert_called_once_with(name, None)
            mocked_package_class.assert_not_called()
            mocked_package = mocked_package_class.browse.return_value
            mocked_package.set_dir.assert_called_once_with('.', dir_path, meta=None)
            mocked_package.push.assert_called_once_with(
                name, registry=None, dest=None, message=None, workflow=..., force=False, dedupe=False
            )


@pytest.mark.parametrize(
    'meta_data, expected_meta',
    [
        (None, None),
        ('{"test": "meta"}', {"test": "meta"}),
    ],
)
def test_push_with_meta_data(
    meta_data,
    expected_meta,
):
    name = 'test/name'
    dir_path = 'test/dir/path'

    with (
        patch_package_class as mocked_package_class,
        mock.patch('quilt3.main.parse_arg_json', wraps=main.parse_arg_json) as mocked_parse_json_arg,
    ):
        mocked_package_class.browse.side_effect = FileNotFoundError()

        # '--registry' defaults to configured remote registry hence optional.
        if meta_data:
            main.main(('push', '--dir', dir_path, name, '--meta', meta_data))
            mocked_parse_json_arg.assert_called_once_with(meta_data)
        else:
            main.main(('push', '--dir', dir_path, name))
            mocked_parse_json_arg.assert_not_called()
        mocked_package_class.browse.assert_called_once_with(name, None)
        mocked_package_class.assert_called_once_with()
        mocked_package = mocked_package_class.return_value
        mocked_package.set_dir.assert_called_once_with('.', dir_path, meta=expected_meta)
        mocked_package.push.assert_called_once_with(
            name, dest=None, message=None, registry=None, workflow=..., force=False, dedupe=False
        )


@pytest.mark.parametrize(
    'meta_data',
    [
        '{invalid: meta}',
        "{'single': 'quotation'}",
        '{"test": "meta", }',
    ],
)
def test_push_with_meta_data_error(meta_data, capsys):
    name = 'test/name'

    with (
        patch_package_class as mocked_package_class,
        mock.patch('quilt3.main.parse_arg_json', wraps=main.parse_arg_json) as mocked_parse_json_arg,
    ):
        mocked_package_class.browse.side_effect = FileNotFoundError()

        with pytest.raises(SystemExit):
            main.main(('push', '--dir', '.', name, '--meta', meta_data))
        # check for expected stderr exception message
        captured = capsys.readouterr()
        assert 'is not a valid json string' in captured.err
        mocked_parse_json_arg.assert_called_once_with(meta_data)
        mocked_package_class.browse.assert_not_called()
        mocked_package_class.assert_not_called()


@pytest.mark.parametrize(
    'workflow_input, expected_workflow',
    [
        (None, ...),
        ('', None),
        ('test-workflow', 'test-workflow'),
    ],
)
def test_push_workflow(workflow_input, expected_workflow):
    name = 'test/name'
    dir_path = 'test/dir/path'

    with patch_package_class as mocked_package_class:
        mocked_package_class.browse.side_effect = FileNotFoundError()
        workflow_args = () if workflow_input is None else ('--workflow', workflow_input)
        main.main(('push', '--dir', dir_path, *workflow_args, name))

        mocked_package_class.assert_called_once_with()
        mocked_package = mocked_package_class.return_value
        mocked_package_class.browse.assert_called_once_with(name, None)
        mocked_package.set_dir.assert_called_once_with('.', dir_path, meta=None)
        mocked_package.push.assert_called_once_with(
            name, dest=None, message=None, registry=None, workflow=expected_workflow, force=False, dedupe=False
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


def test_push_no_copy():
    name = 'test/name'
    dir_path = 's3://test/dir/path'

    with patch_package_class as mocked_package_class:
        main.main(('push', '--dir', dir_path, '--no-copy', name))

        mocked_package_class.browse.assert_called_once_with(name, None)
        mocked_package_class.assert_not_called()
        mocked_package = mocked_package_class.browse.return_value
        mocked_package.set_dir.assert_called_once_with('.', dir_path, meta=None)
        mocked_package.push.assert_called_once_with(
            name,
            registry=None,
            dest=None,
            message=None,
            workflow=...,
            force=False,
            dedupe=False,
            selector_fn=main._selector_fn_no_copy,
        )


def test_push_no_copy_local_dir(capsys):
    name = 'test/name'
    dir_path = 'test/dir/path'

    assert main.main(('push', '--dir', dir_path, '--no-copy', name)) == 1
    captured = capsys.readouterr()
    assert "--no-copy flag can be specified only for remote data." in captured.err


GRAPHQL_QUERY = 'query { config { region } }'


def test_graphql_parse_args():
    parser = create_parser()
    args = parser.parse_args(
        (
            'graphql',
            GRAPHQL_QUERY,
            '--variables',
            '{"name": "foo/bar"}',
            '--operation-name',
            'GetConfig',
        )
    )
    assert args.query == GRAPHQL_QUERY
    assert args.variables == {'name': 'foo/bar'}
    assert args.operation_name == 'GetConfig'


def test_graphql(capsys):
    with patch('quilt3.main.graphql.execute') as execute_mock:
        execute_mock.return_value = {'config': {'region': 'us-east-1'}}
        main.main(('graphql', GRAPHQL_QUERY))

        execute_mock.assert_called_once_with(GRAPHQL_QUERY, variables=None, operation_name=None)
        captured = capsys.readouterr()
        assert json.loads(captured.out) == {'config': {'region': 'us-east-1'}}


def test_graphql_with_variables(capsys):
    with patch('quilt3.main.graphql.execute') as execute_mock:
        execute_mock.return_value = {'package': None}
        main.main(('graphql', GRAPHQL_QUERY, '--variables', '{"name": "foo/bar"}'))

        execute_mock.assert_called_once_with(GRAPHQL_QUERY, variables={'name': 'foo/bar'}, operation_name=None)


def test_graphql_with_operation_name(capsys):
    with patch('quilt3.main.graphql.execute') as execute_mock:
        execute_mock.return_value = {'config': {'region': 'us-east-1'}}
        main.main(('graphql', GRAPHQL_QUERY, '--operation-name', 'GetConfig'))

        execute_mock.assert_called_once_with(GRAPHQL_QUERY, variables=None, operation_name='GetConfig')


def test_graphql_stdin(capsys, monkeypatch):
    monkeypatch.setattr('sys.stdin', io.StringIO(GRAPHQL_QUERY))
    with patch('quilt3.main.graphql.execute') as execute_mock:
        execute_mock.return_value = {}
        main.main(('graphql', '-'))

        execute_mock.assert_called_once_with(GRAPHQL_QUERY, variables=None, operation_name=None)


def test_graphql_invalid_variables(capsys):
    with patch('quilt3.main.graphql.execute') as execute_mock:
        with pytest.raises(SystemExit):
            main.main(('graphql', GRAPHQL_QUERY, '--variables', '{"test": "meta", }'))

        captured = capsys.readouterr()
        assert 'is not a valid json string' in captured.err
        execute_mock.assert_not_called()


@pytest.mark.parametrize('variables', ('[1, 2]', '42', 'true', '"str"', 'null'))
def test_graphql_non_object_variables(capsys, variables):
    with patch('quilt3.main.graphql.execute') as execute_mock:
        with pytest.raises(SystemExit):
            main.main(('graphql', GRAPHQL_QUERY, '--variables', variables))

        captured = capsys.readouterr()
        assert 'is not a valid json object' in captured.err
        execute_mock.assert_not_called()


def test_graphql_operation_error(capsys):
    exc = gql_exceptions.GraphQLClientGraphQLMultiError.from_errors_dicts(
        errors_dicts=[{'message': 'Unauthorized'}, {'message': 'boom'}],
    )
    with patch('quilt3.main.graphql.execute', side_effect=exc):
        assert main.main(('graphql', GRAPHQL_QUERY)) == 1

        captured = capsys.readouterr()
        assert 'GraphQL error: Unauthorized' in captured.err
        assert 'GraphQL error: boom' in captured.err
        assert captured.out == ''


def test_graphql_operation_error_with_partial_data(capsys):
    exc = gql_exceptions.GraphQLClientGraphQLMultiError.from_errors_dicts(
        errors_dicts=[{'message': 'boom', 'path': ['config']}],
        data={'config': None},
    )
    with patch('quilt3.main.graphql.execute', side_effect=exc):
        assert main.main(('graphql', GRAPHQL_QUERY)) == 1

        captured = capsys.readouterr()
        assert 'GraphQL error: boom' in captured.err
        assert json.loads(captured.out) == {'config': None}


def test_graphql_transport_error(capsys):
    exc = gql_exceptions.GraphQLClientInvalidResponseError(response=mock.sentinel.RESPONSE)
    with patch('quilt3.main.graphql.execute', side_effect=exc):
        assert main.main(('graphql', GRAPHQL_QUERY)) == 1

        captured = capsys.readouterr()
        assert 'GraphQL request failed: Invalid response format.' in captured.err


def test_graphql_empty_query(capsys):
    with patch('quilt3.main.graphql.execute') as execute_mock:
        assert main.main(('graphql', '  \n ')) == 1

        captured = capsys.readouterr()
        assert 'Empty GraphQL document.' in captured.err
        execute_mock.assert_not_called()


def test_graphql_empty_stdin(capsys, monkeypatch):
    monkeypatch.setattr('sys.stdin', io.StringIO(''))
    with patch('quilt3.main.graphql.execute') as execute_mock:
        assert main.main(('graphql', '-')) == 1

        captured = capsys.readouterr()
        assert 'Empty GraphQL document.' in captured.err
        execute_mock.assert_not_called()


def test_install_legacy_source_is_unchanged():
    with patch_package_class as mocked_package_class:
        main.main(('install', 'user/package', '--dest', 'data'))

        mocked_package_class.install.assert_called_once_with(
            'user/package',
            registry=None,
            top_hash=None,
            dest='data',
            dest_registry=None,
            path=None,
        )


def test_install_uri_source():
    uri = 'quilt+s3://bucket#package=user/package:release&path=data%2Ffile.csv'
    with patch_package_class as mocked_package_class:
        main.main(('install', '--uri', uri, '--dest', 'data'))

        mocked_package_class.install.assert_called_once_with(
            uri,
            registry=None,
            top_hash=None,
            dest='data',
            dest_registry=None,
            path=None,
        )


@pytest.mark.parametrize(
    'args, error',
    [
        (('install',), 'Exactly one package source is required'),
        (('install', 'user/package', '--uri', 'quilt+s3://bucket#package=user/package'), 'cannot be used together'),
        (('install', 'quilt+s3://bucket#package=user/package'), 'with --uri'),
        # Schemes are case-insensitive, so an uppercase one must not slip past the
        # positional guard and get installed as a URI anyway.
        (('install', 'QUILT+S3://bucket#package=user/package'), 'with --uri'),
        (('install', 'Quilt+S3://bucket#package=user/package'), 'with --uri'),
        (('install', '--uri', 'quilt+s3://bucket#package=user/package', '--registry', 's3://other'), '--registry'),
        (('install', '--uri', 'quilt+s3://bucket#package=user/package', '--top-hash', 'abcdef'), '--top-hash'),
        (('install', '--uri', 'quilt+s3://bucket#package=user/package', '--path', 'data'), '--path'),
    ],
)
def test_install_rejects_invalid_source_combinations(args, error, capsys):
    with patch_package_class as mocked_package_class:
        assert main.main(args) == 1

        assert error in capsys.readouterr().err
        mocked_package_class.install.assert_not_called()


def test_install_uri_help_requires_shell_quoting(capsys):
    with pytest.raises(SystemExit) as exc_info:
        main.main(('install', '--help'))

    assert exc_info.value.code == 0
    help_text = capsys.readouterr().out
    assert '--uri URI' in help_text
    assert 'Quote the URI' in help_text
    assert 'in the shell' in help_text
    assert "'&'" in help_text


def test_install_malformed_uri_has_uri_specific_error(capsys):
    assert main.main(('install', '--uri', 'quilt+http://bucket#package=user/package')) == 1

    assert 'Invalid package URI' in capsys.readouterr().err
