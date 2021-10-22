"""
Helper functions for connecting to the Quilt Registry.
"""

import json
import os
import platform
import stat
import subprocess
import sys
import time

import botocore.session
import pkg_resources
import requests
from botocore.credentials import (
    CredentialProvider,
    CredentialResolver,
    RefreshableCredentials,
)

from .util import BASE_PATH, QuiltException, get_from_config

AUTH_PATH = BASE_PATH / 'auth.json'
CREDENTIALS_PATH = BASE_PATH / 'credentials.json'
VERSION = pkg_resources.require('quilt3')[0].version


def _load_auth():
    if AUTH_PATH.exists():
        with open(AUTH_PATH, encoding='utf-8') as fd:
            return json.load(fd)
    return {}


def _save_auth(cfg):
    BASE_PATH.mkdir(parents=True, exist_ok=True)
    with open(AUTH_PATH, 'w', encoding='utf-8') as fd:
        AUTH_PATH.chmod(stat.S_IRUSR | stat.S_IWUSR)
        json.dump(cfg, fd)


def _load_credentials():
    if CREDENTIALS_PATH.exists():
        with open(CREDENTIALS_PATH, encoding='utf-8') as fd:
            return json.load(fd)
    return {}


def _save_credentials(creds):
    BASE_PATH.mkdir(parents=True, exist_ok=True)
    with open(CREDENTIALS_PATH, 'w', encoding='utf-8') as fd:
        CREDENTIALS_PATH.chmod(stat.S_IRUSR | stat.S_IWUSR)
        json.dump(creds, fd)


def get_registry_url():
    return get_from_config('registryUrl')


def _update_auth(refresh_token, timeout=None):
    try:
        response = requests.post(
            "%s/api/token" % get_registry_url(),
            timeout=timeout,
            data=dict(
                refresh_token=refresh_token,
            )
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
        expires_at=data['expires_at']
    )


def _handle_response(resp, **kwargs):
    if resp.status_code == requests.codes.unauthorized:
        raise QuiltException(
            "Authentication failed. Run `quilt3 login` again."
        )
    elif not resp.ok:
        try:
            data = resp.json()
            raise QuiltException(data['message'])
        except ValueError:
            raise QuiltException("Unexpected failure: error %s" % resp.status_code)


def _create_auth(timeout=None):
    """
    Reads the credentials, updates the access token if necessary, and returns it.
    """
    url = get_registry_url()
    contents = _load_auth()
    auth = contents.get(url)

    if auth is not None:
        # If the access token expires within a minute, update it.
        if auth['expires_at'] < time.time() + 60:
            try:
                auth = _update_auth(auth['refresh_token'], timeout)
            except QuiltException as ex:
                raise QuiltException(
                    "Failed to update the access token (%s). Run `quilt login` again." % ex
                )
            contents[url] = auth
            _save_auth(contents)

    return auth


def _create_session(auth):
    """
    Creates a session object to be used for `push`, `install`, etc.
    """
    session = requests.Session()
    session.hooks.update(
        response=_handle_response
    )
    session.headers.update({
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "quilt-python/%s (%s %s) %s/%s" % (
            VERSION, platform.system(), platform.release(),
            platform.python_implementation(), platform.python_version()
        )
    })
    if auth is not None:
        session.headers["Authorization"] = "Bearer %s" % auth['access_token']

    return session


_session = None


def get_session(timeout=None):
    """
    Creates a session or returns an existing session.
    """
    global _session
    if _session is None:
        auth = _create_auth(timeout)
        _session = _create_session(auth)

    assert _session is not None

    return _session


def clear_session():
    global _session
    if _session is not None:
        _session.close()
        _session = None


def open_url(url):
    try:
        if sys.platform == 'win32':
            os.startfile(url)   # pylint:disable=E1101
        elif sys.platform == 'darwin':
            with open(os.devnull, 'rb+') as null:
                subprocess.check_call(['open', url], stdin=null, stdout=null, stderr=null)
        else:
            with open(os.devnull, 'rb+') as null:
                subprocess.check_call(['xdg-open', url], stdin=null, stdout=null, stderr=null)
    except Exception as ex:     # pylint:disable=W0703
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

    login_url = "%s/login" % get_registry_url()

    print("Launching a web browser...")
    print("If that didn't work, please visit the following URL: %s" % login_url)

    open_url(login_url)

    print()
    refresh_token = input("Enter the code from the webpage: ")

    login_with_token(refresh_token)


def login_with_token(refresh_token):
    """
    Authenticate using an existing token.
    """
    # Get an access token and a new refresh token.
    auth = _update_auth(refresh_token)

    url = get_registry_url()
    contents = _load_auth()
    contents[url] = auth
    _save_auth(contents)

    clear_session()

    # use registry-provided credentials
    _refresh_credentials()


def logout():
    """
    Do not use Quilt credentials. Useful if you have existing AWS credentials.
    """
    # TODO revoke refresh token (without logging out of web sessions)
    if _load_auth() or _load_credentials():
        _save_auth({})
        _save_credentials({})
    else:
        print("Already logged out.")

    clear_session()


def _refresh_credentials():
    session = get_session()
    creds = session.get(
        "{url}/api/auth/get_credentials".format(
            url=get_registry_url()
        )
    ).json()
    result = {
        'access_key': creds['AccessKeyId'],
        'secret_key': creds['SecretAccessKey'],
        'token': creds['SessionToken'],
        'expiry_time': creds['Expiration']
    }
    _save_credentials(result)
    return result


def logged_in():
    """
    Return catalog URL if Quilt client is authenticated. Otherwise
    return `None`.
    """
    url = get_registry_url()
    if url in _load_auth():
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


def create_botocore_session():
    botocore_session = botocore.session.get_session()

    # If we have saved credentials, use them. Otherwise, create a normal Boto session.
    credentials = _load_credentials()
    if credentials:
        provider = QuiltProvider(credentials)
        resolver = CredentialResolver([provider])
        botocore_session.register_component('credential_provider', resolver)

    return botocore_session
