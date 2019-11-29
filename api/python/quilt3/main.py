"""
Parses the command-line arguments and runs a command.
"""

import argparse
import subprocess
import sys

from . import api, session
from .util import get_from_config, QuiltException
from .registry import app

def cmd_config(catalog_url):
    if catalog_url is None:
        existing_catalog_url = get_from_config('navigator_url')
        if existing_catalog_url is not None:
            print(existing_catalog_url)
        else:
            print('<None>')
    else:
        api.config(catalog_url)


def cmd_catalog():
    subprocess.Popen(["docker","run","--rm", "--env-file", "catalog.env", "-p", "3000:80", "quiltdata/catalog"])
    app.run()


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

    # config
    shorthelp = "Configure Quilt"
    config_p = subparsers.add_parser("config", description=shorthelp, help=shorthelp)
    config_p.add_argument(
        "catalog_url",
        help="URL of catalog to config with, or empty string to reset the config",
        type=str,
        nargs="?"
    )
    config_p.set_defaults(func=cmd_config)

    # catalog
    shorthelp = "Run Quilt catalog locally"
    config_p = subparsers.add_parser("catalog", description=shorthelp, help=shorthelp)
    config_p.set_defaults(func=cmd_catalog)

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
