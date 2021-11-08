# Quilt Lite

Open source implementation of the Quilt registry that works in the local
environment (not requiring AWS cloud services).

## TL;DR

```shell
# set up venv, assuming poetry is available in the PATH
poetry install

# set up and build catalog
(cd ../catalog && npm i && npm run build)

# run the app at http://localhost:3000
poetry run uvicorn quilt_lite.main:app --reload --port 3000
```

## Set-up

### Python environment set-up

First, you need [`poetry` installed](https://python-poetry.org/docs/#installation).

Then, you have to set up the virtualenv by running `poetry install` from the
project directory -- it *should* install all the requirements
(consider removing `../api/python/quilt3.egg-info/` directory if dependndency
resolution doesn't work or takes too long -- it contains cached dependency list
(and other metadata) of the `quilt3` package which is being installed as a local
dependency).

### Catalog (node.js) environment set-up

Catalog supports `node` version `16` and `npm` versions `7` and `8`.

To install the dependencies simply run `npm i` from the catalog root directory
(`../catalog/`).

## Running

You can either serve a static catalog bundle (produced by `npm run build`) or
proxy static files from a running catalog instance.

### Serving a static catalog bundle

Run `poetry run uvicorn quilt_lite.main:app --reload --port 3000` to start the
app serving the static catalog bundle from the catalog directory in the same
repo (`../catalog/build/`). The path to the bundle can be overriden by
`CATALOG_BUNDLE` env var.

In order to serve the bundle, you should first build it by running
`npm run build` from the catalog directory. However, this approach is not very
convenient when developing catalog features, since it requires rebuilding the
bundle to pick up the changes. To address this there's a "proxy" mode available.

### Proxying a running catalog instance

In this mode the app proxies all the static files requests to a running catalog
instance. One can be started by executing `PORT=3001 npm start` from the catalog
directory (setting port to `3001` required to avoid conflicts with the
`quilt_lite` app).

After starting up a catalog instance, you can start the `quilt_lite` app and
point it to that instance by running
`CATALOG_URL=http://localhost:3001 poetry run uvicorn quilt_lite.main:app --reload --port 3000`
(the app will be available at `http://localhost:3000` and will serve static
files from the catalog running at `http://localhost:3001`, catalog instance URL
is configurable via `CATALOG_URL` env var).
