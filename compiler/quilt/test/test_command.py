"""
Tests for commands.
"""

import hashlib
import json
import os
import time

import requests
import responses
import shutil

import pandas as pd
from six import assertRaisesRegex

from quilt.tools import command, store
from .utils import QuiltTestCase, patch

class CommandTest(QuiltTestCase):
    @patch('quilt.tools.command._save_config')
    @patch('quilt.tools.command._load_config')
    @patch('quilt.tools.command.input')
    def test_config_urls_default(self, mock_input, mock_load_config, mock_save_config):
        # test setting default URL with blank string -- result should be default
        mock_load_config.return_value = {}
        mock_input.return_value = ''

        command.config()

        assert mock_input.called

        args, kwargs = mock_save_config.call_args
        mock_load_config.return_value = args[0] if args else kwargs['cfg']
        assert command.get_registry_url() == command.DEFAULT_REGISTRY_URL

    @patch('quilt.tools.command._save_config')
    @patch('quilt.tools.command._load_config')
    @patch('quilt.tools.command.input')
    def test_config_good_urls(self, mock_input, mock_load_config, mock_save_config):
        test_urls = [
            'https://foo.com',
            'http://foo.com',
            'https://foo.bar.net',
            ]
        # test general URL setting -- result should match input
        for test_url in test_urls:
                mock_load_config.return_value = {}
                mock_input.return_value = test_url

                command.config()

                assert mock_input.called
                mock_input.reset_mock()

                args, kwargs = mock_save_config.call_args
                mock_load_config.return_value = args[0] if args else kwargs['cfg']
                assert test_url == command.get_registry_url()

    @patch('quilt.tools.command._save_config')
    @patch('quilt.tools.command._load_config')
    @patch('quilt.tools.command.input')
    def test_config_bad_urls(self, mock_input, mock_load_config, mock_save_config):
        test_urls = [
            'foo.com',
            'ftp://foo.com',
            'blah://bar.com',
            'http://foo.bar.com/baz',
            ]
        # test general URL setting -- result should match input
        for test_url in test_urls:
                mock_load_config.return_value = {}
                mock_input.return_value = test_url

                with assertRaisesRegex(self, command.CommandException, 'Invalid URL'):
                    command.config()

                assert mock_input.called
                mock_input.reset_mock()

                assert mock_save_config.call_args is None
                assert command.get_registry_url() != test_url

    @patch('requests.Session.put')
    def test_version_add_badversion(self, mock_put):
        with assertRaisesRegex(self, command.CommandException, 'Invalid version format'):
            command.version_add('user/test', '2.9.12.2error', 'fabc123', force=True)
        assert mock_put.call_args is None

    @patch('quilt.tools.command._match_hash')
    @patch('quilt.tools.command.input')
    @patch('requests.Session.put')
    def test_version_add_confirmed(self, mock_put, mock_input, mock_match_hash):
        testsite = command.get_registry_url()
        mock_input.return_value = 'y'
        mock_match_hash.return_value = 'fabc123'

        command.version_add('user/test', '2.9.12', 'fabc123')

        assert mock_put.call_args
        args, kwargs = mock_put.call_args

        assert args[0] == testsite + '/api/version/user/test/2.9.12'
        assert kwargs == {'data': '{"hash": "fabc123"}'}

    @patch('quilt.tools.command.input')
    @patch('requests.Session.put')
    def test_version_add_declined(self, mock_put, mock_input):
        mock_input.return_value = 'n'

        command.version_add('user/test', '2.9.12', 'fabc123')
        assert mock_put.call_args is None

    def test_push_invalid_package(self):
        with assertRaisesRegex(self, command.CommandException, "owner/package_name"):
            command.push(package="no_user")
        with assertRaisesRegex(self, command.CommandException, "owner/package_name"):
            command.push(package="a/b/c")

    def test_install_invalid_package(self):
        with assertRaisesRegex(self, command.CommandException, "owner/package_name"):
            command.install(package="no_user")

    def test_inspect_invalid_package(self):
        with assertRaisesRegex(self, command.CommandException, "owner/package_name"):
            command.inspect(package="no_user")
        with assertRaisesRegex(self, command.CommandException, "owner/package_name"):
            command.inspect(package="a/b/c")

    def test_push_missing_package(self):
        with assertRaisesRegex(self, command.CommandException, "not found"):
            command.push(package="owner/package")

    def test_inspect_missing_package(self):
        with assertRaisesRegex(self, command.CommandException, "not found"):
            command.inspect(package="owner/package")

    @patch('quilt.tools.command._open_url')
    @patch('quilt.tools.command.input')
    @patch('quilt.tools.command.login_with_token')
    def test_login(self, mock_login_with_token, mock_input, mock_open):
        old_refresh_token = "123"

        mock_input.return_value = old_refresh_token

        command.login()

        mock_open.assert_called_with('%s/login' % command.get_registry_url())

        mock_login_with_token.assert_called_with(old_refresh_token)

    @patch('quilt.tools.command._save_auth')
    def test_login_token(self, mock_save):
        old_refresh_token = "123"
        refresh_token = "456"
        access_token = "abc"
        expires_at = 1000.0

        self.requests_mock.add(
            responses.POST,
            '%s/api/token' % command.get_registry_url(),
            json=dict(
                status=200,
                refresh_token=refresh_token,
                access_token=access_token,
                expires_at=expires_at
            )
        )

        command.login_with_token(old_refresh_token)

        assert self.requests_mock.calls[0].request.body == "refresh_token=%s" % old_refresh_token

        mock_save.assert_called_with(dict(
            refresh_token=refresh_token,
            access_token=access_token,
            expires_at=expires_at
        ))

    @patch('quilt.tools.command._save_auth')
    def test_login_token_server_error(self, mock_save):
        self.requests_mock.add(
            responses.POST,
            '%s/api/token' % command.get_registry_url(),
            status=500
        )

        with self.assertRaises(command.CommandException):
            command.login_with_token("123")

        mock_save.assert_not_called()

    @patch('quilt.tools.command._save_auth')
    def test_login_token_auth_fail(self, mock_save):
        self.requests_mock.add(
            responses.POST,
            '%s/api/token' % command.get_registry_url(),
            json=dict(
                status=200,
                error="Bad token!"
            )
        )

        with self.assertRaises(command.CommandException):
            command.login_with_token("123")

        mock_save.assert_not_called()

    def test_ls(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        command.ls()

    def test_inspect_valid_package(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        command.inspect('foo/bar')

# TODO: work in progress
#    def test_find_node_by_name(self):
#        mydir = os.path.dirname(__file__)
#        build_path = os.path.join(mydir, './build.yml')
#        command.build('foo/bar', build_path)
#
#        owner, pkg = store.parse_package('foo/bar')
#        pkgobj = store.PackageStore.find_package(owner, pkg)
#        assert pkgobj is not None
#        assert pkgobj.find_node_by_name('') is None
#        assert pkgobj.find_node_by_name('bar') is None
#        assert pkgobj.find_node_by_name('foo') is None
#        assert pkgobj.find_node_by_name('README.md') is None
#        assert pkgobj.find_node_by_name('data/README') is None
#        assert pkgobj.find_node_by_name('data/README.md') is None
#        assert pkgobj.find_node_by_name('README') is not None
#        tsvnode = pkgobj.find_node_by_name('dataframes/tsv')
#        assert tsvnode is not None
#        tsvdf = pkgobj.get_obj(tsvnode)
#        assert tsvdf is not None
#        diff = command.diff_vs_dataframe('foo/bar', 'dataframes/tsv', tsvdf)
#        assert diff is None
#        diff = command.diff_vs_dataframe('foo/bar', 'dataframes/csv', tsvdf)
#        assert diff is None
#        import random
#        tsvdf['UID1'] = tsvdf['UID1'].apply(
#            lambda v: v if random.random()>0.01 else ('val'+str(random.random())))
#        diff = command.diff_vs_dataframe('foo/bar', 'dataframes/tsv', tsvdf)
#        assert diff is None

    def test_log(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        owner = 'foo'
        package = 'bar'
        command.build('%s/%s' % (owner, package), build_path)

        pkg_obj = store.PackageStore.find_package(owner, package)
        self._mock_logs_list(owner, package, pkg_obj.get_hash())

        command.log("{owner}/{pkg}".format(owner=owner, pkg=package))

    def _mock_logs_list(self, owner, package, pkg_hash):
        logs_url = "%s/api/log/%s/%s/" % (command.get_registry_url(), owner, package)
        resp = dict(logs=[dict(
            hash=pkg_hash,
            created=time.time(),
            author=owner)])
        print("MOCKING URL=%s" % logs_url)
        self.requests_mock.add(responses.GET, logs_url, json.dumps(resp))

    def test_generate_buildfile_wo_building(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, 'data')
        buildfilepath = os.path.join(path, 'build.yml')
        assert not os.path.exists(buildfilepath), "%s already exists" % buildfilepath
        try:
            command.generate(path)
            assert os.path.exists(buildfilepath), "failed to create %s" % buildfilepath
        finally:
            os.remove(buildfilepath)

    @patch('quilt.tools.command.input')
    def test_delete_not_confirmed(self, mock_input):
        mock_input.return_value = 'blah'

        command.delete('user/test')

    @patch('quilt.tools.command.input')
    def test_delete_confirmed(self, mock_input):
        owner = 'foo'
        package = 'bar'

        mock_input.return_value = '%s/%s' % (owner, package)

        delete_url = "%s/api/package/%s/%s/" % (command.get_registry_url(), owner, package)
        self.requests_mock.add(responses.DELETE, delete_url, json.dumps(dict()))

        command.delete('%s/%s' % (owner, package))

    def test_build_from_git(self):
        git_url = 'https://github.com/quiltdata/testdata.git'
        def mock_git_clone(cmd):
            # test git command
            assert len(cmd) == 6
            assert cmd[:5] == ['git', 'clone', '-q', '--depth=1', git_url]

            # fake git clone by copying test files into destpath
            srcfile = 'foo.csv'
            mydir = os.path.dirname(__file__)
            srcpath = os.path.join(mydir, 'data', srcfile)
            destpath = os.path.join(cmd[-1], srcfile)
            shutil.copyfile(srcpath, destpath)

        with patch('subprocess.check_call', mock_git_clone):
            command.build('user/test', git_url)

        from quilt.data.user import test
        assert hasattr(test, 'foo')
        assert isinstance(test.foo(), pd.DataFrame)

    def test_build_from_git_branch(self):
        branch = 'notmaster'
        git_url = 'https://github.com/quiltdata/testdata.git'
        def mock_git_clone(cmd):
            # test git command
            assert len(cmd) == 8
            assert cmd[:7] == ['git', 'clone', '-q', '--depth=1', '-b', branch, git_url]

            # fake git clone by copying test files into destpath
            srcfile = 'foo.csv'
            mydir = os.path.dirname(__file__)
            srcpath = os.path.join(mydir, 'data', srcfile)
            destpath = os.path.join(cmd[-1], srcfile)
            shutil.copyfile(srcpath, destpath)

        with patch('subprocess.check_call', mock_git_clone):
            command.build('user/test', "{url}@{brch}".format(url=git_url, brch=branch))

        from quilt.data.user import test
        assert hasattr(test, 'foo')
        assert isinstance(test.foo(), pd.DataFrame)

    def test_git_clone_fail(self):
        git_url = 'https://github.com/quiltdata/testdata.git'
        def mock_git_clone(cmd):
            # test git command
            assert len(cmd) == 6
            assert cmd[:5] == ['git', 'clone', '-q', '--depth=1', git_url]

            # fake git clone fail
            raise Exception()

        with patch('subprocess.check_call', mock_git_clone):
            with self.assertRaises(command.CommandException):
                command.build('user/test', git_url)

        from quilt.data.user import test
        assert hasattr(test, 'foo')
        assert isinstance(test.foo(), pd.DataFrame)

    def test_logging(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')

        log_url = '%s/api/log' % (command.get_registry_url(),)

        # Successful logging response.
        with patch('quilt.tools.command._load_config', return_value={}):
            def callback(request):
                data = json.loads(request.body)
                assert data == [dict(
                    type='build',
                    package=hashlib.md5(b'foo/bar').hexdigest(),
                    dry_run=False,
                    env='default',
                )]
                return (200, {}, '')

            self.requests_mock.add_callback(responses.POST, log_url, callback)

            command.build('foo/bar', build_path)

        # Failed logging response.
        with patch('quilt.tools.command._load_config', return_value={}):
            self.requests_mock.add(responses.POST, log_url, status=500)
            command.build('foo/bar', build_path)

        # ConnectionError
        with patch('quilt.tools.command._load_config', return_value={}):
            self.requests_mock.add(responses.POST, log_url, body=requests.exceptions.ConnectionError())
            command.build('foo/bar', build_path)

        # Disabled logging.
        with patch('quilt.tools.command._load_config', return_value={'disable_analytics': True}):
            self.requests_mock.add(responses.POST, log_url, body=AssertionError('Unexpected logging!'))
            command.build('foo/bar', build_path)

            self.requests_mock.reset()  # Prevent the "not all requests ..." assert.
