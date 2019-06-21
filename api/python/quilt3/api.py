import datetime
import pathlib
from urllib.parse import urlparse, unquote

import pytz
import requests
import humanize

from .data_transfer import copy_file, get_bytes, put_bytes, delete_object, list_objects
from .formats import FormatRegistry
from .packages import Package
from .search_util import search as util_search
from .util import (QuiltConfig, QuiltException, CONFIG_PATH,
                   CONFIG_TEMPLATE, find_bucket_config, fix_url, get_from_config,
                   get_package_registry, parse_file_url, parse_s3_url, read_yaml,
                   validate_url, validate_package_name, write_yaml)


def copy(src, dest):
    """
    Copies ``src`` object from QUILT to ``dest``.

    Either of ``src`` and ``dest`` may be S3 paths (starting with ``s3://``)
    or local file paths (starting with ``file:///``).

    Parameters:
        src (str): a path to retrieve
        dest (str): a path to write to
    """
    copy_file(fix_url(src), fix_url(dest))


def put(obj, dest, meta=None):
    """Write an in-memory object to the specified QUILT ``dest``.

    Note:
        Does not work with all objects -- object must be serializable.

    You may pass a dict to ``meta`` to store it with ``obj`` at ``dest``.

    Parameters:
        obj: a serializable object
        dest (str): A URI
        meta (dict): Optional. metadata dict to store with ``obj`` at ``dest``
    """
    all_meta = {'user_meta': meta}
    clean_dest = fix_url(dest)
    ext = pathlib.PurePosixPath(unquote(urlparse(clean_dest).path)).suffix
    data, format_meta = FormatRegistry.serialize(obj, all_meta, ext)
    all_meta.update(format_meta)

    put_bytes(data, clean_dest, all_meta)


def get(src):
    """Retrieves src object from QUILT and loads it into memory.

    An optional ``version`` may be specified.

    Parameters:
        src (str): A URI specifying the object to retrieve

    Returns:
        tuple: ``(data, metadata)``.  Does not work on all objects.
    """
    clean_src = fix_url(src)
    data, meta = get_bytes(clean_src)
    ext = pathlib.PurePosixPath(unquote(urlparse(clean_src).path)).suffix

    return FormatRegistry.deserialize(data, meta, ext=ext), meta.get('user_meta')


def _tophashes_with_packages(registry=None):
    """Return a dictionary of tophashes and their corresponding packages

    Parameters:
        registry (str): URI of the registry to enumerate

    Returns:
        dict: a dictionary of tophash keys and package name entries
    """
    registry_base_path = get_package_registry(fix_url(registry) if registry else None)
    registry_url = urlparse(registry_base_path)
    out = {}

    if registry_url.scheme == 'file':
        registry_dir = pathlib.Path(parse_file_url(registry_url))

        for pkg_namespace_path in (registry_dir / 'named_packages').iterdir():
            pkg_namespace = pkg_namespace_path.name

            for pkg_subname_path in pkg_namespace_path.iterdir():
                pkg_subname = pkg_subname_path.name
                pkg_name = pkg_namespace + '/' + pkg_subname

                package_timestamps = [ts.name for ts in pkg_subname_path.iterdir()
                                      if ts.name != 'latest']

                for timestamp in package_timestamps:
                    tophash = (pkg_namespace_path / pkg_subname / timestamp).read_text()
                    if tophash in out:
                        out[tophash].update({pkg_name})
                    else:
                        out[tophash] = {pkg_name}

    elif registry_url.scheme == 's3':
        bucket, path, _ = parse_s3_url(registry_url)

        pkg_namespace_path = path + '/named_packages/'

        for pkg_entry in list_objects(bucket, pkg_namespace_path):
            pkg_entry_path = pkg_entry['Key']
            tophash, _ = get_bytes('s3://' + bucket + '/' + pkg_entry_path)
            tophash = tophash.decode('utf-8')
            pkg_name = "/".join(pkg_entry_path.split("/")[-3:-1])

            if tophash in out:
                out[tophash].update({pkg_name})
            else:
                out[tophash] = {pkg_name}

    else:
        raise NotImplementedError

    return out


def delete_package(name, registry=None):
    """
    Delete a package. Deletes only the manifest entries and not the underlying files.

    Parameters:
        name (str): Name of the package
        registry (str): The registry the package will be removed from
    """
    validate_package_name(name)

    if name not in list_packages(registry):
        raise QuiltException("No such package exists in the given directory.")

    registry_base_path = get_package_registry(fix_url(registry) if registry else None)
    registry_url = urlparse(registry_base_path)
    pkg_namespace, pkg_subname = name.split("/")

    tophashes_with_packages = _tophashes_with_packages(registry)

    if registry_url.scheme == 'file':

        registry_dir = pathlib.Path(parse_file_url(registry_url))
        pkg_namespace_dir = registry_dir / 'named_packages' / pkg_namespace
        pkg_dir = pkg_namespace_dir / pkg_subname
        packages_path = registry_dir / 'packages'

        for tophash_file in pkg_dir.iterdir():
            # skip latest, which always duplicates a tophashed file
            timestamp = tophash_file.name
            tophash = tophash_file.read_text()

            if timestamp != 'latest' and len(tophashes_with_packages[tophash]) == 1:
                (packages_path / tophash).unlink()

            tophash_file.unlink()

        pkg_dir.rmdir()

        if not list(pkg_namespace_dir.iterdir()):
            pkg_namespace_dir.rmdir()

    elif registry_url.scheme == 's3':
        bucket, path, _ = parse_s3_url(registry_url)
        pkg_namespace_dir = path + '/named_packages/' + pkg_namespace
        pkg_dir = pkg_namespace_dir + '/' + pkg_subname + '/'
        packages_path = path + '/packages/'

        for tophash_obj_repr in list_objects(bucket, pkg_dir):
            tophash_file = tophash_obj_repr['Key']
            timestamp = tophash_file.split("/")[-1]
            tophash_path = 's3://' + bucket + '/' + tophash_file
            tophash, _ = get_bytes(tophash_path)
            tophash = tophash.decode('utf-8')

            if timestamp != 'latest' and len(tophashes_with_packages[tophash]) == 1:
                delete_object(bucket, packages_path + tophash)

            delete_object(bucket, tophash_file)

    else:
        raise NotImplementedError


def list_packages(registry=None):
    """ Lists Packages in the registry.

    Returns a list of all named packages in a registry.
    If the registry is None, default to the local registry.

    Args:
        registry(string): location of registry to load package from.

    Returns:
        A list of strings containing the names of the packages
    """
    class PackageList:
        """Display wrapper for list_packages"""

        def __init__(self, pkg_info):
            # pkg_info is a list of pkg versions, but pkg_names needs to be a list of packages,
            # so uniquify to packages by passing it into a set; but a set is not a valid iterator,
            # so we must turn it back into a list afterwards.
            self.pkg_names = list(set(
                info['pkg_name'].replace(':latest', '') for info in pkg_info
            ))
            self._repr = self.create_str(pkg_info)

        def __repr__(self):
            return self._repr

        def __iter__(self):
            return iter(self.pkg_names)

        def __len__(self):
            return len(self.pkg_names)

        def __contains__(self, item):
            return item in self.pkg_names

        @staticmethod
        def _fmt_str(string, strlen):
            """Formats strings to a certain width"""
            if len(string) > strlen - 1:
                return string[:strlen - 1] + '…'
            else:
                return string.ljust(strlen)

        def create_str(self, pkg_info):
            """Generates a human-readable string representation of a registry"""
            if pkg_info:
                pkg_name_display_width = max(max([len(info['pkg_name']) for info in pkg_info]), 27)
            else:
                pkg_name_display_width = 27

            out = (f"{self._fmt_str('PACKAGE', pkg_name_display_width)}\t"
                   f"{self._fmt_str('TOP HASH', 12)}\t"
                   f"{self._fmt_str('CREATED', 12)}\t"
                   f"{self._fmt_str('SIZE', 12)}\t"
                   f"\n")
            for pkg_dict in pkg_info:
                tdelta = datetime.datetime.now(pytz.utc) -\
                    datetime.datetime.fromtimestamp(int(pkg_dict['ctime']), pytz.utc)
                tdelta_str = humanize.naturaltime(tdelta)
                size_str = humanize.naturalsize(pkg_dict['size'])

                out += (f"{self._fmt_str(pkg_dict['pkg_name'], pkg_name_display_width)}\t"
                        f"{self._fmt_str(pkg_dict['top_hash'][:12], 15)}\t"
                        f"{self._fmt_str(tdelta_str, 15)}\t"
                        f"{self._fmt_str(size_str, 15).rstrip(' ')}\t\n")
            return out

    if registry is None:
        registry = get_from_config('default_local_registry')

    registry = fix_url(registry)
    named_packages_urlparse = urlparse(registry.rstrip('/') + '/.quilt/named_packages')
    registry_scheme = named_packages_urlparse.scheme

    pkg_info = []

    if registry_scheme == 'file':
        named_packages_dir = pathlib.Path(parse_file_url(named_packages_urlparse))

        for named_path in named_packages_dir.glob('*/*'):
            pkg_name = named_path.relative_to(named_packages_dir).as_posix()

            pkg_hashes = []
            pkg_sizes = []
            pkg_ctimes = []
            pkg_display_names = []

            with open(named_path / 'latest', 'r') as latest_hash_file:
                latest_hash = latest_hash_file.read()

            for pkg_hash_path in named_path.rglob('*/'):
                if pkg_hash_path.name == 'latest':
                    continue

                with open(pkg_hash_path, 'r') as pkg_hash_file:
                    pkg_hash = pkg_hash_file.read()
                    pkg_hashes.append(pkg_hash)

                if pkg_hash == latest_hash:
                    pkg_display_name = f'{pkg_name}:latest'
                else:
                    pkg_display_name = pkg_name

                pkg = Package.browse(pkg_name, registry=registry, top_hash=pkg_hash)
                pkg_sizes.append(sum(pkg.map(lambda _, entry: entry.size)))
                pkg_display_names.append(pkg_display_name)
                pkg_ctimes.append(pkg_hash_path.stat().st_ctime)

            for pkg_display_name, top_hash, ctime, size in zip(
                    pkg_display_names, pkg_hashes, pkg_ctimes, pkg_sizes
            ):
                pkg_info.append(
                    {'pkg_name': pkg_display_name, 'top_hash': top_hash,
                     'ctime': ctime, 'size': size}
                )

    elif registry_scheme == 's3':
        bucket_name, bucket_registry_path, _ = parse_s3_url(named_packages_urlparse)
        bucket_registry_path = bucket_registry_path + '/'

        pkg_namespaces, _ = list_objects(bucket_name, bucket_registry_path, recursive=False)
        pkg_namespaces = [result['Prefix'] for result in pkg_namespaces]

        # go through package namespaces to get packages
        for pkg_namespace in pkg_namespaces:
            raw_pkg_names, _ = list_objects(
                bucket_name,
                pkg_namespace,
                recursive=False
            )
            raw_pkg_names = [pkg_name['Prefix'] for pkg_name in raw_pkg_names]

            # go through packages to get package hash files
            for pkg_name in raw_pkg_names:
                pkg_hashes = []
                pkg_sizes = []
                pkg_ctimes = []
                pkg_display_names = []

                _, pkg_hashfiles = list_objects(
                    bucket_name,
                    pkg_name,
                    recursive=False
                )

                latest_hashfile = next(hf for hf in pkg_hashfiles if '/latest' in hf['Key'])['Key']
                latest_hashfile_fullpath = f's3://{bucket_name}/{latest_hashfile}'
                latest_hash, _ = get_bytes(latest_hashfile_fullpath)
                latest_hash = latest_hash.decode()

                # go through package hashfiles to get manifest files
                pkg_hash_paths = []
                for pkg_hashfile in pkg_hashfiles:
                    pkg_hashfile_key = pkg_hashfile['Key']

                    if pkg_hashfile_key.split('/')[-1] == 'latest':
                        continue

                    pkg_hash, _ = get_bytes(f's3://{bucket_name}/{pkg_hashfile_key}')
                    pkg_hash = pkg_hash.decode()

                    pkg_last_modified = pkg_hashfile['LastModified'].timestamp()
                    pkg_hash_paths.append(pkg_hashfile_key)
                    pkg_ctimes.append(pkg_last_modified)

                # go through manifest files to get package info
                for pkg_hash_path in pkg_hash_paths:
                    pkg_display_name = pkg_name[len(bucket_registry_path):].strip('/')

                    pkg_hash, _ = get_bytes('s3://' + bucket_name + '/' + pkg_hash_path)
                    pkg_hash = pkg_hash.decode()

                    if pkg_hash == latest_hash:
                        pkg_display_name = pkg_display_name + ':latest'

                    pkg_hashes.append(pkg_hash)
                    pkg_display_names.append(pkg_display_name)

                    pkg = Package.browse(
                        pkg_name, top_hash=pkg_hash, registry='s3://' + bucket_name
                    )
                    pkg_sizes.append(sum(pkg.map(lambda _, entry: entry.size)))

                for display_name, top_hash, ctime, size in zip(
                        pkg_display_names, pkg_hashes, pkg_ctimes, pkg_sizes
                ):
                    pkg_info.append(
                        {'pkg_name': display_name, 'top_hash': top_hash, 'ctime': ctime,
                         'size': size}
                    )

    else:
        raise NotImplementedError

    def sorter(pkg_info):
        pkg_name, pkg_cdate = pkg_info['pkg_name'], pkg_info['ctime']
        is_latest = ':latest' in pkg_name
        pkg_realname = pkg_name.replace(':latest', '')
        return (pkg_realname, not is_latest, -pkg_cdate)

    pkg_info = sorted(pkg_info, key=sorter)
    return PackageList(pkg_info)


def config(*catalog_url, **config_values):
    """Set or read the QUILT configuration.

    To retrieve the current config, call directly, without arguments:

        >>> import quilt3
        >>> quilt3.config()

    To trigger autoconfiguration, call with just the navigator URL:

        >>> quilt3.config('https://example.com')

    To set config values, call with one or more key=value pairs:

        >>> quilt3.config(navigator_url='http://example.com',
        ...               elastic_search_url='http://example.com/queries')

    Default config values can be found in `quilt3.util.CONFIG_TEMPLATE`.

    Args:
        catalog_url: A (single) URL indicating a location to configure from
        **config_values: `key=value` pairs to set in the config

    Returns:
        QuiltConfig: (an ordered Mapping)
    """
    if catalog_url and config_values:
        raise QuiltException("Expected either an auto-config URL or key=value pairs, but got both.")
    # Total distinction of args and kwargs -- config(catalog_url='http://foo.com')
    if catalog_url and len(catalog_url) > 1:
        raise QuiltException("`catalog_url` cannot be used with other `config_values`.")

    # Use given catalog's config to replace local configuration
    if catalog_url:
        catalog_url = catalog_url[0]

        config_template = read_yaml(CONFIG_TEMPLATE)

        # If catalog_url is empty, reset to the default config.

        if catalog_url:
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
                config_template[key] = value

        write_yaml(config_template, CONFIG_PATH, keep_backup=True)
        return QuiltConfig(CONFIG_PATH, config_template)

    # Use local configuration (or defaults)
    if CONFIG_PATH.exists():
        local_config = read_yaml(CONFIG_PATH)
    else:
        local_config = read_yaml(CONFIG_TEMPLATE)

    # Write to config if needed
    if config_values:
        config_values = QuiltConfig('', config_values)  # Does some validation/scrubbing
        for key, value in config_values.items():
            local_config[key] = value
        write_yaml(local_config, CONFIG_PATH)

    # Return current config
    return QuiltConfig(CONFIG_PATH, local_config)

def search(query, limit=10):
    """
    Execute a search against the configured search endpoint.

    Args:
        query (str): query string to search
        limit (number): maximum number of results to return. Defaults to 10

    Query Syntax:
        By default, a normal plaintext search will be executed over the query string.
        You can use field-match syntax to filter on exact matches for fields in
            your metadata.
        The syntax for field match is `user_meta.$field_name:"exact_match"`.

    Returns:
        either the request object (in case of an error) or
        a list of objects with the following structure:
        ```
        [{
            "key": <key of the object>,
            "version_id": <version_id of object version>,
            "operation": <"Create" or "Delete">,
            "meta": <metadata attached to object>,
            "size": <size of object in bytes>,
            "text": <indexed text of object>,
            "source": <source document for object (what is actually stored in ElasticSeach)>,
            "time": <timestamp for operation>,
        }...]
        ```
    """
    default_bucket = get_from_config('defaultBucket')
    navigator_url = get_from_config('navigator_url')
    config_url = navigator_url + '/config.json'
    search_endpoint = get_from_config('elastic_search_url')

    # TODO: we can maybe get this from searchEndpoint or apiGatewayEndpoint
    region = get_from_config('region')

    return util_search(query, search_endpoint, limit=limit, aws_region=region)
