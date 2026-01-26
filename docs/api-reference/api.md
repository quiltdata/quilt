
# quilt3
Quilt API

## clear\_api\_key()  {#clear\_api\_key}

Clear the API key and fall back to interactive session (if available).

See the [Authentication Guide](authentication.md) for detailed
usage examples and best practices.


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


## delete\_package(name, registry=None, top\_hash=None)  {#delete\_package}

Delete a package. Deletes only the manifest entries and not the underlying files.

__Arguments__

* __name (str)__:  Name of the package
* __registry (str)__:  The registry the package will be removed from
* __top_hash (str)__:  Optional. A package hash to delete, instead of the whole package.


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

Return catalog URL if Quilt client is authenticated, `None` otherwise.

See the [Authentication Guide](authentication.md) for more
information about authentication methods.


## login()  {#login}

Authenticate to your Quilt stack and assume the role assigned to you by
your stack administrator. Not required if you have existing AWS credentials.

Launches a web browser and asks the user for a token.

See the [Authentication Guide](authentication.md) for detailed
usage examples and best practices.


## login\_with\_api\_key(key: str)  {#login\_with\_api\_key}

Authenticate using an API key.

The API key is stored in memory only (no disk persistence).
While set, the API key overrides any interactive session.
Use clear_api_key() to revert to interactive session.

__Arguments__

* __key__:  API key string (starts with 'qk_')

__Raises__

* `ValueError`:  If the key doesn't start with 'qk_' prefix.

See the [Authentication Guide](authentication.md) for detailed
usage examples, best practices, and common use cases (CI/CD, Docker, Lambda).


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


# quilt3.api_keys
API for managing your own API keys.

See the [Authentication Guide](authentication.md) for detailed
usage examples, best practices, and common use cases.

## APIKey(id: str, name: str, fingerprint: str, created\_at: datetime.datetime, expires\_at: datetime.datetime, last\_used\_at: Optional[datetime.datetime], status: Literal['ACTIVE', 'EXPIRED']) -> None  {#APIKey}
An API key for programmatic access.

## APIKeyError(result)  {#APIKeyError}
Error during API key operation.

## list(name: Optional[str] = None, fingerprint: Optional[str] = None, status: Optional[Literal['ACTIVE', 'EXPIRED']] = None) -> List[quilt3.api\_keys.APIKey]  {#list}

List your API keys. Optionally filter by name, fingerprint, or status.

__Arguments__

* __name__:  Filter by key name.
* __fingerprint__:  Filter by key fingerprint.
* __status__:  Filter by "ACTIVE" or "EXPIRED". None returns all.

__Returns__

List of your API keys matching the filters.


## get(id: str) -> Optional[quilt3.api\_keys.APIKey]  {#get}

Get a specific API key by ID.

__Arguments__

* __id__:  The API key ID.

__Returns__

The API key, or None if not found.


## create(name: str, expires\_in\_days: int = 90) -> Tuple[quilt3.api\_keys.APIKey, str]  {#create}

Create a new API key for yourself.

__Arguments__

* __name__:  Name for the API key.
* __expires_in_days__:  Days until expiration (1-365, default 90).

__Returns__

Tuple of (APIKey, secret). The secret is only returned once - save it securely!

__Raises__

* `APIKeyError`:  If the operation fails.


## revoke(id: Optional[str] = None, secret: Optional[str] = None) -> None  {#revoke}

Revoke an API key. Provide either the key ID or the secret.

__Arguments__

* __id__:  The API key ID to revoke.
* __secret__:  The API key secret to revoke.

__Raises__

* `ValueError`:  If neither id nor secret is provided.
* `APIKeyError`:  If the operation fails.

