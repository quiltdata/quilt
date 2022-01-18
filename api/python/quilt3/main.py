"""
Parses the command-line arguments and runs a command.
"""

import _thread
import argparse
import functools
import json
import sys
import time

import requests

from . import Package
from . import __version__ as quilt3_version
from . import api, session
from .backends import get_package_registry
from .session import open_url
from .util import (
    QuiltException,
    catalog_package_url,
    catalog_s3_url,
    get_from_config,
)


def parse_arg_json(value):
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        raise argparse.ArgumentTypeError(f'{value!r} is not a valid json string.')


def parse_positive_int(value):
    value = int(value)
    if value <= 0:
        raise argparse.ArgumentTypeError(f'{value!r} is not a positive integer.')
    return value


def cmd_config(catalog_url, **kwargs):
    """
    Configure quilt3 to a Quilt stack
    """
    config_values = kwargs['set'] if kwargs['set'] else {}
    if catalog_url and config_values:
        raise QuiltException("Expected either an auto-config URL or key=value pairs, but got both.")

    if config_values:
        api.config(**config_values)
    else:
        if catalog_url is None:
            existing_catalog_url = get_from_config('navigator_url')
            if existing_catalog_url is not None:
                print(existing_catalog_url)
            else:
                print('<None>')
        else:
            api.config(catalog_url)


class ParseConfigDict(argparse.Action):
    def __call__(self, parser, namespace, values, option_string=None):
        d = {}
        if values:
            for item in values:
                split_items = item.split("=", 1)
                key, value = split_items[0].strip(), split_items[1]
                d[key] = value
        setattr(namespace, self.dest, d)


def cmd_config_default_registry(default_remote_registry):
    """
    Configure the default remote registry for quilt3
    """
    api.config(default_remote_registry=default_remote_registry)
    print(f"Successfully set the default remote registry to {default_remote_registry}")


def _test_url(url):
    try:
        response = requests.get(url)
        if response.ok:
            return True
        return False
    except requests.exceptions.ConnectionError:
        return False


catalog_cmd_detailed_help = """
Run the Quilt catalog on your machine. Running `quilt3 catalog` launches a
Python webserver on your local machine that serves a catalog web app and
provides required backend services using temporary AWS credentials.
Temporary credentials are derived from your default AWS credentials
(or active `AWS_PROFILE`) using `boto3.sts.get_session_token`.
For more details about configuring and using AWS credentials in `boto3`,
see the AWS documentation:
https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html

#### Previewing files in S3
The Quilt catalog allows users to preview files in S3 by downloading and
processing/converting them inside the Python webserver running on local machine.
Neither your AWS credentials nor data requested goes through any third-party
cloud services aside of S3.
"""


def _launch_local_catalog(*, host: str, port: int):
    try:
        import uvicorn

        from quilt3_local.main import app
    except ModuleNotFoundError as e:
        if e.name in (
            'uvicorn',
            'quilt3_local',
        ):
            raise QuiltException('To run `quilt3 catalog` install `quilt3[catalog]`') from e
        raise
    _thread.start_new_thread(functools.partial(uvicorn.run, host=host, port=port, log_level="info"), (app,))


def cmd_catalog(*, navigation_target=None, detailed_help=False, host: str, port: int, no_browser: bool):
    """
    Run the Quilt catalog locally. If navigation_targets starts with 's3://', open file view. Otherwise assume it
    refers to a package, following the pattern: BUCKET:USER/PKG

    If detailed_help=True, display detailed information about the `quilt3 catalog` command and then exit
    """
    if detailed_help:
        print(catalog_cmd_detailed_help)
        return

    local_catalog_url = f"http://{host}:{port}"

    # Build the catalog URL - we do this at the beginning so simple syntax errors return immediately
    if navigation_target is None:
        catalog_url = local_catalog_url
    elif navigation_target.startswith("s3://"):
        catalog_url = catalog_s3_url(local_catalog_url, navigation_target)
    else:
        num_colons = navigation_target.count(":")
        assert num_colons == 1, f"To go to Package view, the input should follow the pattern BUCKET:USER/PKG. " \
            f"However the input {navigation_target} has {num_colons} colons when it should have exactly one."
        num_slashes = navigation_target.count("/")
        assert num_slashes == 1, f"To go to Package view, the input should follow the pattern BUCKET:USER/PKG. " \
            f"However the input {navigation_target} has {num_slashes} backslashes when it should have exactly one."
        bucket, package_name = navigation_target.split(":")
        catalog_url = catalog_package_url(local_catalog_url, bucket, package_name)

    should_launch_local_catalog = not _test_url(local_catalog_url)
    if should_launch_local_catalog:
        _launch_local_catalog(host=host, port=port)

        # Make sure the containers are running and available before opening the browser window
        print("Waiting for local catalog app to launch...")
        failure_timeout_secs = 15
        poll_interval_secs = 0.5
        start_time = time.time()
        while True:
            if time.time() - start_time > failure_timeout_secs:
                # Succeeded at the last second, let it proceed.
                if _test_url(local_catalog_url):
                    break
                raise QuiltException("The local catalog app did not successfully launch.")

            if _test_url(local_catalog_url):
                # Everything is working, proceed
                break
            else:
                time.sleep(poll_interval_secs)  # The containers can take a moment to launch

    if not no_browser:
        open_url(catalog_url)

    if should_launch_local_catalog:
        while True:
            try:
                time.sleep(1)
            except KeyboardInterrupt:
                sys.exit(0)


def cmd_disable_telemetry():
    api._disable_telemetry()
    print("Successfully disabled telemetry.")


def cmd_list_packages(registry):
    for package_name in get_package_registry(registry).list_packages():
        print(package_name)


def cmd_verify(name, registry, top_hash, dir, extra_files_ok):
    pkg = Package._browse(name, registry, top_hash)
    if pkg.verify(dir, extra_files_ok):
        print("Verification succeeded")
        return 0
    else:
        print("Verification failed")
        return 1


def cmd_push(name, dir, registry, dest, message, meta, workflow):
    pkg = Package()
    pkg.set_dir('.', dir, meta=meta)
    pkg.push(name, registry=registry, dest=dest, message=message, workflow=workflow)


def create_parser():
    parser = argparse.ArgumentParser(allow_abbrev=False)
    parser.add_argument(
            "--version",
            help="Show quilt3 version and exit",
            action="version",
            version=quilt3_version,
    )

    subparsers = parser.add_subparsers(metavar="<command>")
    subparsers.required = True

    # login
    shorthelp = "Log in to configured Quilt server"
    login_p = subparsers.add_parser("login", description=shorthelp, help=shorthelp, allow_abbrev=False)
    login_p.set_defaults(func=session.login)

    # logout
    shorthelp = "Log out of current Quilt server"
    logout_p = subparsers.add_parser("logout", description=shorthelp, help=shorthelp, allow_abbrev=False)
    logout_p.set_defaults(func=session.logout)

    # config
    shorthelp = "Configure Quilt"
    config_p = subparsers.add_parser("config", description=shorthelp, help=shorthelp, allow_abbrev=False)
    config_p.add_argument(
        "catalog_url",
        help="URL of catalog to config with, or empty string to reset the config",
        type=str,
        nargs="?"
    )
    config_p.add_argument(
            "--set",
            metavar="KEY=VALUE",
            nargs="+",
            help="Set a number of key-value pairs for config_values"
                 "(do not put spaces before or after the = sign). "
                 "If a value contains spaces, you should define "
                 "it with double quotes: "
                 'foo="this is a sentence". Note that '
                 "values are always treated as strings.",
            action=ParseConfigDict,
    )
    config_p.set_defaults(func=cmd_config)

    # config-default-registry
    shorthelp = "Configure default remote registry for Quilt"
    config_p = subparsers.add_parser("config-default-remote-registry",
                                     description=shorthelp, help=shorthelp, allow_abbrev=False)
    config_p.add_argument(
            "default_remote_registry",
            help="The default remote registry to use, e.g. s3://quilt-ml",
            type=str
    )
    config_p.set_defaults(func=cmd_config_default_registry)

    # catalog
    shorthelp = "Run Quilt catalog locally"
    catalog_p = subparsers.add_parser("catalog", description=shorthelp, help=shorthelp, allow_abbrev=False)
    catalog_p.add_argument(
            "navigation_target",
            help="Which page in the local catalog to open. Leave blank to go to the catalog landing page, pass in an "
                 "s3 url (e.g. 's3://bucket/myfile.txt') to go to file viewer, or pass in a package name in the form "
                 "'BUCKET:USER/PKG' to go to the package viewer.",
            type=str,
            nargs="?"
    )
    catalog_p.add_argument(
            "--detailed_help",
            help="Display detailed information about this command and then exit",
            action="store_true",
    )
    catalog_p.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Bind socket to this host",
    )
    catalog_p.add_argument(
        "--port",
        type=parse_positive_int,
        default=3000,
        help="Bind to a socket with this port",
    )
    catalog_p.add_argument(
        "--no-browser",
        action="store_true",
        help="Don't open catalog in a browser after startup",
    )
    catalog_p.set_defaults(func=cmd_catalog)

    # disable-telemetry
    shorthelp = "Disable anonymous usage metrics"
    disable_telemetry_p = subparsers.add_parser("disable-telemetry",
                                                description=shorthelp, help=shorthelp, allow_abbrev=False)
    disable_telemetry_p.set_defaults(func=cmd_disable_telemetry)

    # install
    shorthelp = "Install a package"
    install_p = subparsers.add_parser("install", description=shorthelp, help=shorthelp, allow_abbrev=False)
    install_p.add_argument(
        "name",
        help=(
            "Name of package, in the USER/PKG format"
        ),
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
    install_p.add_argument(
        "--path",
        help="If specified, downloads only PATH or its children.",
        type=str,
        required=False,
    )
    install_p.set_defaults(func=Package.install)

    # list-packages
    shorthelp = "List all packages in a registry"
    list_packages_p = subparsers.add_parser("list-packages", description=shorthelp, help=shorthelp, allow_abbrev=False)
    list_packages_p.add_argument(
            "registry",
            help="Registry for packages, e.g. s3://quilt-example",
            type=str,
    )
    list_packages_p.set_defaults(func=cmd_list_packages)

    # verify
    shorthelp = "Verify that package contents matches a given directory"
    verify_p = subparsers.add_parser("verify", description=shorthelp, help=shorthelp, allow_abbrev=False)
    verify_p.add_argument(
        "name",
        help="Name of package, in the USER/PKG format",
        type=str,
    )
    verify_p.add_argument(
        "--registry",
        help="Registry where package is located, usually s3://MY-BUCKET",
        type=str,
        required=True,
    )
    verify_p.add_argument(
        "--top-hash",
        help="Hash of package to verify",
        type=str,
        required=True,
    )
    verify_p.add_argument(
        "--dir",
        help="Directory to verify",
        type=str,
        required=True,
    )
    verify_p.add_argument(
        "--extra-files-ok",
        help="Whether extra files in the directory should cause a failure",
        action="store_true"
    )
    verify_p.set_defaults(func=cmd_verify)

    # push
    shorthelp = "Pushes the new package to the remote registry"
    push_p = subparsers.add_parser("push", description=shorthelp, help=shorthelp, allow_abbrev=False, add_help=False)
    required_args = push_p.add_argument_group('required arguments')
    optional_args = push_p.add_argument_group('optional arguments')
    push_p.add_argument(
        "name",
        help="Name of package, in the USER/PKG format",
        type=str,
    )
    required_args.add_argument(
        "--dir",
        help="Directory to add to the new package",
        type=str,
        required=True,
    )
    optional_args.add_argument(
        '-h',
        '--help',
        action='help',
        default=argparse.SUPPRESS,
        help='show this help message and exit'
    )
    optional_args.add_argument(
        "--registry",
        help="Registry where to create the new package. Defaults to the default remote registry.",
        type=str,
    )
    optional_args.add_argument(
        "--dest",
        help="Where to copy the objects in the package",
        type=str,
    )
    optional_args.add_argument(
        "--message",
        help="The commit message for the new package",
        type=str,
    )
    optional_args.add_argument(
        "--meta",
        help="""
            Sets package-level metadata.
            Format: A json string with keys in double quotes '{"key": "value"}'
            """,
        type=parse_arg_json,
    )
    optional_args.add_argument(
        "--workflow",
        help="""
            Workflow ID or empty string to skip workflow validation.
            If not specified, the default workflow will be used.
            """,
        default=...,
        type=lambda v: None if v == '' else v
    )
    push_p.set_defaults(func=cmd_push)

    return parser


def main(args=None):
    parser = create_parser()
    args = parser.parse_args(args)

    kwargs = vars(args)
    func = kwargs.pop('func')

    try:
        return func(**kwargs)
    except QuiltException as ex:
        print(ex.message, file=sys.stderr)
        return 1
