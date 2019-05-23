import re
from collections import OrderedDict
from collections.abc import Mapping, Sequence, Set
import datetime
import json
import os
from urllib.parse import parse_qs, quote, unquote, urlencode, urljoin, urlparse, urlunparse
from urllib.request import url2pathname
from fnmatch import fnmatch

# backports
from six.moves import urllib
try:
    import pathlib2 as pathlib
except ImportError:
    import pathlib

# Third-Party
import ruamel.yaml
from appdirs import user_data_dir
import requests


APP_NAME = "QUILT"
APP_AUTHOR = "QuiltData"
BASE_DIR = user_data_dir(APP_NAME, APP_AUTHOR)
BASE_PATH = pathlib.Path(BASE_DIR)
CONFIG_PATH = BASE_PATH / 'config.yml'

PACKAGE_NAME_FORMAT = r"[\w-]+/[\w-]+$"

## CONFIG_TEMPLATE
# Must contain every permitted config key, as well as their default values (which can be 'null'/None).
# Comments are retained and added to local config, unless overridden by autoconfig via `api.config(<url>)`
CONFIG_TEMPLATE = """
# Helium configuration file

# navigator_url: <url string, default: null>
#
# Used for autoconfiguration
# navigator_url: https://example.com
navigator_url:

# elastic_search_url: <url string, default: null>
#
# Used to satisfy search queries
# elastic_search_url: https://example.com/es
elastic_search_url:

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
registryUrl: https://quilt-t4-staging-registry.quiltdata.com
""".format(BASE_PATH.as_uri())


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
    parsed_url = urllib.parse.urlparse(url)

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


def find_bucket_config(bucket_name, catalog_config_url):
    config_request = requests.get(catalog_config_url)
    if not config_request.ok:
        raise QuiltException("Failed to get catalog config")
    config_json = json.loads(config_request.text)
    if 'federations' not in config_json:
        # try old config format
        try:
            return config_json['configs'][bucket_name]
        except KeyError:
            raise QuiltException("Catalog config malformed")

    federations = config_json['federations']
    federations.reverse() # want to get results from last federation first
    for federation in federations:
        parsed = urlparse(federation)
        if not parsed.netloc:
            # relative URL
            federation = urljoin(catalog_config_url, federation)
        federation_request = requests.get(federation)
        if not federation_request.ok:
            continue
        federation = json.loads(federation_request.text)
        if 'buckets' not in federation:
            continue
        buckets = federation['buckets']
        for bucket in buckets:
            if isinstance(bucket, str):
                bucket_request = requests.get(bucket)
                if not bucket_request.ok:
                    continue
                bucket = json.loads(bucket_request.text)
            if bucket['name'] == bucket_name:
                return bucket

    raise QuiltException("Failed to find a config for the chosen bucket")

def validate_package_name(name):
    """ Verify that a package name is two alphanumerics strings separated by a slash."""
    if not re.match(PACKAGE_NAME_FORMAT, name):
        raise QuiltException("Invalid package name, must contain exactly one /.")

def get_package_registry(path=None):
    """ Returns the package registry root for a given path """
    if path is None:
        path = BASE_PATH.as_uri()
    return path.rstrip('/') + '/.quilt'

def load_config():
    # For user-facing config, use api.config()
    if CONFIG_PATH.exists():
        local_config = read_yaml(CONFIG_PATH)
    else:
        config_template = read_yaml(CONFIG_TEMPLATE)
        local_config = config_template
    return local_config

def get_from_config(key):
    return load_config().get(key)

def get_install_location():
    loc = load_config().get('default_install_location')
    if loc is None:
        loc = get_package_registry() + '/' + 'data/'
    return loc

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
