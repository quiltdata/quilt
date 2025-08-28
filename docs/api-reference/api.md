
# quilt3
Quilt API

## config(\*catalog\_url, \*\*config\_values)  {#config}
Set or read the QUILT configuration.

To retrieve the current config, call directly, without arguments:

    import quilt3
    quilt3.config()

To trigger autoconfiguration, call with just the navigator URL:

    import quilt3
    quilt3.config('https://YOUR-CATALOG-URL.com')

To set config values, call with one or more key=value pairs:

    import quilt3
    quilt3.config(navigator_url='http://example.com')

Default config values can be found in `quilt3.util.CONFIG_TEMPLATE`.

__Arguments__

* __catalog_url__:  A (single) URL indicating a location to configure from
* __**config_values__:  `key=value` pairs to set in the config

__Returns__

`QuiltConfig`: (an ordered Mapping)


## copy(src, dest)  {#copy}

Copies ``src`` object from QUILT to ``dest``.

Either of ``src`` and ``dest`` may be S3 paths (starting with ``s3://``)
or local file paths (starting with ``file:///``).

__Arguments__

* __src (str)__: a path to retrieve
* __dest (str)__: a path to write to


## delete\_package(name, registry=None, top\_hash=None)  {#delete\_package}

Delete a package. Deletes only the manifest entries and not the underlying files.

__Arguments__

* __name (str)__:  Name of the package
* __registry (str)__:  The registry the package will be removed from
* __top_hash (str)__:  Optional. A package hash to delete, instead of the whole package.


## disable\_telemetry()  {#disable\_telemetry}

Permanently disable sending of anonymous usage metrics


## get\_boto3\_session(\*, fallback: bool = True) -> boto3.session.Session  {#get\_boto3\_session}

Return a Boto3 session with Quilt stack credentials and AWS region.
In case of no Quilt credentials found, return a "normal" Boto3 session if `fallback` is `True`,
otherwise raise a `QuiltException`.

> Note: you need to call `quilt3.config("https://your-catalog-homepage/")` to have region set on the session,
if you previously called it in quilt3 < 6.1.0.


## list\_package\_versions(name, registry=None)  {#list\_package\_versions}
Lists versions of a given package.

Returns an iterable of (latest_or_unix_ts, hash) of package revisions.
If the registry is None, default to the local registry.

__Arguments__

* __name (str)__:  Name of the package
* __registry (str)__:  location of registry to load package from.

__Returns__

An iterable of tuples containing the version and hash for the package.


## list\_packages(registry=None)  {#list\_packages}
Lists Packages in the registry.

Returns an iterable of all named packages in a registry.
If the registry is None, default to the local registry.

__Arguments__

* __registry (str)__:  location of registry to load package from.

__Returns__

An iterable of strings containing the names of the packages


## logged\_in()  {#logged\_in}

Return catalog URL if Quilt client is authenticated. Otherwise
return `None`.


## login()  {#login}

Authenticate to your Quilt stack and assume the role assigned to you by
your stack administrator. Not required if you have existing AWS credentials.

Launches a web browser and asks the user for a token.


## logout()  {#logout}

Do not use Quilt credentials. Useful if you have existing AWS credentials.


## search(query: Union[str, dict], limit: int = 10) -> List[dict]  {#search}

Execute a search against the configured search endpoint.

__Arguments__

* __query__:  query string to query if passed as `str`, DSL query body if passed as `dict`
* __limit__:  maximum number of results to return. Defaults to 10

Query Syntax:
    [Query String Query](
        https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl-query-string-query.html)
    [Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl.html)

Index schemas and search examples can be found in the
[Quilt Search documentation](https://docs.quilt.bio/quilt-platform-catalog-user/search).

__Returns__

search results

