"""
Parses the command-line arguments and runs a command.
"""

import argparse
import subprocess
import sys

import dns.resolver
import requests

from . import api, session, list_packages
from .session import open_url
from .util import get_from_config, catalog_s3_url, QuiltException
from .registry import app

def cmd_config(catalog_url):
    """
    Configure quilt3 to a Quilt stack
    """
    if catalog_url is None:
        existing_catalog_url = get_from_config('navigator_url')
        if existing_catalog_url is not None:
            print(existing_catalog_url)
        else:
            print('<None>')
    else:
        api.config(catalog_url)

def _test_url(url):
    try:
        response = requests.get(url)
        if response.ok:
            return True
        return False
    except requests.exceptions.ConnectionError:
        return False

def _launch_local_catalog():
    """"
    Launches a docker container to run nginx hosting
    the Quilt catalog on localhost:3000
    """
    open_config = api._config()
    command = ["docker", "run", "--rm"]
    env = dict(REGISTRY_URL="http://localhost:5000",
               S3_PROXY_URL="http://localhost:5002",
               ALWAYS_REQUIRE_AUTH="false",
               CATALOG_MODE="LOCAL",
               SSO_AUTH="DISABLED",
               PASSWORD_AUTH="ENABLED",
               API_GATEWAY=open_config["apiGatewayEndpoint"],
               BINARY_API_GATEWAY=open_config["binaryApiGatewayEndpoint"])
    for var in [f"{key}={value}" for key, value in env.items()]:
        command += ["-e", var]
    command += ["-p", "3000:80", "quiltdata/catalog"]
    subprocess.Popen(command)

def _launch_local_s3proxy():
    """"
    Launches an s3 proxy (via docker)
    on localhost:5002
    """
    dns_resolver = dns.resolver.Resolver()
    command = ["docker", "run", "--rm"]

    # Workaround for a Docker-for-Mac bug in which the container
    # ends up with a different DNS server than the host.
    # Workaround #2: use only IPv4 addresses.
    if sys.platform == 'darwin':
        nameservers = [ip for ip in dns_resolver.nameservers if ip.count('.') == 3]
        command += ["--dns", nameservers[0]]

    command += ["-p", "5002:80", "quiltdata/s3proxy"]
    subprocess.Popen(command)



catalog_cmd_detailed_help = """
Run the Quilt catalog on your machine (requires Docker). Running
`quilt3 catalog` launches a webserver on your local machine using
Docker and a Python microservice that supplies temporary AWS
credentials to the catalog. Temporary credentials are derived from
your default AWS credentials (or active `AWS_PROFILE`) using
`boto3.sts.get_session_token`. For more details about configuring and
using AWS credentials in `boto3`, see the AWS documentation: 
https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html

#### Previewing files in S3
The Quilt catalog allows users to preview files in S3 without
downloading. It relies on a API Gateway and AWS Lambda to generate
certain previews in the cloud. The catalog launched by `quilt3
catalog` sends preview requests to https://open.quiltdata.com. Preview
requests contain short-lived signed URLs generated using your AWS
credentials. Data is encrypted in transit and no data is retained by Quilt.
Nevertheless, it is recommended that you use `quilt3 catalog` only for public data.
We strongly encourage users with
sensitive data in S3 to run a private Quilt deployment. Visit
https://quiltdata.com for more information.
"""

def cmd_catalog(s3_url=None, detailed_help=False):
    """
    Run the Quilt catalog locally.

    If detailed_help=True, display detailed information about the `quilt3 catalog` command and then exit
    """
    if detailed_help:
        print(catalog_cmd_detailed_help)
        return

    local_catalog_url = "http://localhost:3000"
    local_s3proxy_url = "http://localhost:5002"



    if not _test_url(local_catalog_url):
        _launch_local_catalog()

    if not _test_url(local_s3proxy_url):
        _launch_local_s3proxy()

    # open a browser to the local catalog
    open_url(catalog_s3_url(local_catalog_url, s3_url))
    app.run()


def cmd_list_packages(registry):
    for package_name in list_packages(registry=registry):
        print(package_name)


def cmd_verify(name, registry, top_hash, dir, extra_files_ok):
    pkg = api.Package._browse(name, registry, top_hash)
    if pkg.verify(dir, extra_files_ok):
        print("Verification succeeded")
        return 0
    else:
        print("Verification failed")
        return 1

def create_parser():
    parser = argparse.ArgumentParser(allow_abbrev=False)

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
    config_p.set_defaults(func=cmd_config)

    # catalog
    shorthelp = "Run Quilt catalog locally"
    catalog_p = subparsers.add_parser("catalog", description=shorthelp, help=shorthelp, allow_abbrev=False)
    catalog_p.add_argument(
            "s3_url",
            help="S3 URL to browse in local catalog",
            type=str,
            nargs="?"
    )
    catalog_p.add_argument(
            "--detailed_help",
            help="Display detailed information about this command and then exit",
            action="store_true",
    )
    catalog_p.set_defaults(func=cmd_catalog)


    # install
    shorthelp = "Install a package"
    install_p = subparsers.add_parser("install", description=shorthelp, help=shorthelp, allow_abbrev=False)
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
        help="Directory to verify",
        action="store_true"
    )
    verify_p.set_defaults(func=cmd_verify)

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
