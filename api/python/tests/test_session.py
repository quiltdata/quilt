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
    return date.astimezone(datetime.timezone.utc).replace(microsecond=0).isoformat()


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
            expires_at=123456789,
        )

        self.requests_mock.add(
            responses.POST,
            f'{url}/api/token',
            json=mock_auth,
            status=200,
        )

        self.requests_mock.add(
            responses.GET,
            f'{url}/api/auth/get_credentials',
            json=dict(
                AccessKeyId='access-key',
                SecretAccessKey='secret-key',
                SessionToken='session-token',
                Expiration="2019-05-28T23:58:07+00:00",
            ),
            status=200,
        )

        quilt3.session.login_with_token('123456')

        mock_save_auth.assert_called_with({url: mock_auth})
        mock_save_credentials.assert_called_with(
            dict(
                access_key='access-key',
                secret_key='secret-key',
                token='session-token',
                expiry_time="2019-05-28T23:58:07+00:00",
            )
        )

    @patch('quilt3.session._save_credentials')
    @patch('quilt3.session._load_credentials')
    def test_create_botocore_session(self, mock_load_credentials, mock_save_credentials):
        # Test good credentials.
        future_date = datetime.datetime.now() + datetime.timedelta(hours=1)

        mock_load_credentials.return_value = dict(
            access_key='access-key',
            secret_key='secret-key',
            token='session-token',
            expiry_time=format_date(future_date),
        )

        session = quilt3.session.create_botocore_session()
        credentials = session.get_credentials()

        assert credentials.access_key == 'access-key'
        assert credentials.secret_key == 'secret-key'
        assert credentials.token == 'session-token'

        mock_save_credentials.assert_not_called()

        # Test expired credentials.
        past_date = datetime.datetime.now() - datetime.timedelta(minutes=5)

        mock_load_credentials.return_value = dict(
            access_key='access-key',
            secret_key='secret-key',
            token='session-token',
            expiry_time=format_date(past_date),
        )

        url = quilt3.session.get_registry_url()
        self.requests_mock.add(
            responses.GET,
            f'{url}/api/auth/get_credentials',
            json=dict(
                AccessKeyId='access-key2',
                SecretAccessKey='secret-key2',
                SessionToken='session-token2',
                Expiration=format_date(future_date),
            ),
            status=200,
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

                session = quilt3.get_boto3_session(**kw)
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


@pytest.fixture
def api_key_session(request):
    """Fixture that clears API key state before and after each test."""
    quilt3.clear_api_key()
    quilt3.session.clear_session()
    yield
    quilt3.clear_api_key()


def test_login_with_api_key_sets_auth_header(api_key_session):
    """Test that login_with_api_key sets the correct Authorization header."""
    api_key = 'qk_test_api_key_12345'
    quilt3.login_with_api_key(api_key)

    session = quilt3.session.get_session()
    assert session.headers['Authorization'] == f'Bearer {api_key}'


def test_login_with_api_key_no_disk_persistence(api_key_session):
    """Test that API key auth doesn't write to disk."""
    api_key = 'qk_test_api_key_12345'

    with (
        patch('quilt3.session._save_auth') as mock_save_auth,
        patch('quilt3.session._save_credentials') as mock_save_creds,
    ):
        quilt3.login_with_api_key(api_key)
        quilt3.session.get_session()

        mock_save_auth.assert_not_called()
        mock_save_creds.assert_not_called()


def test_clear_api_key_removes_override(api_key_session):
    """Test that clear_api_key removes the API key."""
    api_key = 'qk_test_api_key_12345'
    quilt3.login_with_api_key(api_key)

    session = quilt3.session.get_session()
    assert session.headers['Authorization'] == f'Bearer {api_key}'

    quilt3.clear_api_key()
    assert quilt3.session._api_key is None


def test_clear_api_key_falls_back_to_interactive(api_key_session):
    """Test that clear_api_key falls back to interactive session."""
    api_key = 'qk_test_api_key_12345'

    with patch('quilt3.session._create_auth') as mock_create_auth:
        # Login with API key
        quilt3.login_with_api_key(api_key)
        session1 = quilt3.session.get_session()
        assert session1.headers['Authorization'] == f'Bearer {api_key}'
        mock_create_auth.assert_not_called()

        # Clear API key - should attempt interactive auth
        mock_create_auth.return_value = {'access_token': 'interactive_token'}
        quilt3.clear_api_key()
        session2 = quilt3.session.get_session()

        mock_create_auth.assert_called_once()
        assert session2.headers['Authorization'] == 'Bearer interactive_token'


def test_api_key_overrides_interactive_session(api_key_session):
    """Test that API key overrides interactive session."""
    with patch('quilt3.session._create_auth') as mock_create_auth:
        # Set up interactive session first
        mock_create_auth.return_value = {'access_token': 'interactive_token'}
        session1 = quilt3.session.get_session()
        assert session1.headers['Authorization'] == 'Bearer interactive_token'
        mock_create_auth.assert_called_once()

        # Login with API key - should override
        api_key = 'qk_test_api_key_12345'
        quilt3.login_with_api_key(api_key)
        session2 = quilt3.session.get_session()

        assert session2.headers['Authorization'] == f'Bearer {api_key}'


def test_api_key_skips_refresh_logic(api_key_session):
    """Test that API key auth doesn't use refresh token logic."""
    api_key = 'qk_test_api_key_12345'

    with patch('quilt3.session._update_auth') as mock_update_auth:
        quilt3.login_with_api_key(api_key)
        quilt3.session.get_session()

        mock_update_auth.assert_not_called()


def test_logged_in_with_api_key(api_key_session):
    """Test that logged_in() returns URL when API key is set."""
    api_key = 'qk_test_api_key_12345'

    # Not logged in initially
    with patch('quilt3.session._load_auth', return_value={}):
        assert quilt3.logged_in() is None

    # Login with API key
    quilt3.login_with_api_key(api_key)
    assert quilt3.logged_in() == 'https://example.com'


def test_logout_clears_api_key(api_key_session):
    """Test that logout() clears the API key."""
    api_key = 'qk_test_api_key_12345'
    quilt3.login_with_api_key(api_key)

    assert quilt3.session._api_key == api_key

    with patch('quilt3.session._save_auth'), patch('quilt3.session._save_credentials'):
        quilt3.logout()

    assert quilt3.session._api_key is None


def test_headless_auth_no_disk_state(api_key_session):
    """Headless auth requires no disk state."""
    api_key = 'qk_ci_pipeline_key_abc123'

    with (
        patch('quilt3.session._load_auth', return_value={}),
        patch('quilt3.session._load_credentials', return_value={}),
        patch('quilt3.session._save_auth') as mock_save_auth,
        patch('quilt3.session._save_credentials') as mock_save_creds,
    ):
        quilt3.login_with_api_key(api_key)
        session = quilt3.session.get_session()
        assert session.headers['Authorization'] == f'Bearer {api_key}'

        # Simulate restart - clear session, API key still in memory
        quilt3.session.clear_session()
        session2 = quilt3.session.get_session()
        assert session2.headers['Authorization'] == f'Bearer {api_key}'

        # No disk writes
        mock_save_auth.assert_not_called()
        mock_save_creds.assert_not_called()


def test_session_coexistence(api_key_session):
    """API key and interactive session coexist."""
    with patch('quilt3.session._create_auth') as mock_create_auth:
        mock_create_auth.return_value = {'access_token': 'interactive_token'}

        # Start with interactive
        session1 = quilt3.session.get_session()
        assert session1.headers['Authorization'] == 'Bearer interactive_token'

        # Override with API key
        quilt3.login_with_api_key('qk_temp_key')
        session2 = quilt3.session.get_session()
        assert session2.headers['Authorization'] == 'Bearer qk_temp_key'

        # Clear API key, fall back to interactive
        quilt3.clear_api_key()
        session3 = quilt3.session.get_session()
        assert session3.headers['Authorization'] == 'Bearer interactive_token'
