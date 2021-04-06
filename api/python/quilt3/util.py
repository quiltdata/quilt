import datetime
import json
import os
import pathlib
import re
import warnings
from collections import OrderedDict
from urllib.parse import (
    parse_qs,
    quote,
    unquote,
    urlencode,
    urlparse,
    urlunparse,
)
from urllib.request import pathname2url, url2pathname

import requests
# Third-Party
import yaml
from appdirs import user_cache_dir, user_data_dir


def get_bool_from_env(var_name: str):
    return os.getenv(var_name, '').lower() == 'true'


APP_NAME = "Quilt"
APP_AUTHOR = "QuiltData"
BASE_DIR = user_data_dir(APP_NAME, APP_AUTHOR)
BASE_PATH = pathlib.Path(BASE_DIR)
CACHE_PATH = pathlib.Path(user_cache_dir(APP_NAME, APP_AUTHOR)) / "v0"
TEMPFILE_DIR_PATH = BASE_PATH / "tempfiles"
CONFIG_PATH = BASE_PATH / 'config.yml'
OPEN_DATA_URL = "https://open.quiltdata.com"

PACKAGE_NAME_FORMAT = r"([\w-]+/[\w-]+)(?:/(.+))?$"
DISABLE_TQDM = get_bool_from_env('QUILT_MINIMIZE_STDOUT')
PACKAGE_UPDATE_POLICY = {'incoming', 'existing'}
IS_CACHE_ENABLED = not get_bool_from_env('QUILT_DISABLE_CACHE')


# CONFIG_TEMPLATE
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

default_registry_version: 1

""".format(BASE_PATH.as_uri() + '/packages')


def get_pos_int_from_env(var_name):
    val = os.getenv(var_name)
    if val:
        try:
            val = int(val)
        except ValueError:
            val = None
        if val is None or val <= 0:
            raise ValueError(f'{var_name} must be a positive integer')
        return val


class QuiltException(Exception):
    def __init__(self, message, **kwargs):
        # We use NewError("Prefix: " + str(error)) a lot.
        # To be consistent across Python 2.7 and 3.x:
        # 1) This `super` call must exist, or 2.7 will have no text for str(error)
        # 2) This `super` call must have only one argument (the message) or str(error) will be a repr of args
        super().__init__(message)
        self.message = message
        for k, v in kwargs.items():
            setattr(self, k, v)


class RemovedInQuilt4Warning(FutureWarning):
    pass


class URLParseError(ValueError):
    pass


class PhysicalKey:
    __slots__ = ('bucket', 'path', 'version_id')

    def __init__(self, bucket, path, version_id):
        """
        For internal use only; call from_path or from_url instead.
        """
        assert bucket is None or isinstance(bucket, str)
        assert isinstance(path, str)
        assert version_id is None or isinstance(version_id, str)

        if bucket is None:
            assert path is not None, "Local keys must have a path"
            assert version_id is None, "Local keys cannot have a version ID"
            if os.name == 'nt':
                assert '\\' not in path, "Paths must use / as a separator"
        else:
            assert not path.startswith('/'), "S3 paths must not start with '/'"

        self.bucket = bucket
        self.path = path
        self.version_id = version_id

    @classmethod
    def from_url(cls, url):
        parsed = urlparse(url)

        if parsed.scheme == 's3':
            if not parsed.netloc:
                raise URLParseError("Missing bucket")
            bucket = parsed.netloc
            assert not parsed.path or parsed.path.startswith('/')
            path = unquote(parsed.path)[1:]
            # Parse the version ID the way the Java SDK does:
            # https://github.com/aws/aws-sdk-java/blob/master/aws-java-sdk-s3/src/main/java/com/amazonaws/services/s3/AmazonS3URI.java#L192
            query = parse_qs(parsed.query)
            version_id = query.pop('versionId', [None])[0]
            if query:
                raise URLParseError(f"Unexpected S3 query string: {parsed.query!r}")
            return cls(bucket, path, version_id)
        elif parsed.scheme == 'file':
            if parsed.netloc not in ('', 'localhost'):
                raise URLParseError("Unexpected hostname")
            if not parsed.path:
                raise URLParseError("Missing path")
            if not parsed.path.startswith('/'):
                raise URLParseError("Relative paths are not allowed")
            if parsed.query:
                raise URLParseError("Unexpected query")
            path = url2pathname(parsed.path)
            if parsed.path.endswith('/') and not path.endswith(os.path.sep):
                # On Windows, url2pathname loses the trailing `/`.
                path += os.path.sep
            return cls.from_path(path)
        else:
            raise URLParseError(f"Unexpected scheme: {parsed.scheme!r}")

    @classmethod
    def from_path(cls, path):
        path = os.fspath(path)
        new_path = os.path.realpath(path)
        # Use '/' as the path separator.
        if os.path.sep != '/':
            new_path = new_path.replace(os.path.sep, '/')
        # Add back a trailing '/' if the original path has it.
        if (path.endswith(os.path.sep) or
                (os.path.altsep is not None and path.endswith(os.path.altsep))):
            new_path += '/'
        return cls(None, new_path, None)

    def is_local(self):
        return self.bucket is None

    def join(self, rel_path):
        if self.version_id is not None:
            raise ValueError('Cannot append paths to URLs with a version ID')

        if os.name == 'nt' and '\\' in rel_path:
            raise ValueError("Paths must use / as a separator")

        if self.path:
            new_path = self.path.rstrip('/') + '/' + rel_path.lstrip('/')
        else:
            new_path = rel_path.lstrip('/')
        return PhysicalKey(self.bucket, new_path, None)

    def basename(self):
        return self.path.rsplit('/', 1)[-1]

    def __eq__(self, other):
        return (
            isinstance(other, self.__class__) and
            self.bucket == other.bucket and
            self.path == other.path and
            self.version_id == other.version_id
        )

    def __repr__(self):
        return f'{self.__class__.__name__}({self.bucket!r}, {self.path!r}, {self.version_id!r})'

    def __str__(self):
        if self.bucket is None:
            return urlunparse(('file', '', pathname2url(self.path.replace('/', os.path.sep)), None, None, None))
        else:
            if self.version_id is None:
                params = {}
            else:
                params = {'versionId': self.version_id}
            return urlunparse(('s3', self.bucket, quote(self.path), None, urlencode(params), None))


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


def read_yaml(yaml_stream):
    try:
        if isinstance(yaml_stream, pathlib.Path):
            with yaml_stream.open(mode='r') as stream:
                return yaml.safe_load(stream)
        return yaml.safe_load(yaml_stream)
    except yaml.YAMLError as error:
        raise QuiltException(str(error), original_error=error)


def write_yaml(data, yaml_path, keep_backup=False):
    """Write `data` to `yaml_path`

    :param data: Any yaml-serializable data
    :param yaml_path: Destination. Can be a string or pathlib path.
    :param keep_backup: If set, a timestamped backup will be kept in the same dir.
    """
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
    except Exception:     # intentionally wide catch -- reraised immediately.
        if backup_path.exists():
            if path.exists():
                path.unlink()
            backup_path.rename(path)
        raise

    if backup_path.exists() and not keep_backup:
        backup_path.unlink()


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
        super().__init__(*args, **kwargs)

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


def parse_sub_package_name(name):
    """
    Extract package name and optional sub-package path as tuple.
    """
    m = re.match(PACKAGE_NAME_FORMAT, name)
    if m:
        return tuple(m.groups())


def validate_package_name(name):
    """ Verify that a package name is two alphanumeric strings separated by a slash."""
    parts = parse_sub_package_name(name)
    if not parts or parts[1]:
        raise QuiltException(f"Invalid package name: {name}.")


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
        if key not in config_template:
            continue
        config_template[key] = value
    write_yaml(config_template, CONFIG_PATH, keep_backup=True)
    return config_template


def config_exists():
    """
    Returns True if a config file (config.yml) is installed.
    """
    return CONFIG_PATH.exists()


def user_is_configured_to_custom_stack():
    """Look at the users stack to see if they have configured to their own stack."""
    configured_nav_url = get_from_config("navigator_url")
    return configured_nav_url is not None


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
    Read the local config using defaults from CONFIG_TEMPLATE.
    """
    local_config = read_yaml(CONFIG_TEMPLATE)
    if CONFIG_PATH.exists():
        local_config.update(read_yaml(CONFIG_PATH))
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


def catalog_s3_url(catalog_url, s3_url):
    """
    Generate a URL to the Quilt catalog page for an object in S3
    """
    if s3_url is None:
        return catalog_url

    pk = PhysicalKey.from_url(s3_url)
    if pk.is_local():
        raise QuiltException("Not an S3 URL")

    url = f"{catalog_url}/b/{quote(pk.bucket)}"

    if pk.path:
        url += f"/tree/{quote(pk.path)}"

        # Ignore version_id if path is empty (e.g., s3://<bucket>)
        if pk.version_id is not None:
            params = {'version': pk.version_id}
            url += f"?{urlencode(params)}"
    return url


def catalog_package_url(catalog_url, bucket, package_name, package_timestamp="latest", tree=True):
    """
    Generate a URL to the Quilt catalog page of a package. By default will go to the latest version of the package,
    but the user can pass in the appropriate timestamp to go to a different version.
    Disabling tree by passing `tree=False` will generate a package URL without tree path.

    Note: There is currently no good way to generate the URL given a specific tophash
    """
    assert bucket is not None, "The bucket parameter must not be None"
    assert package_name is not None, "The package_name parameter must not be None"
    validate_package_name(package_name)

    package_url = f"{catalog_url}/b/{bucket}/packages/{package_name}"
    if tree:
        package_url = package_url + f"/tree/{package_timestamp}"
    return package_url
