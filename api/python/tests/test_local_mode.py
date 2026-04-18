import asyncio
import base64
import gzip
import importlib
import json
from contextlib import contextmanager
from io import BytesIO
from urllib.parse import quote, unquote, urlencode, urlparse

import pytest
from botocore.exceptions import ClientError
from graphql import graphql

from quilt3_local import buckets
from quilt3_local.context import QuiltContext
from tests.preview_fixtures import (
    CURATED_PREVIEW_FIXTURES,
    FIXTURES_BY_NAME,
    REPO_ROOT,
    stage_preview_fixtures,
)


class _MockHTTPResponse:
    def __init__(self, body: bytes, status_code: int = 200):
        self.content = body
        self.status_code = status_code
        self.reason = "OK" if status_code < 400 else "ERROR"

    @property
    def ok(self):
        return self.status_code < 400

    @property
    def text(self):
        return self.content.decode("utf-8", "ignore")

    def iter_content(self, chunk_size: int):
        for offset in range(0, len(self.content), chunk_size):
            yield self.content[offset : offset + chunk_size]


class _ASGIResponse:
    def __init__(self, status_code: int, headers: dict[str, str], body: bytes):
        self.status_code = status_code
        self.headers = headers
        self.body = body

    @property
    def decoded_body(self) -> bytes:
        if self.headers.get("content-encoding") == "gzip":
            return gzip.decompress(self.body)
        return self.body

    @property
    def text(self) -> str:
        return self.decoded_body.decode("utf-8", "ignore")

    def json(self):
        return json.loads(self.decoded_body)


def _make_lambda_event(name: str, query: dict[str, str]):
    return {
        "httpMethod": "POST",
        "path": f"/__lambda/{name}",
        "pathParameters": {},
        "queryStringParameters": query,
        "headers": {"origin": "http://localhost:3000"},
        "body": None,
        "isBase64Encoded": False,
    }


def _read_lambda_body(response: dict) -> bytes:
    body = response["body"]
    if response.get("isBase64Encoded"):
        data = base64.b64decode(body)
    elif isinstance(body, str):
        data = body.encode()
    else:
        data = body
    if response["headers"].get("Content-Encoding") == "gzip" and response["headers"].get("Content-Type") == "application/json":
        return gzip.decompress(data)
    return data


def _read_lambda_json(response: dict) -> dict:
    return json.loads(_read_lambda_body(response))


def _fixture_proxy_url(bucket: str, key: str, origin: str = "http://localhost:3000") -> str:
    return f"{origin}/__s3proxy/{bucket}/{quote(key, safe='/')}"


def _bucket_key_from_proxy_url(url: str, bucket: str) -> str:
    path = urlparse(url, allow_fragments=False).path
    prefix = f"/__s3proxy/{bucket}/"
    return unquote(path[len(prefix) :])


def _mock_requests_get_factory(bucket_root):
    def _get(url: str, stream: bool = False):
        del stream
        key = _bucket_key_from_proxy_url(url, "demo-bucket")
        return _MockHTTPResponse((bucket_root / key).read_bytes())

    return _get


def _mock_tabular_urlopen_factory(bucket_root):
    def _open(url: str, *, compression: str, seekable: bool = False):
        del compression
        del seekable
        key = _bucket_key_from_proxy_url(url, "demo-bucket")
        return BytesIO((bucket_root / key).read_bytes())

    return _open


def _write_demo_package(bucket_root):
    (bucket_root / "hello.txt").write_text("hello world\n")
    quilt_dir = bucket_root / ".quilt"
    (quilt_dir / "named_packages" / "demo").mkdir(parents=True)
    manifest_hash = "a" * 64
    (quilt_dir / "named_packages" / "demo" / "latest").write_text(manifest_hash)
    (quilt_dir / "packages").mkdir(parents=True)
    (quilt_dir / "packages" / manifest_hash).write_text(
        '{"message":"demo package","user_meta":{"source":"local-test"}}\n'
        '{"logical_key":"hello.txt","physical_key":"hello.txt","size":12,"meta":{}}\n'
    )
    return manifest_hash


def _reload_local_main(monkeypatch, data_dir, *, catalog_url: str | None = None):
    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(data_dir))
    monkeypatch.setenv("QUILT_LOCAL_ORIGIN", "http://testserver")
    monkeypatch.setenv("QUILT_CATALOG_BUNDLE", str(REPO_ROOT / "catalog" / "app"))
    if catalog_url is None:
        monkeypatch.delenv("QUILT_CATALOG_URL", raising=False)
    else:
        monkeypatch.setenv("QUILT_CATALOG_URL", catalog_url)

    import quilt3_local.main as local_main

    return importlib.reload(local_main)


@contextmanager
def _app_lifespan(app):
    manager = app.router.lifespan_context(app)
    asyncio.run(manager.__aenter__())
    try:
        yield
    finally:
        asyncio.run(manager.__aexit__(None, None, None))


def _request_app(app, method: str, path: str, *, params: dict[str, str] | None = None, headers: dict[str, str] | None = None, body: bytes | None = None, json_body=None) -> _ASGIResponse:
    if json_body is not None:
        body = json.dumps(json_body).encode()
        request_headers = {"content-type": "application/json", **(headers or {})}
    else:
        request_headers = headers or {}

    if body is None:
        body = b""

    query_string = urlencode(params or {}, doseq=True).encode()
    header_items = [(key.lower().encode(), value.encode()) for key, value in request_headers.items()]
    if body:
        header_items.append((b"content-length", str(len(body)).encode()))

    messages = []
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.disconnect"}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        messages.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": query_string,
        "headers": header_items,
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "root_path": "",
        "app": app,
    }

    asyncio.run(app(scope, receive, send))

    start = next(message for message in messages if message["type"] == "http.response.start")
    chunks = [message.get("body", b"") for message in messages if message["type"] == "http.response.body"]
    response_headers = {
        key.decode().lower(): value.decode()
        for key, value in start.get("headers", [])
    }
    return _ASGIResponse(start["status"], response_headers, b"".join(chunks))


def test_filesystem_bucket_configs_expose_local_bucket_dirs(monkeypatch, tmp_path):
    (tmp_path / "demo-bucket").mkdir()
    (tmp_path / "zeta-bucket").mkdir()
    (tmp_path / ".ignored").mkdir()
    (tmp_path / "not-a-bucket.txt").write_text("ignore me")

    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))

    with QuiltContext():
        configs = asyncio.run(buckets.list_bucket_configs())

    assert [cfg["name"] for cfg in configs] == ["demo-bucket", "zeta-bucket"]
    assert configs[0]["title"] == "demo-bucket"
    assert configs[0]["description"] == buckets.FILESYSTEM_BUCKET_DESCRIPTION
    assert configs[0]["tags"] == ["local"]
    assert configs[0]["relevanceScore"] == 100
    assert configs[0]["browsable"] is True
    assert configs[0]["prefixes"] == []


def test_filesystem_bucket_config_lookup_returns_none_for_missing_bucket(monkeypatch, tmp_path):
    (tmp_path / "demo-bucket").mkdir()

    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))

    with QuiltContext():
        existing = asyncio.run(buckets.get_bucket_config("demo-bucket"))
        missing = asyncio.run(buckets.get_bucket_config("missing-bucket"))

    assert existing is not None
    assert existing["name"] == "demo-bucket"
    assert missing is None


def test_filesystem_fetch_object_emulates_head_bucket_for_bucket_root(monkeypatch, tmp_path):
    (tmp_path / "demo-bucket").mkdir()

    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))

    from quilt3_local import aws
    from quilt3_local.context import QuiltContext

    with QuiltContext():
        response = asyncio.run(aws.fetch_object(Bucket="demo-bucket", Key="", Method="HEAD"))

    assert response["status"] == 200
    assert response["body"] == b""
    assert response["headers"]["x-amz-bucket-region"] == "us-east-1"


def test_filesystem_bucket_root_rejects_path_traversal(monkeypatch, tmp_path):
    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))

    from quilt3_local import aws

    with QuiltContext():
        try:
            asyncio.run(aws.bucket_exists("../escape"))
        except PermissionError as exc:
            assert "escapes data root" in str(exc)
        else:
            raise AssertionError("Expected PermissionError for bucket traversal")


def test_aws_bucket_exists_returns_false_for_missing_bucket(monkeypatch):
    monkeypatch.delenv("QUILT_LOCAL_OBJECT_BACKEND", raising=False)

    from quilt3_local import aws

    class MissingBucketClient:
        def head_bucket(self, *, Bucket):
            raise ClientError(
                {
                    "Error": {"Code": "404", "Message": "Not Found"},
                    "ResponseMetadata": {"HTTPStatusCode": 404},
                },
                "HeadBucket",
            )

    aws._sync_s3_client.cache_clear()
    monkeypatch.setattr(aws, "_sync_s3_client", lambda region=None: MissingBucketClient())

    with QuiltContext():
        assert asyncio.run(aws.bucket_exists("missing-bucket")) is False


def test_s3proxy_serializes_filesystem_bucket_list_as_s3_xml(monkeypatch, tmp_path):
    bucket = tmp_path / "demo-bucket"
    bucket.mkdir()
    (bucket / "hello.txt").write_text("hello")
    nested = bucket / "nested"
    nested.mkdir()
    (nested / "world.txt").write_text("world")

    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))

    from quilt3_local import aws
    from quilt3_local.s3proxy import _serialize_list_bucket_result

    result = asyncio.run(
        aws.list_objects_page(
            Bucket="demo-bucket",
            Prefix="",
            Delimiter="/",
            MaxKeys=1000,
        ),
    )
    xml = _serialize_list_bucket_result(result, "url").decode()

    assert "<ListBucketResult" in xml
    assert "<Key>hello.txt</Key>" in xml
    assert "<Prefix>nested/</Prefix>" in xml


def test_s3proxy_serializes_filesystem_object_versions_as_s3_xml(monkeypatch, tmp_path):
    bucket = tmp_path / "demo-bucket"
    bucket.mkdir()
    (bucket / "hello.txt").write_text("hello")

    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))

    from quilt3_local import aws
    from quilt3_local.s3proxy import _serialize_list_versions_result

    result = asyncio.run(
        aws.list_object_versions(
            Bucket="demo-bucket",
            Prefix="hello.txt",
            MaxKeys=1000,
        ),
    )
    xml = _serialize_list_versions_result(result, "url").decode()

    assert "<ListVersionsResult" in xml
    assert "<Key>hello.txt</Key>" in xml
    assert "<VersionId>null</VersionId>" in xml
    assert "<IsLatest>true</IsLatest>" in xml


def test_filesystem_conventional_defaults_are_available(monkeypatch, tmp_path):
    bucket = tmp_path / "demo-bucket"
    bucket.mkdir()

    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))

    from quilt3_local import aws

    with QuiltContext():
        readme = asyncio.run(aws.fetch_object(Bucket="demo-bucket", Key="README.md"))
        summarize = asyncio.run(aws.fetch_object(Bucket="demo-bucket", Key="quilt_summarize.json"))
        workflows = asyncio.run(
            aws.fetch_object(Bucket="demo-bucket", Key=".quilt/workflows/config.yml"),
        )
        workflow_schema = asyncio.run(
            aws.fetch_object(
                Bucket="demo-bucket",
                Key=".quilt/workflows/schemas/experiment-universal.json",
            ),
        )
        prefs = asyncio.run(
            aws.fetch_object(Bucket="demo-bucket", Key=".quilt/catalog/config.yml"),
        )
        queries = asyncio.run(
            aws.fetch_object(Bucket="demo-bucket", Key=".quilt/queries/config.yaml"),
        )
        listing = asyncio.run(
            aws.list_objects_page(
                Bucket="demo-bucket",
                Prefix="",
                Delimiter="/",
                MaxKeys=1000,
            ),
        )

    assert readme["status"] == 200
    assert "filesystem-backed LOCAL Quilt bucket" in readme["body"].decode()
    assert json.loads(summarize["body"]) == []
    assert b'default_workflow: "experiment"' in workflows["body"]
    assert b"experiment-universal" in workflows["body"]
    assert b"file://" in workflows["body"]
    assert workflow_schema["status"] == 200
    assert b'"type": "object"' in workflow_schema["body"]
    assert b"sourceBuckets" in prefs["body"]
    assert b"queries: {}" in queries["body"]
    assert any(item["Key"] == "README.md" for item in listing["Contents"])
    assert any(item["Key"] == "quilt_summarize.json" for item in listing["Contents"])
    assert {"Prefix": ".quilt/"} in listing["CommonPrefixes"]


def test_filesystem_default_summarize_expands_preview_fixtures(monkeypatch, tmp_path):
    bucket = tmp_path / "demo-bucket"
    bucket.mkdir()
    stage_preview_fixtures(bucket)

    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))

    from quilt3_local import aws

    with QuiltContext():
        summarize = asyncio.run(
            aws.fetch_object(Bucket="demo-bucket", Key="quilt_summarize.json"),
        )

    body = json.loads(summarize["body"])
    assert summarize["status"] == 200
    assert body[0] == [{"path": "preview/text/short.txt", "title": "short.txt", "expand": True}]
    assert any(
        item["path"] == "preview/documents/dog_watermark.pdf"
        for row in body
        for item in row
    )
    assert all(item["expand"] is True for row in body for item in row)


def test_filesystem_conventional_paths_are_case_insensitive(monkeypatch, tmp_path):
    bucket = tmp_path / "demo-bucket"
    bucket.mkdir()
    (bucket / "readme.md").write_text("custom readme")
    workflows_dir = bucket / ".QuIlT" / "Workflows"
    workflows_dir.mkdir(parents=True)
    (workflows_dir / "CONFIG.YAML").write_text('version: "1"\nworkflows: {}\n')
    prefs_dir = bucket / ".quilt" / "catalog"
    prefs_dir.mkdir(parents=True)
    (prefs_dir / "CONFIG.YAML").write_text("ui:\n  sourceBuckets:\n    demo-bucket: {}\n")

    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))

    from quilt3_local import aws

    with QuiltContext():
        readme = asyncio.run(aws.fetch_object(Bucket="demo-bucket", Key="README.md"))
        workflows = asyncio.run(
            aws.fetch_object(Bucket="demo-bucket", Key=".quilt/workflows/config.yml"),
        )
        prefs = asyncio.run(
            aws.fetch_object(Bucket="demo-bucket", Key=".quilt/catalog/config.yml"),
        )

    assert readme["body"] == b"custom readme"
    assert workflows["body"] == b'version: "1"\nworkflows: {}\n'
    assert prefs["body"] == b"ui:\n  sourceBuckets:\n    demo-bucket: {}\n"


def test_s3proxy_serializes_object_tags_as_s3_xml(monkeypatch, tmp_path):
    bucket = tmp_path / "demo-bucket"
    bucket.mkdir()
    (bucket / "hello.txt").write_text("hello")

    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))

    from quilt3_local import aws
    from quilt3_local.s3proxy import _serialize_object_tagging_result

    with QuiltContext():
        result = asyncio.run(aws.get_object_tagging(Bucket="demo-bucket", Key="hello.txt"))

    assert result is not None

    xml = _serialize_object_tagging_result(result).decode()

    assert "<Tagging" in xml
    assert "<TagSet" in xml


def test_local_graphql_search_and_api_search(monkeypatch, tmp_path):
    bucket = tmp_path / "demo-bucket"
    bucket.mkdir()
    manifest_hash = _write_demo_package(bucket)

    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))

    from quilt3_local import packages
    from quilt3_local.api import search_api
    from quilt3_local.graphql import schema

    query = """
    query Search($buckets: [String!]) {
        searchPackages(buckets: $buckets, latestOnly: true) {
            __typename
            ... on PackagesSearchResultSet {
                total
                firstPage(order: NEWEST) {
                    hits {
                        name
                        bucket
                        hash
                    }
                }
            }
        }
        package(bucket: "demo-bucket", name: "local/demo") {
            name
            revision(hashOrTag: "latest") {
                hash
                modified
            }
        }
        searchObjects(buckets: $buckets) {
            __typename
            ... on ObjectsSearchResultSet {
                total
                firstPage(order: NEWEST) {
                    hits {
                        key
                        bucket
                    }
                }
            }
        }
    }
    """

    with QuiltContext():
        result = asyncio.run(graphql(schema, query, variable_values={"buckets": ["demo-bucket"]}))
        stats = asyncio.run(search_api(index="demo-bucket", action="stats"))
        dir_ = asyncio.run(packages.get_dir("demo-bucket", manifest_hash, ""))
        file_ = asyncio.run(packages.get_file("demo-bucket", manifest_hash, "hello.txt"))

    assert result.errors is None
    assert result.data is not None
    assert result.data["searchPackages"]["__typename"] == "PackagesSearchResultSet"
    assert result.data["searchPackages"]["total"] == 1
    assert result.data["searchPackages"]["firstPage"]["hits"][0]["name"] == "local/demo"
    assert result.data["package"]["name"] == "local/demo"
    assert result.data["package"]["revision"]["hash"] == manifest_hash
    assert result.data["package"]["revision"]["modified"] is not None
    assert dir_.children[0].physical_key == "s3://demo-bucket/hello.txt"
    assert file_.physical_key == "s3://demo-bucket/hello.txt"
    assert result.data["searchObjects"]["__typename"] == "ObjectsSearchResultSet"
    assert result.data["searchObjects"]["total"] == 1
    assert result.data["searchObjects"]["firstPage"]["hits"][0]["key"] == "hello.txt"
    assert stats["hits"]["total"] == 1
    assert stats["aggregations"]["totalBytes"]["value"] == 12.0


def test_local_main_exposes_config_registry_and_graphql_routes(monkeypatch, tmp_path):
    bucket_root = tmp_path / "demo-bucket"
    bucket_root.mkdir()
    stage_preview_fixtures(bucket_root)
    manifest_hash = _write_demo_package(bucket_root)
    local_main = _reload_local_main(monkeypatch, tmp_path)

    with _app_lifespan(local_main.app):
        config = _request_app(local_main.app, "GET", "/config.json")
        creds = _request_app(local_main.app, "GET", "/__reg/api/auth/get_credentials")
        valid_name = _request_app(local_main.app, "POST", "/__reg/api/package_name_valid", json_body={"name": "local/demo"})
        invalid_name = _request_app(local_main.app, "POST", "/__reg/api/package_name_valid", json_body={"name": "bad name"})
        stats = _request_app(local_main.app, "GET", "/__reg/api/search", params={"index": "demo-bucket", "action": "stats"})
        sample = _request_app(local_main.app, "GET", "/__reg/api/search", params={"index": "demo-bucket", "action": "sample"})
        images = _request_app(local_main.app, "GET", "/__reg/api/search", params={"index": "demo-bucket", "action": "images"})
        unsupported = _request_app(local_main.app, "GET", "/__reg/api/search", params={"index": "demo-bucket", "action": "unsupported"})
        graphql_response = _request_app(
            local_main.app,
            "POST",
            "/__reg/graphql/",
            json_body={
                "query": """
                query Search($buckets: [String!]) {
                    searchPackages(buckets: $buckets, latestOnly: true) {
                        __typename
                        ... on PackagesSearchResultSet {
                            total
                            firstPage(order: NEWEST) {
                                hits {
                                    name
                                    bucket
                                    hash
                                }
                            }
                        }
                    }
                    searchObjects(buckets: $buckets) {
                        __typename
                        ... on ObjectsSearchResultSet {
                            total
                            firstPage(order: NEWEST) {
                                hits {
                                    key
                                }
                            }
                        }
                    }
                }
                """,
                "variables": {"buckets": ["demo-bucket"]},
            },
        )

    assert config.status_code == 200
    assert config.json()["mode"] == "LOCAL"
    assert config.json()["registryUrl"] == "/__reg"
    assert config.json()["apiGatewayEndpoint"] == "/__lambda"
    assert config.json()["s3Proxy"] == "/__s3proxy"
    assert creds.status_code == 200
    assert creds.json()["AccessKeyId"] == "LOCALMODEACCESSKEY"
    assert valid_name.json() == {"valid": True}
    assert invalid_name.json() == {"valid": False}
    assert stats.status_code == 200
    assert stats.json()["hits"]["total"] >= 2
    assert any(bucket["key"] == ".txt" for bucket in stats.json()["aggregations"]["exts"]["buckets"])
    sample_keys = [
        item["latest"]["hits"]["hits"][0]["_source"]["key"]
        for item in sample.json()["aggregations"]["objects"]["buckets"]
    ]
    assert "preview/text/short.txt" in sample_keys
    image_keys = [
        item["latest"]["hits"]["hits"][0]["_source"]["key"]
        for item in images.json()["aggregations"]["objects"]["buckets"]
    ]
    assert "preview/images/penguin.jpg" in image_keys
    assert unsupported.status_code == 404
    assert graphql_response.status_code == 200
    assert graphql_response.json()["data"]["searchPackages"]["__typename"] == "PackagesSearchResultSet"
    assert graphql_response.json()["data"]["searchPackages"]["firstPage"]["hits"][0]["name"] == "local/demo"
    assert graphql_response.json()["data"]["searchPackages"]["firstPage"]["hits"][0]["hash"] == manifest_hash
    assert graphql_response.json()["data"]["searchObjects"]["__typename"] == "ObjectsSearchResultSet"
    assert {
        hit["key"]
        for hit in graphql_response.json()["data"]["searchObjects"]["firstPage"]["hits"]
    } >= {"hello.txt", "preview/text/short.txt"}


def test_local_main_exposes_s3proxy_routes(monkeypatch, tmp_path):
    bucket_root = tmp_path / "demo-bucket"
    bucket_root.mkdir()
    stage_preview_fixtures(bucket_root)
    local_main = _reload_local_main(monkeypatch, tmp_path)

    with _app_lifespan(local_main.app):
        listing = _request_app(
            local_main.app,
            "GET",
            "/__s3proxy/us-east-1/demo-bucket",
            params={"list-type": "2", "prefix": "preview/", "delimiter": "/"},
        )
        legacy_get = _request_app(local_main.app, "GET", "/__s3proxy/us-east-1/demo-bucket/preview/text/short.txt")
        host_style_head = _request_app(local_main.app, "HEAD", "/__s3proxy/demo-bucket.s3.amazonaws.com/preview/text/short.txt")
        tagging = _request_app(local_main.app, "GET", "/__s3proxy/us-east-1/demo-bucket/preview/text/short.txt", params={"tagging": ""})
        preflight = _request_app(
            local_main.app,
            "OPTIONS",
            "/__s3proxy/us-east-1/demo-bucket/preview/text/short.txt",
            headers={
                "access-control-request-method": "GET",
                "access-control-request-headers": "range",
            },
        )

    assert listing.status_code == 200
    assert listing.headers["content-type"].startswith("application/xml")
    assert listing.headers["x-amz-bucket-region"] == "us-east-1"
    assert "<ListBucketResult" in listing.text
    assert "<Prefix>preview/</Prefix>" in listing.text
    assert legacy_get.status_code == 200
    assert legacy_get.text.startswith("Line 1")
    assert legacy_get.headers["access-control-allow-origin"] == "*"
    assert host_style_head.status_code == 200
    assert host_style_head.headers["x-amz-bucket-region"] == "us-east-1"
    assert tagging.status_code == 200
    assert "<Tagging" in tagging.text
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-methods"] == "GET"
    assert preflight.headers["access-control-allow-headers"] == "range"


def test_local_main_exposes_lambda_routes(monkeypatch, tmp_path):
    bucket_root = tmp_path / "demo-bucket"
    bucket_root.mkdir()
    stage_preview_fixtures(bucket_root)
    local_main = _reload_local_main(monkeypatch, tmp_path)

    from quilt3_local.lambdas import preview, tabular_preview

    monkeypatch.setattr(preview.requests, "get", _mock_requests_get_factory(bucket_root))
    monkeypatch.setattr(tabular_preview, "urlopen", _mock_tabular_urlopen_factory(bucket_root))

    with _app_lifespan(local_main.app):
        preview_response = _request_app(
            local_main.app,
            "POST",
            "/__lambda/preview",
            params={
                "url": _fixture_proxy_url("demo-bucket", FIXTURES_BY_NAME["text"].bucket_key, origin="http://testserver"),
                "input": "txt",
            },
        )
        tabular_response = _request_app(
            local_main.app,
            "POST",
            "/__lambda/tabular-preview",
            params={
                "url": _fixture_proxy_url("demo-bucket", FIXTURES_BY_NAME["jsonl"].bucket_key, origin="http://testserver"),
                "input": "jsonl",
            },
        )
        missing = _request_app(local_main.app, "POST", "/__lambda/not-a-real-lambda")

    assert preview_response.status_code == 200
    assert preview_response.json()["info"]["data"]["head"][0] == "Line 1"
    assert tabular_response.status_code == 200
    assert tabular_response.headers["content-type"].startswith("text/csv")
    assert tabular_response.headers["content-encoding"] == "gzip"
    assert missing.status_code == 404


def test_local_main_proxy_mode_exposes_webpack_hmr_stub(monkeypatch, tmp_path):
    asgiproxy_main = pytest.importorskip("asgiproxy.__main__", exc_type=ImportError)
    bucket_root = tmp_path / "demo-bucket"
    bucket_root.mkdir()
    context_closed = False

    class _DummyProxyContext:
        async def close(self):
            nonlocal context_closed
            context_closed = True

    async def _proxy_app(scope, receive, send):
        from starlette.responses import PlainTextResponse

        await PlainTextResponse("proxied")(scope, receive, send)

    monkeypatch.setattr(asgiproxy_main, "make_app", lambda upstream_base_url: (_proxy_app, _DummyProxyContext()))
    local_main = _reload_local_main(monkeypatch, tmp_path, catalog_url="http://localhost:3001")

    with _app_lifespan(local_main.app):
        hmr = _request_app(local_main.app, "GET", "/__webpack_hmr")
        proxied = _request_app(local_main.app, "GET", "/some/local/path")

    assert hmr.status_code == 404
    assert proxied.status_code == 200
    assert proxied.text == "proxied"
    assert context_closed is True


def test_local_text_preview_matches_frontend_contract():
    from quilt3_local.lambdas import preview

    html, info = preview.extract_txt(["hello local"])

    assert html == ""
    assert info == {
        "data": {"head": ["hello local"], "tail": []},
        "note": "Rows and columns truncated for preview. S3 object contains more data than shown.",
    }


def test_curated_preview_fixtures_stage_existing_repo_samples(tmp_path):
    bucket_root = tmp_path / "demo-bucket"

    staged = stage_preview_fixtures(bucket_root)

    assert len(staged) == len(CURATED_PREVIEW_FIXTURES)
    assert all(fixture.source.exists() for fixture in CURATED_PREVIEW_FIXTURES)
    assert all(path.exists() for path in staged)
    assert (bucket_root / FIXTURES_BY_NAME["video"].bucket_key).exists()
    assert (bucket_root / FIXTURES_BY_NAME["pdf"].bucket_key).exists()
    assert (bucket_root / FIXTURES_BY_NAME["dog_pdf"].bucket_key).exists()


@pytest.mark.parametrize(
    ("fixture_name", "query", "required_modules"),
    [
        ("text", {"input": "txt"}, ()),
        ("csv", {"input": "csv"}, ()),
        ("excel", {"input": "excel"}, ("openpyxl",)),
        ("ipynb", {"input": "ipynb"}, ("nbformat", "nbconvert")),
        ("parquet", {"input": "parquet"}, ()),
        ("vcf", {"input": "vcf"}, ()),
        ("fcs", {"input": "fcs"}, ("fcsparser",)),
    ],
)
def test_local_preview_lambda_reuses_curated_fixture_pack(monkeypatch, tmp_path, fixture_name, query, required_modules):
    for module in required_modules:
        pytest.importorskip(module, exc_type=ImportError)

    from quilt3_local.lambdas import preview

    bucket_root = tmp_path / "demo-bucket"
    stage_preview_fixtures(bucket_root)
    fixture = FIXTURES_BY_NAME[fixture_name]

    monkeypatch.setattr(preview.requests, "get", _mock_requests_get_factory(bucket_root))

    response = preview.lambda_handler(
        _make_lambda_event(
            "preview",
            {
                "url": _fixture_proxy_url("demo-bucket", fixture.bucket_key),
                **query,
            },
        ),
        None,
    )

    if fixture_name == "fcs" and response["statusCode"] != 200:
        pytest.skip("FCS preview fixture is blocked by the current fcsparser/NumPy runtime combination")

    body = _read_lambda_json(response)

    assert response["statusCode"] == 200
    if fixture_name == "text":
        assert body["info"]["data"]["head"][0] == "Line 1"
    elif fixture_name == "csv":
        assert "<table" in body["html"]
        assert body["info"]["note"] == "Rows and columns truncated for preview. S3 object contains more data than shown."
    elif fixture_name == "excel":
        assert "Canada" in body["html"]
        assert "Enterprise" in body["html"]
    elif fixture_name == "ipynb":
        assert "SVD of Minute-Market-Data" in body["html"]
    elif fixture_name == "parquet":
        assert body["info"]["schema"]["names"]
        assert "<table" in body["html"]
    elif fixture_name == "vcf":
        assert "<table" in body["html"]
        assert body["info"]["meta"]
        assert body["info"]["lines"]
    elif fixture_name == "fcs":
        assert body["info"]["metadata"]
        assert "<div>" in body["html"]


@pytest.mark.parametrize(
    ("fixture_name", "input_type", "expected_content_type"),
    [
        ("jsonl", "jsonl", "text/csv"),
        ("parquet", "parquet", "text/csv"),
    ],
)
def test_local_tabular_preview_lambda_reuses_curated_fixture_pack(monkeypatch, tmp_path, fixture_name, input_type, expected_content_type):
    from quilt3_local.lambdas import tabular_preview

    bucket_root = tmp_path / "demo-bucket"
    stage_preview_fixtures(bucket_root)
    fixture = FIXTURES_BY_NAME[fixture_name]

    monkeypatch.setattr(tabular_preview, "urlopen", _mock_tabular_urlopen_factory(bucket_root))

    response = tabular_preview.lambda_handler(
        _make_lambda_event(
            "tabular-preview",
            {
                "url": _fixture_proxy_url("demo-bucket", fixture.bucket_key),
                "input": input_type,
            },
        ),
        None,
    )

    assert response["statusCode"] == 200
    assert response["headers"]["Content-Type"] == expected_content_type
    assert response["headers"]["Content-Encoding"] == "gzip"
