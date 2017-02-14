"""
Tests for commands.
"""

from unittest import TestCase
try:
    # Python3
    from unittest.mock import patch
except ImportError:
    # Python2 - external dependency.
    from mock import patch

import pytest
import responses

try:
    import h5py
except ImportError:
    h5py = None

from quilt.tools import command

class CommandTest(TestCase):
    # Note: we're using the deprecated `assertRaisesRegexp` method because
    # the new one, `assertRaisesRegex`, is not present in Python2.

    def test_push_invalid_package(self):
        with self.assertRaisesRegexp(command.CommandException, "owner/package_name"):
            command.push(package="no_user")
        with self.assertRaisesRegexp(command.CommandException, "owner/package_name"):
            command.push(package="a/b/c")

    def test_install_invalid_package(self):
        with self.assertRaisesRegexp(command.CommandException, "owner/package_name"):
            command.install(package="no_user")
        with self.assertRaisesRegexp(command.CommandException, "owner/package_name"):
            command.install(package="a/b/c")

    @pytest.mark.skipif("h5py is None")
    def test_inspect_invalid_package(self):
        with self.assertRaisesRegexp(command.CommandException, "owner/package_name"):
            command.inspect(package="no_user")
        with self.assertRaisesRegexp(command.CommandException, "owner/package_name"):
            command.inspect(package="a/b/c")

    def test_push_missing_package(self):
        with self.assertRaisesRegexp(command.CommandException, "not found"):
            command.push(package="owner/package")

    @pytest.mark.skipif("h5py is None")
    def test_inspect_missing_package(self):
        with self.assertRaisesRegexp(command.CommandException, "not found"):
            command.inspect(package="owner/package")

    @responses.activate
    @patch('webbrowser.open')
    @patch('quilt.tools.command.input')
    @patch('quilt.tools.command._save_auth')
    def test_login(self, mock_save, mock_input, mock_open):
        mock_input.return_value = "123"

        responses.add(
            responses.POST,
            '%s/api/token' % command.QUILT_PKG_URL,
            json=dict(
                statuc=200,
                refresh_token="456",
                access_token="abc",
                expires_at=1000.0
            )
        )

        command.login()

        mock_open.assert_called_with('%s/login' % command.QUILT_PKG_URL)

        assert responses.calls[0].request.body == "refresh_token=123"

        mock_save.assert_called_with(dict(
            refresh_token="456",
            access_token="abc",
            expires_at=1000.0
        ))

    @responses.activate
    @patch('webbrowser.open')
    @patch('quilt.tools.command.input')
    @patch('quilt.tools.command._save_auth')
    def test_login_server_error(self, mock_save, mock_input, mock_open):
        mock_input.return_value = "123"

        responses.add(
            responses.POST,
            '%s/api/token' % command.QUILT_PKG_URL,
            status=500
        )

        with self.assertRaises(command.CommandException):
            command.login()

        mock_save.assert_not_called()

    @responses.activate
    @patch('webbrowser.open')
    @patch('quilt.tools.command.input')
    @patch('quilt.tools.command._save_auth')
    def test_login_auth_fail(self, mock_save, mock_input, mock_open):
        mock_input.return_value = "123"

        responses.add(
            responses.POST,
            '%s/api/token' % command.QUILT_PKG_URL,
            json=dict(
                status=200,
                error="Bad token!"
            )
        )

        with self.assertRaises(command.CommandException):
            command.login()

        mock_save.assert_not_called()

