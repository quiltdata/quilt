"""
Tests for login and logout.
"""

import datetime
from unittest.mock import patch

import boto3
import pytest
import responses

import quilt3
import quilt3.util

from .utils import QuiltTestCase


def format_date(date):
    return date.replace(tzinfo=datetime.timezone.utc, microsecond=0).isoformat()


class TestSession(QuiltTestCase):
    @patch('quilt3.session.open_url')
    @patch('quilt3.session.input', return_value='123456')
    @patch('quilt3.session.login_with_token')
    def test_login(self, mock_login_with_token, mock_input, mock_open_url):
        quilt3.login()

        url = quilt3.session.get_registry_url()

        mock_open_url.assert_called_with(f'{url}/login')
        mock_login_with_token.assert_called_with('123456')

    @patch('quilt3.session._save_auth')
    @patch('quilt3.session._save_credentials')
    def test_login_with_token(self, mock_save_credentials, mock_save_auth):
        url = quilt3.session.get_registry_url()

        mock_auth = dict(
            refresh_token='refresh-token',
            access_token='access-token',
            expires_at=123456789
        )

        self.requests_mock.add(
            responses.POST,
            f'{url}/api/token',
            json=mock_auth,
            status=200
        )

        self.requests_mock.add(
            responses.GET,
            f'{url}/api/auth/get_credentials',
            json=dict(
                AccessKeyId='access-key',
                SecretAccessKey='secret-key',
                SessionToken='session-token',
                Expiration="2019-05-28T23:58:07+00:00"
            ),
            status=200
        )

        quilt3.session.login_with_token('123456')

        mock_save_auth.assert_called_with({url: mock_auth})
        mock_save_credentials.assert_called_with(dict(
            access_key='access-key',
            secret_key='secret-key',
            token='session-token',
            expiry_time="2019-05-28T23:58:07+00:00"
        ))

    @patch('quilt3.session._save_credentials')
    @patch('quilt3.session._load_credentials')
    def test_create_botocore_session(self, mock_load_credentials, mock_save_credentials):
        # Test good credentials.
        future_date = datetime.datetime.utcnow() + datetime.timedelta(hours=1)

        mock_load_credentials.return_value = dict(
            access_key='access-key',
            secret_key='secret-key',
            token='session-token',
            expiry_time=format_date(future_date)
        )

        session = quilt3.session.create_botocore_session()
        credentials = session.get_credentials()

        assert credentials.access_key == 'access-key'
        assert credentials.secret_key == 'secret-key'
        assert credentials.token == 'session-token'

        mock_save_credentials.assert_not_called()

        # Test expired credentials.
        past_date = datetime.datetime.utcnow() - datetime.timedelta(minutes=5)

        mock_load_credentials.return_value = dict(
            access_key='access-key',
            secret_key='secret-key',
            token='session-token',
            expiry_time=format_date(past_date)
        )

        url = quilt3.session.get_registry_url()
        self.requests_mock.add(
            responses.GET,
            f'{url}/api/auth/get_credentials',
            json=dict(
                AccessKeyId='access-key2',
                SecretAccessKey='secret-key2',
                SessionToken='session-token2',
                Expiration=format_date(future_date)
            ),
            status=200
        )

        session = quilt3.session.create_botocore_session()
        credentials = session.get_credentials()

        assert credentials.access_key == 'access-key2'
        assert credentials.secret_key == 'secret-key2'
        assert credentials.token == 'session-token2'

        mock_save_credentials.assert_called()

    @patch("quilt3.util.load_config")
    @patch("quilt3.session._load_credentials")
    def test_get_boto3_session(self, mock_load_credentials, mock_load_config):
        for kw in (
            {"fallback": False},
            {"fallback": True},
            {},
        ):
            mock_load_credentials.reset_mock()
            mock_load_config.reset_mock()
            with self.subTest(kwargs=kw):
                region = "us-west-2"
                config = quilt3.util.load_config()
                mock_load_config.return_value = {
                    **config,
                    "region": region,
                }

                future_date = datetime.datetime.now() + datetime.timedelta(hours=1)
                mock_load_credentials.return_value = dict(
                    access_key="access-key",
                    secret_key="secret-key",
                    token="session-token",
                    expiry_time=format_date(future_date),
                )

                session = quilt3.get_boto3_session()
                mock_load_credentials.assert_called_once_with()
                mock_load_config.assert_called_with()

                assert isinstance(session, boto3.Session)
                credentials = session.get_credentials()

                assert credentials.access_key == "access-key"
                assert credentials.secret_key == "secret-key"
                assert credentials.token == "session-token"

                assert session.region_name == region

    @patch("quilt3.session.create_botocore_session")
    @patch("quilt3.session._load_credentials", return_value={})
    def test_get_boto3_session_no_credentials_fallback_true(self, mock_load_credentials, mock_create_botocore_session):
        session = quilt3.get_boto3_session()
        mock_load_credentials.assert_called_once_with()
        mock_create_botocore_session.assert_not_called()

        assert isinstance(session, boto3.Session)

    @patch("quilt3.session._load_credentials", return_value={})
    def test_get_boto3_session_no_credentials_fallback_false(self, mock_load_credentials):
        with pytest.raises(quilt3.util.QuiltException) as exc_info:
            quilt3.get_boto3_session(fallback=False)

        mock_load_credentials.assert_called_once_with()
        assert "No Quilt credentials found" in str(exc_info.value)

    def test_logged_in(self):
        registry_url = quilt3.session.get_registry_url()
        other_registry_url = registry_url + 'other'
        mock_auth = dict(
            refresh_token='refresh-token',
            access_token='access-token',
            expires_at=123456789,
        )

        with patch('quilt3.session._load_auth', return_value={registry_url: mock_auth}) as mocked_load_auth:
            assert quilt3.logged_in() == 'https://example.com'
            mocked_load_auth.assert_called_once()

        with patch('quilt3.session._load_auth', return_value={other_registry_url: mock_auth}) as mocked_load_auth:
            assert quilt3.logged_in() is None
            mocked_load_auth.assert_called_once()
