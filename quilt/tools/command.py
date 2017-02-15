# -*- coding: utf-8 -*-

from __future__ import print_function
from builtins import input
import argparse
import json
import os
import stat
import sys
import time
import webbrowser

import requests

from .build import build_package, BuildException
from .const import LATEST_TAG
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

def _create_session():
    try:
        file_path = os.path.join(BASE_DIR, AUTH_FILE_NAME)
        with open(file_path) as fd:
            auth = json.load(fd)
    except (IOError, ValueError):
        raise CommandException("Please run `quilt login` first.")

    # If the access token expires within a minute, update it.
    if auth['expires_at'] < time.time() + 60:
        try:
            auth = _update_auth(auth['refresh_token'])
        except CommandException as ex:
            raise CommandException(
                "Failed to update the access token (%s). Run `quilt login` again." % ex
            )
        _save_auth(auth)

    session = requests.Session()
    session.hooks.update(dict(
        response=_handle_response
    ))
    session.headers.update({
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": "Bearer %s" % auth['access_token']
    })

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

def push(package):
    """
    Push a Quilt data package to the server
    """
    owner, pkg = _parse_package(package)

    store = get_store(owner, pkg)
    if not store.exists():
        raise CommandException("Package {owner}/{pkg} not found.".format(owner=owner, pkg=pkg))

    path = store.get_path()
    pkghash = store.get_hash()
    assert path

    session = _create_session()

    response = session.put(
        "{url}/api/package/{owner}/{pkg}/{hash}".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg,
            hash=pkghash
        ),
        data=json.dumps(dict(
            description=""  # TODO
        ))
    )

    if not response.ok:
        # PUT Dataset failed
        raise CommandException("Push failed: error %s" % response.status_code)

    dataset = response.json()
    upload_url = dataset['upload_url']

    headers = {
        'Content-Encoding': 'gzip'
    }

    # Create a temporary gzip'ed file.
    with store.tempfile() as temp_file:
        response = requests.put(upload_url, data=temp_file, headers=headers)

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
    if not response.ok:
        raise CommandException("Failed to set the 'latest' tag: error %s" % response.status_code)

def install(package):
    """
    Download a Quilt data package from the server and install locally
    """
    owner, pkg = _parse_package(package)
    store = get_store(owner, pkg, mode='w')

    if store.exists():
        print("{owner}/{pkg} already installed.".format(owner=owner, pkg=pkg))
        overwrite = input("Overwrite y/n? ")
        if overwrite.lower() != 'y':
            return

    session = _create_session()

    # Get the "latest" tag.
    response = session.get(
        "{url}/api/tag/{owner}/{pkg}/{tag}".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg,
            tag=LATEST_TAG
        )
    )
    if response.status_code == requests.codes.not_found:
        raise CommandException("Lookup failed: package {owner}/{pkg} not found.".format(
            owner=owner, pkg=pkg))
    elif not response.ok:
        raise CommandException("Failed to get the 'latest' tag: error %s" % response.status_code)

    pkghash = response.json()['hash']

    response = session.get(
        "{url}/api/package/{owner}/{pkg}/{hash}".format(
            url=QUILT_PKG_URL,
            owner=owner,
            pkg=pkg,
            hash=pkghash
        )
    )
    if not response.ok:
        raise CommandException("Lookup failed: error %s" % response.status_code)
    dataset = response.json()

    try:
        store.install(dataset['url'], dataset['hash'])
    except StoreException as ex:
        raise CommandException("Failed to install the package: %s" % ex)

def access_list(package):
    """
    Print list of users who can access a package.
    """
    owner, pkg = _parse_package(package)

    session = _create_session()

    lookup_url = "{url}/api/access/{owner}/{pkg}".format(url=QUILT_PKG_URL, owner=owner, pkg=pkg)
    response = session.get(lookup_url)
    if response.status_code == requests.codes.not_found:
        raise CommandException("Lookup failed: package {owner}/{pkg} not found.".format(
            owner=owner, pkg=pkg))
    elif not response.ok:
        raise CommandException("Lookup failed: error %s" % response.status_code)

    data = response.json()
    users = data['users']

    print('\n'.join(users))

def access_add(package, user):
    owner, pkg = _parse_package(package)

    session = _create_session()

    response = session.put("%s/api/access/%s/%s/%s" % (QUILT_PKG_URL, owner, pkg, user))
    if response.status_code == requests.codes.not_found:
        raise CommandException("Failed to add access: package {owner}/{pkg} not found.".format(
            owner=owner, pkg=pkg))
    elif not response.ok:
        raise CommandException("Failed to add access: %s" % response.status_code)

def access_remove(package, user):
    owner, pkg = _parse_package(package)

    session = _create_session()

    response = session.delete("%s/api/access/%s/%s/%s" % (QUILT_PKG_URL, owner, pkg, user))
    if response.status_code == requests.codes.not_found:
        raise CommandException("Failed to remove access: package {owner}/{pkg} not found.".format(
            owner=owner, pkg=pkg))
    elif not response.ok:
        raise CommandException("Failed to remove access: %s" % response.status_code)

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
    try:
        import h5py
    except ImportError:
        raise CommandException("Please install 'h5py' to use 'quilt inspect'")

    owner, pkg = _parse_package(package)
    store = get_store(owner, pkg)
    if not store.exists():
        raise CommandException("Package {owner}/{pkg} not found.".format(owner=owner, pkg=pkg))
    path = store.get_path()
    assert path

    def _print_children(children, prefix):
        for idx, child in enumerate(children):
            if idx == len(children) - 1:
                new_prefix = u"└─"
                new_child_prefix = u"  "
            else:
                new_prefix = u"├─"
                new_child_prefix = u"│ "
            _print_node(child, prefix + new_prefix, prefix + new_child_prefix)

    def _print_node(node, prefix, child_prefix):
        name_prefix = u"─ "
        if isinstance(node, h5py.Group):
            children = list(node.values())
            if children:
                name_prefix = u"┬ "
            print(prefix + name_prefix + node.name)
            _print_children(children, child_prefix)
        elif isinstance(node, h5py.Dataset):
            info = "shape %s, type \"%s\"" % (node.shape, node.dtype.str)
            print(prefix + name_prefix + node.name + ": " + info)
        else:
            print(prefix + name_prefix + node.name + ": " + str(node))

    h5_file = h5py.File(path)
    print(path)
    _print_children(list(h5_file.values()), '')

def main():
    parser = argparse.ArgumentParser(description="Quilt Command Line")
    subparsers = parser.add_subparsers(title="Commands", dest='cmd')
    subparsers.required = True

    login_p = subparsers.add_parser("login")
    login_p.set_defaults(func=login)

    build_p = subparsers.add_parser("build")
    build_p.add_argument("package", type=str, help="Owner/Package Name")
    build_p.add_argument("path", type=str, help="Path to the Yaml build file")
    build_p.set_defaults(func=build)

    push_p = subparsers.add_parser("push")
    push_p.add_argument("package", type=str, help="Owner/Package Name")
    push_p.set_defaults(func=push)

    install_p = subparsers.add_parser("install")
    install_p.add_argument("package", type=str, help="Owner/Package Name")
    install_p.set_defaults(func=install)

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
    ls_p.set_defaults(func=ls)

    inspect_p = subparsers.add_parser("inspect")
    inspect_p.add_argument("package", type=str, help="Owner/Package Name")
    inspect_p.set_defaults(func=inspect)

    args = parser.parse_args()
    func = args.func

    # Convert argparse.Namespace into dict and clean it up.
    # We can then pass it directly to the helper function.
    kwargs = vars(args)
    del kwargs['func']
    del kwargs['cmd']

    try:
        func(**kwargs)
        return 0
    except CommandException as ex:
        print(ex, file=sys.stderr)
        return 1
