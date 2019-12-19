import re
from collections import OrderedDict
from collections.abc import Mapping, Sequence, Set
import datetime
import json
import os
import pathlib
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse, urlunparse
from urllib.request import url2pathname
import warnings

# Third-Party
import ruamel.yaml
from appdirs import user_data_dir
import requests


APP_NAME = "Quilt"
APP_AUTHOR = "QuiltData"
BASE_DIR = user_data_dir(APP_NAME, APP_AUTHOR)
BASE_PATH = pathlib.Path(BASE_DIR)
CACHE_PATH = BASE_PATH / "cache" / "v0"
TEMPFILE_DIR_PATH = BASE_PATH / "tempfiles"
CONFIG_PATH = BASE_PATH / 'config.yml'
OPEN_DATA_URL = "https://open.quiltdata.com"

PACKAGE_NAME_FORMAT = r"[\w-]+/[\w-]+$"

## CONFIG_TEMPLATE
# Must contain every permitted config key, as well as their default values (which can be 'null'/None).
# Comments are retained and added to local config, unless overridden by autoconfig via `api.config(<url>)`
CONFIG_TEMPLATE = """
# Quilt3 configuration file

# navigator_url: <url string, default: null>
#
# Used for autoconfiguration
# navigator_url: https://example.com
navigator_url:

# default_local_registry: <url string, default: local appdirs>
# default target registry for operations like install and build
default_local_registry: "{}"

# default_remote_registry: <url string, default: null>
# default target for operations like push and browse
default_remote_registry:

# default_install_location: <url string, default: null>
# default filesystem target for the install operation
default_install_location:

# Identity service URL
registryUrl:

# Disable anonymous usage metrics
telemetry_disabled: false

# S3 Proxy
s3Proxy:

# API Gateway endpoint (e.g., for search)
apiGatewayEndpoint:

# Binary API Gateway endpoint (e.g., for preview)
binaryApiGatewayEndpoint:

""".format(BASE_PATH.as_uri() + '/packages')

class QuiltException(Exception):
    def __init__(self, message, **kwargs):
        # We use NewError("Prefix: " + str(error)) a lot.
        # To be consistent across Python 2.7 and 3.x:
        # 1) This `super` call must exist, or 2.7 will have no text for str(error)
        # 2) This `super` call must have only one argument (the message) or str(error) will be a repr of args
        super(QuiltException, self).__init__(message)
        self.message = message
        for k, v in kwargs.items():
            setattr(self, k, v)


def fix_url(url):
    """Convert non-URL paths to file:// URLs"""
    # If it has a scheme, we assume it's a URL.
    # On Windows, we ignore schemes that look like drive letters, e.g. C:/users/foo
    if not url:
        raise ValueError("Empty URL")

    url = str(url)

    parsed = urlparse(url)
    if parsed.scheme and not os.path.splitdrive(url)[0]:
        return url

    # `expanduser()` expands any leading "~" or "~user" path components, as a user convenience
    # `resolve()` _tries_ to make the URI absolute - but doesn't guarantee anything.
    # In particular, on Windows, non-existent files won't be resolved.
    # `absolute()` makes the URI absolute, though it can still contain '..'
    fixed_url = pathlib.Path(url).expanduser().resolve().absolute().as_uri()

    # pathlib likes to remove trailing slashes, so add it back if needed.
    if url[-1:] in (os.sep, os.altsep) and not fixed_url.endswith('/'):
        fixed_url += '/'

    return fixed_url


def extract_file_extension(file_path_or_url):
    """
    Extract the file extension if it exists.

    Args:
        file_path_or_url: The path to the file. Type can can be anything that pathlib.Path understands.

    Returns:
        File extension without the period, i.e. ("txt" not ".txt"). None if the path does not have an extension.
    """
    p = pathlib.Path(file_path_or_url)
    if len(p.suffix) > 0:
        return p.suffix[1:]
    else:
        return None


EXAMPLE = "Example: 's3://my-bucket/path/'."
def parse_s3_url(s3_url):
    """
    Takes in the result of urlparse, and returns a tuple (bucket, path, version_id)
    """
    if s3_url.scheme != 's3':
        raise ValueError("Expected URI scheme 's3', not '{}'. {}".format(s3_url.scheme, EXAMPLE))
    if not s3_url.netloc:
        raise ValueError("Expected non-empty URI location. {}".format(EXAMPLE))
    # based on testing, the next case can never happen; TODO: remove this case
    if (s3_url.path and not s3_url.path.startswith('/')):
        raise ValueError("Expected URI path to start with '/', not '{}'. {}".format(s3_url.scheme, EXAMPLE))
    bucket = s3_url.netloc
    path = unquote(s3_url.path)[1:]
    # Parse the version ID the way the Java SDK does:
    # https://github.com/aws/aws-sdk-java/blob/master/aws-java-sdk-s3/src/main/java/com/amazonaws/services/s3/AmazonS3URI.java#L192
    query = parse_qs(s3_url.query)
    version_id = query.pop('versionId', [None])[0]
    if query:
        raise ValueError("Unexpected S3 query string: %r" % s3_url.query)
    return bucket, path, version_id


def make_s3_url(bucket, path, version_id=None):
    params = {}
    if version_id not in (None, 'null'):
        params = {'versionId': version_id}

    return urlunparse(('s3', bucket, quote(path), None, urlencode(params), None))


def parse_file_url(file_url):
    if file_url.scheme != 'file':
        raise ValueError("Invalid file URI")
    path = url2pathname(file_url.path)
    if file_url.netloc not in ('', 'localhost'):
        # Windows file share
        # TODO: Can't do anything useful on non-Windows... Return an error?
        path = '\\\\%s%s' % (file_url.netloc, path)
    return path

def file_is_local(file_url_or_path):
    return urlparse(fix_url(file_url_or_path)).scheme == 'file'

def read_yaml(yaml_stream):
    yaml = ruamel.yaml.YAML()
    try:
        return yaml.load(yaml_stream)
    except ruamel.yaml.parser.ParserError as error:
        raise QuiltException(str(error), original_error=error)


def write_yaml(data, yaml_path, keep_backup=False):
    """Write `data` to `yaml_path`

    :param data: Any yaml-serializable data
    :param yaml_path: Destination. Can be a string or pathlib path.
    :param keep_backup: If set, a timestamped backup will be kept in the same dir.
    """
    yaml = ruamel.yaml.YAML()
    path = pathlib.Path(yaml_path)
    now = str(datetime.datetime.now())

    # XXX unicode colon for Windows/NTFS -- looks prettier, but could be confusing. We could use '_' instead.
    if os.name == 'nt':
        now = now.replace(':', '\ua789')

    backup_path = path.with_name(path.name + '.backup.' + now)

    try:
        if path.exists():
            path.rename(backup_path)
        if not path.parent.exists():
            path.parent.mkdir(parents=True)
        with path.open('w') as config_file:
            yaml.dump(data, config_file)
    except Exception:     #! intentionally wide catch -- reraised immediately.
        if backup_path.exists():
            if path.exists():
                path.unlink()
            backup_path.rename(path)
        raise

    if backup_path.exists() and not keep_backup:
        backup_path.unlink()


def yaml_has_comments(parsed):
    """Determine if parsed YAML data has comments.

    Any object can be given, but only objects based on `ruamel.yaml`'s
    `CommentedBase` class can be True.

    :returns: True if object has retained comments, False otherwise
    """
    # Is this even a parse result object that stores comments?
    if not isinstance(parsed, ruamel.yaml.comments.CommentedBase):
        return False

    # Are there comments on this object?
    if parsed.ca.items or parsed.ca.comment or parsed.ca.end:
        return True

    # Is this a container that might have values with comments?
    values = ()
    if isinstance(parsed, (Sequence, Set)):
        values = parsed
    if isinstance(parsed, Mapping):
        values = parsed.values()
    # If so, do any of them have comments?
    for value in values:
        if yaml_has_comments(value):
            return True
    # no comments found.
    return False


def validate_url(url):
    """A URL must have scheme and host, at minimum."""
    parsed_url = urlparse(url)

    # require scheme and host at minimum, like config_path'http://foo'
    if not all((parsed_url.scheme, parsed_url.netloc)):
        raise QuiltException("Invalid URL -- Requires at least scheme and host: {}".format(url))
    try:
        parsed_url.port
    except ValueError:
        raise QuiltException("Invalid URL -- Port must be a number: {}".format(url))


# Although displaying the config may seem not to warrant a class, it's pretty important
# for good UX. A lot of points were considered in making this -- retaining order,
# user's usage in an interpreted environment like Jupyter, and keeping the displayed
# information concise.  Given the limitations of the other options, making a class with
# custom repr panned out to be the best (and shortest) option.
class QuiltConfig(OrderedDict):
    def __init__(self, filepath, *args, **kwargs):
        self.filepath = pathlib.Path(filepath)
        super(QuiltConfig, self).__init__(*args, **kwargs)

    def __setitem__(self, key, value):
        # Per chat in #engineering 4-5-19, strip navigator_url of trailing slash.
        # Ideally, we should do that kind of thing in one cohesive spot.
        # This is a good spot.
        if key == 'navigator_url' and value:
            if not isinstance(value, str):
                raise ValueError("Expected a string for config key {!r}, but got {!r}"
                                 .format(key, value))
            value = value.strip().rstrip('/')
        # Similar activity, moved from api.config() to here.
        if isinstance(key, str) and key.endswith('_url'):
            if value:
                validate_url(value)
        super().__setitem__(key, value)

    # TODO: Make an _html_repr_ for nicer Notebook display
    def __repr__(self):
        return "<{} at {!r} {}>".format(type(self).__name__, str(self.filepath), json.dumps(self, indent=4))

def validate_package_name(name):
    """ Verify that a package name is two alphanumeric strings separated by a slash."""
    if not re.match(PACKAGE_NAME_FORMAT, name):
        raise QuiltException(f"Invalid package name: {name}.")

def get_package_registry(path=None):
    """ Returns the package registry root for a given path """
    if path is None:
        path = get_from_config('default_local_registry')
    return path.rstrip('/') + '/.quilt'

def configure_from_url(catalog_url):
    """ Read configuration settings from a Quilt catalog """
    config_template = read_yaml(CONFIG_TEMPLATE)
    # Clean up and validate catalog url
    catalog_url = catalog_url.rstrip('/')
    validate_url(catalog_url)

    # Get the new config
    config_url = catalog_url + '/config.json'

    response = requests.get(config_url)
    if not response.ok:
        message = "An HTTP Error ({code}) occurred: {reason}"
        raise QuiltException(
            message.format(code=response.status_code, reason=response.reason),
            response=response
            )

    # QuiltConfig may perform some validation and value scrubbing.
    new_config = QuiltConfig('', response.json())

    # 'navigator_url' needs to be renamed, the term is outdated.
    if not new_config.get('navigator_url'):
        new_config['navigator_url'] = catalog_url

    # Use our template + their configured values, keeping our comments.
    for key, value in new_config.items():
        if not key in config_template:
            continue
        config_template[key] = value
    write_yaml(config_template, CONFIG_PATH, keep_backup=True)
    return config_template

def config_exists():
    """
    Returns True if a config file (config.yml) is installed.
    """
    return CONFIG_PATH.exists()

def configure_from_default():
    """
    Try to configure to the default (public) Quilt stack.
    If reading from the public stack fails, warn the user
    and save an empty template.
    """
    try:
        local_config = configure_from_url(OPEN_DATA_URL)
    except requests.exceptions.ConnectionError:
        msg = f"Failed to connect to {OPEN_DATA_URL}."
        msg += "Some features will not work without a"
        msg += "valid configuration."
        warnings.warn(msg)
        config_template = read_yaml(CONFIG_TEMPLATE)
        write_yaml(config_template, CONFIG_PATH, keep_backup=True)
        local_config = config_template
    return local_config

def load_config():
    """
    Read the local config if one exists, else return an
    empty config based on CONFIG_TEMPLATE.
    """
    if CONFIG_PATH.exists():
        local_config = read_yaml(CONFIG_PATH)
    else:
        # This should only happen if a user deletes their local config and
        # during test setup
        local_config = read_yaml(CONFIG_TEMPLATE)
    return local_config

def get_from_config(key):
    return load_config().get(key)

def get_install_location():
    loc = get_from_config('default_install_location')
    if loc is None:
        loc = get_from_config('default_local_registry').rstrip('/')
    return loc

def set_config_value(key, value):
    # Use local configuration (or defaults)
    local_config = load_config()
    local_config[key] = value
    write_yaml(local_config, CONFIG_PATH)

def quiltignore_filter(paths, ignore, url_scheme):
    """Given a list of paths, filter out the paths which are captured by the
    given ignore rules.

    Args:
        paths (list): a list or iterable of paths
        ignore (path): a path to the file defining ignore rules, in Unix shell
            style wildcard format
        url_scheme (str): the URL scheme, only the "file" scheme is currently
            supported
    """
    ignore_rules = ignore.read_text('utf-8').split("\n")
    ignore_rules = ['*/' + rule for rule in ignore_rules if rule]

    if url_scheme == 'file':
        from fnmatch import fnmatch

        files, dirs = set(), set()
        for path in paths:
            if path.is_file():
                files.add(path)
            else:
                dirs.add(path)

        filtered_dirs = dirs.copy()
        for ignore_rule in ignore_rules:

            for pkg_dir in filtered_dirs.copy():
                # copy git behavior --- git matches paths and directories equivalently.
                # e.g. both foo and foo/ will match the ignore rule "foo"
                # but only foo/ will match the ignore rule "foo/"
                if fnmatch(pkg_dir.as_posix() + "/", ignore_rule) or fnmatch(pkg_dir.as_posix(), ignore_rule):
                    files = set(n for n in files if pkg_dir not in n.parents)
                    dirs = dirs - {pkg_dir}

            files = set(n for n in files if not fnmatch(n, ignore_rule))

        return files.union(dirs)
    else:
        raise NotImplementedError

def validate_key(key):
    """
    Verify that a file path or S3 path does not contain any '.' or '..' separators or files.
    """
    if key is None or key == '':
        raise QuiltException(
            f"Invalid key {key!r}. A package entry key cannot be empty."
        )

    for part in key.split('/'):
        if part in ('', '.', '..'):
            raise QuiltException(
                f"Invalid key {key!r}. "
                f"A package entry key cannot contain a file or folder named '.' or '..' in its path."
            )
