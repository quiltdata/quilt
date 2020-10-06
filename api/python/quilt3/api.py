from .backends import get_package_registry
from .data_transfer import copy_file
from .search_util import search_api
from .telemetry import ApiTelemetry
from .util import (
    CONFIG_PATH,
    CONFIG_TEMPLATE,
    PhysicalKey,
    QuiltConfig,
    QuiltException,
    config_exists,
    configure_from_default,
    configure_from_url,
    fix_url,
    load_config,
    read_yaml,
    validate_package_name,
    write_yaml,
)


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
    validate_package_name(name)
    registry = get_package_registry(registry)
    if top_hash is None:
        registry.delete_package(name)
    else:
        registry.delete_package_version(name, registry.resolve_top_hash(name, top_hash))


@ApiTelemetry("api.list_packages")
def list_packages(registry=None):
    """Lists Packages in the registry.

    Returns an iterable of all named packages in a registry.
    If the registry is None, default to the local registry.

    Args:
        registry (str): location of registry to load package from.

    Returns:
        An iterable of strings containing the names of the packages
    """
    return get_package_registry(registry).list_packages()


@ApiTelemetry("api.list_package_versions")
def list_package_versions(name, registry=None):
    """Lists versions of a given package.

    Returns an iterable of (version, hash) of a package in a registry.
    If the registry is None, default to the local registry.

    Args:
        name (str): Name of the package
        registry (str): location of registry to load package from.

    Returns:
        An iterable of tuples containing the version and hash for the package.
    """
    validate_package_name(name)
    return get_package_registry(registry).list_package_versions(name)


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
        [simple query string query](
            https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl-simple-query-string-query.html)


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
