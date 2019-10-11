
# quilt3
Quilt API

## config(\*catalog\_url, \*\*config\_values)  {#config}
Set or read the QUILT configuration.

To retrieve the current config, call directly, without arguments:

```python
    >>> import quilt3
    >>> quilt3.config()
```

To trigger autoconfiguration, call with just the navigator URL:

```python
    >>> quilt3.config('https://example.com')
```

To set config values, call with one or more key=value pairs:

```python
    >>> quilt3.config(navigator_url='http://example.com',
    ...               elastic_search_url='http://example.com/queries')
```

Default config values can be found in `quilt3.util.CONFIG_TEMPLATE`.

__Arguments__

* __catalog_url__:  A (single) URL indicating a location to configure from
* __**config_values__:  `key=value` pairs to set in the config

__Returns__

`QuiltConfig`: (an ordered Mapping)


## delete\_package(name, registry=None)  {#delete\_package}

Delete a package. Deletes only the manifest entries and not the underlying files.

__Arguments__

* __name (str)__:  Name of the package
* __registry (str)__:  The registry the package will be removed from


## list\_package\_versions(name, registry=None)  {#list\_package\_versions}
Lists versions of a given package.

Returns a sequence of (version, hash) of a package in a registry.
If the registry is None, default to the local registry.

__Arguments__

* __registry(string)__:  location of registry to load package from.

__Returns__

A sequence of tuples containing the named version and hash.


## list\_packages(registry=None)  {#list\_packages}
Lists Packages in the registry.

Returns a sequence of all named packages in a registry.
If the registry is None, default to the local registry.

__Arguments__

* __registry(string)__:  location of registry to load package from.

__Returns__

A sequence of strings containing the names of the packages


## search(query, limit=10)  {#search}

Execute a search against the configured search endpoint.

__Arguments__

* __query (str)__:  query string to search
* __limit (number)__:  maximum number of results to return. Defaults to 10

Query Syntax:
    [simple query string query](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl-simple-query-string-query.html)


__Returns__

a list of objects with the following structure:
```
[{
`"_id"`: <document unique id>
`"_index"`: <source index>,
`"_score"`: <relevance score>
    "_source":
`"key"`: <key of the object>,
`"size"`: <size of object in bytes>,
`"user_meta"`: <user metadata from meta= via quilt3>,
`"last_modified"`: <timestamp from ElasticSearch>,
`"updated"`: <object timestamp from S3>,
`"version_id"`: <version_id of object version>
`"_type"`: <document type>
}, ...]
```

