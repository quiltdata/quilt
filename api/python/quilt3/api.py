from .data_transfer import copy_file, get_bytes, delete_url, list_url, get_new_latest_manifest_tophash, put_bytes, list_url_with_datetime
from .packages import Package
from .search_util import search_api
from .util import (QuiltConfig, QuiltException, CONFIG_PATH,
                   CONFIG_TEMPLATE, configure_from_default, config_exists,
                   configure_from_url, fix_url, get_package_registry,
                   load_config, PhysicalKey, read_yaml, validate_package_name,
                   write_yaml)
from .telemetry import ApiTelemetry
from .dotquilt_layout import DotQuiltLayout


def copy(src, dest):
    """
    Copies ``src`` object from QUILT to ``dest``.

    Either of ``src`` and ``dest`` may be S3 paths (starting with ``s3://``)
    or local file paths (starting with ``file:///``).

    Parameters:
        src (str): a path to retrieve
        dest (str): a path to write to
    """
    copy_file(PhysicalKey.from_url(fix_url(src)), PhysicalKey.from_url(fix_url(dest)))



@ApiTelemetry("api.delete_package")
def delete_package(name, registry=None, top_hash=None):
    """
    Delete a package. Deletes only the manifest entries and not the underlying files.

    Parameters:
        name (str): Name of the package
        registry (str): The registry the package will be removed from
        top_hash (str): Optional. A package hash to delete, instead of the whole package.
    """
    return _delete_package(name=name, registry=registry, top_hash=top_hash)


def _delete_package(name, registry=None, top_hash=None):

    validate_package_name(name)
    usr, pkg = name.split('/')

    registry_parsed = PhysicalKey.from_url(get_package_registry(fix_url(registry) if registry else None))
    # named_packages = registry_parsed.join('named_packages')
    # package_path = named_packages.join(name)

    package_path = registry_parsed.join(DotQuiltLayout.get_package_manifest_dir(name))  # .quilt/v2/usr=usr/pkg=pkg (no trailing slash)

    manifest_list_prefix = package_path.join("hash_prefix=")  # This prevents the listing from including the 'latest' pointer
    latest_pointer = registry_parsed.join(DotQuiltLayout.get_latest_key(name))

    paths = list(list_url(manifest_list_prefix))
    if not paths:
        raise QuiltException("No such package exists in the given directory.")


    if top_hash is not None:  # Just deleting one version
        top_hash = Package.resolve_hash(registry_parsed, name, top_hash)

        # Check if the tophash to delete is latest
        #   if not, delete it and call it a day
        #   if so, replace it with the most recently created manifest. List all manifests and pick the most recent


        # Open latest pointer to see if we are deleting the latest version
        latest_top_hash = get_bytes(latest_pointer).decode('utf-8').strip()
        need_to_update_latest_pointer = top_hash == latest_top_hash

        manifest_physical_key = registry_parsed.join(DotQuiltLayout.get_manifest_key_by_tophash(name, top_hash))
        delete_url(manifest_physical_key)

        if need_to_update_latest_pointer:
            # List
            new_latest_manifest_tophash = get_new_latest_manifest_tophash(manifest_list_prefix, top_hash)
            put_bytes(new_latest_manifest_tophash.encode('utf-8'), latest_pointer)


    else:
        for path, _ in paths:
            delete_url(package_path.join(path))
            delete_url(latest_pointer)



@ApiTelemetry("api.list_packages")
def list_packages(registry=None):
    """Lists Packages in the registry.

    Returns a sequence of all named packages in a registry.
    If the registry is None, default to the local registry.

    Args:
        registry(string): location of registry to load package from.

    Returns:
        A sequence of strings containing the names of the packages
    """


    return _list_packages(registry=registry)


def _list_packages(registry=None):

    registry_parsed = PhysicalKey.from_url(get_package_registry(fix_url(registry) if registry else None))

    # A package can have multiple versions, but we should only return the name once.
    visited = set()

    prev_pkg = None
    for path, _ in list_url(registry_parsed):
        if path.endswith("latest"):  # Ignore 'latest' pointer
            continue

        parts = path.split('/')   # ["user=usr", "pkg=pkg", "hash_prefix=ab", "XXXXXXXXXXX.jsonl"]
        usr = parts[0].lstrip("usr=")
        pkg = parts[1].lstrip("pkg=")

        pkg_name = f"{usr}/{pkg}"
        if pkg_name not in visited:
            visited.add(pkg_name)
            yield pkg_name



@ApiTelemetry("api.list_package_versions")
def list_package_versions(name, registry=None):
    """Lists versions of a given package.

    Returns a sequence of (version, hash) of a package in a registry.
    If the registry is None, default to the local registry.

    Args:
        registry(string): location of registry to load package from.

    Returns:
        A sequence of tuples containing the named version and hash.
    """

    return _list_package_versions(name=name, registry=registry)


def _list_package_versions(name, registry=None):

    validate_package_name(name)
    registry_parsed = PhysicalKey.from_url(get_package_registry(fix_url(registry) if registry else None))

    package = registry_parsed.join(DotQuiltLayout.get_package_manifest_dir(name)).join("")  # Get that trailing slash
    for path, _, dt in list_url_with_datetime(package):
        if path.endswith("latest"):
            continue

        tophash = path.split("/")[1].strip(".jsonl")
        yield tophash, dt.strftime("%Y-%m-%d %H:%M:%S")



@ApiTelemetry("api.config")
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
    return _config(*catalog_url, **config_values)


def _config(*catalog_url, **config_values):
    """   telemetry-free version of config()   """
    if catalog_url and config_values:
        raise QuiltException("Expected either an auto-config URL or key=value pairs, but got both.")
    # Total distinction of args and kwargs -- config(catalog_url='http://foo.com')
    if catalog_url and len(catalog_url) > 1:
        raise QuiltException("`catalog_url` cannot be used with other `config_values`.")

    # Use given catalog's config to replace local configuration
    if catalog_url:
        catalog_url = catalog_url[0]

        # If catalog_url is empty, reset to an empty config.
        if catalog_url:
            config_template = configure_from_url(catalog_url)
        else:
            config_template = read_yaml(CONFIG_TEMPLATE)
            write_yaml(config_template, CONFIG_PATH, keep_backup=True)
        local_config = config_template
    # Create a custom config with the passed-in values only
    elif config_values:
        local_config = load_config()
        config_values = QuiltConfig('', config_values)  # Does some validation/scrubbing
        for key, value in config_values.items():
            local_config[key] = value
        write_yaml(local_config, CONFIG_PATH)
    # Return the current config if present or create one from the default stack
    else:
        if config_exists():
            local_config = load_config()
        else:
            local_config = configure_from_default()

    # Return current config
    return QuiltConfig(CONFIG_PATH, local_config)


@ApiTelemetry("api.disable_telemetry")
def disable_telemetry():
    """ Permanently disable sending of anonymous usage metrics """
    _disable_telemetry()

def _disable_telemetry():
    _config(telemetry_disabled=True)



@ApiTelemetry("api.search")
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
    # force a call to configure_from_default if no config exists
    _config()
    raw_results = search_api(query, '*', limit)
    return raw_results['hits']['hits']
