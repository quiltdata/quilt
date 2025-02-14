# Catalog Authentication

Based on the source code, here's what `quilt3.login()` does:

## 1. Verify URL

First, it checks if a registry URL is configured. If not, it raises a
QuiltException asking the user to first specify their home catalog using
`quilt3.config('$URL')`.

## 2. Ask User to Copy Refresh Token from Catalog

It launches a web browser directing the user to copy the refresh token at: `{registry_url}/code`.
If the browser launch fails, it prints the URL for manual navigation

## 3. Have User Enter Refresh Token

After the user logs in through the web interface, they receive a code which they
need to enter back in the terminal when prompted by the "Enter the code from the
webpage:" message.

## 4. Use that Refresh token to Create/Update Auth for that URL

Make a POST request to `{registry_url}/api/token` with the refresh token

```python
response = requests.post(
    "%s/api/token" % get_registry_url(),
    timeout=timeout,
    data=dict(
        refresh_token=refresh_token,
    )
)
```

This should return a JSON object with at least these three fields:

```python
return dict(
    refresh_token=data['refresh_token'],
    access_token=data['access_token'],
    expires_at=data['expires_at']
)
```

## 5. Cache that Auth

The `access_token` is used to retrieve credentials,
and the `refresh_token` will be used to get new `auth` tokens when the
`access_token` expires.

`quilt3` stores them in `user_data_dir(APP_NAME, APP_AUTHOR)`, e.g.
`~/Library/Application\ Support/Quilt` on macOS, so they are available across
invocations of the CLI or API.

## 6. (Re)Create a Session

Clear the old session (if any) and call `refresh_credentials()` to create a new
one. This calls GET on `{registry_url}/api/auth/get_credentials` with the
`access_token` to get the credentials.

```python
def _refresh_credentials():
    session = get_session()
    creds = session.get(
        "{url}/api/auth/get_credentials".format(
            url=get_registry_url()
        )
    ).json()
```

Those credentials and the session token are saved:

```python
    result = {
        'access_key': creds['AccessKeyId'],
        'secret_key': creds['SecretAccessKey'],
        'token': creds['SessionToken'],
        'expiry_time': creds['Expiration']
    }
    _save_credentials(result)
    return result
```

From there `_load_credentials()` will use them to create a `boto3.Session` when
needed.

## Appendix: FAQ

*Using [Greptile](https://app.greptile.com/chat/d7e845f4-56fb-490a-bfda-6a7ee16dc159)*

### 1. _load_credentials

> Is _load_credentials used for AWS credentials, or only for credentials from
quilt3.login

Based on the code and context provided, _load_credentials is used specifically
for credentials obtained through quilt3.login, not directly for AWS credentials.

Here's why:

The _load_credentials function loads credentials from a Quilt-specific path

### 2. _refresh_credentials

> When and why is _refresh_credentials called?

Based on the code, _refresh_credentials() is called in two main scenarios:

1. During login_with_token() (above)

2. As a refresh callback for AWS credentials through the QuiltProvider class:

```python
def load(self):
    creds = RefreshableCredentials.create_from_metadata(
        metadata=self._credentials,
        method=self.METHOD,
        refresh_using=_refresh_credentials,
    )
```

The purpose of _refresh_credentials() is to:

- Get fresh AWS credentials from the Quilt registry by making a request to /api/auth/get_credentials
- Save these credentials locally in a standardized format

### 3. QuiltProvider

> How does QuiltProvider support a refresh callback for AWS credentials?

Based on the code, the QuiltProvider class supports a refresh callback for AWS
credentials through these key components:

It inherits from `botocore.credentials.CredentialProvider` and implements the
refresh mechanism through RefreshableCredentials:

```python
class QuiltProvider(CredentialProvider):
    METHOD = 'quilt-registry'
    CANONICAL_NAME = 'QuiltRegistry'

    def load(self):
        creds = RefreshableCredentials.create_from_metadata(
            metadata=self._credentials,
            method=self.METHOD,
            refresh_using=_refresh_credentials,
        )
        return creds
```

The key part is passing `_refresh_credentials` as the refresh_using parameter to
`RefreshableCredentials.create_from_metadata()`. This function will be called
whenever the credentials need to be refreshed.

### 4. Rust Implementation

> Does `aws-sdk-rust` have a Rust equivalent of `botocore.credentials.CredentialProvider`

[aws-config](https://crates.io/crates/aws-config) is a Rust crate that provides
a similar functionality to `botocore.credentials.CredentialProvider`. It allows
you to load AWS credentials from various sources, including environment
variables, shared credentials file, and AWS config file.

> How would I implement quilt3.login (as described above) in quilt-rs?

Based on the provided code and requirements, here's how I would implement
`quilt3.login` in Rust:

1. First, create a new module [auth.rs](./auth.rs) to handle authentication.
2. Then modify the existing [client.rs](./client.rs) to use these credentials:
3. Add a CLI command in [src/cli/model.rs](./cli-model.rs) to handle the login
   process.
4. Add dependencies to [Cargo.toml](./Cargo.toml) for handling HTTP requests and
   JSON parsing.

This implementation:

1. Verifies the registry URL exists
2. Opens a browser for the user to get their refresh token
3. Prompts for and collects the refresh token
4. Exchanges the refresh token for auth tokens via POST request
5. Caches the tokens in the user's data directory
6. Gets initial AWS credentials using the access token
7. Saves those credentials for future use

The credentials can then be used to create authenticated S3 clients when needed.

Key differences from the Python implementation:

1. Uses Rust's async/await for asynchronous operations
2. Leverages Rust's type system for better safety
3. Uses the aws-sdk-rust crate instead of boto3
4. Implements proper error handling using Rust's Result type
