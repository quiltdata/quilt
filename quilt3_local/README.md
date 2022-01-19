# Quilt3 catalog: Local development mode

Open source implementation of the Quilt3 registry that works in the local
environment (not requiring AWS cloud services aside from S3 / S3 Select).

This package is not intended to be installed/used directly by end users.
Instead, install `quilt3[catalog]` and use `quilt3 catalog` CLI command.

## Developing

### TL;DR

```shell
# set up venv, assuming poetry is available in the PATH
poetry install

# build catalog bundle
(cd ../catalog && npm i && npm run build && cp -r build ../quilt3_local/quilt3_local/catalog_bundle)

# run the app at http://localhost:3000
poetry run quilt3-local
```

### Set-up

#### Python environment set-up

First, you need [`poetry` installed](https://python-poetry.org/docs/#installation).

Then, you have to set up the virtualenv by running `poetry install` from the
project directory -- it will create a virtualenv and install the requirements.

#### Catalog (node.js) environment set-up

Refer to the [catalog documentation](../catalog/).

### Running

You can either serve a static catalog bundle (produced by `npm run build`) or
proxy static files from a running catalog instance.

**NOTE**: you need valid AWS credentials available, see
[boto3 docs](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials) for details.

#### Serving a static catalog bundle

Run `poetry run quilt3-local` to start the app on port 3000 serving the static
catalog bundle from the `./quilt3_local/catalog_bundle` directory.
Path to the bundle can be overriden by `QUILT_CATALOG_BUNDLE` env var.
Port can be configured via `PORT` env var.

In order to serve the bundle, you should first build it by running
`npm run build` from the catalog directory and then either copying it to
`./quilt3_loca/catalog_bundle` or overriding `QUILT_CATALOG_BUNDLE` to point to
your bundle.
However, this approach is not very convenient when developing catalog features,
since it requires rebuilding the bundle to pick up the changes.
To address this there's a "proxy" mode available.

#### Proxying a running catalog instance

In this mode the app proxies all the static files requests to a running catalog
instance. One can be started by executing `PORT=3001 npm start` from the catalog
directory (setting port to `3001` required to avoid conflict with the `quilt3_local`
app's default settings).

After starting up a catalog instance, you can start the `quilt3_local` app and
point it to that instance by running
`QUILT_CATALOG_URL=http://localhost:3001 poetry run quilt3-local`
(the app will be available at `http://localhost:3000` and will serve static
files from the catalog running at `http://localhost:3001`, catalog URL
configurable via `QUILT_CATALOG_URL` env var).

### Building and publishing

1. Bump package version in `pyproject.toml`

2. Make sure you set up [credentials for `poetry`](https://python-poetry.org/docs/repositories/#configuring-credentials)

3. Build and publish the package: `poetry publish --build`
