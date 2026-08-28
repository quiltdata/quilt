"""
Helper functions for connecting to the Quilt Registry.
"""

import getpass
import json
import os
import platform
import stat
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from contextvars import ContextVar
from importlib import metadata

import boto3
import botocore.session
import requests
from botocore.credentials import (
    CredentialProvider,
    CredentialResolver,
    RefreshableCredentials,
)

from .util import BASE_PATH, QuiltException, get_from_config

AUTH_PATH = BASE_PATH / 'auth.json'
CREDENTIALS_PATH = BASE_PATH / 'credentials.json'
VERSION = metadata.version('quilt3')

# Optional override for registry URL resolution; see set_registry_url_resolver().
# A ContextVar rather than a plain global so concurrent tasks and threads can
# each bind their own registry without racing.
_registry_url_resolver: ContextVar = ContextVar('quilt3_registry_url_resolver', default=None)


def _load_auth():
    try:
        with open(AUTH_PATH, encoding='utf-8') as fd:
            return json.load(fd)
    except FileNotFoundError:
        return {}


def _save_auth(cfg):
    BASE_PATH.mkdir(parents=True, exist_ok=True)
    with open(AUTH_PATH, 'w', encoding='utf-8') as fd:
        AUTH_PATH.chmod(stat.S_IRUSR | stat.S_IWUSR)
        json.dump(cfg, fd)


def _load_credentials():
    try:
        with open(CREDENTIALS_PATH, encoding='utf-8') as fd:
            return json.load(fd)
    except FileNotFoundError:
        return {}


def _save_credentials(creds):
    BASE_PATH.mkdir(parents=True, exist_ok=True)
    with open(CREDENTIALS_PATH, 'w', encoding='utf-8') as fd:
        CREDENTIALS_PATH.chmod(stat.S_IRUSR | stat.S_IWUSR)
        json.dump(creds, fd)


def set_registry_url_resolver(resolver):
    """
    Override how the registry URL is resolved, for the current context.

    Normally `get_registry_url()` reads `registryUrl` from `~/.quilt/config.yml`
    on every call. Host applications that need to drive a registry chosen at
    runtime -- or several registries in one process -- can install a resolver
    instead of calling `quilt3.config()`, which would overwrite the user's
    config file.

    Args:
        resolver: a zero-argument callable returning the registry URL as a
            string, or `None` to restore the default config-file lookup.

    Returns:
        A token that can be passed to `reset_registry_url_resolver()` to
        restore the previous resolver.

    Prefer `use_registry_url()` for the common case of scoping an override to
    a block of code.

    Note that `quilt3.admin` and other GraphQL callers capture the URL when
    their client is constructed, so the resolver must be installed before the
    call you want it to affect.
    """
    if resolver is not None and not callable(resolver):
        raise ValueError(
            "resolver must be a callable returning a registry URL, or None; "
            f"got {type(resolver).__name__}. To set a fixed URL, pass "
            "`lambda: url` or use use_registry_url(url)."
        )
    return _registry_url_resolver.set(resolver)


def reset_registry_url_resolver(token):
    """
    Restore the resolver replaced by `set_registry_url_resolver()`.

    Args:
        token: the value returned by `set_registry_url_resolver()`.
    """
    _registry_url_resolver.reset(token)


@contextmanager
def use_registry_url(url):
    """
    Resolve the registry URL to `url` inside a `with` block.

    Nothing is written to `~/.quilt/config.yml`, and the previous resolution
    behavior is restored on exit, including when the block raises.

    Args:
        url: the registry URL to use inside the block.
    """
    token = set_registry_url_resolver(lambda: url)
    try:
        yield
    finally:
        reset_registry_url_resolver(token)


def get_registry_url():
    resolver = _registry_url_resolver.get()
    if resolver is not None:
        return resolver()
    return get_from_config('registryUrl')


def _update_auth(refresh_token, timeout=None, registry_url=None):
    if registry_url is None:
        registry_url = get_registry_url()
    try:
        response = requests.post(
            "%s/api/token" % registry_url,
            timeout=timeout,
            data=dict(
                refresh_token=refresh_token,
            ),
        )
    except requests.exceptions.ConnectionError as ex:
        raise QuiltException("Failed to connect: %s" % ex)

    if response.status_code != requests.codes.ok:
        raise QuiltException("Authentication error: %s" % response.status_code)

    data = response.json()
    error = data.get('error')
    if error is not None:
        raise QuiltException("Failed to log in: %s" % error)

    return dict(
        refresh_token=data['refresh_token'],
        access_token=data['access_token'],
        expires_at=data['expires_at'],
    )


def _handle_response(resp, **kwargs):
    if resp.status_code == requests.codes.unauthorized:
        raise QuiltException("Authentication failed. Check your credentials or API key.")
    elif not resp.ok:
        try:
            data = resp.json()
            raise QuiltException(data['message'])
        except ValueError:
            raise QuiltException("Unexpected failure: error %s" % resp.status_code)


def _create_auth(timeout=None, registry_url=None):
    """
    Reads the credentials, updates the access token if necessary, and returns it.
    """
    url = registry_url if registry_url is not None else get_registry_url()
    contents = _load_auth()
    auth = contents.get(url)

    if auth is not None:
        # If the access token expires within a minute, update it.
        if auth['expires_at'] < time.time() + 60:
            try:
                auth = _update_auth(auth['refresh_token'], timeout, registry_url=url)
            except QuiltException as ex:
                raise QuiltException("Failed to update the access token (%s). Run `quilt3 login` again." % ex)
            contents[url] = auth
            _save_auth(contents)

    return auth


def _create_session(auth):
    """
    Creates a session object to be used for `push`, `install`, etc.
    """
    session = requests.Session()
    session.hooks.update(response=_handle_response)
    session.headers.update(
        {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "quilt-python/%s (%s %s) %s/%s"
            % (
                VERSION,
                platform.system(),
                platform.release(),
                platform.python_implementation(),
                platform.python_version(),
            ),
        }
    )
    if auth is not None:
        session.headers["Authorization"] = "Bearer %s" % auth['access_token']

    return session


_sessions = {}
_sessions_lock = threading.RLock()
_api_keys = {}


def get_session(timeout=None, registry_url=None):
    """
    Creates a session or returns an existing session for the current registry.

    If an API key is set for the resolved registry via login_with_api_key(),
    uses that for authentication. Otherwise, uses the interactive session with
    refresh token logic.

    Sessions are cached separately by resolved registry URL so an authorization
    header created for one registry is never reused for another registry.

    Args:
        timeout: optional timeout for refreshing authentication.
        registry_url: optional URL snapshot supplied by a caller that has
            already resolved the registry for its operation.
    """
    registry_url = registry_url if registry_url is not None else get_registry_url()
    with _sessions_lock:
        session = _sessions.get(registry_url)
        if session is None:
            api_key = _api_keys.get(registry_url)
            if api_key is not None:
                # API key auth: no refresh logic, use key directly
                session = _create_session({'access_token': api_key})
            else:
                # Interactive session: refresh token logic
                auth = _create_auth(timeout, registry_url=registry_url)
                session = _create_session(auth)
            _sessions[registry_url] = session

    return session


def clear_session():
    with _sessions_lock:
        for session in _sessions.values():
            session.close()
        _sessions.clear()


def login_with_api_key(key: str):
    """
    Authenticate using an API key.

    The API key is stored in memory only (no disk persistence) and scoped to
    the currently resolved registry. While set, it overrides any interactive
    session for that registry. Use clear_api_key() to revert that registry to
    its interactive session.

    Args:
        key: API key string (starts with 'qk_')

    Raises:
        ValueError: If the key doesn't start with 'qk_' prefix.
    """
    if not key.startswith("qk_"):
        raise ValueError("API key must start with 'qk_' prefix")
    registry_url = get_registry_url()
    with _sessions_lock:
        _api_keys[registry_url] = key
        session = _sessions.pop(registry_url, None)
        if session is not None:
            session.close()


def clear_api_key():
    """
    Clear the current registry's API key and fall back to its interactive session.
    """
    registry_url = get_registry_url()
    with _sessions_lock:
        _api_keys.pop(registry_url, None)
        session = _sessions.pop(registry_url, None)
        if session is not None:
            session.close()


def open_url(url):
    try:
        if sys.platform == 'win32':
            os.startfile(url)  # pylint:disable=E1101
        elif sys.platform == 'darwin':
            with open(os.devnull, 'rb+') as null:
                subprocess.check_call(['open', url], stdin=null, stdout=null, stderr=null)
        else:
            with open(os.devnull, 'rb+') as null:
                subprocess.check_call(['xdg-open', url], stdin=null, stdout=null, stderr=null)
    except Exception as ex:  # pylint:disable=W0703
        print("Failed to launch the browser: %s" % ex)


def login():
    """
    Authenticate to your Quilt stack and assume the role assigned to you by
    your stack administrator. Not required if you have existing AWS credentials.

    Launches a web browser and asks the user for a token.
    """
    registry_url = get_registry_url()
    if registry_url is None:
        raise QuiltException(
            "You attempted to authenticate to a Quilt catalog, but your home catalog is "
            "currently set to None. Please first specify your home catalog by running "
            "\"quilt3.config('$URL')\", replacing '$URL' with your catalog homepage."
        )

    login_url = "%s/login" % registry_url

    print("Launching a web browser...")
    print("If that didn't work, please visit the following URL: %s" % login_url)

    open_url(login_url)

    print()
    refresh_token = getpass.getpass("Enter the code from the webpage: ")

    login_with_token(refresh_token, registry_url=registry_url)


def login_with_token(refresh_token, registry_url=None):
    """
    Authenticate using an existing token.

    Args:
        refresh_token: token to exchange for registry authentication.
        registry_url: optional URL snapshot supplied by `login()`.
    """
    url = registry_url if registry_url is not None else get_registry_url()

    # Get an access token and a new refresh token.
    auth = _update_auth(refresh_token, registry_url=url)

    with _sessions_lock:
        contents = _load_auth()
        contents[url] = auth
        _save_auth(contents)
        clear_session()

    # use registry-provided credentials
    _refresh_credentials(registry_url=url)


def logout():
    """
    Do not use Quilt credentials. Useful if you have existing AWS credentials.
    """
    # TODO revoke refresh token (without logging out of web sessions)
    with _sessions_lock:
        if _load_auth() or _load_credentials() or _api_keys:
            _save_auth({})
            _save_credentials({})
            _api_keys.clear()
        else:
            print("Already logged out.")

        clear_session()


def _refresh_credentials(registry_url=None):
    url = registry_url if registry_url is not None else get_registry_url()
    session = get_session(registry_url=url)
    creds = session.get("{url}/api/auth/get_credentials".format(url=url)).json()
    result = {
        'access_key': creds['AccessKeyId'],
        'secret_key': creds['SecretAccessKey'],
        'token': creds['SessionToken'],
        'expiry_time': creds['Expiration'],
    }
    _save_credentials(result)
    return result


def logged_in():
    """
    Return catalog URL if Quilt client is authenticated, `None` otherwise.
    """
    registry_url = get_registry_url()
    with _sessions_lock:
        has_api_key = registry_url in _api_keys
    if has_api_key or registry_url in _load_auth():
        return get_from_config('navigator_url')


class QuiltProvider(CredentialProvider):
    METHOD = 'quilt-registry'
    CANONICAL_NAME = 'QuiltRegistry'

    def __init__(self, credentials):
        super().__init__()
        self._credentials = credentials

    def load(self):
        creds = RefreshableCredentials.create_from_metadata(
            metadata=self._credentials,
            method=self.METHOD,
            refresh_using=_refresh_credentials,
        )

        return creds


def create_botocore_session(*, credentials: dict | None = None) -> botocore.session.Session:
    botocore_session = botocore.session.get_session()

    # If we have saved credentials, use them. Otherwise, create a normal Boto session.
    if credentials is None:
        credentials = _load_credentials()
    if credentials:
        provider = QuiltProvider(credentials)
        resolver = CredentialResolver([provider])
        botocore_session.register_component('credential_provider', resolver)

    return botocore_session


def get_boto3_session(*, fallback: bool = True) -> boto3.Session:
    """
    Return a Boto3 session with Quilt stack credentials and AWS region.
    In case of no Quilt credentials found, return a "normal" Boto3 session if `fallback` is `True`,
    otherwise raise a `QuiltException`.

    > Note: you need to call `quilt3.config("https://your-catalog-homepage/")` to have region set on the session,
    if you previously called it in quilt3 < 6.1.0.
    """
    if not (credentials := _load_credentials()):
        if fallback:
            return boto3.Session()
        raise QuiltException("No Quilt credentials found.")
    return boto3.Session(
        botocore_session=create_botocore_session(credentials=credentials),
        region_name=get_from_config("region"),
    )
