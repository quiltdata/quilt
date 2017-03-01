# -*- coding: utf-8 -*-
"""
Command line parsing and command dispatch
"""

from __future__ import print_function
from builtins import input
import argparse
import json
import os
import stat
import sys
import time
import webbrowser

import pandas as pd
import requests
from packaging.version import Version

from .build import build_package, BuildException
from .const import LATEST_TAG, NodeType, TYPE_KEY
from .hashing import hash_contents
from .store import PackageStore, StoreException, get_store, ls_packages
from .util import BASE_DIR

HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}

QUILT_PKG_URL = os.environ.get('QUILT_PKG_URL', 'https://pkg.quiltdata.com')

AUTH_FILE_NAME = "auth.json"


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

def create_session():
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
    })
    if auth is not None:
        session.headers["Authorization"] = "Bearer %s" % auth['access_token']

    return session

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
    # Open the browser. Get rid of stdout while launching the browser to prevent
    # Chrome/Firefox from outputing garbage over the code prompt.
    devnull = os.open(os.devnull, os.O_RDWR)
    old_stdout = os.dup(1)
    os.dup2(devnull, 1)
    try:
        webbrowser.open("%s/login" % QUILT_PKG_URL)
    finally:
        os.close(devnull)
        os.dup2(old_stdout, 1)
        os.close(old_stdout)

    refresh_token = input("Enter the code: ")

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

def build(package, path):
    """
    Compile a Quilt data package
    """
    owner, pkg = _parse_package(package)
    try:
        build_package(owner, pkg, path)
        print("Built %s/%s successfully." % (owner, pkg))
    except BuildException as ex:
        raise CommandException("Failed to build the package: %s" % ex)

def log(session, package):
    """
    List all of the changes to a package on the server.
    """
    owner, pkg = _parse_package(package)

    response = session.get(
        "{url}/api/log/{owner}/{pkg}/".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg
        )
    )

    format_str = "%-64s %-19s %s"

    print(format_str % ("Hash", "Created", "Author"))
    for entry in response.json()['logs']:
        # TODO: convert "created" to local time.
        print(format_str % (entry['hash'], entry['created'], entry['author']))

def push(session, package):
    """
    Push a Quilt data package to the server
    """
    owner, pkg = _parse_package(package)

    store = get_store(owner, pkg)
    if not store.exists():
        raise CommandException("Package {owner}/{pkg} not found.".format(owner=owner, pkg=pkg))
    pkghash = store.get_hash()

    response = session.put(
        "{url}/api/package/{owner}/{pkg}/{hash}".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg,
            hash=pkghash
        ),
        data=json.dumps(dict(
            contents=store.get_contents(),
            description=""  # TODO
        ))
    )

    dataset = response.json()
    upload_urls = dataset['upload_urls']

    headers = {
        'Content-Encoding': 'gzip'
    }

    for objhash, url in upload_urls.items():
        # Create a temporary gzip'ed file.
        with store.tempfile(objhash) as temp_file:
            response = requests.put(url, data=temp_file, headers=headers)

            if not response.ok:
                raise CommandException("Upload failed: error %s" % response.status_code)

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


def version_list(session, package):
    """
    List the versions of a package.
    """
    owner, pkg = _parse_package(package)

    response = session.get(
        "{url}/api/version/{owner}/{pkg}/".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg
        )
    )

    for version in response.json()['versions']:
        print("%s: %s" % (version['version'], version['hash']))

def version_add(session, package, version, pkghash):
    """
    Add a new version for a given package hash.

    Version format needs to follow PEP 440.
    Versions are permanent - once created, they cannot be modified or deleted.
    """
    owner, pkg = _parse_package(package)

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

def tag_list(session, package):
    """
    List the tags of a package.
    """
    owner, pkg = _parse_package(package)

    response = session.get(
        "{url}/api/tag/{owner}/{pkg}/".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg
        )
    )

    for tag in response.json()['tags']:
        print("%s: %s" % (tag['tag'], tag['hash']))

def tag_add(session, package, tag, pkghash):
    """
    Add a new tag for a given package hash.

    Unlike versions, tags can have an arbitrary format, and can be modified
    and deleted.

    When a package is pushed, it gets the "latest" tag.
    """
    owner, pkg = _parse_package(package)

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

def tag_remove(session, package, tag):
    """
    Delete a tag.
    """
    owner, pkg = _parse_package(package)

    session.delete(
        "{url}/api/tag/{owner}/{pkg}/{tag}".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg,
            tag=tag
        )
    )

def install(session, package, hash=None, version=None, tag=None):
    """
    Download a Quilt data package from the server and install locally.

    At most one of `hash`, `version`, or `tag` can be given. If none are
    given, `tag` defaults to "latest".
    """
    if hash is version is tag is None:
        tag = LATEST_TAG

    assert [hash, version, tag].count(None) == 2

    owner, pkg = _parse_package(package)
    store = get_store(owner, pkg, mode='w')

    if store.exists():
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

    dataset = response.json()
    response_urls = dataset['urls']
    response_contents = dataset['contents']

    # Verify contents hash
    if pkghash != hash_contents(response_contents):
        raise CommandException("Mismatched hash. Try again.")

    try:
        store.install(response_contents, response_urls)
    except StoreException as ex:
        store.clear_contents()
        raise CommandException("Failed to install the package: %s" % ex)

def access_list(session, package):
    """
    Print list of users who can access a package.
    """
    owner, pkg = _parse_package(package)

    lookup_url = "{url}/api/access/{owner}/{pkg}".format(url=QUILT_PKG_URL, owner=owner, pkg=pkg)
    response = session.get(lookup_url)

    data = response.json()
    users = data['users']

    print('\n'.join(users))

def access_add(session, package, user):
    """
    Add access
    """
    owner, pkg = _parse_package(package)

    session.put("%s/api/access/%s/%s/%s" % (QUILT_PKG_URL, owner, pkg, user))

def access_remove(session, package, user):
    """
    Remove access
    """
    owner, pkg = _parse_package(package)

    session.delete("%s/api/access/%s/%s/%s" % (QUILT_PKG_URL, owner, pkg, user))

def ls():
    """
    List all installed Quilt data packages
    """
    for pkg_dir in PackageStore.find_package_dirs():
        print("%s" % pkg_dir)
        packages = ls_packages(pkg_dir)
        for idx, (owner, pkg) in enumerate(packages):
            prefix = u"└── " if idx == len(packages) - 1 else u"├── "
            print("%s%s/%s" % (prefix, owner, pkg))

def inspect(package):
    """
    Inspect package details
    """
    owner, pkg = _parse_package(package)
    store = get_store(owner, pkg)
    if not store.exists():
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
        if isinstance(node, dict):
            node_type = NodeType(node.pop(TYPE_KEY))
            if node_type is NodeType.GROUP:
                children = list(node.items())
                if children:
                    name_prefix = u"┬ "
                print(prefix + name_prefix + name)
                _print_children(children, child_prefix, path + name)
            elif node_type is NodeType.TABLE:
                fullname = "/".join([path, name])
                df = store.get(fullname)
                info = "shape %s, type \"%s\"" % (df.shape, df.dtypes)
                print(prefix + name_prefix + ": " + info)
            elif node_type is NodeType.FILE:
                fullname = "/".join([path, name])
                print(prefix + name_prefix + name)
            else:
                print(prefix + name_prefix + ": " + str(node))
        else:
            assert False, "node=%s type=%s" % (node, type(node))

    print(store.get_path())
    _print_children(children=store.get_contents().items(), prefix='', path='')

def main():
    """
    Build and run parser
    """
    parser = argparse.ArgumentParser(description="Quilt Command Line")
    parser.set_defaults(need_session=True)
    subparsers = parser.add_subparsers(title="Commands", dest='cmd')
    subparsers.required = True

    login_p = subparsers.add_parser("login")
    login_p.set_defaults(func=login, need_session=False)

    logout_p = subparsers.add_parser("logout")
    logout_p.set_defaults(func=logout, need_session=False)

    log_p = subparsers.add_parser("log")
    log_p.add_argument("package", type=str, help="Owner/Package Name")
    log_p.set_defaults(func=log)

    build_p = subparsers.add_parser("build")
    build_p.add_argument("package", type=str, help="Owner/Package Name")
    build_p.add_argument("path", type=str, help="Path to the Yaml build file")
    build_p.set_defaults(func=build, need_session=False)

    push_p = subparsers.add_parser("push")
    push_p.add_argument("package", type=str, help="Owner/Package Name")
    push_p.set_defaults(func=push)

    push_p = subparsers.add_parser("push")
    push_p.add_argument("package", type=str, help="Owner/Package Name")
    push_p.set_defaults(func=push)

    version_p = subparsers.add_parser("version")
    version_subparsers = version_p.add_subparsers(title="version", dest='cmd')
    version_subparsers.required = True

    version_list_p = version_subparsers.add_parser("list")
    version_list_p.add_argument("package", type=str, help="Owner/Package Name")
    version_list_p.set_defaults(func=version_list)

    version_add_p = version_subparsers.add_parser("add")
    version_add_p.add_argument("package", type=str, help="Owner/Package Name")
    version_add_p.add_argument("version", type=str, help="Version")
    version_add_p.add_argument("pkghash", type=str, help="Package hash")
    version_add_p.set_defaults(func=version_add)

    tag_p = subparsers.add_parser("tag")
    tag_subparsers = tag_p.add_subparsers(title="Tag", dest='cmd')
    tag_subparsers.required = True

    tag_list_p = tag_subparsers.add_parser("list")
    tag_list_p.add_argument("package", type=str, help="Owner/Package Name")
    tag_list_p.set_defaults(func=tag_list)

    tag_add_p = tag_subparsers.add_parser("add")
    tag_add_p.add_argument("package", type=str, help="Owner/Package Name")
    tag_add_p.add_argument("tag", type=str, help="Tag name")
    tag_add_p.add_argument("pkghash", type=str, help="Package hash")
    tag_add_p.set_defaults(func=tag_add)

    tag_remove_p = tag_subparsers.add_parser("remove")
    tag_remove_p.add_argument("package", type=str, help="Owner/Package Name")
    tag_remove_p.add_argument("tag", type=str, help="Tag name")
    tag_remove_p.set_defaults(func=tag_remove)

    install_p = subparsers.add_parser("install")
    install_p.add_argument("package", type=str, help="Owner/Package Name")
    install_p.set_defaults(func=install)
    install_group = install_p.add_mutually_exclusive_group()
    install_group.add_argument("-x", "--hash", type=str, help="Package hash")
    install_group.add_argument("-v", "--version", type=str, help="Package version")
    install_group.add_argument("-t", "--tag", type=str, help="Package tag - defaults to 'latest'")

    access_p = subparsers.add_parser("access")
    access_subparsers = access_p.add_subparsers(title="Access", dest='cmd')
    access_subparsers.required = True

    access_list_p = access_subparsers.add_parser("list")
    access_list_p.add_argument("package", type=str, help="Owner/Package Name")
    access_list_p.set_defaults(func=access_list)

    access_add_p = access_subparsers.add_parser("add")
    access_add_p.add_argument("package", type=str, help="Owner/Package Name")
    access_add_p.add_argument("user", type=str, help="User to add")
    access_add_p.set_defaults(func=access_add)

    access_remove_p = access_subparsers.add_parser("remove")
    access_remove_p.add_argument("package", type=str, help="Owner/Package Name")
    access_remove_p.add_argument("user", type=str, help="User to remove")
    access_remove_p.set_defaults(func=access_remove)

    ls_p = subparsers.add_parser("ls")
    ls_p.set_defaults(func=ls, need_session=False)

    inspect_p = subparsers.add_parser("inspect")
    inspect_p.add_argument("package", type=str, help="Owner/Package Name")
    inspect_p.set_defaults(func=inspect, need_session=False)

    args = parser.parse_args()

    # Convert argparse.Namespace into dict and clean it up.
    # We can then pass it directly to the helper function.
    kwargs = vars(args)
    del kwargs['cmd']

    func = kwargs.pop('func')

    try:
        # Create a session if needed.
        if kwargs.pop('need_session'):
            kwargs['session'] = create_session()

        func(**kwargs)
        return 0
    except CommandException as ex:
        print(ex, file=sys.stderr)
        return 1
    except requests.exceptions.ConnectionError as ex:
        print("Failed to connect: %s" % ex, file=sys.stderr)
        return 1
