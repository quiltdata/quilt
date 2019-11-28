"""
Parses the command-line arguments and runs a command.
"""

import argparse
import sys

from . import api, session
from .util import get_from_config, QuiltException


def cmd_config(catalog_url):
    if catalog_url is None:
        existing_catalog_url = get_from_config('navigator_url')
        if existing_catalog_url is not None:
            print(existing_catalog_url)
        else:
            print('<None>')
    else:
        api.config(catalog_url)


def create_parser():
    parser = argparse.ArgumentParser()

    subparsers = parser.add_subparsers(metavar="<command>")
    subparsers.required = True

    # login
    shorthelp = "Log in to configured Quilt server"
    login_p = subparsers.add_parser("login", description=shorthelp, help=shorthelp)
    login_p.set_defaults(func=session.login)

    # logout
    shorthelp = "Log out of current Quilt server"
    logout_p = subparsers.add_parser("logout", description=shorthelp, help=shorthelp)
    logout_p.set_defaults(func=session.logout)

    shorthelp = "Configure Quilt"
    config_p = subparsers.add_parser("config", description=shorthelp, help=shorthelp)
    config_p.add_argument(
        "catalog_url",
        help="URL of catalog to config with, or empty string to reset the config",
        type=str,
        nargs="?"
    )
    config_p.set_defaults(func=cmd_config)

    shorthelp = "Install a package"
    install_p = subparsers.add_parser("install", description=shorthelp, help=shorthelp)
    install_p.add_argument(
        "name",
        help="Name of package, in the USER/PKG format",
        type=str,
    )
    install_p.add_argument(
        "--registry",
        help="Registry where package is located, usually s3://MY-BUCKET. Defaults to the default remote registry.",
        type=str,
        required=False,
    )
    install_p.add_argument(
        "--top-hash",
        help="Hash of package to install. Defaults to latest.",
        type=str,
        required=False,
    )
    install_p.add_argument(
        "--dest",
        help="Local path to download files to.",
        type=str,
        required=False,
    )
    install_p.add_argument(
        "--dest-registry",
        help="Registry to install package to. Defaults to local registry.",
        type=str,
        required=False,
    )

    install_p.set_defaults(func=api.Package.install)

    return parser

def main(args=None):
    parser = create_parser()
    args = parser.parse_args(args)

    kwargs = vars(args)
    func = kwargs.pop('func')

    try:
        func(**kwargs)
    except QuiltException as ex:
        print(ex.message, file=sys.stderr)

    return 0
