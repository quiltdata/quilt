"""
Tests for commands.

Covered cases:
CRUD related:
    1. users/list
        - OK
        - no auth
        - not found
        - server error
    2. users/create
        - OK
        - no auth
        - not found
        - server error
        - already created (duplicate)
        - bogus email
        - empty name
        - empty email
        - non existing team
    3. users/disable
        - OK
        - no auth
        - not found
        - server error
        - already disabled
        - empty name
        - deleted user
        - unknown user
        - non existing team
    4. users/delete
        - OK
        - no auth
        - not found
        - server error
        - already deleted
        - empty name
        - unknown user
        - non existing team
    5. audit user or package
        - OK
        - no auth
        - no team
        - not admin
    6. users/list_detailed
        - OK
        - no auth
        - no admin
        - not found
        - server error
    7. access list
        - OK
        - no auth
    8. access remove
        - OK
        - no auth
        - not owner
        - revoke owner
        - free plan
    9. access add
        - OK
        - no auth
        - not owner
"""
# Disable no-self-use, protected-access, too-many-public-methods
# pylint: disable=R0201, W0212, R0904

import hashlib
import json
import os
import shutil
import time

import requests
import responses

import pytest
from io import StringIO
import pandas as pd
from six import assertRaisesRegex

from .utils import QuiltTestCase, patch
from ..tools import command, store
from ..tools.const import TEAM_ID_ERROR

class CommandTest(QuiltTestCase):
    def _mock_error(self, endpoint, status, team=None, message="",
                    method=responses.POST):
        self.requests_mock.add(
            method,
            '%s/api/%s' % (command.get_registry_url(team), endpoint),
            body=json.dumps(dict(message=message)),
            status=status
        )

    @patch('quilt.tools.command._save_config')
    @patch('quilt.tools.command._load_config')
    @patch('quilt.tools.command.input')
    @patch.dict('os.environ')
    def test_config_urls_default(self, mock_input, mock_load_config, mock_save_config):
        os.environ.pop('QUILT_PKG_URL', None)  # Remove it cause it takes precedence over config.

        # test setting default URL with blank string -- result should be default
        mock_load_config.return_value = {}
        mock_input.return_value = ''

        command.config()

        assert mock_input.called

        args, kwargs = mock_save_config.call_args
        mock_load_config.return_value = args[0] if args else kwargs['cfg']
        assert command.get_registry_url(None) == command.DEFAULT_REGISTRY_URL

    @patch('quilt.tools.command._save_config')
    @patch('quilt.tools.command._load_config')
    @patch('quilt.tools.command.input')
    @patch.dict('os.environ')
    def test_config_good_urls(self, mock_input, mock_load_config, mock_save_config):
        os.environ.pop('QUILT_PKG_URL', None)  # Remove it cause it takes precedence over config.

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
            assert test_url == command.get_registry_url(None)

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
        # test general URL setting -- result should match initial state
        mock_load_config.return_value = {}
        initial_url = command.get_registry_url(None)

        for test_url in test_urls:
            mock_input.return_value = test_url

            with assertRaisesRegex(self, command.CommandException, 'Invalid URL'):
                command.config()

            assert mock_input.called
            mock_input.reset_mock()

            mock_save_config.assert_not_called()

            assert command.get_registry_url(None) == initial_url

    def test_version_add_badversion(self):
        with assertRaisesRegex(self, command.CommandException, 'Invalid version format'):
            command.version_add('user/test', '2.9.12.2error', 'fabc123', force=True)

    @patch('quilt.tools.command._match_hash')
    @patch('quilt.tools.command.input')
    def test_version_add_confirmed(self, mock_input, mock_match_hash):
        registry_url = command.get_registry_url(None)
        mock_input.return_value = 'y'
        mock_match_hash.return_value = 'fabc123'

        # Response content is not checked by version_add, so
        # status ok and URL verification are enough
        self.requests_mock.add(
            responses.PUT,
            registry_url + "/api/version/user/test/2.9.12",
            status=200,
        )

        command.version_add('user/test', '2.9.12', 'fabc123')

    @patch('quilt.tools.command.input')
    def test_version_add_declined(self, mock_input):
        mock_input.return_value = 'n'
        command.version_add('user/test', '2.9.12', 'fabc123')  # should produce no mock network activity

    def test_ambiguous_hash(self):
        registry_url = command.get_registry_url(None)
        ambiguous_token = "795a7b"
        # There should be at least two results that start with the ambiguous_token, plus some non-ambiguous
        # results in fake_data to test against.
        fake_data = {'logs': [
            {'author': 'user', 'created': 1490816524.0,
             'hash': '885696c6e40613b3c601e95037caf4e43bda58c39f67ab5d5e56beefb3662ff4'},
            {'author': 'user', 'created': 1490816507.0,
             'hash': '795a7bc9e40613b3c601e95037caf4e43bda58c39f67ab5d5e56beefb3662ff4'},
            {'author': 'user', 'created': 1490816473.0,
             'hash': '795a7bc6e40613b3c601e95037caf4e43bda58c39f67ab5d5e56beefb3662ff4'},
            {'author': 'user', 'created': 1490816524.0,
             'hash': '2501a6c6e40a7b355901fc5037caf4e43bda58c39f67ab5d5e56beefb3662ff4'},
        ]}
        self.requests_mock.add(
            responses.GET,
            registry_url + "/api/log/user/test/",
            json=fake_data
        )
        # Ambiguous hashes in _match_hash's exception will be sorted -- sorted here to match.
        fake_data_ambiguous = sorted(entry['hash'] for entry in fake_data['logs']
                               if entry['hash'].startswith(ambiguous_token))
        # this will match each ambiguous hash, in order, separated by anything.
        # ..it allows for formatting changes in the error, but requires the same order.
        fake_data_regexp = r'(.|\n)+'.join(fake_data_ambiguous)
        with assertRaisesRegex(self, command.CommandException, fake_data_regexp):
            command._match_hash('user/test', hash='795a7b')

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

        command.login(None)

        mock_open.assert_called_with('%s/login' % command.get_registry_url(None))

        mock_login_with_token.assert_called_with(old_refresh_token, None)

    @patch('quilt.tools.command._open_url')
    @patch('quilt.tools.command.input')
    @patch('quilt.tools.command.login_with_token')
    @patch('socket.gethostbyname', lambda name: '1.2.3.4')
    def test_login_with_team(self, mock_login_with_token, mock_input, mock_open):
        old_refresh_token = "123"

        mock_input.return_value = old_refresh_token

        command.login('foo')

        mock_open.assert_called_with('%s/login' % command.get_registry_url('foo'))

        mock_login_with_token.assert_called_with(old_refresh_token, 'foo')

    @patch('quilt.tools.command._open_url')
    @patch('quilt.tools.command.input')
    @patch('quilt.tools.command.login_with_token')
    def test_login_invalid_team(self, mock_login_with_token, mock_input, mock_open):
        old_refresh_token = "123"

        mock_input.return_value = old_refresh_token

        with pytest.raises(command.CommandException,
                match=TEAM_ID_ERROR):
            command.login('fo!o')

        mock_open.assert_not_called()
        mock_login_with_token.assert_not_called()

    @patch('quilt.tools.command._open_url')
    @patch('quilt.tools.command.input')
    @patch('quilt.tools.command.login_with_token')
    @patch('socket.gethostbyname')
    def test_login_non_existent_team(self, gethostbyname, mock_login_with_token, mock_input, mock_open):
        # No team, but have internet.
        gethostbyname.side_effect = [IOError(), None]

        with pytest.raises(command.CommandException, match="Unable to connect to registry"):
            command.login('blah')

        mock_open.assert_not_called()
        mock_login_with_token.assert_not_called()

        # No internet.
        gethostbyname.side_effect = [IOError(), IOError()]

        with pytest.raises(command.CommandException, match="Check your internet"):
            command.login('blah')

        mock_open.assert_not_called()
        mock_login_with_token.assert_not_called()

    def test_login_with_token_invalid_team(self):
        with pytest.raises(command.CommandException,
                match=TEAM_ID_ERROR):
            command.login_with_token('123', 'fo!o')

    @patch('quilt.tools.command._save_auth')
    def test_login_token(self, mock_save):
        old_refresh_token = "123"
        refresh_token = "456"
        access_token = "abc"
        expires_at = 1000.0

        self.requests_mock.add(
            responses.POST,
            '%s/api/token' % command.get_registry_url(None),
            json=dict(
                status=200,
                refresh_token=refresh_token,
                access_token=access_token,
                expires_at=expires_at
            )
        )

        command.login_with_token(old_refresh_token, None)

        assert self.requests_mock.calls[0].request.body == "refresh_token=%s" % old_refresh_token

        mock_save.assert_called_with({
            command.get_registry_url(None): dict(
                team=None,
                refresh_token=refresh_token,
                access_token=access_token,
                expires_at=expires_at
            )
        })

    @patch('quilt.tools.command._save_auth')
    def test_login_token_server_error(self, mock_save):
        self.requests_mock.add(
            responses.POST,
            '%s/api/token' % command.get_registry_url(None),
            status=500
        )

        with self.assertRaises(command.CommandException):
            command.login_with_token("123", None)

        mock_save.assert_not_called()

    @patch('quilt.tools.command._save_auth')
    def test_login_token_auth_fail(self, mock_save):
        self.requests_mock.add(
            responses.POST,
            '%s/api/token' % command.get_registry_url(None),
            json=dict(
                status=200,
                error="Bad token!"
            )
        )

        with self.assertRaises(command.CommandException):
            command.login_with_token("123", None)

        mock_save.assert_not_called()

    @patch('quilt.tools.command._save_auth')
    @patch('quilt.tools.command._load_auth')
    @patch('quilt.tools.command._open_url')
    @patch('quilt.tools.command.input', lambda x: '')
    @patch('quilt.tools.command.login_with_token', lambda x, y: None)
    @patch('socket.gethostbyname', lambda name: '1.2.3.4')
    def test_login_not_allowed(self, mock_open, mock_load, mock_save):
        # Already logged is as a public user.
        mock_load.return_value = {
            command.get_registry_url(None): dict(
                team=None
            )
        }

        # Normal login is ok.
        command.login(None)
        mock_open.reset_mock()
        mock_save.reset_mock()

        # Team login is not allowed.
        with self.assertRaises(command.CommandException):
            command.login('foo')

        mock_open.assert_not_called()
        mock_save.assert_not_called()

        # Already logged is as a team user.
        mock_load.return_value = {
            command.get_registry_url('foo'): dict(
                team='foo'
            )
        }

        # Normal login is not allowed.
        with self.assertRaises(command.CommandException):
            command.login(None)

        # Login as 'foo' is ok.
        command.login('foo')
        mock_open.reset_mock()
        mock_save.reset_mock()

        # Login as a different team is not allowed.
        with self.assertRaises(command.CommandException):
            command.login('bar')

        mock_open.assert_not_called()
        mock_save.assert_not_called()

    def test_ls(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        command.ls()

    def test_search(self):
        self.requests_mock.add(
            responses.GET,
            '%s/api/search/?q=asdf' % command.get_registry_url(None),
            status=200,
            json={
                "packages": [],
                "status": 200
                }
            )
        command.search("asdf")

    @patch('quilt.tools.command._find_logged_in_team', lambda: "teamname")
    def test_search_team(self):
        self.requests_mock.add(
            responses.GET,
            '%s/api/search/?q=asdf' % command.get_registry_url("teamname"),
            status=200,
            json={
                "packages": [],
                "status": 200
                }
            )
        self.requests_mock.add(
            responses.GET,
            '%s/api/search/?q=asdf' % command.get_registry_url(None),
            status=200,
            json={
                "packages": [],
                "status": 200
                }
            )
        command.search("asdf")

    def test_inspect_valid_package(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        command.inspect('foo/bar')

    def test_user_list(self):
        self.requests_mock.add(
            responses.GET,
            '%s/api/users/list' % command.get_registry_url(None),
            status=200,
            json={
                'count':'1',
                'results':[{
                    'username':'admin',
                    'email':'admin@quiltdata.io',
                    'first_name':'',
                    'last_name':'',
                    'is_superuser':True,
                    'is_admin':True,
                    'is_staff':True
                }]
            }
        )
        command.list_users()

    def test_user_list_no_auth(self):
        self._mock_error('users/list', status=401, method=responses.GET)
        with self.assertRaises(command.CommandException):
            command.list_users()

    def test_user_list_not_found(self):
        self._mock_error('users/list', status=404, method=responses.GET)
        with self.assertRaises(command.CommandException):
            command.list_users()

    def test_user_list_server_error(self):
        self._mock_error('users/list', status=500, method=responses.GET)
        with self.assertRaises(command.CommandException):
            command.list_users()

    def test_user_list_detailed(self):
        self.requests_mock.add(
            responses.GET,
            '%s/api/users/list_detailed' % command.get_registry_url(None),
            status=200,
            json=json.dumps({
                'users': {
                    'admin': {
                        'packages': '1',
                        'installs': {'admin': '1'},
                        'previews': {'admin': '1'},
                        'pushes': {'admin': '1'},
                        'deletes': {'admin': '1'},
                        'status': 'active',
                        'last_seen': ''
                    }
                }
            }))
        command.list_users_detailed()

    def test_user_detailed_list_no_auth(self):
        self._mock_error('users/list_detailed', status=401, method=responses.GET)
        with self.assertRaises(command.CommandException):
            command.list_users_detailed()

    def test_user_detailed_list_no_admin(self):
        self._mock_error('users/list_detailed', status=403, method=responses.GET)
        with self.assertRaises(command.CommandException):
            command.list_users_detailed()

    def test_user_detailed_list_not_found(self):
        self._mock_error('users/list_detailed', status=404, method=responses.GET)
        with self.assertRaises(command.CommandException):
            command.list_users_detailed()

    def test_user_detailed_list_server_error(self):
        self._mock_error('users/list_detailed', status=500, method=responses.GET)
        with self.assertRaises(command.CommandException):
            command.list_users_detailed()

    def test_user_create(self):
        self.requests_mock.add(
            responses.POST,
            '%s/api/users/create' % command.get_registry_url(None),
            status=201,
            json={
                'count':'1',
                'username':'admin',
                'first_name':'',
                'last_name':'',
                'is_superuser':True,
                'is_admin':True,
                'is_staff':True,
            }
        )
        command.create_user('bob', 'bob@quiltdata.io', None)

    def test_user_create_no_auth(self):
        self._mock_error('users/create', status=401)
        with self.assertRaises(command.CommandException):
            command.create_user('bob', 'bob@quitdata.io', None)

    def test_user_disable(self):
        self.requests_mock.add(
            responses.POST,
            '%s/api/users/disable' % command.get_registry_url(None),
            status=201
            )
        command.disable_user('bob', None)

    def test_user_enable(self):
        self.requests_mock.add(
            responses.POST,
            '%s/api/users/enable' % command.get_registry_url(None),
            status=201
            )
        command.enable_user('bob', None)

    def test_create_not_found(self):
        self._mock_error('users/create', team='qux', status=404)
        with self.assertRaises(command.CommandException):
            command.create_user('bob', 'bob@quiltdata.io', team='qux')

    def test_create_server_error(self):
        self._mock_error('users/create', team='qux', status=500)
        with self.assertRaises(command.CommandException):
            command.create_user('bob', 'bob@quiltdata.io', team='qux')

    def test_create_duplicate(self):
        self._mock_error('users/create', status=400, team='qux', message="Bad request. Maybe there's already")
        with assertRaisesRegex(self, command.CommandException, "Bad request. Maybe there's already"):
            command.create_user('bob', 'bob@quiltdata.io', team='qux')

    def test_user_create_bogus(self):
        self._mock_error('users/create', status=400, team='qux', message="Please enter a valid email address.")
        with assertRaisesRegex(self, command.CommandException, "Please enter a valid email address."):
            command.create_user('bob', 'wrongemail', 'qux')

    def test_user_create_empty_email_team(self):
        self._mock_error('users/create', status=400, team='qux', message="Please enter a valid email address.")
        with assertRaisesRegex(self, command.CommandException, "Please enter a valid email address."):
            command.create_user('bob', '', team='qux')

    def test_user_create_empty(self):
        self._mock_error('users/create', status=400, team='qux', message="Bad request. Maybe there's already")
        with assertRaisesRegex(self, command.CommandException, "Bad request. Maybe there's already"):
            command.create_user('', 'bob@quiltdata.io', team='qux')

    def test_user_create_bogus_team(self):
        self._mock_error('users/create', status=400, team='qux', message="Please enter a valid email address.")
        with assertRaisesRegex(self, command.CommandException, "Please enter a valid email address."):
            command.create_user('bob', 'wrongemail', team='qux')

    def test_user_create_empty_team(self):
        self._mock_error('users/create', status=400, team='qux', message="Bad request. Maybe there's already")
        with assertRaisesRegex(self, command.CommandException, "Bad request. Maybe there's already"):
            command.create_user('', 'bob@quiltdata.io', team='qux')

    def test_user_create_nonexisting_team(self):
        self._mock_error('users/create', status=404, team='nonexisting')
        with self.assertRaises(command.CommandException):
            command.create_user('bob', 'bob@quiltdata.io', team='nonexisting')

    def test_user_disable_not_found(self):
        self._mock_error('users/disable', status=404, team='qux')
        with self.assertRaises(command.CommandException):
            command.disable_user('bob', 'qux')

    def test_user_disable_server_error(self):
        self._mock_error('users/disable', team='qux', status=500)
        with self.assertRaises(command.CommandException):
            command.disable_user('bob', 'qux')

    def test_user_disable_already(self):
        self._mock_error('users/disable', status=404, team='qux')
        with self.assertRaises(command.CommandException):
            command.disable_user('bob', team='qux')

    def test_user_disable_deleted(self):
        self._mock_error('users/disable', status=404, team='qux')
        with self.assertRaises(command.CommandException):
            command.disable_user('deleted', team='qux')

    def test_user_disable_non_existing_team(self):
        self._mock_error('users/disable', status=404, team='nonexisting')
        with self.assertRaises(command.CommandException):
            command.disable_user('bob', team='nonexisting')

    def test_user_disable_non_existing(self):
        self._mock_error('users/disable', status=404, team='qux')
        with self.assertRaises(command.CommandException):
            command.disable_user('nonexisting', team='qux')

    def test_user_disable_empty(self):
        self._mock_error('users/disable', status=400, team='qux', message="Username is not valid")
        with assertRaisesRegex(self, command.CommandException, "Username is not valid"):
            command.disable_user('', team='qux')

    def test_user_disable_no_auth(self):
        self._mock_error('users/disable', status=401, team='qux')
        with self.assertRaises(command.CommandException):
            command.disable_user('bob', team='qux')

    def test_user_disable_unknown(self):
        self._mock_error('users/disable', status=404, team='qux')
        with self.assertRaises(command.CommandException):
            command.disable_user('unknown', team='qux')

    def test_user_delete(self):
        self._mock_error('users/delete', status=201, team='qux')
        command.delete_user('bob', force=True, team='qux')

    def test_user_delete_not_found(self):
        self._mock_error('users/delete', team='qux', status=404)
        with self.assertRaises(command.CommandException):
            command.delete_user('bob', team='qux', force=True)

    def test_user_delete_server_error(self):
        self._mock_error('users/delete', status=404, team='qux')
        with self.assertRaises(command.CommandException):
            command.delete_user('bob', 'qux', force=True)

    def test_user_delete_empty(self):
        self._mock_error('users/delete', status=400, team='qux', message="Username is not valid")
        with assertRaisesRegex(self, command.CommandException, "Username is not valid"):
            command.delete_user('', force=True, team='qux')

    def test_user_delete_no_auth(self):
        self._mock_error('users/delete', status=401, team='qux')
        with self.assertRaises(command.CommandException):
            command.delete_user('bob', force=True, team='qux')

    def test_user_delete_unknown(self):
        self._mock_error('users/delete', status=404, team='qux')
        with self.assertRaises(command.CommandException):
            command.delete_user('unknown', force=True, team='qux')

    def test_user_delete_already(self):
        self._mock_error('users/delete', status=404, team='qux')
        with self.assertRaises(command.CommandException):
            command.delete_user('deleted', team='qux', force=True)

    def test_user_delete_nonexisting_team(self):
        self._mock_error('users/delete', status=404, team='nonexisting')
        with self.assertRaises(command.CommandException):
            command.delete_user('bob', force=True, team='nonexisting')

    @patch('quilt.tools.command._find_logged_in_team', lambda: "someteam")
    def test_audit_user(self):
        self.requests_mock.add(
            responses.GET,
            '%s/api/audit/bob/' % command.get_registry_url("someteam"),
            status=201,
            json={
                'events': [{
                    'created': '',
                    'user': 'bob',
                    'type': 'user',
                    'package_owner': '',
                    'package_name': '',
                    'package_hash': '',
                    'extra': ''
                }]
            })
        command.audit('bob')

    @patch('quilt.tools.command._find_logged_in_team', lambda: "someteam")
    def test_audit_package(self):
        self.requests_mock.add(
            responses.GET,
            '%s/api/audit/foo/bar/' % command.get_registry_url("someteam"),
            status=201,
            json={
                'events': [{
                    'created': '',
                    'user': 'bob',
                    'type': 'package',
                    'package_owner': '',
                    'package_name': '',
                    'package_hash': '',
                    'extra': ''
                }]
            })
        command.audit('foo/bar')

    @patch('quilt.tools.command._find_logged_in_team', lambda: "someteam")
    def test_audit_no_auth_user(self):
        self._mock_error('audit/bob/', status=401, team='someteam', method=responses.GET)
        with self.assertRaises(command.CommandException):
            command.audit('bob')

    @patch('quilt.tools.command._find_logged_in_team', lambda: "someteam")
    def test_audit_no_auth_package(self):
        self._mock_error('audit/foo/bar/', status=401, team='someteam', method=responses.GET)
        with self.assertRaises(command.CommandException):
            command.audit('foo/bar')

    @patch('quilt.tools.command._find_logged_in_team', lambda: None)
    def test_audit_no_team(self):
        with assertRaisesRegex(self, command.CommandException, "Not logged in as a team user"):
            command.audit('bob')
            command.audit('foo/bar')

    @patch('quilt.tools.command._find_logged_in_team', lambda: "someteam")
    def test_audit_not_admin_user(self):
        self._mock_error('audit/bob/', status=403, team='someteam', method=responses.GET)
        with self.assertRaises(command.CommandException):
            command.audit('bob')

    @patch('quilt.tools.command._find_logged_in_team', lambda: "someteam")
    def test_audit_not_admin_package(self):
        self._mock_error('audit/foo/bar/', status=403, team='someteam', method=responses.GET)
        with self.assertRaises(command.CommandException):
            command.audit('foo/bar')

    @patch('quilt.tools.command._find_logged_in_team', lambda: None)
    @patch('sys.stdout', new_callable=StringIO)
    def test_access_list(self, mock_stdout):
        self.requests_mock.add(
            responses.GET,
            '%s/api/access/foo/bar/' % command.get_registry_url(None),
            status=201,
            json={
                'users': ['foo', 'bob']
            }
        )
        command.access_list('foo/bar')
        assert mock_stdout.getvalue() == 'foo\nbob\n'

    @patch('quilt.tools.command._find_logged_in_team', lambda: None)
    def test_access_list_no_auth(self):
        self._mock_error('access/foo/bar/', status=401, method=responses.GET)
        with self.assertRaises(command.CommandException):
            command.access_list('foo/bar')

    @patch('quilt.tools.command._find_logged_in_team', lambda: None)
    @patch('sys.stdout', new_callable=StringIO)
    def test_access_remove(self, mock_stdout):
        self.requests_mock.add(
            responses.DELETE,
            '%s/api/access/foo/bar/bob' % command.get_registry_url(None),
            status=201
        )
        command.access_remove('foo/bar', 'bob')
        assert mock_stdout.getvalue() == u'Access removed for bob\n'

    @patch('quilt.tools.command._find_logged_in_team', lambda: None)
    def test_access_remove_no_auth(self):
        self._mock_error('access/foo/bar/bob', status=401, method=responses.DELETE)
        with self.assertRaises(command.CommandException):
            command.access_remove('foo/bar', 'bob')

    @patch('quilt.tools.command._find_logged_in_team', lambda: None)
    def test_access_remove_not_owner(self):
        self._mock_error('access/foo/bar/bob', status=403, method=responses.DELETE,
                         message="Only the package owner can revoke access")
        with assertRaisesRegex(self, command.CommandException, "Only the package owner can revoke access"):
            command.access_remove('foo/bar', 'bob')

    @patch('quilt.tools.command._find_logged_in_team', lambda: None)
    def test_access_remove_owner(self):
        self._mock_error('access/foo/bar/foo', status=403, method=responses.DELETE,
                         message="Cannot revoke the owner's access")
        with assertRaisesRegex(self, command.CommandException, "Cannot revoke the owner's access"):
            command.access_remove('foo/bar', 'foo')

    @patch('quilt.tools.command._find_logged_in_team', lambda: None)
    def test_access_remove_free_plan(self):
        self._mock_error('access/foo/bar/foo', status=402, method=responses.DELETE,
                         message="Insufficient permissions.")
        with assertRaisesRegex(self, command.CommandException, "Insufficient permissions."):
            command.access_remove('foo/bar', 'foo')

    @patch('quilt.tools.command._find_logged_in_team', lambda: None)
    @patch('sys.stdout', new_callable=StringIO)
    def test_access_add(self, mock_stdout):
        self.requests_mock.add(
            responses.PUT,
            '%s/api/access/foo/bar/bob' % command.get_registry_url(None),
            status=201
        )
        command.access_add('foo/bar', 'bob')
        assert mock_stdout.getvalue() == u'Access added for bob\n'

    @patch('quilt.tools.command._find_logged_in_team', lambda: None)
    def test_access_add_no_auth(self):
        self._mock_error('access/foo/bar/bob', status=401, method=responses.PUT)
        with self.assertRaises(command.CommandException):
            command.access_add('foo/bar', 'bob')

    @patch('quilt.tools.command._find_logged_in_team', lambda: None)
    def test_access_add_not_owner(self):
        self._mock_error('access/foo/bar/bob', status=403, method=responses.PUT,
                         message="Only the package owner can revoke access")
        with assertRaisesRegex(self, command.CommandException, "Only the package owner can revoke access"):
            command.access_add('foo/bar', 'bob')

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

        pkg_obj = store.PackageStore.find_package(None, owner, package)
        self._mock_logs_list(owner, package, pkg_obj.get_hash())

        command.log("{owner}/{pkg}".format(owner=owner, pkg=package))

    def _mock_logs_list(self, owner, package, pkg_hash):
        logs_url = "%s/api/log/%s/%s/" % (command.get_registry_url(None), owner, package)
        resp = dict(logs=[dict(
            hash=pkg_hash,
            created=time.time(),
            author=owner)])
        print("MOCKING URL=%s" % logs_url)
        self.requests_mock.add(responses.GET, logs_url, json.dumps(resp))

    def test_generate_buildfile_wo_building(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, 'data')
        buildfilename = 'build_test_generate_buildfile_wo_building.yml'
        buildfilepath = os.path.join(path, buildfilename)
        assert not os.path.exists(buildfilepath), "%s already exists" % buildfilepath
        try:
            command.generate(path, outfilename=buildfilename)
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

        delete_url = "%s/api/package/%s/%s/" % (command.get_registry_url(None), owner, package)
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

    def test_build_yaml_syntax_error(self):
        path = os.path.dirname(__file__)
        buildfilepath = os.path.join(path, 'build_bad_syntax.yml')
        with assertRaisesRegex(self, command.CommandException, r'Bad yaml syntax.*build_bad_syntax\.yml'):
            command.build('user/test', buildfilepath)

    def test_build_checks_yaml_syntax_error(self):      # pylint: disable=C0103
        path = os.path.abspath(os.path.dirname(__file__))
        buildfilepath = os.path.join(path, 'build_checks_bad_syntax.yml')
        checksorigpath = os.path.join(path, 'checks_bad_syntax.yml')
        checksfilepath = os.path.join(path, 'checks.yml')

        try:
            origdir = os.curdir
            os.chdir(path)
            assert not os.path.exists(checksfilepath)
            shutil.copy(checksorigpath, checksfilepath)
            with assertRaisesRegex(self, command.CommandException, r'Bad yaml syntax.*checks\.yml'):
                command.build('user/test', buildfilepath)
        finally:
            os.remove(checksfilepath)
            os.chdir(origdir)

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
                command.build('user/pkg__test_git_clone_fail', git_url)

        # TODO: running -n (pytest-xdist) there's leaky state and can throw
        # either ImportError: cannot import name or ModuleNotFoundError
        with assertRaisesRegex(self, Exception, r'cannot import|not found|No module named|Could not find'):
            from quilt.data.user import pkg__test_git_clone_fail

    def test_logging(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')

        log_url = '%s/api/log' % (command.get_registry_url(None),)

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

    def test_rm(self):
        """
        Test removing a package.
        """
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        command.rm('foo/bar', force=True)
        teststore = store.PackageStore(self._store_dir)
        assert not os.path.isdir(teststore.package_path(None, 'foo', 'bar'))

    def test_rm_non_existent_package(self):
        """
        Test removing a non-existent package.
        """
        teststore = store.PackageStore(self._store_dir)
        assert not os.path.isdir(teststore.package_path(None, 'foo', 'bar'))
        command.rm('foo/bar', force=True)

    def test_rm_package_w_shared_obj(self):
        """
        Test removing a package that shares an object with another. The
        other package should still remain.
        """
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)
        command.build('foo/bar2', build_path)

        command.rm('foo/bar', force=True)
        teststore = store.PackageStore(self._store_dir)
        assert not os.path.isdir(teststore.package_path(None, 'foo', 'bar'))

        from quilt.data.foo import bar2
        assert isinstance(bar2.foo(), pd.DataFrame)

    def test_rm_subpackage(self):
        """
        Test removing a sub-package (not supported).
        """
        with assertRaisesRegex(self, command.CommandException, "Specify package as"):
            command.rm('foo/bar/baz', force=True)

    def test_rm_doesnt_break_cache(self):
        """
        Test building, removing then rebuilding a package. The package
        should be correctly rebuilt.
        """
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        command.rm('foo/bar', force=True)
        teststore = store.PackageStore(self._store_dir)
        assert not os.path.isdir(teststore.package_path(None, 'foo', 'bar'))

        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        from quilt.data.foo import bar
        assert isinstance(bar.foo(), pd.DataFrame)

    def test_parse_package_names(self):
        # good parse strings
        expected = (None, 'user', 'package')
        assert command.parse_package('user/package') == expected

        expected = ('team', 'user', 'package')
        assert command.parse_package('team:user/package') == expected

        expected = (None, 'user', 'package', ['foo', 'bar'])
        assert command.parse_package('user/package/foo/bar', True) == expected

        expected = ('team', 'user', 'package', ['foo', 'bar'])
        assert command.parse_package('team:user/package/foo/bar', True) == expected

        expected = ('team', 'user', 'package', [])
        assert command.parse_package('team:user/package', True) == expected

        # bad parse strings
        with pytest.raises(command.CommandException, message='subdir should be rejected'):
            command.parse_package('user/package/subdir', allow_subpath=False)

        with pytest.raises(command.CommandException, match="Invalid user name"):
            command.parse_package('9user/package')

        with pytest.raises(command.CommandException, match='Invalid package name'):
            command.parse_package('user/!package')

        with pytest.raises(command.CommandException, match='Invalid element in subpath'):
            command.parse_package('user/package/&subdir', True)

        with pytest.raises(command.CommandException, message='subdir should be rejected'):
            command.parse_package('team:user/package/subdir', allow_subpath=False)

        with pytest.raises(command.CommandException, match='Invalid team name'):
            command.parse_package('team%:user/package/subdir', allow_subpath=True)

        with pytest.raises(command.CommandException, match="Invalid user name"):
            command.parse_package('team:9user/package')

        with pytest.raises(command.CommandException, match='Invalid package name'):
            command.parse_package('team:user/!package')

        with pytest.raises(command.CommandException, match='Invalid element in subpath'):
            command.parse_package('team:user/package/&subdir', True)

        # XXX: in this case, should we just strip the trialing slash?
        with pytest.raises(command.CommandException, match='Invalid element in subpath'):
            command.parse_package('team:user/package/subdir/', True)

    def test_parse_package_extended_names(self):
        # good parse strings
        expected = ('user/package', None, 'user', 'package', [], None, None, None)
        assert command.parse_package_extended('user/package') == expected

        expected = ('user/package/sub/path', None, 'user', 'package', ['sub', 'path'], None, None, None)
        assert command.parse_package_extended('user/package/sub/path') == expected

        expected = ('team:user/package', 'team', 'user', 'package', [], None, None, None)
        assert command.parse_package_extended('team:user/package') == expected

        expected = ('team:user/package/sub/path',
                    'team', 'user', 'package', ['sub', 'path'], None, None, None)
        assert command.parse_package_extended('team:user/package/sub/path') == expected

        expected = ('user/package', None, 'user', 'package', [], 'abc123', None, None)
        assert command.parse_package_extended('user/package:h:abc123') == expected

        expected = ('user/package', None, 'user', 'package', [], 'abc123', None, None)
        assert command.parse_package_extended('user/package:hash:abc123') == expected

        expected = ('user/package', None, 'user', 'package', [], None, '123', None)
        assert command.parse_package_extended('user/package:v:123') == expected

        expected = ('user/package', None, 'user', 'package', [], None, '123', None)
        assert command.parse_package_extended('user/package:version:123') == expected

        expected = ('user/package', None, 'user', 'package', [], None, None, 'some')
        assert command.parse_package_extended('user/package:t:some') == expected

        expected = ('user/package', None, 'user', 'package', [],  None, None, 'some')
        assert command.parse_package_extended('user/package:tag:some') == expected

        expected = ('user/package/sub/path', None, 'user', 'package', ['sub', 'path'], 'abc123', None, None)
        assert command.parse_package_extended('user/package/sub/path:h:abc123') == expected

        expected = ('user/package/sub/path', None, 'user', 'package', ['sub', 'path'], 'abc123', None, None)
        assert command.parse_package_extended('user/package/sub/path:hash:abc123') == expected

        expected = ('user/package/sub/path', None, 'user', 'package', ['sub', 'path'], None, '123', None)
        assert command.parse_package_extended('user/package/sub/path:v:123') == expected

        expected = ('user/package/sub/path', None, 'user', 'package', ['sub', 'path'], None, '123', None)
        assert command.parse_package_extended('user/package/sub/path:version:123') == expected

        expected = ('user/package/sub/path', None, 'user', 'package', ['sub', 'path'], None, None, 'some')
        assert command.parse_package_extended('user/package/sub/path:t:some') == expected

        expected = ('user/package/sub/path', None, 'user', 'package', ['sub', 'path'],  None, None, 'some')
        assert command.parse_package_extended('user/package/sub/path:tag:some') == expected

        expected = ('team:user/package', 'team', 'user', 'package', [], 'abc123', None, None)
        assert command.parse_package_extended('team:user/package:h:abc123') == expected

        expected = ('team:user/package', 'team', 'user', 'package', [], 'abc123', None, None)
        assert command.parse_package_extended('team:user/package:hash:abc123') == expected

        expected = ('team:user/package', 'team', 'user', 'package', [], None, '123', None)
        assert command.parse_package_extended('team:user/package:v:123') == expected

        expected = ('team:user/package', 'team', 'user', 'package', [], None, '123', None)
        assert command.parse_package_extended('team:user/package:version:123') == expected

        expected = ('team:user/package', 'team', 'user', 'package', [], None, None, 'some')
        assert command.parse_package_extended('team:user/package:t:some') == expected

        expected = ('team:user/package', 'team', 'user', 'package', [], None, None, 'some')
        assert command.parse_package_extended('team:user/package:tag:some') == expected

        expected = ('team:user/package/sub/path',
                    'team', 'user', 'package', ['sub', 'path'], 'abc123', None, None)
        assert command.parse_package_extended('team:user/package/sub/path:h:abc123') == expected

        expected = ('team:user/package/sub/path',
                    'team', 'user', 'package', ['sub', 'path'], 'abc123', None, None)
        assert command.parse_package_extended('team:user/package/sub/path:hash:abc123') == expected

        expected = ('team:user/package/sub/path',
                    'team', 'user', 'package', ['sub', 'path'], None, '123', None)
        assert command.parse_package_extended('team:user/package/sub/path:v:123') == expected

        expected = ('team:user/package/sub/path',
                    'team', 'user', 'package', ['sub', 'path'], None, '123', None)
        assert command.parse_package_extended('team:user/package/sub/path:version:123') == expected

        expected = ('team:user/package/sub/path',
                    'team', 'user', 'package', ['sub', 'path'], None, None, 'some')
        assert command.parse_package_extended('team:user/package/sub/path:t:some') == expected

        expected = ('team:user/package/sub/path',
                    'team', 'user', 'package', ['sub', 'path'], None, None, 'some')
        assert command.parse_package_extended('team:user/package/sub/path:tag:some') == expected

        # bad parse strings
        with pytest.raises(command.CommandException):
            command.parse_package_extended('user/package:a:aaa111')

        with pytest.raises(command.CommandException):
            command.parse_package_extended('team:user/package:a:aaa111')

        with pytest.raises(command.CommandException):
            command.parse_package_extended('foo:bar:baz')
