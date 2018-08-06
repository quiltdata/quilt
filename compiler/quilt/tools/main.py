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
from .const import DEFAULT_QUILT_YML, QuiltException

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
        helpcommand = kwargs.pop('helpcommand', False)

        kwargs['add_help'] = False
        kwargs.setdefault('formatter_class', argparse.RawDescriptionHelpFormatter)
        super(CustomHelpParser, self).__init__(*args, **kwargs)
        if helpcommand:
            self.add_argument('--help', '-h', action='help', help="Show this message")
        else:
            self.add_argument('--help', '-h', action='help', help="Show help for given command")


def argument_parser():
    def check_hash(group, hashstr):
        # TODO: add this universally once short hashes are supported in other functions.
        return (hashstr if 6 <= len(hashstr) <= 64 else
                group.error('hashes must be 6-64 chars long'))

    description = ("Quilt Command Line\n"
                   "Visit our online docs at https://docs.quiltdata.com/")
    parser = CustomHelpParser(description=description, add_help=False)
    parser.add_argument('--version', action='version', version=get_full_version(),
                        help="Show version number and exit")

    # Hidden option '--dev' for development
    parser.add_argument('--dev', action='store_true', help=argparse.SUPPRESS)

    subparsers = parser.add_subparsers(metavar="<subcommand>")
    subparsers.required = True


    ## Note for `add_parser()` parameters:
    #   `description` can be a full, detailed description of usage and characteristics  (displayed as-is/raw)
    #   `help` is short help, shown in command lists like 'quilt help' or 'quilt help access' (auto-formatted)

    # quilt access
    shorthelp = "List, add, or remove who has access to a given package"
    access_p = subparsers.add_parser("access", description=shorthelp, help=shorthelp)
    access_subparsers = access_p.add_subparsers(metavar="<subcommand>")
    access_subparsers.required = True

    # quilt access add
    shorthelp = "Allow a user to access a package"
    access_add_p = access_subparsers.add_parser("add", description=shorthelp, help=shorthelp)
    access_add_p.add_argument("package", type=str, help=HANDLE)
    access_add_p.add_argument("user", type=str, help="User to add")
    access_add_p.set_defaults(func=command.access_add)

    # quilt access list
    shorthelp = "List who has access to a given package"
    access_list_p = access_subparsers.add_parser("list", description=shorthelp, help=shorthelp)
    access_list_p.add_argument("package", type=str, help=HANDLE)
    access_list_p.set_defaults(func=command.access_list)

    # quilt access remove
    shorthelp = "Remove a user's access to a package"
    access_remove_p = access_subparsers.add_parser("remove", description=shorthelp, help=shorthelp)
    access_remove_p.add_argument("package", type=str, help=HANDLE)
    access_remove_p.add_argument("user", type=str, help="User to remove")
    access_remove_p.set_defaults(func=command.access_remove)

    # audit
    shorthelp = "Audit a user or a package."
    audit_p = subparsers.add_parser("audit", description=shorthelp, help=shorthelp)
    audit_p.add_argument("user_or_package", type=str, help=shorthelp)
    audit_p.set_defaults(func=command._cli_audit)

    # quilt build
    shorthelp = "Compile a Quilt data package from directory or YAML file"
    build_p = subparsers.add_parser("build", description=shorthelp, help=shorthelp)
    build_p.add_argument("package", type=str, help=HANDLE)
    build_p.add_argument("path", type=str, help="Path to source directory or YAML file")
    build_p.set_defaults(func=command.build, build_file=True)

    # quilt check
    shorthelp = "Execute checks for a given build"
    check_p = subparsers.add_parser("check", description=shorthelp, help=shorthelp)
    check_p.add_argument("path", nargs="?", type=str, help="Path to source directory or YAML file")
    check_p.add_argument("--env", type=str, help="use which environment (default=default)")
    check_p.set_defaults(func=command.check)

    # quilt config
    shorthelp = "Configure Quilt"
    config_p = subparsers.add_parser("config", description=shorthelp, help=shorthelp)
    config_p.set_defaults(func=command.config)

    # quilt delete
    shorthelp = "Delete the package (and all of its history) from the server"
    delete_p = subparsers.add_parser("delete", description=shorthelp, help=shorthelp)
    delete_p.add_argument("package", type=str, help="Owner/Package Name")
    delete_p.set_defaults(func=command.delete)

    # quilt export
    shorthelp = "Export file data from package or subpackage to filesystem"
    export_p = subparsers.add_parser("export", description=shorthelp, help=shorthelp)
    export_p.add_argument("package", type=str, help=HANDLE)
    export_p.add_argument("output_path", type=str, default='.', nargs='?',
                          help="Destination folder (auto-created), default '.'")
    export_p.add_argument("-f", "--force", action="store_true", help="Export over existing files and folders")
    export_p.add_argument("-s", "--symlinks", action="store_true", help="Use symlinks where possible")
    export_p.set_defaults(func=command.export)

    # quilt generate
    shorthelp = "Generate a build-file for Quilt build from a directory of build files"
    generate_p = subparsers.add_parser("generate", description=shorthelp, help=shorthelp)
    generate_p.add_argument("directory", help="Source file directory")
    generate_p.set_defaults(func=command.generate)

    # quilt help
    shorthelp = "Show help for any given Quilt command"
    help_p = subparsers.add_parser("help", description=shorthelp, help=shorthelp, add_help=False, helpcommand=True)
    help_p.add_argument('subcommand', nargs="*", help="Optional -- any Quilt subcommand")
    help_p.set_defaults(func=lambda subcommand=[]: parser.parse_args(subcommand + ['--help']))

    # quilt inspect
    shorthelp = "Inspect package details"
    inspect_p = subparsers.add_parser("inspect", description=shorthelp, help=shorthelp)
    inspect_p.add_argument("package", type=str, help=HANDLE)
    inspect_p.set_defaults(func=command.inspect)

    # quilt install
    shorthelp = "Install a package from the server"
    install_p = subparsers.add_parser("install", description=shorthelp, help=shorthelp)

    # quilt install: When default quilt yml file is present, don't require the 'package' argument.
    pkg_help = ("owner/package_name[/path/...] or @filename (defaults to @{} when present)"
                .format(DEFAULT_QUILT_YML))
    if os.path.exists(DEFAULT_QUILT_YML):
        install_p.add_argument("package", type=str, help=pkg_help, nargs="?", default="@"+DEFAULT_QUILT_YML)
    else:
        install_p.add_argument("package", type=str, help=pkg_help)

    install_p.set_defaults(func=command.install)
    install_p.add_argument("-f", "--force", action="store_true", help="Overwrite without prompting")
    install_p.add_argument("-m", "--meta-only", action="store_true", help="Only download the metadata")
    # not a threading mutex, obv.
    install_mutex_group = install_p.add_mutually_exclusive_group()
    install_mutex_group.add_argument("-x", "--hash", help="Package hash", type=str)
    install_mutex_group.add_argument("-v", "--version", type=str, help="Package version")
    install_mutex_group.add_argument("-t", "--tag", type=str, help="Package tag - defaults to 'latest'")

    # quilt log
    shorthelp = "Show log for a specified package"
    log_p = subparsers.add_parser("log", description=shorthelp, help=shorthelp)
    log_p.add_argument("package", type=str, help=HANDLE)
    log_p.set_defaults(func=command.log)

    # quilt login
    shorthelp = "Log in to configured Quilt server"
    login_p = subparsers.add_parser("login", description=shorthelp, help=shorthelp)
    login_p.add_argument("team", type=str, nargs='?', help="Specify team to log in as")
    login_p.set_defaults(func=command.login)

    # quilt logout
    shorthelp = "Log out of current Quilt server"
    logout_p = subparsers.add_parser("logout", description=shorthelp, help=shorthelp)
    logout_p.set_defaults(func=command.logout)

    # quilt ls
    shorthelp = "List locally-installed packages"
    ls_p = subparsers.add_parser("ls", description=shorthelp, help=shorthelp)
    ls_p.set_defaults(func=command.ls)

    # quilt push
    shorthelp = "Push a data package to the server"
    push_p = subparsers.add_parser("push", description=shorthelp, help=shorthelp)
    push_p.add_argument("package", type=str, help=HANDLE)
    push_p.add_argument("--public", action="store_true", dest='is_public',
                        help=("Create or update a public package " +
                              "(fails if the package exists and is private)"))
    push_p.add_argument("--team", action="store_true", dest='is_team',
                        help=("Create or update a team-visible package " +
                              "(fails if the package exists and is private)"))
    push_p.add_argument("--reupload", action="store_true",
                        help="Re-upload all fragments, even if fragment is already in registry")
    push_p.set_defaults(func=command.push)

    # quilt rm
    shorthelp = "Remove a package locally"
    rm_p = subparsers.add_parser("rm", description=shorthelp, help=shorthelp)
    rm_p.add_argument("package", type=str, help=HANDLE)
    rm_p.add_argument("-f", "--force", action="store_true", help="Remove without prompting")
    rm_p.set_defaults(func=command.rm)

    # quilt search
    shorthelp = "Search for a package on the server"
    search_p = subparsers.add_parser("search", description=shorthelp, help=shorthelp)
    search_p.add_argument("query", type=str, help="Search query (max 5 keywords)")
    search_p.set_defaults(func=command.search)

    # quilt tag
    shorthelp = "List, add, or remove tags for a package on the server"
    tag_p = subparsers.add_parser("tag", description=shorthelp, help=shorthelp)
    tag_subparsers = tag_p.add_subparsers(metavar="<subcommand>")
    tag_subparsers.required = True

    # quilt tag add
    shorthelp = "Add a new tag to the server for the given package hash"
    tag_add_p = tag_subparsers.add_parser("add", description=shorthelp, help=shorthelp)
    tag_add_p.add_argument("package", type=str, help=HANDLE)
    tag_add_p.add_argument("tag", type=str, help="Tag name")
    tag_add_p.add_argument("pkghash", type=str, help="Package hash")
    tag_add_p.set_defaults(func=command.tag_add)

    # quilt tag list
    shorthelp = "List tags for a given package on the server"
    tag_list_p = tag_subparsers.add_parser("list", description=shorthelp, help=shorthelp)
    tag_list_p.add_argument("package", type=str, help=HANDLE)
    tag_list_p.set_defaults(func=command.tag_list)

    # quilt tag remove
    shorthelp = "Remove a tag from the server"
    tag_remove_p = tag_subparsers.add_parser("remove", description=shorthelp, help=shorthelp)
    tag_remove_p.add_argument("package", type=str, help=HANDLE)
    tag_remove_p.add_argument("tag", type=str, help="Tag name")
    tag_remove_p.set_defaults(func=command.tag_remove)

    # user
    shorthelp = "Commands for managing users. Only available to admins"
    users_p = subparsers.add_parser("user", description=shorthelp, help=shorthelp)
    users_subparsers = users_p.add_subparsers(metavar='<subcommand>')
    users_subparsers.required = True

    #TODO: Correctly order user_create, user_delete, user_disable, user_list, user_reset
    # user list
    shorthelp = "List users in your team."
    user_list_p = users_subparsers.add_parser("list", help=shorthelp)
    user_list_p.add_argument("team", type=str)
    user_list_p.set_defaults(func=command._cli_list_users)

    # user create
    shorthelp = "Create a user. Must provide username and email. Username must be unique."
    user_create_p = users_subparsers.add_parser("create", help=shorthelp)
    user_create_p.add_argument("team", type=str)
    user_create_p.add_argument("username", type=str)
    user_create_p.add_argument("email", type=str)
    user_create_p.set_defaults(func=command.create_user)

    # user disable
    shorthelp = "Disable a user."
    user_disable_p = users_subparsers.add_parser("disable", help=shorthelp)
    user_disable_p.add_argument("team", type=str)
    user_disable_p.add_argument("username", type=str)
    user_disable_p.set_defaults(func=command.disable_user)

    # user disable
    shorthelp = "Enable a user."
    user_enable_p = users_subparsers.add_parser("enable", help=shorthelp)
    user_enable_p.add_argument("team", type=str)
    user_enable_p.add_argument("username", type=str)
    user_enable_p.set_defaults(func=command.enable_user)

    # user delete
    shorthelp = "Delete a user. Use with caution."
    user_delete_p = users_subparsers.add_parser("delete", help=shorthelp)
    user_delete_p.add_argument("team", type=str)
    user_delete_p.add_argument("username", type=str)
    user_delete_p.add_argument("-f", "--force", action="store_true", help="Skip warning prompt")
    user_delete_p.set_defaults(func=command.delete_user)

    shorthelp = "Reset a user's password and send them a password reset email."
    user_reset_password_p = users_subparsers.add_parser("reset-password", help=shorthelp)
    user_reset_password_p.add_argument("team", type=str)
    user_reset_password_p.add_argument("username", type=str)
    user_reset_password_p.set_defaults(func=command.reset_password)


    # quilt version
    shorthelp = "List or permanently add a package version to the server"
    version_p = subparsers.add_parser("version", description=shorthelp, help=shorthelp)
    version_subparsers = version_p.add_subparsers(metavar="<subcommand>")
    version_subparsers.required = True

    # quilt version add
    shorthelp = "Permanently add a version of a package to the server"
    version_add_p = version_subparsers.add_parser("add", description=shorthelp, help=shorthelp)
    version_add_p.add_argument("package", type=str, help=HANDLE)
    version_add_p.add_argument("version", type=str, help="Version")
    version_add_p.add_argument("pkghash", type=str, help="Package hash")
    version_add_p.set_defaults(func=command.version_add)

    # quilt version list
    shorthelp = "List versions of package on the server"
    version_list_p = version_subparsers.add_parser("list", description=shorthelp, help=shorthelp)
    version_list_p.add_argument("package", type=str, help=HANDLE)
    version_list_p.set_defaults(func=command.version_list)

    return parser


def main(args=None):
    """Build and run parser

    :param args: cli args from tests
    """
    parser = argument_parser()
    args = parser.parse_args(args)

    # If 'func' isn't present, something is misconfigured above or no (positional) arg was given.
    if not hasattr(args, 'func'):
        args = parser.parse_args(['help'])  # show help

    # Convert argparse.Namespace into dict and clean it up.
    # We can then pass it directly to the helper function.
    kwargs = vars(args)

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
    except QuiltException as ex:
        print(ex.message, file=sys.stderr)
        return 1
    except requests.exceptions.ConnectionError as ex:
        print("Failed to connect: %s" % ex, file=sys.stderr)
        return 1
