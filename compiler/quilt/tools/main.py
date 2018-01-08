"""
Parses the command-line arguments and runs a command.
"""

from __future__ import print_function

import argparse
import sys
import os
import pkg_resources

import requests

import quilt
from . import command
from .const import DEFAULT_QUILT_YML

# Mock `command` when running as a subprocess during testing
if os.environ.get('QUILT_TEST_CLI_SUBPROC') == "True":
    from ..test import test_cli
    command = test_cli.MockObject(command, use_stdout=True)


HANDLE = "owner/package_name"
VERSION = command.VERSION


def get_full_version():
    # attempt to return egg name with version
    try:
        quilt = pkg_resources.get_distribution('quilt')
    except pkg_resources.DistributionNotFound:
        pass
    else:
        return "quilt {} ({})".format(VERSION, quilt.egg_name())
    # ..otherwise, just the version
    return "quilt " + VERSION


class UsageAction(argparse.Action):
    """Argparse action to print usage (short help)"""
    def __call__(self, parser, namespace, values, option_string=None):
        parser.print_usage()
        exit()


class CustomHelpParser(argparse.ArgumentParser):
    def __init__(self, *args, **kwargs):
        full_help_only = kwargs.pop('full_help_only', False)
        kwargs['add_help'] = False
        super(CustomHelpParser, self).__init__(*args, **kwargs)
        if full_help_only:
            self.add_argument('-h', '--help', action='help', help="Show help")
        else:
            self.add_argument('--help', action='help', help="Show full help for given command")
            self.add_argument('-h', action=UsageAction, help="Show short help (usage) for given command",
                              nargs=0, default=argparse.SUPPRESS)


def argument_parser():
    def check_hash(group, hashstr):
        # TODO: add this universally once short hashes are supported in other functions.
        return (hashstr if 6 <= len(hashstr) <= 64 else
                group.error('hashes must be 6-64 chars long'))

    parser = CustomHelpParser(description="Quilt Command Line", add_help=False, full_help_only=True)

    parser.add_argument('--version', action='version', version=get_full_version(),
                        help="Show version number and exit")

    # Hidden option '--dev' for development
    parser.add_argument('--dev', action='store_true', help=argparse.SUPPRESS)

    subparsers = parser.add_subparsers(title="Commands", dest='cmd')
    subparsers.required = True

    help_p = subparsers.add_parser("help", description="Show help for any given Quilt command",
                                   add_help=False)
    help_p.add_argument('command', nargs="*", help="Optional -- any Quilt command")
    help_p.set_defaults(func=lambda command: parser.parse_args(command + ['--help']))

    config_p = subparsers.add_parser("config", description="Configure Quilt")
    config_p.set_defaults(func=command.config)

    login_p = subparsers.add_parser("login", description="Log in to configured Quilt server")
    login_p.add_argument("team", type=str, nargs='?', help="Specify team to log in as")
    login_p.set_defaults(func=command.login)

    logout_p = subparsers.add_parser("logout", description="Log out of current Quilt server")
    logout_p.add_argument("team", type=str, nargs='?', help="Specify team to log out from")
    logout_p.set_defaults(func=command.logout)

    log_p = subparsers.add_parser("log", description="Show log for a specified package")
    log_p.add_argument("package", type=str, help=HANDLE)
    log_p.set_defaults(func=command.log)

    generate_p = subparsers.add_parser("generate",
        description="Generate a build-file for Quilt build from a directory of build files")
    generate_p.add_argument("directory", help="Source file directory")
    generate_p.set_defaults(func=command.generate)

    build_p = subparsers.add_parser("build",
        description="Compile a Quilt data package from directory or YAML file")
    build_p.add_argument("package", type=str, help=HANDLE)
    build_p.add_argument("path", type=str, help="Path to source directory or YAML file")
    build_p.set_defaults(func=command.build)

    check_p = subparsers.add_parser("check", description="Execute checks for a given build")
    check_p.add_argument("path", nargs="?", type=str, help="Path to source directory or YAML file")
    check_p.add_argument("--env", type=str, help="use which environment (default=default)")
    check_p.set_defaults(func=command.check)

    push_p = subparsers.add_parser("push", description="Push a data package to the server")
    push_p.add_argument("package", type=str, help=HANDLE)
    push_p.add_argument("--public", action="store_true",
                        help=("Create or update a public package " +
                              "(fails if the package exists and is private)"))
    push_p.add_argument("--team", action="store_true",
                        help=("Create or update a team-visible package " +
                              "(fails if the package exists and is private)"))
    push_p.add_argument("--reupload", action="store_true",
                        help="Re-upload all fragments, even if fragment is already in registry")
    push_p.set_defaults(func=command.push)

    version_p = subparsers.add_parser("version",
        description="List or permanently add a package version to the server")
    version_subparsers = version_p.add_subparsers(title="version", dest='cmd')
    version_subparsers.required = True

    version_list_p = version_subparsers.add_parser("list",
        description="List versions of package on the server")
    version_list_p.add_argument("package", type=str, help=HANDLE)
    version_list_p.set_defaults(func=command.version_list)

    version_add_p = version_subparsers.add_parser("add",
        description="Permanently add a version of a package to the server")
    version_add_p.add_argument("package", type=str, help=HANDLE)
    version_add_p.add_argument("version", type=str, help="Version")
    version_add_p.add_argument("pkghash", type=str, help="Package hash")
    version_add_p.set_defaults(func=command.version_add)

    tag_p = subparsers.add_parser("tag", description="List, add, or remove tags for a package on the server")
    tag_subparsers = tag_p.add_subparsers(title="Tag", dest='cmd')
    tag_subparsers.required = True

    tag_list_p = tag_subparsers.add_parser("list", description="List tags for a given package on the server")
    tag_list_p.add_argument("package", type=str, help=HANDLE)
    tag_list_p.set_defaults(func=command.tag_list)

    tag_add_p = tag_subparsers.add_parser("add",
        description="Add a new tag to the server for the given package hash")
    tag_add_p.add_argument("package", type=str, help=HANDLE)
    tag_add_p.add_argument("tag", type=str, help="Tag name")
    tag_add_p.add_argument("pkghash", type=str, help="Package hash")
    tag_add_p.set_defaults(func=command.tag_add)

    tag_remove_p = tag_subparsers.add_parser("remove", description="Remove a tag from the server")
    tag_remove_p.add_argument("package", type=str, help=HANDLE)
    tag_remove_p.add_argument("tag", type=str, help="Tag name")
    tag_remove_p.set_defaults(func=command.tag_remove)

    install_p = subparsers.add_parser("install", description="Install a package from the server")

    # When default quilt yml file is present, don't require the 'package' argument.
    pkg_help = ("owner/package_name[/path/...] or @filename (defaults to @{} when present)"
                .format(DEFAULT_QUILT_YML))
    if os.path.exists(DEFAULT_QUILT_YML):
        install_p.add_argument("package", type=str, help=pkg_help, nargs="?", default="@"+DEFAULT_QUILT_YML)
    else:
        install_p.add_argument("package", type=str, help=pkg_help)

    install_p.set_defaults(func=command.install)
    install_p.add_argument("-f", "--force", action="store_true", help="Overwrite without prompting")
    install_group = install_p.add_mutually_exclusive_group()
    install_group.add_argument("-x", "--hash", help="Package hash", type=str)
    install_group.add_argument("-v", "--version", type=str, help="Package version")
    install_group.add_argument("-t", "--tag", type=str, help="Package tag - defaults to 'latest'")

    access_p = subparsers.add_parser("access",
        description="List, add, or remove who has access to a given package")
    access_subparsers = access_p.add_subparsers(title="Access", dest='cmd')
    access_subparsers.required = True

    access_list_p = access_subparsers.add_parser("list", description="List who has access to a given package")
    access_list_p.add_argument("package", type=str, help=HANDLE)
    access_list_p.set_defaults(func=command.access_list)

    access_add_p = access_subparsers.add_parser("add", description="Allow a user to access a package")
    access_add_p.add_argument("package", type=str, help=HANDLE)
    access_add_p.add_argument("user", type=str, help="User to add")
    access_add_p.set_defaults(func=command.access_add)

    access_remove_p = access_subparsers.add_parser("remove",
       description="Remove a user's access to a package")
    access_remove_p.add_argument("package", type=str, help=HANDLE)
    access_remove_p.add_argument("user", type=str, help="User to remove")
    access_remove_p.set_defaults(func=command.access_remove)

    delete_p = subparsers.add_parser(
        "delete", description="Delete the package (including all of its history) from the server")
    delete_p.add_argument("package", type=str, help="Owner/Package Name")
    delete_p.set_defaults(func=command.delete)

    search_p = subparsers.add_parser("search", description="Search for a package on the server")
    search_p.add_argument("query", type=str, help="Search query (max 5 keywords)")
    search_p.set_defaults(func=command.search)

    ls_p = subparsers.add_parser("ls", description="List locally-installed packages")
    ls_p.set_defaults(func=command.ls)

    inspect_p = subparsers.add_parser("inspect", description="Inspect package details")
    inspect_p.add_argument("package", type=str, help=HANDLE)
    inspect_p.set_defaults(func=command.inspect)

    rm_p = subparsers.add_parser("rm")
    rm_p.add_argument("package", type=str, help=HANDLE)
    rm_p.add_argument("-f", "--force", action="store_true", help="Remove without prompting")
    rm_p.set_defaults(func=command.rm)

    return parser


def main(args=None):
    """Build and run parser

    :param args: cli args from tests
    """
    parser = argument_parser()
    args = parser.parse_args(args)

    # Convert argparse.Namespace into dict and clean it up.
    # We can then pass it directly to the helper function.
    kwargs = vars(args)
    del kwargs['cmd']

    # handle the '--dev' option
    if kwargs.pop('dev') or os.environ.get('QUILT_DEV_MODE', '').strip().lower() == 'true':
        # Enables CLI ctrl-c tracebacks, and whatever anyone else uses it for
        quilt._DEV_MODE = True
    else:
        # Disables CLI ctrl-c tracebacks, etc.
        quilt._DEV_MODE = False

    func = kwargs.pop('func')

    try:
        func(**kwargs)
        return 0
    except command.CommandException as ex:
        print(ex, file=sys.stderr)
        return 1
    except requests.exceptions.ConnectionError as ex:
        print("Failed to connect: %s" % ex, file=sys.stderr)
        return 1
