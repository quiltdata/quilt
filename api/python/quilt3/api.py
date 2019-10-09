import pathlib
from urllib.parse import urlparse, unquote

from .data_transfer import copy_file, get_bytes, delete_url, put_bytes, list_objects, list_url
from .formats import FormatRegistry
from .search_util import search_api
from .util import (QuiltConfig, QuiltException, CONFIG_PATH,
                   CONFIG_TEMPLATE, configure_from_url, fix_url,
                   get_from_config, get_package_registry, parse_file_url, parse_s3_url,
                   read_yaml, validate_package_name, write_yaml)


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
    usr, pkg = name.split('/')

    registry_base_path = get_package_registry(fix_url(registry) if registry else None)

    named_packages = registry_base_path.rstrip('/') + '/named_packages/'
    package_path = named_packages + name + '/'

    paths = list(list_url(package_path))
    if not paths:
        raise QuiltException("No such package exists in the given directory.")

    for path, _ in paths:
        delete_url(package_path + path)

    # Will ignore non-empty dirs.
    delete_url(package_path)
    delete_url(named_packages + usr + '/')


def list_packages(registry=None):
    """Lists Packages in the registry.

    Returns a sequence of all named packages in a registry.
    If the registry is None, default to the local registry.

    Args:
        registry(string): location of registry to load package from.

    Returns:
        A sequence of strings containing the names of the packages
    """
    registry_base_path = get_package_registry(fix_url(registry) if registry else None)

    named_packages = registry_base_path.rstrip('/') + '/named_packages/'
    for path, _ in list_url(named_packages):
        parts = path.split('/')
        if len(parts) == 3 and parts[2] == 'latest':
            yield f'{parts[0]}/{parts[1]}'


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

        # If catalog_url is empty, reset to the default config.

        if catalog_url:
            config_template = configure_from_url(catalog_url)
        else:
            config_template = read_yaml(CONFIG_TEMPLATE)
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
    raw_results = search_api(query, '*', limit)
    return raw_results['hits']['hits']

