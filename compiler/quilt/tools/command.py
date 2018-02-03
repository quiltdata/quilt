# -*- coding: utf-8 -*-
"""
Command line parsing and command dispatch
"""

from __future__ import print_function
from builtins import input      # pylint:disable=W0622
from datetime import datetime
import gzip
import hashlib
import json
import os
import platform
import re
from shutil import copyfileobj, move, rmtree
import stat
import subprocess
import sys
import tempfile
from threading import Thread, Lock
import time
import yaml

from packaging.version import Version
import pandas as pd
import pkg_resources
import requests
from requests.packages.urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter
from six import iteritems, itervalues, string_types
from six.moves.urllib.parse import urlparse, urlunparse
from tqdm import tqdm

from .build import (build_package, build_package_from_contents, generate_build_file,
                    generate_contents, BuildException, exec_yaml_python, load_yaml)
from .const import DEFAULT_BUILDFILE, LATEST_TAG
from .core import (hash_contents, find_object_hashes, PackageFormat, TableNode, FileNode, GroupNode,
                   decode_node, encode_node)
from .hashing import digest_file
from .store import PackageStore, StoreException, VALID_NAME_RE
from .util import BASE_DIR, FileWithReadProgress, gzip_compress
from . import check_functions as qc

from .. import nodes

# pyOpenSSL and S3 don't play well together. pyOpenSSL is completely optional, but gets enabled by requests.
# So... We disable it. That's what boto does.
# https://github.com/boto/botocore/issues/760
# https://github.com/boto/botocore/pull/803
try:
    from urllib3.contrib import pyopenssl
    pyopenssl.extract_from_urllib3()
except ImportError:
    pass


DEFAULT_REGISTRY_URL = 'https://pkg.quiltdata.com'
GIT_URL_RE = re.compile(r'(?P<url>http[s]?://[\w./~_-]+\.git)(?:@(?P<branch>[\w_-]+))?')

EXTENDED_PACKAGE_RE = re.compile(
    r'^((?:\w+:)?\w+/[\w/]+)(?::h(?:ash)?:(.+)|:v(?:ersion)?:(.+)|:t(?:ag)?:(.+))?$'
)

CHUNK_SIZE = 4096

PARALLEL_UPLOADS = 20
PARALLEL_DOWNLOADS = 20

S3_CONNECT_TIMEOUT = 30
S3_READ_TIMEOUT = 30
S3_TIMEOUT_RETRIES = 3
CONTENT_RANGE_RE = re.compile(r'^bytes (\d+)-(\d+)/(\d+)$')

LOG_TIMEOUT = 3  # 3 seconds

VERSION = pkg_resources.require('quilt')[0].version


class CommandException(Exception):
    """
    Exception class for all command-related failures.
    """
    pass

def parse_package_extended(name):
    """
    Parses the extended package syntax and returns a tuple of (package, hash, version, tag).
    """
    match = EXTENDED_PACKAGE_RE.match(name)
    if match is None:
        pkg_format = '[team:]owner/package_name/path[:v:<version> or :t:<tag> or :h:<hash>]'
        raise CommandException("Specify package as %s." % pkg_format)

    return match.groups()

def parse_package(name, allow_subpath=False):
    try:
        values = name.split(':', 1)
        team = values[0] if len(values) > 1 else None

        values = values[-1].split('/')
        # Can't do "owner, pkg, *subpath = ..." in Python2 :(
        (owner, pkg), subpath = values[:2], values[2:]
        if not owner or not pkg:
            # Make sure they're not empty.
            raise ValueError
        if subpath and not allow_subpath:
            raise ValueError

    except ValueError:
        pkg_format = '[team:]owner/package_name/path' if allow_subpath else '[team:]owner/package_name'
        raise CommandException("Specify package as %s." % pkg_format)

    try:
        PackageStore.check_name(team, owner, pkg, subpath)
    except StoreException as ex:
        raise CommandException(str(ex))

    if allow_subpath:
        return team, owner, pkg, subpath
    return team, owner, pkg


_registry_url = None

def _load_config():
    config_path = os.path.join(BASE_DIR, 'config.json')
    if os.path.exists(config_path):
        with open(config_path) as fd:
            return json.load(fd)
    return {}

def _save_config(cfg):
    if not os.path.exists(BASE_DIR):
        os.makedirs(BASE_DIR)
    config_path = os.path.join(BASE_DIR, 'config.json')
    with open(config_path, 'w') as fd:
        json.dump(cfg, fd)

def _load_auth():
    auth_path = os.path.join(BASE_DIR, 'auth.json')
    if os.path.exists(auth_path):
        with open(auth_path) as fd:
            auth = json.load(fd)
            if 'access_token' in auth:
                # Old format; ignore it.
                auth = {}
            return auth
    return {}

def _save_auth(cfg):
    if not os.path.exists(BASE_DIR):
        os.makedirs(BASE_DIR)
    auth_path = os.path.join(BASE_DIR, 'auth.json')
    with open(auth_path, 'w') as fd:
        os.chmod(auth_path, stat.S_IRUSR | stat.S_IWUSR)
        json.dump(cfg, fd)

def get_registry_url(team=None):
    if team is not None:
        # TODO: use utils.is_nodename() once merged
        if not VALID_NAME_RE.match(team):
            raise CommandException("Invalid team name: %r" % team)
        return "https://%s-registry.team.quiltdata.com" % team

    global _registry_url
    if _registry_url is not None:
        return _registry_url

    # Env variable; overrides the config.
    url = os.environ.get('QUILT_PKG_URL')
    if url is None:
        # Config file (generated by `quilt config`).
        cfg = _load_config()
        url = cfg.get('registry_url', '')

    # '' means default URL.
    _registry_url = url or DEFAULT_REGISTRY_URL
    return _registry_url

def config():
    answer = input("Please enter the URL for your custom Quilt registry (ask your administrator),\n" +
                   "or leave this line blank to use the default registry: ")
    if answer:
        url = urlparse(answer.rstrip('/'))
        if (url.scheme not in ['http', 'https'] or not url.netloc or
            url.path or url.params or url.query or url.fragment):
            raise CommandException("Invalid URL: %s" % answer)
        canonical_url = urlunparse(url)
    else:
        # When saving the config, store '' instead of the actual URL in case we ever change it.
        canonical_url = ''

    cfg = _load_config()
    cfg['registry_url'] = canonical_url
    _save_config(cfg)

    # Clear the cached URL.
    global _registry_url
    _registry_url = None

def _update_auth(team, refresh_token):
    response = requests.post("%s/api/token" % get_registry_url(team), data=dict(
        refresh_token=refresh_token
    ))

    if response.status_code != requests.codes.ok:
        raise CommandException("Authentication error: %s" % response.status_code)

    data = response.json()
    error = data.get('error')
    if error is not None:
        raise CommandException("Failed to log in: %s" % error)

    return dict(
        team=team,
        refresh_token=data['refresh_token'],
        access_token=data['access_token'],
        expires_at=data['expires_at']
    )

def _handle_response(resp, **kwargs):
    _ = kwargs                  # unused    pylint:disable=W0613
    if resp.status_code == requests.codes.unauthorized:
        raise CommandException("Authentication failed. Run `quilt login` again.")
    elif not resp.ok:
        try:
            data = resp.json()
            raise CommandException(data['message'])
        except ValueError:
            raise CommandException("Unexpected failure: error %s" % resp.status_code)

def _create_auth(team=None):
    """
    Reads the credentials, updates the access token if necessary, and returns it.
    """
    url = get_registry_url(team)
    contents = _load_auth()
    auth = contents.get(url)

    if auth is not None:
        # If the access token expires within a minute, update it.
        if auth['expires_at'] < time.time() + 60:
            try:
                auth = _update_auth(team, auth['refresh_token'])
            except CommandException as ex:
                raise CommandException(
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
    session.hooks.update(dict(
        response=_handle_response
    ))
    session.headers.update({
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "quilt-cli/%s (%s %s) %s/%s" % (
            VERSION, platform.system(), platform.release(),
            platform.python_implementation(), platform.python_version()
        )
    })
    if auth is not None:
        session.headers["Authorization"] = "Bearer %s" % auth['access_token']

    return session

_sessions = {}                  # pylint:disable=C0103

def _get_session(team=None):
    """
    Creates a session or returns an existing session.
    """
    global _sessions            # pylint:disable=C0103
    session = _sessions.get(team)
    if session is None:
        auth = _create_auth(team)
        _sessions[team] = session = _create_session(auth)

    assert session is not None

    return session

def _clear_session(team=None):
    global _sessions            # pylint:disable=C0103
    session = _sessions.pop(team, None)
    if session is not None:
        session.close()

def _create_s3_session():
    """
    Creates a session with automatic retries on 5xx errors.
    """
    sess = requests.Session()
    retries = Retry(total=3,
                    backoff_factor=.5,
                    status_forcelist=[500, 502, 503, 504])
    sess.mount('https://', HTTPAdapter(max_retries=retries))
    return sess

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

def _match_hash(session, team, owner, pkg, hash):
    hash = hash.lower()

    if not (6 <= len(hash) <= 64):
        raise CommandException('Invalid hash of length {}: {!r}\n  '
                               'Ensure that the hash is between 6 and 64 characters.'
                               .format(len(hash), hash))

    # short-circuit for exact length
    if len(hash) == 64:
        return hash

    response = session.get(
        "{url}/api/log/{owner}/{pkg}/".format(
            url=get_registry_url(team),
            owner=owner,
            pkg=pkg
        )
    )

    matches = set(entry['hash'] for entry in response.json()['logs']
                  if entry['hash'].startswith(hash))

    if len(matches) == 1:
        return matches.pop()
    if len(matches) > 1:
        # Sorting for consistency in testing, as well as visual comparison of hashes
        ambiguous = '\n'.join(sorted(matches))
        raise CommandException(
            "Ambiguous hash for package {owner}/{pkg}: {hash!r} matches the folowing hashes:\n\n{ambiguous}"
            .format(**locals()))
    raise CommandException("Invalid hash for package {owner}/{pkg}: {hash}".format(**locals()))

def _find_logged_in_team():
    """
    Find a team name in the auth credentials.
    There should be at most one, since we don't allow multiple team logins.
    """
    contents = _load_auth()
    auth = next(itervalues(contents), {})
    return auth.get('team')

def _check_team_login(team):
    """
    Disallow simultaneous public cloud and team logins.
    """
    contents = _load_auth()

    for auth in itervalues(contents):
        existing_team = auth.get('team')
        if team and team != existing_team:
            raise CommandException(
                "Can't log in as team %r; log out first." % team
            )
        elif not team and existing_team:
            raise CommandException(
                "Can't log in as a public user; log out from team %r first." % existing_team
            )

def login(team=None):
    """
    Authenticate.

    Launches a web browser and asks the user for a token.
    """
    _check_team_login(team)

    login_url = "%s/login" % get_registry_url(team)

    print("Launching a web browser...")
    print("If that didn't work, please visit the following URL: %s" % login_url)

    _open_url(login_url)

    print()
    refresh_token = input("Enter the code from the webpage: ")

    login_with_token(refresh_token, team)

def login_with_token(refresh_token, team=None):
    """
    Authenticate using an existing token.
    """
    # Get an access token and a new refresh token.
    auth = _update_auth(team, refresh_token)

    url = get_registry_url(team)
    contents = _load_auth()
    contents[url] = auth
    _save_auth(contents)

    _clear_session(team)

def logout():
    """
    Become anonymous. Useful for testing.
    """
    # TODO revoke refresh token (without logging out of web sessions)
    if _load_auth():
        _save_auth({})
    else:
        print("Already logged out.")

    global _sessions            # pylint:disable=C0103
    _sessions = {}

def generate(directory, outfilename=DEFAULT_BUILDFILE):
    """
    Generate a build-file for quilt build from a directory of
    source files.
    """
    try:
        buildfilepath = generate_build_file(directory, outfilename=outfilename)
    except BuildException as builderror:
        raise CommandException(str(builderror))

    print("Generated build-file %s." % (buildfilepath))

def check(path=None, env='default'):
    """
    Execute the checks: rules for a given build.yml file.
    """
    # TODO: add files=<list of files> to check only a subset...
    # also useful for 'quilt build' to exclude certain files?
    # (if not, then require dry_run=True if files!=None/all)
    build("dry_run/dry_run", path=path, dry_run=True, env=env)

def _clone_git_repo(url, branch, dest):
    cmd = ['git', 'clone', '-q', '--depth=1']
    if branch:
        cmd += ['-b', branch]
    cmd += [url, dest]
    subprocess.check_call(cmd)

def _log(team=None, **kwargs):
    # TODO(dima): Save logs to a file, then send them when we get a chance.

    cfg = _load_config()
    if cfg.get('disable_analytics'):
        return

    session = _get_session(team)

    # Disable error handling.
    orig_response_hooks = session.hooks.get('response')
    session.hooks.update(dict(
        response=None
    ))

    try:
        session.post(
            "{url}/api/log".format(
                url=get_registry_url(team),
            ),
            data=json.dumps([kwargs]),
            timeout=LOG_TIMEOUT,
        )
    except requests.exceptions.RequestException:
        # Ignore logging errors.
        pass
    # restore disabled error-handling
    session.hooks['response'] = orig_response_hooks

def build(package, path=None, dry_run=False, env='default'):
    """
    Compile a Quilt data package, either from a build file or an existing package node.
    """
    team, _, _ = parse_package(package)
    package_hash = hashlib.md5(package.encode('utf-8')).hexdigest()
    try:
        _build_internal(package, path, dry_run, env)
    except Exception as ex:
        _log(team, type='build', package=package_hash, dry_run=dry_run, env=env, error=str(ex))
        raise
    _log(team, type='build', package=package_hash, dry_run=dry_run, env=env)

def _build_internal(package, path, dry_run, env):
    # we may have a path, git URL, PackageNode, or None
    if isinstance(path, string_types):
        # is this a git url?
        is_git_url = GIT_URL_RE.match(path)
        if is_git_url:
            tmpdir = tempfile.mkdtemp()
            url = is_git_url.group('url')
            branch = is_git_url.group('branch')
            try:
                _clone_git_repo(url, branch, tmpdir)
                build_from_path(package, tmpdir, dry_run=dry_run, env=env)
            except Exception as exc:
                msg = "attempting git clone raised exception: {exc}"
                raise CommandException(msg.format(exc=exc))
            finally:
                if os.path.exists(tmpdir):
                    rmtree(tmpdir)
        else:
            build_from_path(package, path, dry_run=dry_run, env=env)
    elif isinstance(path, nodes.PackageNode):
        assert not dry_run  # TODO?
        build_from_node(package, path)
    elif path is None:
        assert not dry_run  # TODO?
        _build_empty(package)
    else:
        raise ValueError("Expected a PackageNode, path or git URL, but got %r" % path)

def _build_empty(package):
    """
    Create an empty package for convenient editing of de novo packages
    """
    team, owner, pkg = parse_package(package)

    store = PackageStore()
    new = store.create_package(team, owner, pkg)
    new.save_contents()

def build_from_node(package, node):
    """
    Compile a Quilt data package from an existing package node.
    """
    team, owner, pkg = parse_package(package)
    # deliberate access of protected member
    store = node._package.get_store()
    package_obj = store.create_package(team, owner, pkg)

    def _process_node(node, path=''):
        if isinstance(node, nodes.GroupNode):
            for key, child in node._items():
                _process_node(child, path + '/' + key)
        elif isinstance(node, nodes.DataNode):
            core_node = node._node
            metadata = core_node.metadata or {}
            if isinstance(core_node, TableNode):
                dataframe = node._data()
                package_obj.save_df(dataframe, path, metadata.get('q_path'), metadata.get('q_ext'),
                                    'pandas', PackageFormat.default)
            elif isinstance(core_node, FileNode):
                src_path = node._data()
                package_obj.save_file(src_path, path, metadata.get('q_path'))
            else:
                assert False, "Unexpected core node type: %r" % core_node
        else:
            assert False, "Unexpected node type: %r" % node

    _process_node(node)
    package_obj.save_contents()

def build_from_path(package, path, dry_run=False, env='default', outfilename=DEFAULT_BUILDFILE):
    """
    Compile a Quilt data package from a build file.
    Path can be a directory, in which case the build file will be generated automatically.
    """
    team, owner, pkg = parse_package(package)

    if not os.path.exists(path):
        raise CommandException("%s does not exist." % path)

    try:
        if os.path.isdir(path):
            buildpath = os.path.join(path, outfilename)
            if os.path.exists(buildpath):
                raise CommandException(
                    "Build file already exists. Run `quilt build %r` instead." % buildpath
                )

            contents = generate_contents(path, outfilename)
            build_package_from_contents(team, owner, pkg, path, contents, dry_run=dry_run, env=env)
        else:
            build_package(team, owner, pkg, path, dry_run=dry_run, env=env)

        if not dry_run:
            print("Built %s%s/%s successfully." % (team + ':' if team else '', owner, pkg))
    except BuildException as ex:
        raise CommandException("Failed to build the package: %s" % ex)

def log(package):
    """
    List all of the changes to a package on the server.
    """
    team, owner, pkg = parse_package(package)
    session = _get_session(team)

    response = session.get(
        "{url}/api/log/{owner}/{pkg}/".format(
            url=get_registry_url(team),
            owner=owner,
            pkg=pkg
        )
    )

    format_str = "%-64s %-19s %s"

    print(format_str % ("Hash", "Pushed", "Author"))
    for entry in reversed(response.json()['logs']):
        ugly = datetime.fromtimestamp(entry['created'])
        nice = ugly.strftime("%Y-%m-%d %H:%M:%S")
        print(format_str % (entry['hash'], nice, entry['author']))

def push(package, public=False, team=False, reupload=False):
    """
    Push a Quilt data package to the server
    """
    using_team = team
    team, owner, pkg = parse_package(package)
    session = _get_session(team)

    pkgobj = PackageStore.find_package(team, owner, pkg)
    if pkgobj is None:
        raise CommandException("Package {owner}/{pkg} not found.".format(owner=owner, pkg=pkg))

    if using_team and public:
        raise CommandException("--team and --public are incompatible")

    if using_team and team is None:
        raise CommandException("--team cannot be used on non-team packages")

    if public and team is not None:
        raise CommandException("--public is not compatible with team packages, " +
                               "Maybe you meant --team")

    if using_team and team is not None:
        public = True

    pkghash = pkgobj.get_hash()

    def _push_package(dry_run=False):
        data = json.dumps(dict(
            dry_run=dry_run,
            public=public,
            contents=pkgobj.get_contents(),
            description=""  # TODO
        ), default=encode_node)

        compressed_data = gzip_compress(data.encode('utf-8'))

        return session.put(
            "{url}/api/package/{owner}/{pkg}/{hash}".format(
                url=get_registry_url(team),
                owner=owner,
                pkg=pkg,
                hash=pkghash
            ),
            data=compressed_data,
            headers={
                'Content-Encoding': 'gzip'
            }
        )

    print("Fetching upload URLs from the registry...")
    resp = _push_package(dry_run=True)
    upload_urls = resp.json()['upload_urls']

    obj_queue = sorted(set(find_object_hashes(pkgobj.get_contents())), reverse=True)
    total = len(obj_queue)

    total_bytes = 0
    for obj_hash in obj_queue:
        total_bytes += os.path.getsize(pkgobj.get_store().object_path(obj_hash))

    uploaded = []
    lock = Lock()

    headers = {
        'Content-Encoding': 'gzip'
    }

    print("Uploading %d fragments (%d bytes before compression)..." % (total, total_bytes))

    with tqdm(total=total_bytes, unit='B', unit_scale=True) as progress:
        def _worker_thread():
            with _create_s3_session() as s3_session:
                while True:
                    with lock:
                        if not obj_queue:
                            break
                        obj_hash = obj_queue.pop()

                    try:
                        obj_urls = upload_urls[obj_hash]

                        original_size = os.path.getsize(pkgobj.get_store().object_path(obj_hash))

                        if reupload or not s3_session.head(obj_urls['head']).ok:
                            # Create a temporary gzip'ed file.
                            with pkgobj.tempfile(obj_hash) as temp_file:
                                temp_file.seek(0, 2)
                                compressed_size = temp_file.tell()
                                temp_file.seek(0)

                                # Workaround for non-local variables in Python 2.7
                                class Context:
                                    compressed_read = 0
                                    original_last_update = 0

                                def _progress_cb(count):
                                    Context.compressed_read += count
                                    original_read = Context.compressed_read * original_size // compressed_size
                                    with lock:
                                        progress.update(original_read - Context.original_last_update)
                                    Context.original_last_update = original_read

                                with FileWithReadProgress(temp_file, _progress_cb) as fd:
                                    url = obj_urls['put']
                                    response = s3_session.put(url, data=fd, headers=headers)
                                    response.raise_for_status()
                        else:
                            with lock:
                                tqdm.write("Fragment %s already uploaded; skipping." % obj_hash)
                                progress.update(original_size)

                        with lock:
                            uploaded.append(obj_hash)
                    except requests.exceptions.RequestException as ex:
                        message = "Upload failed for %s:\n" % obj_hash
                        if ex.response is not None:
                            message += "URL: %s\nStatus code: %s\nResponse: %r\n" % (
                                ex.request.url, ex.response.status_code, ex.response.text
                            )
                        else:
                            message += "%s\n" % ex

                        with lock:
                            tqdm.write(message)

        threads = [
            Thread(target=_worker_thread, name="upload-worker-%d" % i)
            for i in range(PARALLEL_UPLOADS)
        ]
        for thread in threads:
            thread.daemon = True
            thread.start()
        for thread in threads:
            thread.join()

    if len(uploaded) != total:
        raise CommandException("Failed to upload fragments")

    print("Uploading package metadata...")
    _push_package()

    print("Updating the 'latest' tag...")
    session.put(
        "{url}/api/tag/{owner}/{pkg}/{tag}".format(
            url=get_registry_url(team),
            owner=owner,
            pkg=pkg,
            tag=LATEST_TAG
        ),
        data=json.dumps(dict(
            hash=pkghash
        ))
    )

    if team is None:
        url = "https://quiltdata.com/package/%s/%s" % (owner, pkg)
        teamstr = ""
    else:
        url = "https://%s.team.quiltdata.com/package/%s/%s" % (team, owner, pkg)
        teamstr = "%s:" % (team)

    print("Push complete. %s%s/%s is live:\n%s" % (teamstr, owner, pkg, url))

def version_list(package):
    """
    List the versions of a package.
    """
    team, owner, pkg = parse_package(package)
    session = _get_session(team)

    response = session.get(
        "{url}/api/version/{owner}/{pkg}/".format(
            url=get_registry_url(team),
            owner=owner,
            pkg=pkg
        )
    )

    for version in response.json()['versions']:
        print("%s: %s" % (version['version'], version['hash']))

def version_add(package, version, pkghash, force=False):
    """
    Add a new version for a given package hash.

    Version format needs to follow PEP 440.
    Versions are permanent - once created, they cannot be modified or deleted.
    """
    team, owner, pkg = parse_package(package)
    session = _get_session(team)

    try:
        Version(version)
    except ValueError:
        url = "https://www.python.org/dev/peps/pep-0440/#examples-of-compliant-version-schemes"
        raise CommandException(
            "Invalid version format; see %s" % url
        )

    if not force:
        answer = input("Versions cannot be modified or deleted; are you sure? (y/n) ")
        if answer.lower() != 'y':
            return

    session.put(
        "{url}/api/version/{owner}/{pkg}/{version}".format(
            url=get_registry_url(team),
            owner=owner,
            pkg=pkg,
            version=version
        ),
        data=json.dumps(dict(
            hash=_match_hash(session, team, owner, pkg, pkghash)
        ))
    )

def tag_list(package):
    """
    List the tags of a package.
    """
    team, owner, pkg = parse_package(package)
    session = _get_session(team)

    response = session.get(
        "{url}/api/tag/{owner}/{pkg}/".format(
            url=get_registry_url(team),
            owner=owner,
            pkg=pkg
        )
    )

    for tag in response.json()['tags']:
        print("%s: %s" % (tag['tag'], tag['hash']))

def tag_add(package, tag, pkghash):
    """
    Add a new tag for a given package hash.

    Unlike versions, tags can have an arbitrary format, and can be modified
    and deleted.

    When a package is pushed, it gets the "latest" tag.
    """
    team, owner, pkg = parse_package(package)
    session = _get_session(team)

    session.put(
        "{url}/api/tag/{owner}/{pkg}/{tag}".format(
            url=get_registry_url(team),
            owner=owner,
            pkg=pkg,
            tag=tag
        ),
        data=json.dumps(dict(
            hash=_match_hash(session, team, owner, pkg, pkghash)
        ))
    )

def tag_remove(package, tag):
    """
    Delete a tag.
    """
    team, owner, pkg = parse_package(package)
    session = _get_session(team)

    session.delete(
        "{url}/api/tag/{owner}/{pkg}/{tag}".format(
            url=get_registry_url(team),
            owner=owner,
            pkg=pkg,
            tag=tag
        )
    )

def install_via_requirements(requirements_str, force=False):
    """
    Download multiple Quilt data packages via quilt.xml requirements file.
    """
    if requirements_str[0] == '@':
        path = requirements_str[1:]
        if os.path.isfile(path):
            yaml_data = load_yaml(path)
        else:
            raise CommandException("Requirements file not found: {filename}".format(filename=path))
    else:
        yaml_data = yaml.load(requirements_str)
    for pkginfo in yaml_data['packages']:
        package, pkghash, version, tag = parse_package_extended(pkginfo)
        install(package, pkghash, version, tag, force=force)

def install(package, hash=None, version=None, tag=None, force=False):
    """
    Download a Quilt data package from the server and install locally.

    At most one of `hash`, `version`, or `tag` can be given. If none are
    given, `tag` defaults to "latest".
    """
    if hash is version is tag is None:
        tag = LATEST_TAG

    # @filename ==> read from file
    # newline = multiple lines ==> multiple requirements
    package = package.strip()
    if len(package) == 0:
        raise CommandException("package name is empty.")

    if package[0] == '@' or '\n' in package:
        return install_via_requirements(package, force=force)

    assert [hash, version, tag].count(None) == 2

    team, owner, pkg, subpath = parse_package(package, allow_subpath=True)
    teamstr = "{}:".format(team) if team else ""
    session = _get_session(team)
    store = PackageStore()
    existing_pkg = store.get_package(team, owner, pkg)

    print("Downloading package metadata...")

    if version is not None:
        response = session.get(
            "{url}/api/version/{owner}/{pkg}/{version}".format(
                url=get_registry_url(team),
                owner=owner,
                pkg=pkg,
                version=version
            )
        )
        pkghash = response.json()['hash']
    elif tag is not None:
        response = session.get(
            "{url}/api/tag/{owner}/{pkg}/{tag}".format(
                url=get_registry_url(team),
                owner=owner,
                pkg=pkg,
                tag=tag
            )
        )
        pkghash = response.json()['hash']
    else:
        pkghash = _match_hash(session, team, owner, pkg, hash)
    assert pkghash is not None

    response = session.get(
        "{url}/api/package/{owner}/{pkg}/{hash}".format(
            url=get_registry_url(team),
            owner=owner,
            pkg=pkg,
            hash=pkghash
        ),
        params=dict(
            subpath='/'.join(subpath)
        )
    )
    assert response.ok # other responses handled by _handle_response

    if existing_pkg is not None and not force:
        print("{teamstr}{owner}/{pkg} already installed.".format(teamstr=teamstr, owner=owner, pkg=pkg))
        overwrite = input("Overwrite? (y/n) ")
        if overwrite.lower() != 'y':
            return

    dataset = response.json(object_hook=decode_node)
    response_urls = dataset['urls']
    response_contents = dataset['contents']

    # Verify contents hash
    if pkghash != hash_contents(response_contents):
        raise CommandException("Mismatched hash. Try again.")

    pkgobj = store.install_package(team, owner, pkg, response_contents)

    obj_queue = sorted(iteritems(response_urls), reverse=True)
    total = len(obj_queue)

    downloaded = []
    lock = Lock()

    print("Downloading %d fragments..." % total)

    with tqdm(total=total, unit='obj') as progress:
        def _worker_thread():
            with _create_s3_session() as s3_session:
                while True:
                    with lock:
                        if not obj_queue:
                            break
                        obj_hash, url = obj_queue.pop()

                    local_filename = store.object_path(obj_hash)
                    if os.path.exists(local_filename):
                        with lock:
                            progress.update(1)
                            downloaded.append(obj_hash)
                        continue

                    success = False

                    temp_path_gz = store.temporary_object_path(obj_hash + '.gz')
                    with open(temp_path_gz, 'ab') as output_file:
                        for attempt in range(S3_TIMEOUT_RETRIES):
                            try:
                                starting_length = output_file.tell()
                                response = s3_session.get(
                                    url,
                                    headers={
                                        'Range': 'bytes=%d-' % starting_length
                                    },
                                    stream=True,
                                    timeout=(S3_CONNECT_TIMEOUT, S3_READ_TIMEOUT)
                                )

                                # RANGE_NOT_SATISFIABLE means, we already have the whole file.
                                if response.status_code != requests.codes.RANGE_NOT_SATISFIABLE:
                                    if not response.ok:
                                        message = "Download failed for %s:\nURL: %s\nStatus code: %s\nResponse: %r\n" % (
                                            obj_hash, response.request.url, response.status_code, response.text
                                        )
                                        with lock:
                                            tqdm.write(message)
                                        break

                                    # Fragments have the 'Content-Encoding: gzip' header set to make requests ungzip
                                    # them automatically - but that turned out to be a bad idea because it makes
                                    # resuming downloads impossible.
                                    # HACK: For now, just delete the header. Eventually, update the data in S3.
                                    response.raw.headers.pop('Content-Encoding', None)

                                    # Make sure we're getting the expected range.
                                    content_range = response.headers.get('Content-Range', '')
                                    match = CONTENT_RANGE_RE.match(content_range)
                                    if not match or not int(match.group(1)) == starting_length:
                                        with lock:
                                            tqdm.write("Unexpected Content-Range: %s" % content_range)
                                        break

                                    for chunk in response.iter_content(CHUNK_SIZE):
                                        output_file.write(chunk)

                                success = True
                                break  # Done!
                            except requests.exceptions.ConnectionError as ex:
                                if attempt < S3_TIMEOUT_RETRIES - 1:
                                    with lock:
                                        tqdm.write("Download for %s timed out; retrying..." % obj_hash)
                                else:
                                    with lock:
                                        tqdm.write("Download failed for %s: %s" % (obj_hash, ex))
                                    break

                    if not success:
                        # We've already printed an error, so not much to do - just move on to the next object.
                        continue

                    # Ungzip the downloaded fragment.
                    temp_path = store.temporary_object_path(obj_hash)
                    try:
                        with gzip.open(temp_path_gz, 'rb') as f_in, open(temp_path, 'wb') as f_out:
                            copyfileobj(f_in, f_out)
                    finally:
                        # Delete the file unconditionally - in case it's corrupted and cannot be ungzipped.
                        os.remove(temp_path_gz)

                    # Check the hash of the result.
                    file_hash = digest_file(temp_path)
                    if file_hash != obj_hash:
                        os.remove(temp_path)
                        with lock:
                            tqdm.write("Fragment hashes do not match: expected %s, got %s." %
                                       (obj_hash, file_hash))
                            continue

                    move(temp_path, local_filename)

                    # Success.
                    with lock:
                        progress.update(1)
                        downloaded.append(obj_hash)

        threads = [
            Thread(target=_worker_thread, name="download-worker-%d" % i)
            for i in range(PARALLEL_DOWNLOADS)
        ]
        for thread in threads:
            thread.daemon = True
            thread.start()
        for thread in threads:
            thread.join()

    if len(downloaded) != total:
        raise CommandException("Failed to download fragments")

    pkgobj.save_contents()

def _setup_env(env, files):
    """ process data distribution. """
    # TODO: build.yml is not saved in the package system, so re-load it here
    with open('build.yml') as fd:
        buildfile = next(yaml.load_all(fd), None)
        environments = buildfile.get('environments', {})
    if env != 'default' and (env not in environments):
        raise CommandException(
            "environment %s not found in environments: section of build.yml" % env)
    if len(environments) == 0:
        return files
    if env == 'default' and 'default' not in environments:
        return files

    # TODO: this should be done during quilt push, not during install/import
    # (requires server support)
    # TODO: add a way to dry-run dataset checking
    print('processing environment %s: checking data...' % (env))
    environment = environments[env]
    dataset = environment.get('dataset')
    for key, val in files.items():
        # TODO: debug mode, where we can see which files were skipped
        if isinstance(val, pd.DataFrame):
            before_len = len(val)
            res = exec_yaml_python(dataset, val, key, '('+key+')')
            if not res and res is not None:
                raise BuildException("error creating dataset for environment: %s on file %s" % (
                    env, key))
            print('%s: %s=>%s recs' % (key, before_len, len(qc.data)))
            files[key] = qc.data

    # TODO: should be done on the server during quilt install
    # (requires server support)
    print('processing environment %s: slicing data...' % (env))
    instance_data = environment.get('instance_data')
    for key, val in files.items():
        # TODO: debug mode, where we can see which files were skipped
        if type(val) == pd.core.frame.DataFrame:
            before_len = len(val)
            # TODO: pass instance identifier, e.g. instance number N of M
            val['.qchash'] = val.apply(lambda x: abs(hash(tuple(x))), axis = 1)
            res = exec_yaml_python(instance_data, val, key, '('+key+')')
            if res == False:
                raise BuildException("error assigning data to instance in environment: %s on file %s" % (
                    env, key))
            print('%s: %s=>%s recs' % (key, before_len, len(qc.data)))
            files[key] = qc.data
    return files

def access_list(package):
    """
    Print list of users who can access a package.
    """
    team, owner, pkg = parse_package(package)
    session = _get_session(team)

    lookup_url = "{url}/api/access/{owner}/{pkg}".format(url=get_registry_url(team), owner=owner, pkg=pkg)
    response = session.get(lookup_url)

    data = response.json()
    users = data['users']

    print('\n'.join(users))

def access_add(package, user):
    """
    Add access
    """
    team, owner, pkg = parse_package(package)
    session = _get_session(team)

    session.put("%s/api/access/%s/%s/%s" % (get_registry_url(team), owner, pkg, user))

def access_remove(package, user):
    """
    Remove access
    """
    team, owner, pkg = parse_package(package)
    session = _get_session(team)

    session.delete("%s/api/access/%s/%s/%s" % (get_registry_url(team), owner, pkg, user))

def delete(package):
    """
    Delete a package from the server.

    Irreversibly deletes the package along with its history, tags, versions, etc.
    """
    team, owner, pkg = parse_package(package)

    teamstr = "{}:".format(team) if team else ""
    answer = input(
        "Are you sure you want to delete this package and its entire history? " +
        "Type '%s%s/%s' to confirm: " % (teamstr, owner, pkg)
    )

    if answer != '%s%s/%s' % (teamstr, owner, pkg):
        print("Not deleting.")
        return 1

    session = _get_session(team)

    session.delete("%s/api/package/%s/%s/" % (get_registry_url(team), owner, pkg))
    print("Deleted.")

def search(query, team=None):
    """
    Search for packages
    """
    if team is None:
        team = _find_logged_in_team()

    if team is not None:
        session = _get_session(team)
        response = session.get("%s/api/search/" % get_registry_url(team), params=dict(q=query))
        print("--- Packages in team %s ---" % team)
        packages = response.json()['packages']
        for pkg in packages:
            print(("%s:" % team) + ("%(owner)s/%(name)s" % pkg))
        print("--- Packages in public cloud ---")

    public_session = _get_session(None)
    response = public_session.get("%s/api/search/" % get_registry_url(), params=dict(q=query))
    packages = response.json()['packages']
    for pkg in packages:
        print("%(owner)s/%(name)s" % pkg)

def ls():                       # pylint:disable=C0103
    """
    List all installed Quilt data packages
    """
    for pkg_dir in PackageStore.find_store_dirs():
        print("%s" % pkg_dir)
        packages = PackageStore(pkg_dir).ls_packages()
        for idx, (package, tag, pkghash) in enumerate(packages):
            print("{0:30} {1:20} {2}".format(package, tag, pkghash))

def inspect(package):
    """
    Inspect package details
    """
    team, owner, pkg = parse_package(package)
    teamstr = "{}:".format(team) if team else ""

    pkgobj = PackageStore.find_package(team, owner, pkg)
    if pkgobj is None:
        raise CommandException("Package {teamstr}{owner}/{pkg} not found.".format(teamstr=teamstr, owner=owner, pkg=pkg))

    def _print_children(children, prefix, path):
        for idx, (name, child) in enumerate(children):
            if idx == len(children) - 1:
                new_prefix = u"└─"
                new_child_prefix = u"  "
            else:
                new_prefix = u"├─"
                new_child_prefix = u"│ "
            _print_node(child, prefix + new_prefix, prefix + new_child_prefix, name, path)

    def _print_node(node, prefix, child_prefix, name, path):
        name_prefix = u"─ "
        if isinstance(node, GroupNode):
            children = list(node.children.items())
            if children:
                name_prefix = u"┬ "
            print(prefix + name_prefix + name)
            _print_children(children, child_prefix, path + name)
        elif isinstance(node, TableNode):
            df = pkgobj.get_obj(node)
            assert isinstance(df, pd.DataFrame)
            info = "shape %s, type \"%s\"" % (df.shape, df.dtypes)
            print(prefix + name_prefix + ": " + info)
        elif isinstance(node, FileNode):
            print(prefix + name_prefix + name)
        else:
            assert False, "node=%s type=%s" % (node, type(node))

    print(pkgobj.get_path())
    _print_children(children=pkgobj.get_contents().children.items(), prefix='', path='')

def rm(package, force=False):
    """
    Remove a package (all instances) from the local store.
    """
    team, owner, pkg = parse_package(package)

    if not force:
        confirmed = input("Remove {0}? (y/n)".format(package))
        if confirmed.lower() != 'y':
            return

    store = PackageStore()
    deleted = store.remove_package(team, owner, pkg)
    for obj in deleted:
        print("Removed: {0}".format(obj))

def list_users(team=None):
    # get team from disk if not specified
    if team is None:
        team = _find_logged_in_team()
    session = _get_session(team)
    url = get_registry_url(team)
    resp = session.get('%s/api/users/list' % url)
    return resp.json()

def create_user(username, email, team):
    # get team from disk if not specified
    session = _get_session(team)
    url = get_registry_url(team)
    resp = session.post('%s/api/users/create' % url,
            data=json.dumps({'username':username, 'email':email}))

def list_packages(username, team=None):
    if team is None:
        team = _find_logged_in_team()
    session = _get_session(team)
    url = get_registry_url(team)
    resp = session.get('%s/api/admin/package_list/%s' % (url, username))
    return resp.json()

def disable_user(username, team):
    # get team from disk if not specified
    session = _get_session(team)
    url = get_registry_url(team)
    resp = session.post('%s/api/users/disable' % url,
            data=json.dumps({'username':username}))

def delete_user(username, team, force=False):
    # get team from disk if not specified
    if not force:
        confirmed = input("Really delete user '{0}'? (y/n)".format(username))
        if confirmed.lower() != 'y':
            return

    session = _get_session(team)
    url = get_registry_url(team)
    resp = session.post('%s/api/users/delete' % url, data=json.dumps({'username':username}))

def delete_user_cli(team, username, force=False):
    delete_user(username, team, force)

def audit(thing):
    team = _find_logged_in_team()
    if not team:
        raise CommandException("Not logged in as a team user")

    session = _get_session(team)
    response = session.get(
        "{url}/api/audit/{thing}/".format(
            url=get_registry_url(team),
            thing=thing
        )
    )

    print(json.dumps(response.json(), indent=2))
