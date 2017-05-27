# -*- coding: utf-8 -*-
"""
Command line parsing and command dispatch
"""

from __future__ import print_function
from builtins import input
from datetime import datetime
import json
import os
import stat
import time
import webbrowser

from packaging.version import Version
import pandas as pd
import pkg_resources
import requests
from six import iteritems, string_types
from tqdm import tqdm

from .build import build_package, generate_build_file, BuildException
from .const import DEFAULT_BUILDFILE, LATEST_TAG
from .core import (hash_contents, GroupNode, TableNode, FileNode, PackageFormat,
                   decode_node, encode_node)
from .hashing import digest_file
from .store import PackageStore
from .util import BASE_DIR, FileWithReadProgress

from .. import data

DEFAULT_QUILT_PKG_URL = 'https://pkg.quiltdata.com'
QUILT_PKG_URL = os.environ.get('QUILT_PKG_URL', DEFAULT_QUILT_PKG_URL)

if QUILT_PKG_URL == DEFAULT_QUILT_PKG_URL:
    AUTH_FILE_NAME = "auth.json"
else:
    # Store different servers' auth in different files.
    import hashlib
    AUTH_FILE_NAME = "auth-%.8s.json" % hashlib.md5(QUILT_PKG_URL.encode('utf-8')).hexdigest()

CHUNK_SIZE = 4096

VERSION = pkg_resources.require('quilt')[0].version

class CommandException(Exception):
    """
    Exception class for all command-related failures.
    """
    pass


def _update_auth(refresh_token):
    response = requests.post("%s/api/token" % QUILT_PKG_URL, data=dict(
        refresh_token=refresh_token
    ))

    if response.status_code != requests.codes.ok:
        raise CommandException("Authentication error: %s" % response.status_code)

    data = response.json()
    error = data.get('error')
    if error is not None:
        raise CommandException("Failed to log in: %s" % error)

    return dict(
        refresh_token=data['refresh_token'],
        access_token=data['access_token'],
        expires_at=data['expires_at']
    )

def _save_auth(auth):
    if not os.path.exists(BASE_DIR):
        os.makedirs(BASE_DIR)

    file_path = os.path.join(BASE_DIR, AUTH_FILE_NAME)
    with open(file_path, 'w') as fd:
        os.chmod(file_path, stat.S_IRUSR | stat.S_IWUSR)
        json.dump(auth, fd)

def _handle_response(resp, **kwargs):
    if resp.status_code == requests.codes.unauthorized:
        raise CommandException("Authentication failed. Run `quilt login` again.")
    elif not resp.ok:
        try:
            data = resp.json()
            raise CommandException(data['message'])
        except ValueError:
            raise CommandException("Unexpected failure: error %s" % resp.status_code)

def _create_session():
    """
    Creates a session object to be used for `push`, `install`, etc.

    It reads the credentials, possibly gets an updated access token,
    and sets the request headers.
    """
    file_path = os.path.join(BASE_DIR, AUTH_FILE_NAME)
    if os.path.exists(file_path):
        with open(file_path) as fd:
            auth = json.load(fd)

        # If the access token expires within a minute, update it.
        if auth['expires_at'] < time.time() + 60:
            try:
                auth = _update_auth(auth['refresh_token'])
            except CommandException as ex:
                raise CommandException(
                    "Failed to update the access token (%s). Run `quilt login` again." % ex
                )
            _save_auth(auth)
    else:
        # The auth file doesn't exist, probably because the
        # user hasn't run quilt login yet.
        auth = None

    session = requests.Session()
    session.hooks.update(dict(
        response=_handle_response
    ))
    session.headers.update({
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "quilt-cli/%s" % VERSION,
    })
    if auth is not None:
        session.headers["Authorization"] = "Bearer %s" % auth['access_token']

    return session

_session = None

def _get_session():
    """
    Creates a session or returns an existing session.
    """
    global _session
    if _session is None:
        _session = _create_session()

    return _session

def _parse_package(name):
    try:
        owner, pkg = name.split('/')
        if not owner or not pkg:
            # Make sure they're not empty.
            raise ValueError
    except ValueError:
        raise CommandException("Specify package as owner/package_name.")
    return owner, pkg

def login():
    """
    Authenticate.
    """
    login_url = "%s/login" % QUILT_PKG_URL

    print("Launching a web browser...")
    print("If that didn't work, please visit the following URL: %s" % login_url)

    # Open the browser. Get rid of stdout while launching the browser to prevent
    # Chrome/Firefox from outputing garbage over the code prompt.
    devnull = os.open(os.devnull, os.O_RDWR)
    old_stdout = os.dup(1)
    os.dup2(devnull, 1)
    try:
        webbrowser.open(login_url)
    finally:
        os.close(devnull)
        os.dup2(old_stdout, 1)
        os.close(old_stdout)

    print()
    refresh_token = input("Enter the code from the webpage: ")

    # Get an access token (and a new refresh token).
    # Technically, we could have the user enter both tokens - but it doesn't
    # really matter, and this lets us verify that the token actually works.
    auth = _update_auth(refresh_token)

    _save_auth(auth)

def logout():
    """
    Become anonymous. Useful for testing.
    """
    auth_file = os.path.join(BASE_DIR, AUTH_FILE_NAME)
    # TODO revoke refresh token (without logging out of web sessions)
    if os.path.exists(auth_file):
        os.remove(auth_file)
    else:
        print("Already logged out.")

def generate(directory):
    """
    Generate a build-file for quilt build from a directory of
    source files.
    """
    try:
        buildfilepath = generate_build_file(directory)
    except BuildException as builderror:
        raise CommandException(str(builderror))

    print("Generated build-file %s." % (buildfilepath))

def build(package, path_or_node):
    """
    Compile a Quilt data package, either from a build file or an existing package node.
    """
    if isinstance(path_or_node, data.PackageNode):
        build_from_node(package, path_or_node)
    elif isinstance(path_or_node, string_types):
        build_from_path(package, path_or_node)
    else:
        raise ValueError("Expected a PackageNode or a path, but got %r" % path_or_node)

def build_from_node(package, node):
    """
    Compile a Quilt data package from an existing package node.
    """
    owner, pkg = _parse_package(package)

    store = node._package.get_store()
    package_obj = store.create_package(owner, pkg)

    def _process_node(node, path=''):
        if isinstance(node, data.GroupNode):
            for key, child in node._items():
                _process_node(child, path + '/' + key)
        elif isinstance(node, data.DataNode):
            core_node = node._node
            metadata = core_node.metadata
            if isinstance(core_node, TableNode):
                df = node.data()
                package_obj.save_df(df, path, metadata.get('q_path'), metadata.get('q_ext'),
                                    'pandas', PackageFormat.default)
            elif isinstance(core_node, FileNode):
                src_path = node.data()
                package_obj.save_file(src_path, path, metadata.get('q_path'))
            else:
                assert False, "Unexpected core node type: %r" % core_node
        else:
            assert False, "Unexpected node type: %r" % node

    _process_node(node)
    package_obj.save_contents()

def build_from_path(package, path):
    """
    Compile a Quilt data package from a build file.
    Path can be a directory, in which case the build file will be generated automatically.
    """
    owner, pkg = _parse_package(package)

    if not os.path.exists(path):
        raise CommandException("%s does not exist." % path)

    if os.path.isdir(path):
        buildpath = os.path.join(path, DEFAULT_BUILDFILE)
        if not os.path.exists(buildpath):
            try:
                generated_buildfile = generate_build_file(path)
                assert generated_buildfile == buildpath
            except BuildException as builderror:
                raise CommandException(str(builderror))
    else:
        buildpath = path

    try:
        build_package(owner, pkg, buildpath)
        print("Built %s/%s successfully." % (owner, pkg))
    except BuildException as ex:
        raise CommandException("Failed to build the package: %s" % ex)

def log(package):
    """
    List all of the changes to a package on the server.
    """
    owner, pkg = _parse_package(package)
    session = _get_session()

    response = session.get(
        "{url}/api/log/{owner}/{pkg}/".format(
            url=QUILT_PKG_URL,
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

def push(package):
    """
    Push a Quilt data package to the server
    """
    owner, pkg = _parse_package(package)
    session = _get_session()

    pkgobj = PackageStore.find_package(owner, pkg)
    if pkgobj is None:
        raise CommandException("Package {owner}/{pkg} not found.".format(owner=owner, pkg=pkg))
    pkghash = pkgobj.get_hash()

    print("Uploading package metadata...")
    response = session.put(
        "{url}/api/package/{owner}/{pkg}/{hash}".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg,
            hash=pkghash
        ),
        data=json.dumps(dict(
            contents=pkgobj.get_contents(),
            description=""  # TODO
        ), default=encode_node)
    )

    dataset = response.json()
    upload_urls = dataset['upload_urls']

    headers = {
        'Content-Encoding': 'gzip'
    }

    total = len(upload_urls)
    for idx, (objhash, url) in enumerate(iteritems(upload_urls)):
        # Create a temporary gzip'ed file.
        print("Uploading %s (%d/%d)..." % (objhash, idx + 1, total))
        with pkgobj.tempfile(objhash) as temp_file:
            with FileWithReadProgress(temp_file) as temp_file_with_progress:
                response = requests.put(url, data=temp_file_with_progress, headers=headers)
                if not response.ok:
                    raise CommandException("Upload failed: error %s" % response.status_code)

    print("Updating the 'latest' tag...")
    # Set the "latest" tag.
    response = session.put(
        "{url}/api/tag/{owner}/{pkg}/{tag}".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg,
            tag=LATEST_TAG
        ),
        data=json.dumps(dict(
            hash=pkghash
        ))
    )
    assert response.ok # other responses handled by _handle_response

    url = "https://quiltdata.com/package/%s/%s" % (owner, pkg)
    print("Push complete. Your package is live:\n%s" % url)

def version_list(package):
    """
    List the versions of a package.
    """
    owner, pkg = _parse_package(package)
    session = _get_session()

    response = session.get(
        "{url}/api/version/{owner}/{pkg}/".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg
        )
    )

    for version in response.json()['versions']:
        print("%s: %s" % (version['version'], version['hash']))

def version_add(package, version, pkghash):
    """
    Add a new version for a given package hash.

    Version format needs to follow PEP 440.
    Versions are permanent - once created, they cannot be modified or deleted.
    """
    owner, pkg = _parse_package(package)
    session = _get_session()

    try:
        Version(version)
    except ValueError:
        url = "https://www.python.org/dev/peps/pep-0440/#examples-of-compliant-version-schemes"
        raise CommandException(
            "Invalid version format; see %s" % url
        )

    answer = input("Versions cannot be modified or deleted; are you sure? (y/n) ")
    if answer.lower() != 'y':
        return

    session.put(
        "{url}/api/version/{owner}/{pkg}/{version}".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg,
            version=version
        ),
        data=json.dumps(dict(
            hash=pkghash
        ))
    )

def tag_list(package):
    """
    List the tags of a package.
    """
    owner, pkg = _parse_package(package)
    session = _get_session()

    response = session.get(
        "{url}/api/tag/{owner}/{pkg}/".format(
            url=QUILT_PKG_URL,
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
    owner, pkg = _parse_package(package)
    session = _get_session()

    session.put(
        "{url}/api/tag/{owner}/{pkg}/{tag}".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg,
            tag=tag
        ),
        data=json.dumps(dict(
            hash=pkghash
        ))
    )

def tag_remove(package, tag):
    """
    Delete a tag.
    """
    owner, pkg = _parse_package(package)
    session = _get_session()

    session.delete(
        "{url}/api/tag/{owner}/{pkg}/{tag}".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg,
            tag=tag
        )
    )

def install(package, hash=None, version=None, tag=None, force=False):
    """
    Download a Quilt data package from the server and install locally.

    At most one of `hash`, `version`, or `tag` can be given. If none are
    given, `tag` defaults to "latest".
    """
    if hash is version is tag is None:
        tag = LATEST_TAG

    assert [hash, version, tag].count(None) == 2

    owner, pkg = _parse_package(package)
    session = _get_session()
    store = PackageStore()
    existing_pkg = store.get_package(owner, pkg)

    if existing_pkg is not None and not force:
        print("{owner}/{pkg} already installed.".format(owner=owner, pkg=pkg))
        overwrite = input("Overwrite? (y/n) ")
        if overwrite.lower() != 'y':
            return

    if version is not None:
        response = session.get(
            "{url}/api/version/{owner}/{pkg}/{version}".format(
                url=QUILT_PKG_URL,
                owner=owner,
                pkg=pkg,
                version=version
            )
        )
        pkghash = response.json()['hash']
    elif tag is not None:
        response = session.get(
            "{url}/api/tag/{owner}/{pkg}/{tag}".format(
                url=QUILT_PKG_URL,
                owner=owner,
                pkg=pkg,
                tag=tag
            )
        )
        pkghash = response.json()['hash']
    else:
        pkghash = hash
    assert pkghash is not None

    response = session.get(
        "{url}/api/package/{owner}/{pkg}/{hash}".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg,
            hash=pkghash
        )
    )
    assert response.ok # other responses handled by _handle_response

    dataset = response.json(object_hook=decode_node)
    response_urls = dataset['urls']
    response_contents = dataset['contents']

    # Verify contents hash
    if pkghash != hash_contents(response_contents):
        raise CommandException("Mismatched hash. Try again.")

    pkgobj = store.install_package(owner, pkg, response_contents)

    total = len(response_urls)
    for idx, (download_hash, url) in enumerate(sorted(iteritems(response_urls))):
        print("Downloading %s (%d/%d)..." % (download_hash, idx + 1, total))

        local_filename = store.object_path(download_hash)
        if os.path.exists(local_filename):
            file_hash = digest_file(local_filename)
            if file_hash == download_hash:
                print("Fragment already installed; skipping.")
                continue
            else:
                print("Fragment already installed, but has the wrong hash (%s); re-downloading." %
                      file_hash)

        response = requests.get(url, stream=True)
        if not response.ok:
            msg = "Download {hash} failed: error {code}"
            raise CommandException(msg.format(hash=download_hash, code=response.status_code))

        length_remaining = response.raw.length_remaining

        temp_path = store.temporary_object_path(download_hash)
        with open(temp_path, 'wb') as output_file:
            with tqdm(total=length_remaining, unit='B', unit_scale=True) as progress:
                # `requests` will automatically un-gzip the content, as long as
                # the 'Content-Encoding: gzip' header is set.
                # To report progress, however, we need the length of the original compressed data;
                # we use the undocumented but technically public `response.raw.length_remaining`.
                for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                    if chunk: # filter out keep-alive new chunks
                        output_file.write(chunk)
                    if response.raw.length_remaining is not None:  # Not set in unit tests.
                        progress.update(length_remaining - response.raw.length_remaining)
                        length_remaining = response.raw.length_remaining

        file_hash = digest_file(temp_path)
        if file_hash != download_hash:
            os.remove(temp_path)
            raise CommandException("Fragment hashes do not match: expected %s, got %s." %
                                   (download_hash, file_hash))

        os.rename(temp_path, local_filename)

    pkgobj.save_contents()

def access_list(package):
    """
    Print list of users who can access a package.
    """
    owner, pkg = _parse_package(package)
    session = _get_session()

    lookup_url = "{url}/api/access/{owner}/{pkg}".format(url=QUILT_PKG_URL, owner=owner, pkg=pkg)
    response = session.get(lookup_url)

    data = response.json()
    users = data['users']

    print('\n'.join(users))

def access_add(package, user):
    """
    Add access
    """
    owner, pkg = _parse_package(package)
    session = _get_session()

    session.put("%s/api/access/%s/%s/%s" % (QUILT_PKG_URL, owner, pkg, user))

def access_remove(package, user):
    """
    Remove access
    """
    owner, pkg = _parse_package(package)
    session = _get_session()

    session.delete("%s/api/access/%s/%s/%s" % (QUILT_PKG_URL, owner, pkg, user))

def ls():
    """
    List all installed Quilt data packages
    """
    for pkg_dir in PackageStore.find_store_dirs():
        print("%s" % pkg_dir)
        packages = PackageStore(pkg_dir).ls_packages()
        for idx, (owner, pkg) in enumerate(packages):
            prefix = u"└── " if idx == len(packages) - 1 else u"├── "
            print("%s%s/%s" % (prefix, owner, pkg))

def inspect(package):
    """
    Inspect package details
    """
    owner, pkg = _parse_package(package)
    pkgobj = PackageStore.find_package(owner, pkg)
    if pkgobj is None:
        raise CommandException("Package {owner}/{pkg} not found.".format(owner=owner, pkg=pkg))

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
