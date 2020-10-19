# quilt3

Quilt API

## config\(\*catalog\_url, \*\*config\_values\) <a id="config"></a>

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

**Arguments**

* **catalog\_url**:  A \(single\) URL indicating a location to configure from
* **\*\*config\_values**:  `key=value` pairs to set in the config

**Returns**

`QuiltConfig`: \(an ordered Mapping\)

## delete\_package\(name, registry=None, top\_hash=None\) <a id="delete\_package"></a>

Delete a package. Deletes only the manifest entries and not the underlying files.

**Arguments**

* **name \(str\)**:  Name of the package
* **registry \(str\)**:  The registry the package will be removed from
* **top\_hash \(str\)**:  Optional. A package hash to delete, instead of the whole package.

## list\_package\_versions\(name, registry=None\) <a id="list\_package\_versions"></a>

Lists versions of a given package.

Returns an iterable of \(version, hash\) of a package in a registry. If the registry is None, default to the local registry.

**Arguments**

* **name \(str\)**:  Name of the package
* **registry \(str\)**:  location of registry to load package from.

**Returns**

An iterable of tuples containing the version and hash for the package.

## list\_packages\(registry=None\) <a id="list\_packages"></a>

Lists Packages in the registry.

Returns an iterable of all named packages in a registry. If the registry is None, default to the local registry.

**Arguments**

* **registry \(str\)**:  location of registry to load package from.

**Returns**

An iterable of strings containing the names of the packages

## logged\_in\(\) <a id="logged\_in"></a>

Return catalog URL if Quilt client is authenticated. Otherwise return `None`.

## login\(\) <a id="login"></a>

Authenticate to your Quilt stack and assume the role assigned to you by your stack administrator. Not required if you have existing AWS credentials.

Launches a web browser and asks the user for a token.

## logout\(\) <a id="logout"></a>

Do not use Quilt credentials. Useful if you have existing AWS credentials.

## search\(query, limit=10\) <a id="search"></a>

Execute a search against the configured search endpoint.

**Arguments**

* **query \(str\)**:  query string to search
* **limit \(number\)**:  maximum number of results to return. Defaults to 10

Query Syntax: [simple query string query](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl-simple-query-string-query.html)

**Returns**

a list of objects with the following structure:

```text
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

