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

from botocore.credentials import RefreshableCredentials
import pkg_resources
import requests

from .data_transfer import _update_credentials
from .util import BASE_PATH, load_config, QuiltException


AUTH_PATH = BASE_PATH / 'auth.json'
VERSION = pkg_resources.require('t4')[0].version

def _load_auth():
    if AUTH_PATH.exists():
        with open(AUTH_PATH) as fd:
            return json.load(fd)
    return {}

def _save_auth(cfg):
    BASE_PATH.mkdir(parents=True, exist_ok=True)
    with open(AUTH_PATH, 'w') as fd:
        AUTH_PATH.chmod(stat.S_IRUSR | stat.S_IWUSR)
        json.dump(cfg, fd)

_registry_url = None

def get_registry_url():
    global _registry_url
    if _registry_url is not None:
        return _registry_url

    _registry_url = load_config()['registryUrl']

    return _registry_url

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
            "Authentication failed. Run `t4 login` again."
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
                    "Failed to update the access token (%s). Run `t4 login` again." % ex
                )
            contents[url] = auth
            _save_auth(contents)

    return auth

def _create_session(auth):
    """
    Creates a session object to be used for `push`, `install`, etc.
    """
    session = requests.Session()
    session.hooks.update(dict(
        response=_handle_response
    ))
    session.headers.update({
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "quilt-t4/%s (%s %s) %s/%s" % (
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

def _open_url(url):
    try:
        if sys.platform == 'win32':
            os.startfile(url)   # pylint:disable=E1101
        elif sys.platform == 'darwin':
            with open(os.devnull, 'r+') as null:
                subprocess.check_call(['open', url], stdin=null, stdout=null, stderr=null)
        else:
            with open(os.devnull, 'r+') as null:
                subprocess.check_call(['xdg-open', url], stdin=null, stdout=null, stderr=null)
    except Exception as ex:     # pylint:disable=W0703
        print("Failed to launch the browser: %s" % ex)

def login():
    """
    Authenticate.

    Launches a web browser and asks the user for a token.
    """
    login_url = "%s/login" % get_registry_url()

    print("Launching a web browser...")
    print("If that didn't work, please visit the following URL: %s" % login_url)

    _open_url(login_url)

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
    set_credentials_from_registry()
    _update_credentials(CREDENTIALS)

def logout():
    """
    Become anonymous. Useful for testing.
    """
    # TODO revoke refresh token (without logging out of web sessions)
    if _load_auth():
        _save_auth({})
    else:
        print("Already logged out.")

    clear_session()

CREDENTIALS = None

def get_credentials():
    return CREDENTIALS

def set_refreshable_credentials(get_credentials):
    global CREDENTIALS
    CREDENTIALS = RefreshableCredentials.create_from_metadata(
            metadata=get_credentials(),
            refresh_using=get_credentials,
            method='quilt-registry'
            )

def get_registry_credentials():
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
    return result

def set_credentials_from_registry():
    set_refreshable_credentials(get_registry_credentials)
