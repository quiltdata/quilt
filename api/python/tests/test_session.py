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
    @patch('quilt3.session.getpass.getpass', return_value='123456')
    @patch('quilt3.session.login_with_token')
    def test_login(self, mock_login_with_token, mock_getpass, mock_open_url):
        quilt3.login()

        url = quilt3.session.get_registry_url()

        mock_open_url.assert_called_with(f'{url}/login')
        mock_login_with_token.assert_called_with('123456', registry_url=url)

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
def api_key_session():
    """Fixture that clears API key state before and after each test."""
    with quilt3.session._sessions_lock:
        quilt3.session._api_keys.clear()
        quilt3.session.clear_session()
    yield
    with quilt3.session._sessions_lock:
        quilt3.session._api_keys.clear()
        quilt3.session.clear_session()


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
    assert quilt3.session.get_registry_url() not in quilt3.session._api_keys


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

    with patch('quilt3.session.get_from_config', return_value='https://example.com'):
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

    assert quilt3.session._api_keys == {quilt3.session.get_registry_url(): api_key}

    with patch('quilt3.session._save_auth'), patch('quilt3.session._save_credentials'):
        quilt3.logout()

    assert quilt3.session._api_keys == {}


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


def test_login_with_api_key_validates_prefix(api_key_session):
    """Test that login_with_api_key rejects keys without qk_ prefix."""
    with pytest.raises(ValueError, match="must start with 'qk_' prefix"):
        quilt3.login_with_api_key('invalid_key_without_prefix')

    with pytest.raises(ValueError, match="must start with 'qk_' prefix"):
        quilt3.login_with_api_key('')

    # Valid prefix should work
    quilt3.login_with_api_key('qk_valid_key')
    assert quilt3.session._api_keys == {quilt3.session.get_registry_url(): 'qk_valid_key'}


def test_login_with_api_key_requires_registry_url(api_key_session):
    with (
        patch('quilt3.session.get_registry_url', return_value=None),
        pytest.raises(quilt3.util.QuiltException, match='No registry URL is configured'),
    ):
        quilt3.login_with_api_key('qk_valid_key')

    assert quilt3.session._api_keys == {}


def test_login_with_api_key_accepts_registry_url(api_key_session):
    registry_url = 'https://first.example.com'

    with patch('quilt3.session.get_registry_url', return_value=None):
        quilt3.login_with_api_key('qk_first_key', registry_url=registry_url)

    assert quilt3.session._api_keys == {registry_url: 'qk_first_key'}


def test_api_key_is_scoped_to_registry_url(api_key_session):
    """An API key is never sent to a registry other than the one it belongs to."""
    first_registry = 'https://first.example.com'
    second_registry = 'https://second.example.com'

    quilt3.session.clear_session()
    try:
        with (
            patch.dict('quilt3.session._api_keys', clear=True),
            patch(
                'quilt3.session._create_auth',
                return_value={'access_token': 'second-interactive-token'},
            ) as mock_create_auth,
        ):
            with quilt3.session.use_registry_url(first_registry):
                quilt3.login_with_api_key('qk_first_key')
                first_session = quilt3.session.get_session()

            with quilt3.session.use_registry_url(second_registry):
                second_session = quilt3.session.get_session()

        assert first_session.headers['Authorization'] == 'Bearer qk_first_key'
        assert second_session.headers['Authorization'] == 'Bearer second-interactive-token'
        mock_create_auth.assert_called_once_with(None, registry_url=second_registry)
    finally:
        quilt3.session.clear_session()


def test_each_registry_can_have_its_own_api_key(api_key_session):
    first_registry = 'https://first.example.com'
    second_registry = 'https://second.example.com'

    quilt3.session.clear_session()
    try:
        with patch.dict('quilt3.session._api_keys', clear=True):
            with quilt3.session.use_registry_url(first_registry):
                quilt3.login_with_api_key('qk_first_key')

            with quilt3.session.use_registry_url(second_registry):
                quilt3.login_with_api_key('qk_second_key')

            assert quilt3.session._api_keys == {
                first_registry: 'qk_first_key',
                second_registry: 'qk_second_key',
            }

            with quilt3.session.use_registry_url(first_registry):
                first_session = quilt3.session.get_session()
            with quilt3.session.use_registry_url(second_registry):
                second_session = quilt3.session.get_session()

        assert first_session.headers['Authorization'] == 'Bearer qk_first_key'
        assert second_session.headers['Authorization'] == 'Bearer qk_second_key'
    finally:
        quilt3.session.clear_session()


def test_clear_api_key_removes_keys_for_all_registries(api_key_session):
    first_registry = 'https://first.example.com'
    second_registry = 'https://second.example.com'

    quilt3.session.clear_session()
    try:
        with patch.dict(
            'quilt3.session._api_keys',
            {first_registry: 'qk_first_key', second_registry: 'qk_second_key'},
            clear=True,
        ):
            with quilt3.session.use_registry_url(first_registry):
                quilt3.session.get_session()
            with quilt3.session.use_registry_url(second_registry):
                quilt3.session.get_session()

            assert set(quilt3.session._sessions) == {first_registry, second_registry}

            quilt3.clear_api_key()

            assert quilt3.session._api_keys == {}
            assert quilt3.session._sessions == {}
    finally:
        quilt3.session.clear_session()


def test_login_with_api_key_uses_single_registry_snapshot(api_key_session):
    registry_url = 'https://first.example.com'
    resolver_results = iter([registry_url])
    token = quilt3.session.set_registry_url_resolver(lambda: next(resolver_results))
    try:
        with patch.dict('quilt3.session._api_keys', clear=True):
            quilt3.login_with_api_key('qk_first_key')
            assert quilt3.session._api_keys == {registry_url: 'qk_first_key'}
    finally:
        quilt3.session.reset_registry_url_resolver(token)


def test_logged_in_only_reports_api_key_for_current_registry(api_key_session):
    first_registry = 'https://first.example.com'
    second_registry = 'https://second.example.com'

    with (
        patch.dict('quilt3.session._api_keys', {first_registry: 'qk_first_key'}, clear=True),
        patch('quilt3.session._load_auth', return_value={}),
        patch('quilt3.session.get_from_config', return_value='https://example.com'),
    ):
        with quilt3.session.use_registry_url(first_registry):
            assert quilt3.logged_in() == 'https://example.com'
        with quilt3.session.use_registry_url(second_registry):
            assert quilt3.logged_in() is None


def test_logged_in_does_not_wait_for_session_lock(api_key_session):
    import threading

    completed = threading.Event()

    def check_logged_in():
        with (
            patch('quilt3.session._load_auth', return_value={}),
            patch('quilt3.session.get_from_config', return_value='https://example.com'),
        ):
            quilt3.logged_in()
        completed.set()

    with quilt3.session._sessions_lock:
        thread = threading.Thread(target=check_logged_in)
        thread.start()
        assert completed.wait(timeout=1)

    thread.join()


class TestRegistryUrlOverride(QuiltTestCase):
    def test_default_reads_config(self):
        assert quilt3.session.get_registry_url() == quilt3.util.get_from_config('registryUrl')

    def test_use_registry_url_overrides_and_restores(self):
        original = quilt3.session.get_registry_url()

        with quilt3.session.use_registry_url('https://other.example.com'):
            assert quilt3.session.get_registry_url() == 'https://other.example.com'

        assert quilt3.session.get_registry_url() == original

    def test_use_registry_url_restores_on_exception(self):
        original = quilt3.session.get_registry_url()

        with pytest.raises(ValueError):
            with quilt3.session.use_registry_url('https://other.example.com'):
                raise ValueError('boom')

        assert quilt3.session.get_registry_url() == original

    def test_use_registry_url_nests(self):
        original = quilt3.session.get_registry_url()

        with quilt3.session.use_registry_url('https://outer.example.com'):
            with quilt3.session.use_registry_url('https://inner.example.com'):
                assert quilt3.session.get_registry_url() == 'https://inner.example.com'
            assert quilt3.session.get_registry_url() == 'https://outer.example.com'

        assert quilt3.session.get_registry_url() == original

    def test_resolver_is_called_per_call(self):
        urls = iter(['https://first.example.com', 'https://second.example.com'])
        token = quilt3.session.set_registry_url_resolver(lambda: next(urls))
        try:
            assert quilt3.session.get_registry_url() == 'https://first.example.com'
            assert quilt3.session.get_registry_url() == 'https://second.example.com'
        finally:
            quilt3.session.reset_registry_url_resolver(token)

    def test_resolver_none_restores_config_lookup(self):
        original = quilt3.session.get_registry_url()

        with quilt3.session.use_registry_url('https://other.example.com'):
            token = quilt3.session.set_registry_url_resolver(None)
            try:
                assert quilt3.session.get_registry_url() == original
            finally:
                quilt3.session.reset_registry_url_resolver(token)

    def test_set_resolver_rejects_non_callable(self):
        with pytest.raises(ValueError, match='must be a callable'):
            quilt3.session.set_registry_url_resolver('https://other.example.com')

    def test_override_does_not_write_config(self):
        before = quilt3.util.CONFIG_PATH.read_bytes()

        with quilt3.session.use_registry_url('https://other.example.com'):
            pass

        assert quilt3.util.CONFIG_PATH.read_bytes() == before

    def test_override_applies_to_graphql_client_url(self):
        from quilt3._graphql_client.base_client import BaseClient

        with quilt3.session.use_registry_url('https://other.example.com'):
            assert BaseClient().url == 'https://other.example.com/graphql'

    def test_graphql_client_uses_single_registry_snapshot(self):
        from quilt3._graphql_client.base_client import BaseClient

        registry_url = 'https://first.example.com'
        resolver_results = iter([registry_url])
        token = quilt3.session.set_registry_url_resolver(lambda: next(resolver_results))
        try:
            with patch('quilt3.session.get_session') as mock_get_session:
                client = BaseClient()

            assert client.url == f'{registry_url}/graphql'
            mock_get_session.assert_called_once_with(registry_url=registry_url)
        finally:
            quilt3.session.reset_registry_url_resolver(token)

    def test_search_uses_single_registry_snapshot(self):
        from quilt3.search_util import search_api

        registry_url = 'https://first.example.com'
        resolver_results = iter([registry_url])
        token = quilt3.session.set_registry_url_resolver(lambda: next(resolver_results))
        try:
            with patch('quilt3.session.get_session') as mock_get_session:
                mock_get_session.return_value.get.return_value.json.return_value = {'hits': []}
                assert search_api('query', '_all') == {'hits': []}

            mock_get_session.assert_called_once_with(registry_url=registry_url)
            mock_get_session.return_value.get.assert_called_once_with(
                f'{registry_url}/api/search',
                params={'index': '_all', 'action': 'search', 'query': 'query', 'size': 10},
            )
        finally:
            quilt3.session.reset_registry_url_resolver(token)

    def test_login_with_token_uses_single_registry_snapshot(self):
        registry_url = 'https://first.example.com'
        auth = {
            'access_token': 'access-token',
            'refresh_token': 'refresh-token',
            'expires_at': float('inf'),
        }
        resolver_results = iter([registry_url])
        token = quilt3.session.set_registry_url_resolver(lambda: next(resolver_results))
        try:
            with (
                patch('quilt3.session._update_auth', return_value=auth) as mock_update_auth,
                patch('quilt3.session._load_auth', return_value={}),
                patch('quilt3.session._save_auth') as mock_save_auth,
                patch('quilt3.session._refresh_credentials') as mock_refresh_credentials,
            ):
                quilt3.session.login_with_token('initial-refresh-token')

            mock_update_auth.assert_called_once_with('initial-refresh-token', registry_url=registry_url)
            mock_save_auth.assert_called_once_with({registry_url: auth})
            mock_refresh_credentials.assert_called_once_with(registry_url=registry_url)
        finally:
            quilt3.session.reset_registry_url_resolver(token)

    def test_update_auth_resolves_registry_without_snapshot(self):
        registry_url = 'https://first.example.com'
        auth = {
            'access_token': 'access-token',
            'refresh_token': 'refresh-token',
            'expires_at': float('inf'),
        }

        with (
            quilt3.session.use_registry_url(registry_url),
            patch('quilt3.session.requests.post') as mock_post,
        ):
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = auth
            assert quilt3.session._update_auth('initial-refresh-token') == auth

        mock_post.assert_called_once_with(
            f'{registry_url}/api/token',
            timeout=None,
            data={'refresh_token': 'initial-refresh-token'},
        )

    def test_refresh_credentials_uses_single_registry_snapshot(self):
        registry_url = 'https://first.example.com'
        credentials = {
            'AccessKeyId': 'access-key',
            'SecretAccessKey': 'secret-key',
            'SessionToken': 'session-token',
            'Expiration': 'expiration',
        }
        resolver_results = iter([registry_url])
        token = quilt3.session.set_registry_url_resolver(lambda: next(resolver_results))
        try:
            with (
                patch('quilt3.session.get_session') as mock_get_session,
                patch('quilt3.session._save_credentials'),
            ):
                mock_get_session.return_value.get.return_value.json.return_value = credentials
                quilt3.session._refresh_credentials()

            mock_get_session.assert_called_once_with(registry_url=registry_url)
            mock_get_session.return_value.get.assert_called_once_with(f'{registry_url}/api/auth/get_credentials')
        finally:
            quilt3.session.reset_registry_url_resolver(token)

    def test_sessions_are_scoped_to_registry_url(self):
        def create_auth(timeout=None, registry_url=None):
            return {'access_token': f'token-for-{registry_url}'}

        quilt3.session.clear_session()
        try:
            with (
                patch.dict('quilt3.session._api_keys', clear=True),
                patch('quilt3.session._create_auth', side_effect=create_auth) as mock_create_auth,
            ):
                with quilt3.session.use_registry_url('https://first.example.com'):
                    first_session = quilt3.session.get_session()

                with quilt3.session.use_registry_url('https://second.example.com'):
                    second_session = quilt3.session.get_session()

                with quilt3.session.use_registry_url('https://first.example.com'):
                    assert quilt3.session.get_session() is first_session

            assert first_session is not second_session
            assert first_session.headers['Authorization'] == 'Bearer token-for-https://first.example.com'
            assert second_session.headers['Authorization'] == 'Bearer token-for-https://second.example.com'
            assert mock_create_auth.call_count == 2
        finally:
            quilt3.session.clear_session()

    def test_session_refresh_uses_same_registry_url(self):
        registry_url = 'https://other.example.com'
        expired_auth = {
            'access_token': 'expired-token',
            'refresh_token': 'refresh-token',
            'expires_at': 0,
        }
        refreshed_auth = {
            'access_token': 'refreshed-token',
            'refresh_token': 'new-refresh-token',
            'expires_at': float('inf'),
        }

        quilt3.session.clear_session()
        try:
            with (
                patch.dict('quilt3.session._api_keys', clear=True),
                patch('quilt3.session._load_auth', return_value={registry_url: expired_auth}),
                patch('quilt3.session._update_auth', return_value=refreshed_auth) as mock_update_auth,
                patch('quilt3.session._save_auth') as mock_save_auth,
            ):
                with quilt3.session.use_registry_url(registry_url):
                    session = quilt3.session.get_session()

            assert session.headers['Authorization'] == 'Bearer refreshed-token'
            mock_update_auth.assert_called_once_with('refresh-token', None, registry_url=registry_url)
            mock_save_auth.assert_called_once_with({registry_url: refreshed_auth})
        finally:
            quilt3.session.clear_session()

    def test_session_creation_is_atomic_per_registry(self):
        import concurrent.futures
        import threading
        import time

        registry_url = 'https://other.example.com'
        start = threading.Barrier(2)

        def create_auth(timeout=None, registry_url=None):
            time.sleep(0.05)
            return {'access_token': f'token-for-{registry_url}'}

        def get_session():
            with quilt3.session.use_registry_url(registry_url):
                start.wait()
                return quilt3.session.get_session()

        quilt3.session.clear_session()
        try:
            with (
                patch.dict('quilt3.session._api_keys', clear=True),
                patch('quilt3.session._create_auth', side_effect=create_auth) as mock_create_auth,
                concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor,
            ):
                sessions = list(executor.map(lambda _: get_session(), range(2)))

            assert sessions[0] is sessions[1]
            assert mock_create_auth.call_count == 1
        finally:
            quilt3.session.clear_session()

    def test_logout_when_already_logged_out(self):
        with (
            patch('quilt3.session._load_auth', return_value={}),
            patch('quilt3.session._load_credentials', return_value={}),
            patch.dict('quilt3.session._api_keys', clear=True),
            patch('builtins.print') as mock_print,
        ):
            quilt3.session.logout()

        mock_print.assert_called_once_with('Already logged out.')

    def test_override_is_isolated_per_thread(self):
        import threading

        original = quilt3.session.get_registry_url()
        seen = {}

        def worker():
            seen['value'] = quilt3.session.get_registry_url()

        with quilt3.session.use_registry_url('https://other.example.com'):
            thread = threading.Thread(target=worker)
            thread.start()
            thread.join()

        assert seen['value'] == original
