import collections
import concurrent
from functools import partial
from io import BytesIO
from itertools import islice

from .data_transfer import copy_file, get_bytes, delete_url, list_url, new_latest_manifest_tophash, put_bytes, \
    list_url_with_datetime, copy_file_list, S3ClientProvider
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

    registry_parsed = PhysicalKey.from_url(get_package_registry(fix_url(registry) if registry else None))

    if top_hash is None:
        _delete_all_package_versions(registry_parsed, name)
    else:
        _delete_package_version(registry_parsed, name, top_hash)


def _delete_package_version(registry: PhysicalKey, package_name, tophash: str):
    assert isinstance(registry, PhysicalKey)

    full_tophash = Package.resolve_hash(registry, package_name, tophash)
    latest_pointer_pk = DotQuiltLayout.latest_pointer_pk(registry, package_name)

    # Open latest pointer to see if we are deleting the latest version
    latest_tophash = get_bytes(latest_pointer_pk).decode('utf-8').strip()
    need_to_update_latest_pointer = full_tophash == latest_tophash

    delete_url(DotQuiltLayout.manifest_pk(registry, package_name, tophash))

    if need_to_update_latest_pointer:
        new_latest_tophash = new_latest_manifest_tophash(registry, package_name, tophash_to_ignore=full_tophash)
        if new_latest_tophash is None:
            return
        put_bytes(new_latest_tophash.encode('utf-8'), latest_pointer_pk)


def _delete_all_package_versions(registry: PhysicalKey, package_name):
    assert isinstance(registry, PhysicalKey)
    manifest_dir_pk = DotQuiltLayout.package_manifest_dir(registry, package_name)

    for rel_path, _ in list_url(manifest_dir_pk):
        tophash = DotQuiltLayout.extract_tophash(rel_path)
        delete_url(DotQuiltLayout.manifest_pk(registry, package_name, tophash))
    delete_url(DotQuiltLayout.latest_pointer_pk(registry, package_name))


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

    registry_pk = PhysicalKey.from_url(get_package_registry(fix_url(registry) if registry else None))
    manifest_dir_pk = DotQuiltLayout.global_manifest_dir(registry_pk)

    # A package can have multiple versions, but we should only return the name once.
    visited = set()

    for path, _ in list_url(manifest_dir_pk):
        parts = path.lstrip("/").split("/")  # ["usr=usr", "pkg=pkg", "hash_prefix=ab", "XXXXXXXXXXX.jsonl"]

        usr = parts[0].replace("usr=", "")
        pkg = parts[1].replace("pkg=", "")

        pkg_name = f"{usr}/{pkg}"
        if pkg_name not in visited:
            visited.add(pkg_name)
            yield pkg_name


@ApiTelemetry("api.list_package_versions")
def list_package_versions(name, registry=None):
    """Lists versions of a given package.

    Returns a sequence of (tophash, timestamp) of a package in a registry. The timestamp is a string for display
    purposes - either the last modified timestamp or the created timestamp depending on whether it is local or on s3.
    If the registry is None, default to the local registry.

    Args:
        registry(string): location of registry to load package from.

    Returns:
        A sequence of tuples containing the hash and the timestamp.
    """

    return _list_package_versions(name=name, registry=registry)


def _list_package_versions(name, registry=None):
    # TODO: Timezones?

    validate_package_name(name)
    registry_pk = PhysicalKey.from_url(get_package_registry(fix_url(registry) if registry else None))

    package_manifest_dir_pk = DotQuiltLayout.package_manifest_dir(registry_pk, name)

    for path, _, dt in list_url_with_datetime(package_manifest_dir_pk):
        tophash = DotQuiltLayout.extract_tophash(path)
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


def migrate(registry, dest_registry, n=100):
    registry_parsed = PhysicalKey.from_url(fix_url(registry))
    named_packages = registry_parsed.join('.quilt/named_packages')
    pkg_version_paths = [x[0] for x in islice(list_url(named_packages), n)]
    s3_client_provider = S3ClientProvider()
    latest_pointers = {}
    top_hash_to_pkg = collections.defaultdict(set)
    with concurrent.futures.ThreadPoolExecutor() as pool:
        top_hashes = pool.map(
            partial(get_bytes, s3_client_provider=s3_client_provider),
            map(named_packages.join, pkg_version_paths),
        )
        for pkg_version_path, top_hash in zip(pkg_version_paths, top_hashes):
            top_hash = top_hash.decode()
            pkg_name, version = pkg_version_path.rsplit('/', 1)
            if version == 'latest':
                latest_pointers[pkg_name] = top_hash
            top_hash_to_pkg[top_hash].add(pkg_name)

        # TODO: make sure we don't want to regenerate manifests.
        new_registry = PhysicalKey.from_url(
            get_package_registry(None if dest_registry is None else fix_url(dest_registry)))
        file_list = []
        fixed_top_hashes = {}
        for top_hash, pkgs in top_hash_to_pkg.items():
            manifest_path = registry_parsed.join(f'.quilt/packages/{top_hash}')
            manifest_bytes = get_bytes(manifest_path, s3_client_provider=s3_client_provider)
            new_top_hash = Package._load(BytesIO(manifest_bytes)).top_hash
            if new_top_hash != top_hash:
                fixed_top_hashes[top_hash] = new_top_hash
                print('fixed top hash')
            for pkg_name in pkgs:
                file_list.append(
                    (
                        manifest_path,
                        DotQuiltLayout.manifest_pk(new_registry, pkg_name, new_top_hash),
                        len(manifest_bytes),
                    )
                )
        copy_file_list(file_list)

        futures = [
            pool.submit(
                put_bytes,
                fixed_top_hashes.get(top_hash, top_hash).encode(),
                DotQuiltLayout.latest_pointer_pk(new_registry, pkg_name),
                s3_client_provider=s3_client_provider,
            )
            for pkg_name, top_hash in latest_pointers.items()
        ]
        for f in concurrent.futures.as_completed(futures):
            f.result()
