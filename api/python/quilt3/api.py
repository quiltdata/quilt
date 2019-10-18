import pathlib
from urllib.parse import quote, urlparse, unquote

from .data_transfer import copy_file, get_bytes, delete_url, put_bytes, list_url
from .formats import FormatRegistry
from .search_util import search_api
from .util import (QuiltConfig, QuiltException, CONFIG_PATH,
                   CONFIG_TEMPLATE, configure_from_url, fix_url,
                   get_package_registry, read_yaml, validate_package_name, write_yaml)


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


def delete_package(name, registry=None, top_hash=None):
    """
    Delete a package. Deletes only the manifest entries and not the underlying files.

    Parameters:
        name (str): Name of the package
        registry (str): The registry the package will be removed from
        top_hash (str): Optional. A package hash to delete, instead of the whole package.
    """
    validate_package_name(name)
    usr, pkg = name.split('/')

    registry_base_path = get_package_registry(fix_url(registry) if registry else None)

    named_packages = registry_base_path.rstrip('/') + '/named_packages/'
    package_path = named_packages + name + '/'

    paths = list(list_url(package_path))
    if not paths:
        raise QuiltException("No such package exists in the given directory.")

    if top_hash is not None:
        deleted = []
        remaining = []
        for path, _ in paths:
            parts = path.split('/')
            if len(parts) == 1:
                pkg_hash, _ = get_bytes(package_path + quote(parts[0]))
                if pkg_hash.decode().strip() == top_hash:
                    deleted.append(parts[0])
                else:
                    remaining.append(parts[0])
        if not deleted:
            raise QuiltException("No such package version exists in the given directory.")
        for path in deleted:
            delete_url(package_path + quote(path))
        if 'latest' in deleted and remaining:
            # Create a new "latest". Technically, we need to compare numerically,
            # but string comparisons will be fine till year 2286.
            new_latest = max(remaining)
            copy_file(package_path + quote(new_latest), package_path + 'latest')
    else:
        for path, _ in paths:
            delete_url(package_path + quote(path))

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
    prev_pkg = None
    for path, _ in list_url(named_packages):
        parts = path.split('/')
        if len(parts) == 3:
            pkg = f'{parts[0]}/{parts[1]}'
            # A package can have multiple versions, but we should only return the name once.
            if pkg != prev_pkg:
                prev_pkg = pkg
                yield pkg


def list_package_versions(name, registry=None):
    """Lists versions of a given package.

    Returns a sequence of (version, hash) of a package in a registry.
    If the registry is None, default to the local registry.

    Args:
        registry(string): location of registry to load package from.

    Returns:
        A sequence of tuples containing the named version and hash.
    """
    validate_package_name(name)

    registry_base_path = get_package_registry(fix_url(registry) if registry else None)

    package = registry_base_path.rstrip('/') + '/named_packages/' + name + '/'
    for path, _ in list_url(package):
        parts = path.split('/')
        if len(parts) == 1:
            pkg_hash, _ = get_bytes(package + parts[0])
            yield parts[0], pkg_hash.decode().strip()


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
        [simple query string query](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl-simple-query-string-query.html)


    Returns:
        a list of objects with the following structure:
        ```
        [{
            "_id": <document unique id>
            "_index": <source index>,
            "_score": <relevance score>
            "_source":
                "key": <key of the object>,
                "size": <size of object in bytes>,
                "user_meta": <user metadata from meta= via quilt3>,
                "last_modified": <timestamp from ElasticSearch>,
                "updated": <object timestamp from S3>,
                "version_id": <version_id of object version>
            "_type": <document type>
        }, ...]
        ```
    """
    raw_results = search_api(query, '*', limit)
    return raw_results['hits']['hits']

