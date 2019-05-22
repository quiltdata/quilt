
# quilt
Quilt API

## config(\*catalog\_url, \*\*config\_values)  {#config}
Set or read the Quilt configuration.

To retrieve the current config, call directly, without arguments:

```python
    >>> import quilt
    >>> quilt.config()
```

To trigger autoconfiguration, call with just the navigator URL:

```python
    >>> quilt.config('https://example.com')
```

To set config values, call with one or more key=value pairs:

```python
    >>> quilt.config(navigator_url='http://example.com',
    ...           elastic_search_url='http://example.com/queries')
```

Default config values can be found in `quilt.util.CONFIG_TEMPLATE`.

__Arguments__

* __catalog_url__:  A (single) URL indicating a location to configure from
* __**config_values__:  `key=value` pairs to set in the config

__Returns__

`Quilt`: (an ordered Mapping)


## delete\_package(name, registry=None)  {#delete\_package}

Delete a package. Deletes only the manifest entries and not the underlying files.

__Arguments__

* __name (str)__:  Name of the package
* __registry (str)__:  The registry the package will be removed from


## list\_packages(registry=None)  {#list\_packages}
Lists Packages in the registry.

Returns a list of all named packages in a registry.
If the registry is None, default to the local registry.

__Arguments__

* __registry(string)__:  location of registry to load package from.

__Returns__

A list of strings containing the names of the packages

