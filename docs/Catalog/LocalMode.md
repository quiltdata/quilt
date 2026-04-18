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

## Frontend Proxy Mode

If you are changing source files under `catalog/`, run the local Catalog backend
in front of the webpack dev server so the UI uses the real LOCAL-mode backend
routes while still hot-reloading your frontend changes.

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
cd catalog
PORT=3001 npm start
```

```bash
cd api/python
PYTHONPATH=$PWD \
QUILT_CATALOG_URL=http://localhost:3001 \
	uv run --no-dev --extra catalog quilt3 catalog --host localhost --port 3000 --no-browser
```

Open `http://localhost:3000` in your browser. The Python app serves the LOCAL backend routes, and proxies static assets to webpack on port 3001.

`PYTHONPATH=$PWD` is required so the repo-local `api/python/quilt3_local/` implementation overrides the published `quilt3_local` package during local dev.

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

In filesystem mode:

```text
- GraphQL package reads come from the local .quilt metadata tree
- each top-level directory under $QUILT_LOCAL_DATA_DIR appears in the Catalog as a browsable bucket
- object URLs are routed through /__s3proxy on the LOCAL backend
- object pages now emulate the S3 listObjectVersions call used by the UI, so version-history lookups do not hard-fail in LOCAL mode
- downloads and preview fetches use the same local object proxy path
```

Expected LOCAL-mode console noise:

```text
- HEAD/GET probes for optional files such as README.md, README.txt, README.ipynb, quilt_summarize.json, and .quilt/workflows/config.yml still return 404 when those files do not exist
- those 404s are expected and are how the Catalog detects whether optional bucket-level content is present
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

Recommended next setup step before PDF work:

```text
1. Decide whether you want read-only testing against real AWS, or a full local
	 S3-compatible mock for read/write flows.
2. If you want full local mocking, add endpoint overrides to quilt3_local first.
3. Then choose a backend such as LocalStack or MinIO and point LOCAL mode at it.
4. After that, close the GraphQL gap for the specific Catalog flows you need.
```

See the [CLI API reference](../api-reference/cli.md#catalog) for details.
