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

## Installation

```bash
cd api/python
uv sync --python 3.11 --no-dev --extra catalog
source .venv/bin/activate
```

## One-shot LOCAL test setup

To prepare the full LOCAL catalog filesystem test state in one command:

```bash
cd quilt/api/python
uvx --from poethepoet poe catalog-test
```

That task:

```text
- refreshes api/python catalog dependencies
- runs catalog npm install
- rewrites catalog/static-dev/config.js for LOCAL mode
- resets /tmp/quilt-local-data/demo-bucket
- stages the curated preview fixtures, including dog_watermark.pdf
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
	uv run --no-dev --extra catalog quilt3 catalog --host localhost --port 3000 --no-browser
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
cd quilt
ss -ltnp | grep -E ':(3000|3001)\b' || true
```

Stop the usual LOCAL development processes by command pattern:

```bash
pkill -f 'webpack serve --config internals/webpack/webpack.dev.js' || true
pkill -f 'quilt3 catalog --host localhost --port 3000' || true
```

Verify the ports are clear, then restart Node and Python:

```bash
ss -ltnp | grep -E ':(3000|3001)\b' || true
cd catalog
PORT=3001 npm start
```

```bash
cd quilt/api/python
PYTHONPATH=$PWD \
QUILT_LOCAL_OBJECT_BACKEND=filesystem \
QUILT_LOCAL_DATA_DIR=/tmp/quilt-local-data \
QUILT_CATALOG_URL=http://localhost:3001 \
	uv run --python 3.11 --no-dev --extra catalog quilt3 catalog --host localhost --port 3000 --no-browser
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
		uv run --python 3.11 --no-dev --extra catalog quilt3 catalog --host localhost --port 3000 --no-browser
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

## Capability Checklist

The current LOCAL stack is good enough for a best-effort product demo, but only
for a specific subset of Catalog behavior.

What is ready for a local demo today:

```text
- source-tree frontend changes through webpack on port 3001
- LOCAL backend routing on port 3000
- package and file reads from either real S3 or the filesystem backend
- same-origin object fetches through /__s3proxy
- discovered filesystem buckets on the landing page and bucket tabs
- bucket Overview stats, sample objects, and text previews in filesystem LOCAL mode
- bucket Packages search/listing backed by a minimal LOCAL search implementation
- package tree browsing for filesystem-backed package revisions
- the always-on license subscription query is suppressed in LOCAL mode to reduce demo noise
```

What is not production-faithful yet:

```text
- LOCAL GraphQL does not implement the full production query surface
- LOCAL search is intentionally minimal and is implemented only deeply enough for
	bucket Overview, Workflows, and Packages flows
- filesystem mode is a storage mock, not a full AWS service mock
- the LOCAL lambda path runs the thumbnail/preview handlers in-process, not in an
	isolated Lambda runtime with real timeout, memory, or cold-start behavior
- write, upload, and mutation-heavy flows are still incomplete in LOCAL mode
```

What blocks a full local replacement for the production Catalog API:

```text
- missing GraphQL resolvers for search, subscription, and several mutation flows
- no endpoint-override path yet for a full S3-compatible backend such as LocalStack or MinIO
- no local equivalent of production auth, IAM, or STS behavior beyond the narrow LOCAL shim
- no realistic emulation of Lambda resource ceilings for heavy preview and conversion workloads
```

## Current Limits

The setup above is useful for frontend development, but it is still not a full
production-equivalent local stack.

What works today:

```text
- LOCAL config and routing through http://localhost:3000
- Webpack hot reload on port 3001
- GraphQL read paths implemented by quilt3_local, including status, bucketConfigs,
	package reads, and the minimal search surface used by bucket Overview/Packages pages
- LOCAL object URLs routed through /__s3proxy instead of browser-side S3 presigning
- Read-oriented package browsing and preview flows against either real S3 or the
	filesystem backend
```

What still depends on real AWS when `QUILT_LOCAL_OBJECT_BACKEND=aws`:

```text
- /__reg/api/auth/get_credentials uses boto3 STS or your current session creds
- object reads ultimately come from S3 using your active AWS credentials
```

What is still incomplete in filesystem mode:

```text
- GraphQL write mutations and package construction flows are still not implemented
- the local proxy supports direct object reads and simple PUTs, but not the full
	upload lifecycle used by production Catalog flows
- this mode is aimed at local browsing and preview validation, not full multi-user
	Catalog behavior
```

What is currently incomplete in LOCAL GraphQL:

```text
- Queries work for the LOCAL subset
- The schema includes many shared mutations from the main Catalog schema
- Mutations such as bucketAdd are present in schema but currently fail at execution
	in LOCAL mode because the corresponding resolvers are not implemented there
```

In practice, LOCAL mode is now best treated as a read-oriented development
environment with either:

```text
- real AWS objects, or
- a filesystem-backed local object store for browsing and preview validation
```

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
