<!--pytest-codeblocks:skipfile-->
<!-- markdownlint-disable -->

You can securely and privately run the Quilt catalog in "single-player
mode" on your machine. `quilt3 catalog` launches a Python webserver
and local services.

There are now two supported object backends for LOCAL mode:

```text
- aws: the default; uses your active AWS credentials and real S3 objects
- filesystem: reads objects and package metadata from a local directory tree
```

Both modes keep the Catalog UI and backend local to your machine.

For more details about configuring and using AWS credentials in `boto3`,
see the [AWS documentation](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html).

## Prerequisites

```bash
cd catalog
npm install
```

The recommended LOCAL helpers use isolated `uv run` invocations, so they do not
mutate `api/python/.venv`.

## Quick start

To launch a browseable LOCAL catalog (filesystem backend, demo data staged) in
one command:

```bash
cd quilt/api/python
uv run poe catalog          # serves http://127.0.0.1:3000/b/demo-bucket
uv run poe catalog --port 8080   # extra args pass through
```

This serves the built catalog bundle from `catalog/build` (run `cd catalog && npm run build`
first if it is missing) and spawns the preview/thumbnail/tabular-preview/transcode
lambdas as subprocesses. Probe a running instance with `uv run poe catalog-health`.

Use the frontend proxy mode below instead when you are editing `catalog/` source
and want webpack hot-reload.

## One-shot LOCAL test setup

To prepare the full LOCAL catalog filesystem test state in one command:

```bash
cd quilt/api/python
uv run poe catalog-test
```

That task:

```text
- resolves api/python catalog dependencies in isolated envs
- runs catalog npm install
- rewrites catalog/static-dev/config.js for LOCAL mode
- resets /tmp/quilt-local-data/demo-bucket
- stages the curated preview fixtures, including dog_watermark.pdf
```

To run just the LOCAL backend test suite with the dedicated local-catalog test group:

```bash
cd quilt/api/python
uv run --python 3.11 --no-default-groups --group local-catalog-test --extra catalog pytest tests/test_local_mode.py
```

## Frontend Proxy Mode

If you are changing source files under `catalog/`, run the local Catalog backend
in front of the webpack dev server so the UI uses the real LOCAL-mode backend
routes while still hot-reloading your frontend changes.

Current behavior in this repo:

```text
- the Node webpack dev server should be the only process bound to port 3001
- the Python LOCAL backend should be the only process bound to port 3000
- `PYTHONPATH=$PWD` makes the repo-local `api/python/quilt3_local/` package override the published `quilt3_local` package during development
- the browser should talk to the Python app on port 3000; that app serves LOCAL backend routes directly and proxies static assets to webpack on port 3001
```

First, point `catalog/static-dev/config.js` at the LOCAL-mode prefixes served by
the Python app:

```js
window.QUILT_CATALOG_CONFIG = {
	region: 'us-east-1',
	registryUrl: '/__reg',
	alwaysRequiresAuth: false,
	apiGatewayEndpoint: '/__lambda',
	s3Proxy: '/__s3proxy',
	passwordAuth: 'DISABLED',
	ssoAuth: 'DISABLED',
	ssoProviders: '',
	stackVersion: 'local-dev',
	mode: 'LOCAL',
	mixpanelToken: '',
	serviceBucket: '',
	noDownload: false,
}
```

Then run the two processes in separate terminals:

```bash
cd quilt/catalog
PORT=3001 npm start
```

```bash
cd quilt/api/python
PYTHONPATH=$PWD \
QUILT_LOCAL_OBJECT_BACKEND=filesystem \
QUILT_LOCAL_DATA_DIR=/tmp/quilt-local-data \
QUILT_CATALOG_URL=http://localhost:3001 \
	uv run --isolated --python 3.11 --no-dev --extra catalog quilt3 catalog --host localhost --port 3000 --no-browser
```

Open `http://localhost:3000` in your browser. The Python app serves the LOCAL backend routes, and proxies static assets to webpack on port 3001.

```bash
xdg-open http://localhost:3000
```

`PYTHONPATH=$PWD` is required so the repo-local `api/python/quilt3_local/` implementation overrides the published `quilt3_local` package during local dev.

### Clean Restart

If you have been iterating on LOCAL mode for a while, it is easy to leave old
webpack or `quilt3 catalog` processes bound to the same ports. Before starting a
fresh LOCAL session, stop any overlapping services and confirm ports `3000` and
`3001` are free.

Inspect current listeners:

```bash
# Linux
ss -ltnp | grep -E ':(3000|3001)\b' || true
# macOS
lsof -iTCP:3000 -iTCP:3001 -sTCP:LISTEN 2>/dev/null || true
```

Stop the processes by PID from the output above:

```bash
kill <PID_FROM_PORT_3001>
kill <PID_FROM_PORT_3000>
```

Verify the ports are clear, then restart Node and Python:

```bash
# Linux
ss -ltnp | grep -E ':(3000|3001)\b' || true
# macOS
lsof -iTCP:3000 -iTCP:3001 -sTCP:LISTEN 2>/dev/null || true
cd catalog
PORT=3001 npm start
```

```bash
cd quilt/api/python
PYTHONPATH=$PWD \
QUILT_LOCAL_OBJECT_BACKEND=filesystem \
QUILT_LOCAL_DATA_DIR=/tmp/quilt-local-data \
QUILT_CATALOG_URL=http://localhost:3001 \
	uv run --isolated --python 3.11 --no-dev --extra catalog quilt3 catalog --host localhost --port 3000 --no-browser
```

## Filesystem Object Backend

Set `QUILT_LOCAL_OBJECT_BACKEND=filesystem` to bypass AWS for package and object reads. In this mode, LOCAL serves data from `QUILT_LOCAL_DATA_DIR`.

Expected layout:

```text
$QUILT_LOCAL_DATA_DIR/
	<bucket>/
		hello.txt
		.quilt/
			named_packages/
				<package>/
					latest
					1700000000
			packages/
				<64-hex-manifest-hash>
```

Notes:

```text
- regular objects live directly under $QUILT_LOCAL_DATA_DIR/<bucket>/...
- named package pointers are plain text files whose contents are a 64-character manifest hash
- manifest files live under .quilt/packages/<hash> as JSON-lines records in the same shape used by Quilt manifests
- file records should set logical_key, size, and physical_keys so the Catalog can browse and preview them
- if a local package name is stored without a namespace, LOCAL exposes it in the UI as local/<name> so existing Catalog package routes still work
```

Example launch command:

```bash
$ cd api/python
$ PYTHONPATH=$PWD \
		QUILT_LOCAL_OBJECT_BACKEND=filesystem \
		QUILT_LOCAL_DATA_DIR=/tmp/quilt-local-data \
		QUILT_CATALOG_URL=http://localhost:3001 \
		uv run --isolated --python 3.11 --no-dev --extra catalog quilt3 catalog --host localhost --port 3000 --no-browser
```

## Canonical Preview Fixtures

The repo already contains a small, checked-in preview fixture pack. Reuse that pack for LOCAL filesystem demos instead of creating a second set of sample binaries.

To stage the curated pack into a filesystem-backed LOCAL bucket:

```bash
cd api/python
python -m tests.preview_fixtures /tmp/quilt-local-data/demo-bucket
```

This copies the existing canonical samples into `/tmp/quilt-local-data/demo-bucket` from these source locations:

```text
- lambdas/preview/test/data for text, csv, tsv, vcf, ipynb, and parquet fixtures
- lambdas/tabular_preview/tests/data/simple for jsonl-focused tabular fixtures
- lambdas/shared/tests/data/fcs for FCS fixtures
- lambdas/thumbnail/tests/data for image, pdf, and pptx fixtures
- api/python/tests/data for extra local document fixtures such as dog_watermark.pdf
- catalog/app/components/JsonEditor/object-expand.webm for a tiny video fixture
```

That fixture registry lives in `api/python/tests/preview_fixtures.py`, and `api/python/tests/test_local_mode.py` reuses it for built-in LOCAL preview coverage. This keeps the local preview workflow aligned with the existing lambda test structure instead of duplicating assets.

In filesystem mode:

```text
- GraphQL package reads come from the local .quilt metadata tree
- each top-level directory under $QUILT_LOCAL_DATA_DIR appears in the Catalog as a browsable bucket
- object URLs are routed through /__s3proxy on the LOCAL backend
- object pages now emulate the S3 listObjectVersions call used by the UI, so version-history lookups do not hard-fail in LOCAL mode
- object tags now return an empty S3 TagSet XML document instead of raw file bytes, so the Object Tags panel does not fail on ordinary files
- downloads and preview fetches use the same local object proxy path
- filesystem buckets expose default LOCAL-only bucket files when they are missing: README.md, quilt_summarize.json, .quilt/workflows/config.yml, .quilt/catalog/config.yml, and .quilt/queries/config.yaml
- real files override those defaults immediately, and the conventional config paths are resolved case-insensitively so README / config case variants still work during local testing
```

## Current Scope

LOCAL mode is a **read-oriented development environment** useful for frontend
iteration, preview validation, and product demos. It is not a full
production-equivalent local stack.

### What works

| Capability | Notes |
|------------|-------|
| Frontend hot reload | webpack dev server on port 3001, proxied through port 3000 |
| LOCAL backend routing | `/__reg`, `/__lambda`, `/__s3proxy` on port 3000 |
| Package and file reads | real S3 **or** filesystem backend |
| Filesystem bucket discovery | each dir under `$QUILT_LOCAL_DATA_DIR` appears as a bucket |
| Bucket Overview / Packages | stats, sample objects, text previews, search/listing |
| Package tree browsing | filesystem-backed revisions with namespace resolution |
| Object previews | thumbnail, tabular, text, and static notebook previews via lambda subprocesses; interactive Voila dashboards are supported when the opt-in `local-voila` extra is installed (see below) |
| Subscription suppression | license/admin queries paused in LOCAL mode |

### What requires real AWS (`QUILT_LOCAL_OBJECT_BACKEND=aws`)

- `/__reg/api/auth/get_credentials` uses boto3 STS or your active session
- Object reads come from S3 using your current AWS credentials

### What is incomplete

- GraphQL covers only the read subset; mutations like `bucketAdd` are in the
  schema but their resolvers are not implemented
- LOCAL search is intentionally minimal — only deep enough for bucket Overview,
  Workflows, and Packages flows
- Filesystem mode is a storage mock, not a full AWS service mock
- Lambda subprocesses do not enforce real timeout, memory, or cold-start behavior
- Write, upload, and multi-user flows are still incomplete

### Interactive Voila dashboards (opt-in)

Interactive [Voila](https://github.com/voila-dashboards/voila) dashboards are
supported in LOCAL mode, but they are **opt-in and not installed by default**
because Voila pulls in a large transitive dependency tree (tornado, pyzmq,
ipykernel, jupyter-server). They are gated behind the `local-voila` extra plus
an explicit enable flag.

When enabled, the LOCAL backend launches a single persistent Voila server as a
managed subprocess and serves it through a dedicated `/__reg/voila` proxy that
speaks both **HTTP and WebSocket** (the live Jupyter kernel channels require
WebSockets, so this is a separate proxy from the HTTP-only `/__lambda` lambda
proxy). The proxy keeps the iframe same-origin under `/__reg/voila/`, matching
the catalog's `${registryUrl}/voila/...` contract. Each render request spawns
its own kernel with per-session environment: the catalog user's AWS credentials
and the `QUILT_PKG_*` variables are injected per render session. Just as in
deployed Voila stacks, `quilt3` inside the kernel reads objects from S3 directly
with those credentials — read-oriented and scoped by what the credentials permit
— rather than introducing a new storage path. (The browser-side `/__s3proxy`
CORS shim is not on the kernel's read path; an in-kernel boto3 client talks to S3
directly. LOCAL `filesystem` mode is a browser/registry storage mock and does not
provide an in-kernel object read path.)

To enable it, from `api/python`:

```bash
# install the catalog deps plus the opt-in Voila extra
uv sync --extra catalog --extra local-voila

# turn the feature on (strictly opt-in)
export QUILT_LOCAL_VOILA=1

# start the LOCAL backend on :3000 and the webpack dev server on :3001
# (same as the normal LOCAL workflow)
```

Behavior:

- With the extra installed and `QUILT_LOCAL_VOILA=1`, `GET /__reg/voila/` returns
  `200` once the managed Voila server is ready, and the catalog exposes the
  interactive Voila preview mode.
- Both halves of the gate are required: the backend mounts the Voila proxy only
  when `QUILT_LOCAL_VOILA=1` **and** the `local-voila` extra is importable in the
  backend's environment. With the flag unset, or with the extra not installed,
  `GET /__reg/voila/` gracefully returns `404` and the catalog hides Voila mode.

This is a developer preview and is not production-equivalent: the server is
loopback-only, runs without a token, and does not enforce production isolation,
quotas, or multi-tenant security.

## Toward a True Local AWS Mock

To support LocalStack, MinIO, or another local S3-compatible backend for the
remaining write and mutation flows, the LOCAL backend still needs explicit
endpoint override support.

Minimum backend changes:

```text
- add configurable S3 endpoint support in quilt3_local/aws.py for an S3-compatible backend
- add configurable STS behavior in quilt3_local/api.py, or bypass STS entirely
	when static local credentials are supplied
- teach quilt3_local/s3proxy.py to proxy write flows to the configured endpoint
- add the missing mutation resolvers needed by the frontend flows you want to test
```

See the [CLI API reference](../api-reference/cli.md#catalog) for details.
