import asyncio
import gzip
import importlib
import importlib.util
import json
import os
import sys
import types
from contextlib import contextmanager
from urllib.parse import urlencode

import pytest
from botocore.exceptions import ClientError
from graphql import graphql

from quilt3_local import buckets
from quilt3_local.context import QuiltContext
from tests.preview_fixtures import (
    CURATED_PREVIEW_FIXTURES,
    DEMO_PACKAGE_HASH,
    FIXTURES_BY_NAME,
    REPO_ROOT,
    stage_local_catalog_demo,
    stage_preview_fixtures,
)


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


def _request_app(
    app,
    method: str,
    path: str,
    *,
    params: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    json_body=None,
) -> _ASGIResponse:
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
    response_headers = {key.decode().lower(): value.decode() for key, value in start.get("headers", [])}
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


def test_local_proxy_url_accepts_loopback_aliases(monkeypatch):
    monkeypatch.setenv("QUILT_LOCAL_ORIGIN", "http://localhost:3000")

    from quilt3_local import settings

    assert settings.is_local_proxy_url("http://127.0.0.1:3000/__s3proxy/demo-bucket/object.txt")
    assert settings.is_local_proxy_url("http://localhost:3000/__s3proxy/demo-bucket/object.txt")
    assert not settings.is_local_proxy_url("http://127.0.0.1:4000/__s3proxy/demo-bucket/object.txt")
    assert not settings.is_local_proxy_url("http://example.com:3000/__s3proxy/demo-bucket/object.txt")


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
    assert b"s3://demo-bucket/" in workflows["body"]
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
    assert any(item["path"] == "preview/documents/dog_watermark.pdf" for row in body for item in row)
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
    # Voila is opt-in; with QUILT_LOCAL_VOILA unset the proxy is never mounted and
    # /__reg/voila/ must fall through to api.py's graceful-disable 404 stub.
    monkeypatch.delenv("QUILT_LOCAL_VOILA", raising=False)
    local_main = _reload_local_main(monkeypatch, tmp_path)
    _patch_lambda_lifespan(monkeypatch, local_main)

    with _app_lifespan(local_main.app):
        config = _request_app(local_main.app, "GET", "/config.json")
        creds = _request_app(local_main.app, "GET", "/__reg/api/auth/get_credentials")
        voila = _request_app(local_main.app, "GET", "/__reg/voila/")
        valid_name = _request_app(
            local_main.app, "POST", "/__reg/api/package_name_valid", json_body={"name": "local/demo"}
        )
        invalid_name = _request_app(
            local_main.app, "POST", "/__reg/api/package_name_valid", json_body={"name": "bad name"}
        )
        stats = _request_app(
            local_main.app, "GET", "/__reg/api/search", params={"index": "demo-bucket", "action": "stats"}
        )
        sample = _request_app(
            local_main.app, "GET", "/__reg/api/search", params={"index": "demo-bucket", "action": "sample"}
        )
        images = _request_app(
            local_main.app, "GET", "/__reg/api/search", params={"index": "demo-bucket", "action": "images"}
        )
        unsupported = _request_app(
            local_main.app, "GET", "/__reg/api/search", params={"index": "demo-bucket", "action": "unsupported"}
        )
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
    assert config.json()["region"] == "us-east-1"
    assert config.json()["registryUrl"] == "/__reg"
    assert config.json()["apiGatewayEndpoint"] == "/__lambda"
    assert config.json()["s3Proxy"] == "/__s3proxy"
    assert config.json()["stackVersion"] == "local-dev"
    assert creds.status_code == 200
    assert creds.json()["AccessKeyId"] == "LOCALMODEACCESSKEY"
    # Graceful-disable: extra absent / flag unset => proxy not mounted => api stub 404.
    assert voila.status_code == 404
    assert voila.json()["detail"] == (
        "Voila dashboards are not implemented in LOCAL mode; installing the Python package alone is insufficient."
    )
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
    assert {hit["key"] for hit in graphql_response.json()["data"]["searchObjects"]["firstPage"]["hits"]} >= {
        "hello.txt",
        "preview/text/short.txt",
    }


def test_local_main_serves_config_js(monkeypatch, tmp_path):
    # The catalog index.html loads /config.js synchronously to bootstrap
    # window.QUILT_CATALOG_CONFIG before the app starts; it must be served as JS
    # (not fall through to the SPA's HTML) and carry the same config as
    # /config.json.
    local_main = _reload_local_main(monkeypatch, tmp_path)
    _patch_lambda_lifespan(monkeypatch, local_main)

    with _app_lifespan(local_main.app):
        config_js = _request_app(local_main.app, "GET", "/config.js")
        config_json = _request_app(local_main.app, "GET", "/config.json")

    assert config_js.status_code == 200
    assert "javascript" in config_js.headers.get("content-type", "")
    body = config_js.text
    prefix = "window.QUILT_CATALOG_CONFIG = "
    assert body.startswith(prefix)
    # The JS payload is exactly the /config.json object assigned to the global.
    assert json.loads(body[len(prefix) :]) == config_json.json()


def test_local_main_exposes_s3proxy_routes(monkeypatch, tmp_path):
    bucket_root = tmp_path / "demo-bucket"
    bucket_root.mkdir()
    stage_preview_fixtures(bucket_root)
    local_main = _reload_local_main(monkeypatch, tmp_path)
    _patch_lambda_lifespan(monkeypatch, local_main)

    with _app_lifespan(local_main.app):
        listing = _request_app(
            local_main.app,
            "GET",
            "/__s3proxy/us-east-1/demo-bucket",
            params={"list-type": "2", "prefix": "preview/", "delimiter": "/"},
        )
        legacy_get = _request_app(local_main.app, "GET", "/__s3proxy/us-east-1/demo-bucket/preview/text/short.txt")
        host_style_head = _request_app(
            local_main.app, "HEAD", "/__s3proxy/demo-bucket.s3.amazonaws.com/preview/text/short.txt"
        )
        tagging = _request_app(
            local_main.app, "GET", "/__s3proxy/us-east-1/demo-bucket/preview/text/short.txt", params={"tagging": ""}
        )
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


def _patch_lambda_lifespan(monkeypatch, local_main):
    """Replace the real lambda subprocess lifespan with a no-op mock for unit tests."""
    from contextlib import asynccontextmanager
    from unittest.mock import MagicMock

    from quilt3_local.lambda_subprocess import LambdaManager
    from quilt3_local.lambdas import lambdas

    mock_manager = MagicMock(spec=LambdaManager)
    mock_manager.get_port.return_value = None

    @asynccontextmanager
    async def _mock_lifespan(_app):
        _app.state.lambda_manager = mock_manager
        lambdas.state.lambda_manager = mock_manager
        try:
            yield
        finally:
            if hasattr(local_main, "proxy_context") and local_main.proxy_context is not None:
                await local_main.proxy_context.close()

    local_main.app.router.lifespan_context = _mock_lifespan
    return mock_manager


def test_local_main_exposes_lambda_routes(monkeypatch, tmp_path):
    """Test that the lambda proxy routes requests to subprocess ports and handles missing lambdas."""
    bucket_root = tmp_path / "demo-bucket"
    bucket_root.mkdir()
    stage_preview_fixtures(bucket_root)
    local_main = _reload_local_main(monkeypatch, tmp_path)
    _patch_lambda_lifespan(monkeypatch, local_main)

    with _app_lifespan(local_main.app):
        missing = _request_app(local_main.app, "POST", "/__lambda/not-a-real-lambda")

    assert missing.status_code == 503


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
    _patch_lambda_lifespan(monkeypatch, local_main)

    with _app_lifespan(local_main.app):
        hmr = _request_app(local_main.app, "GET", "/__webpack_hmr")
        proxied = _request_app(local_main.app, "GET", "/some/local/path")

    assert hmr.status_code == 404
    assert proxied.status_code == 200
    assert proxied.text == "proxied"
    assert context_closed is True


def test_local_text_preview_matches_frontend_contract():
    """Verify the real preview lambda's text extraction matches the expected frontend contract."""
    t4_preview = pytest.importorskip("t4_lambda_preview", exc_type=ImportError)

    html, info = t4_preview.extract_txt(["hello local"], b"hello local")

    assert html == ""
    assert info["data"]["head"] == ["hello local"]
    assert info["data"]["tail"] == []


def test_curated_preview_fixtures_stage_existing_repo_samples(tmp_path):
    bucket_root = tmp_path / "demo-bucket"

    staged = stage_preview_fixtures(bucket_root)

    assert len(staged) == len(CURATED_PREVIEW_FIXTURES)
    assert all(fixture.source.exists() for fixture in CURATED_PREVIEW_FIXTURES)
    assert all(path.exists() for path in staged)
    assert (bucket_root / FIXTURES_BY_NAME["video"].bucket_key).exists()
    assert (bucket_root / FIXTURES_BY_NAME["pdf"].bucket_key).exists()
    assert (bucket_root / FIXTURES_BY_NAME["dog_pdf"].bucket_key).exists()


def test_stage_local_catalog_demo_writes_package_metadata(tmp_path):
    bucket_root = tmp_path / "demo-bucket"

    staged, manifest_path = stage_local_catalog_demo(bucket_root)

    assert len(staged) == len(CURATED_PREVIEW_FIXTURES)
    assert manifest_path == bucket_root / ".quilt" / "packages" / DEMO_PACKAGE_HASH
    assert manifest_path.exists()
    assert (bucket_root / ".quilt" / "named_packages" / "demo" / "latest").read_text() == DEMO_PACKAGE_HASH


@pytest.mark.integration
@pytest.mark.parametrize(
    ("fixture_name", "query"),
    [
        ("text", {"input": "txt"}),
        ("csv", {"input": "csv"}),
        ("parquet", {"input": "parquet"}),
    ],
)
def test_preview_lambda_subprocess_serves_curated_fixtures(tmp_path, fixture_name, query):
    """
    Integration test: starts the preview lambda as a subprocess via lambda_runner.py
    and verifies it processes fixture files correctly via the local S3 proxy.

    Requires: uv on PATH, lambdas/preview/ dependencies resolved.
    """
    import subprocess
    from urllib.parse import quote

    import requests

    from quilt3_local.lambda_subprocess import detect_repo_root

    bucket_root = tmp_path / "demo-bucket"
    stage_preview_fixtures(bucket_root)
    fixture = FIXTURES_BY_NAME[fixture_name]

    # Start a simple file server to simulate the S3 proxy
    file_server_port = _start_file_server(bucket_root, tmp_path)
    file_url = f"http://127.0.0.1:{file_server_port}/{quote(fixture.bucket_key, safe='/')}"

    repo_root = detect_repo_root()
    runner_path = repo_root / "api" / "python" / "quilt3_local" / "lambda_runner.py"
    project_dir = repo_root / "lambdas" / "preview"

    proc = subprocess.Popen(
        [
            "uv",
            "run",
            "--project",
            str(project_dir),
            "python",
            str(runner_path),
            "--module",
            "t4_lambda_preview",
            "--port",
            "0",
            "--s3-proxy-origin",
            f"http://127.0.0.1:{file_server_port}",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        # Wait for ready signal
        line = proc.stdout.readline().decode().strip()
        assert line.startswith("LAMBDA_READY port="), f"Unexpected output: {line}"
        lambda_port = int(line.split("=", 1)[1])

        resp = requests.get(
            f"http://127.0.0.1:{lambda_port}/lambda",
            params={"url": file_url, **query},
            timeout=10,
        )

        assert resp.status_code == 200
        body = resp.json()

        if fixture_name == "text":
            assert body["info"]["data"]["head"][0] == "Line 1"
        elif fixture_name == "csv":
            assert "<table" in body["html"]
        elif fixture_name == "parquet":
            assert body["info"]["schema"]["names"]
            assert "<table" in body["html"]
    finally:
        proc.terminate()
        proc.wait(timeout=5)


@pytest.mark.integration
@pytest.mark.parametrize(
    ("fixture_name", "input_type", "expected_content_type"),
    [
        ("jsonl", "jsonl", "text/csv"),
        ("parquet", "parquet", "text/csv"),
    ],
)
def test_tabular_preview_lambda_subprocess_serves_curated_fixtures(
    tmp_path, fixture_name, input_type, expected_content_type
):
    """
    Integration test: starts the tabular-preview lambda as a subprocess via lambda_runner.py
    and verifies it processes fixture files correctly.

    Requires: uv on PATH, lambdas/tabular_preview/ dependencies resolved.
    """
    import subprocess
    from urllib.parse import quote

    import requests

    from quilt3_local.lambda_subprocess import detect_repo_root

    bucket_root = tmp_path / "demo-bucket"
    stage_preview_fixtures(bucket_root)
    fixture = FIXTURES_BY_NAME[fixture_name]

    file_server_port = _start_file_server(bucket_root, tmp_path)
    file_url = f"http://127.0.0.1:{file_server_port}/{quote(fixture.bucket_key, safe='/')}"

    repo_root = detect_repo_root()
    runner_path = repo_root / "api" / "python" / "quilt3_local" / "lambda_runner.py"
    project_dir = repo_root / "lambdas" / "tabular_preview"

    proc = subprocess.Popen(
        [
            "uv",
            "run",
            "--project",
            str(project_dir),
            "python",
            str(runner_path),
            "--module",
            "t4_lambda_tabular_preview",
            "--port",
            "0",
            "--s3-proxy-origin",
            f"http://127.0.0.1:{file_server_port}",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        line = proc.stdout.readline().decode().strip()
        assert line.startswith("LAMBDA_READY port="), f"Unexpected output: {line}"
        lambda_port = int(line.split("=", 1)[1])

        resp = requests.get(
            f"http://127.0.0.1:{lambda_port}/lambda",
            params={"url": file_url, "input": input_type, "size": "small"},
            timeout=10,
        )

        assert resp.status_code == 200
        assert expected_content_type in resp.headers["Content-Type"]
    finally:
        proc.terminate()
        proc.wait(timeout=5)


def _start_file_server(root_dir, tmp_path):
    """Start a background HTTP file server with Range request support."""
    import os
    from http.server import HTTPServer, SimpleHTTPRequestHandler
    from threading import Thread

    class _Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root_dir), **kwargs)

        def log_message(self, format, *args):
            pass  # Suppress logging in tests

        def do_GET(self):
            path = self.translate_path(self.path)
            if not os.path.isfile(path):
                super().do_GET()
                return

            range_header = self.headers.get("Range")
            if range_header is None:
                super().do_GET()
                return

            file_size = os.path.getsize(path)
            # Parse "bytes=START-END"
            range_spec = range_header.replace("bytes=", "")
            parts = range_spec.split("-")
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else file_size - 1
            end = min(end, file_size - 1)
            length = end - start + 1

            with open(path, "rb") as f:
                f.seek(start)
                data = f.read(length)

            self.send_response(206)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Length", str(length))
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            self.wfile.write(data)

        def do_HEAD(self):
            path = self.translate_path(self.path)
            if os.path.isfile(path):
                file_size = os.path.getsize(path)
                self.send_response(200)
                self.send_header("Content-Type", self.guess_type(path))
                self.send_header("Content-Length", str(file_size))
                self.send_header("Accept-Ranges", "bytes")
                self.end_headers()
            else:
                super().do_HEAD()

    server = HTTPServer(("127.0.0.1", 0), _Handler)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return port


# ---------------------------------------------------------------------------
# LOCAL-mode Voila coverage
#
# voila / jupyter_server are NOT in the test env (they live behind the opt-in
# "local-voila" extra), so the ENABLED-state tests below never launch real voila.
# Instead we stand up a lightweight aiohttp upstream that answers the same
# HTTP + WebSocket surface the dedicated proxy (voila_proxy.py) bridges to, and
# point a fake VoilaManager at it. The DISABLED-state path is exercised against
# the real wiring (proxy not mounted => api.py 404 stub).
# ---------------------------------------------------------------------------


def test_voila_enabled_flag_is_opt_in(monkeypatch):
    from quilt3_local import settings

    monkeypatch.delenv("QUILT_LOCAL_VOILA", raising=False)
    assert settings.voila_enabled() is False
    for truthy in ("1", "true", "TRUE", "Yes", " on "):
        monkeypatch.setenv("QUILT_LOCAL_VOILA", truthy)
        assert settings.voila_enabled() is True
    for falsy in ("", "0", "false", "no", "off", "maybe"):
        monkeypatch.setenv("QUILT_LOCAL_VOILA", falsy)
        assert settings.voila_enabled() is False


def test_voila_available_requires_flag_and_packages(monkeypatch):
    """voila_available() is False when the flag is off OR the packages are absent."""
    from quilt3_local import voila_subprocess

    # Flag off => short-circuit, never even probes for the packages.
    monkeypatch.delenv("QUILT_LOCAL_VOILA", raising=False)
    assert voila_subprocess.voila_available() is False

    # Flag on but the "local-voila" extra is not installed in the test env.
    monkeypatch.setenv("QUILT_LOCAL_VOILA", "1")
    # voila/jupyter_server genuinely absent here; assert the real probe agrees,
    # then assert the gate flips True only when find_spec reports both present.
    import importlib.util as _ilu

    real_find_spec = _ilu.find_spec

    def fake_find_spec(name, *args, **kwargs):
        if name in {"voila", "jupyter_server"}:
            return None
        return real_find_spec(name, *args, **kwargs)

    monkeypatch.setattr(voila_subprocess.importlib.util, "find_spec", fake_find_spec)
    assert voila_subprocess.voila_available() is False

    def present_find_spec(name, *args, **kwargs):
        if name in {"voila", "jupyter_server"}:
            return object()  # truthy non-None spec stand-in
        return real_find_spec(name, *args, **kwargs)

    monkeypatch.setattr(voila_subprocess.importlib.util, "find_spec", present_find_spec)
    assert voila_subprocess.voila_available() is True


def test_voila_translate_render_params_builds_kernel_env(monkeypatch, tmp_path):
    """pkg_* + credential params become QUILT_PKG_* / AWS_* layered on the LOCAL backend env."""
    monkeypatch.setenv("QUILT_LOCAL_OBJECT_BACKEND", "filesystem")
    monkeypatch.setenv("QUILT_LOCAL_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("QUILT_LOCAL_ORIGIN", "http://testserver")

    from quilt3_local.voila_subprocess import translate_render_params

    env = translate_render_params(
        {
            "pkg_bucket": "demo-bucket",
            "pkg_name": "local/demo",
            "pkg_top_hash": "a" * 64,
            "access_key": "AKIA-LOCAL",
            "secret_key": "secret-local",
            "session_token": "token-local",
            "url": "http://testserver/__s3proxy/demo-bucket/preview/notebooks/nb_1200727.ipynb",
        }
    )

    # Per-session credential + package env.
    assert env["QUILT_PKG_BUCKET"] == "demo-bucket"
    assert env["QUILT_PKG_NAME"] == "local/demo"
    assert env["QUILT_PKG_TOP_HASH"] == "a" * 64
    assert env["AWS_ACCESS_KEY_ID"] == "AKIA-LOCAL"
    assert env["AWS_SECRET_ACCESS_KEY"] == "secret-local"
    assert env["AWS_SESSION_TOKEN"] == "token-local"
    # Inherited LOCAL backend env so the kernel's quilt3 region/backend assumptions
    # match the LOCAL backend (the kernel reads S3 directly with these credentials).
    assert env["QUILT_LOCAL_OBJECT_BACKEND"] == "filesystem"
    assert env["QUILT_LOCAL_ORIGIN"] == "http://testserver"
    assert "QUILT_LOCAL_S3PROXY_ORIGIN" not in env
    assert env["QUILT_LOCAL_DATA_DIR"] == str(tmp_path)
    # The non-mapped "url" param is not promoted to env.
    assert "url" not in env


def test_voila_build_render_url_strips_credentials(tmp_path):
    """Credentials must never appear in the render URL (they go into kernel env)."""
    from quilt3_local.voila_subprocess import VoilaManager

    manager = VoilaManager(
        repo_root=tmp_path,
        notebook_dir=tmp_path,
        base_url="/__reg/voila/",
    )
    # Pretend the process is up on a known port without launching Voila.
    manager._process._process = type("P", (), {"returncode": None})()
    manager._process.port = 12345

    url = manager.build_render_url(
        {
            "pkg_bucket": "demo-bucket",
            "url": "http://testserver/__s3proxy/demo-bucket/nb.ipynb",
            "access_key": "AKIA-LOCAL",
            "secret_key": "secret-local",
            "session_token": "token-local",
        }
    )

    assert "AKIA-LOCAL" not in url
    assert "secret-local" not in url
    assert "token-local" not in url
    assert "access_key" not in url
    assert "secret_key" not in url
    assert "session_token" not in url
    # Non-credential params still flow through.
    assert "pkg_bucket=demo-bucket" in url
    assert url.startswith("http://127.0.0.1:12345/__reg/voila/voila/render/")


def test_voila_notebook_dir_honors_override_and_default(monkeypatch, tmp_path):
    from quilt3_local import settings

    override = tmp_path / "nb-staging"
    monkeypatch.setenv("QUILT_LOCAL_VOILA_DIR", str(override))
    resolved = settings.voila_notebook_dir()
    assert resolved == override.resolve()
    assert resolved.is_dir()  # created on demand

    monkeypatch.delenv("QUILT_LOCAL_VOILA_DIR", raising=False)
    default = settings.voila_notebook_dir()
    assert default.name == "quilt-local-voila"
    assert default.is_dir()


class _FakeUpstreamVoila:
    """A real aiohttp server that mimics the bits of voila the proxy bridges to.

    Runs in its own thread + event loop (the test driver uses asyncio.run per
    request on the main thread, so the upstream must own a separate loop).
    Records every HTTP request path/query and echoes WS frames so the test can
    assert the live interactive channel is reachable through the proxy.
    """

    def __init__(self):
        self.requests: list[tuple[str, str]] = []
        self._loop = None
        self._runner = None
        self._site = None
        self._thread = None
        self.port = None

    async def _handle_landing(self, request):
        from aiohttp import web

        self.requests.append((request.path, request.query_string))
        return web.Response(text="<html>voila landing</html>", content_type="text/html")

    async def _handle_render(self, request):
        from aiohttp import web

        self.requests.append((request.path, request.query_string))
        # Echo enough back that the test can confirm the query survived the hop.
        return web.json_response(
            {
                "rendered": True,
                "notebook": request.match_info.get("nb", ""),
                "query": dict(request.query),
            }
        )

    async def _handle_ws(self, request):
        from aiohttp import web

        self.requests.append((request.path, request.query_string))
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                await ws.send_str(f"echo:{msg.data}")
                await ws.close()
                break
        return ws

    def _run(self):
        import asyncio as _asyncio

        from aiohttp import web

        self._loop = _asyncio.new_event_loop()
        _asyncio.set_event_loop(self._loop)

        app = web.Application()
        app.router.add_get("/__reg/voila/", self._handle_landing)
        app.router.add_get("/__reg/voila/voila/render/{nb}", self._handle_render)
        app.router.add_get("/__reg/voila/api/kernels/{kid}/channels", self._handle_ws)

        self._runner = web.AppRunner(app)
        self._loop.run_until_complete(self._runner.setup())
        self._site = web.TCPSite(self._runner, "127.0.0.1", 0)
        self._loop.run_until_complete(self._site.start())
        self.port = self._site._server.sockets[0].getsockname()[1]
        self._ready.set()
        self._loop.run_forever()

    def start(self) -> int:
        import threading

        self._ready = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        assert self._ready.wait(timeout=10), "fake voila upstream failed to start"
        return self.port

    def stop(self):
        import asyncio as _asyncio

        if self._loop is None:
            return
        fut = _asyncio.run_coroutine_threadsafe(self._runner.cleanup(), self._loop)
        try:
            fut.result(timeout=5)
        except Exception:
            pass
        self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread is not None:
            self._thread.join(timeout=5)


class _FakeVoilaManager:
    """Stand-in for VoilaManager that points the proxy at a fake upstream port."""

    def __init__(self, port: int, *, ready: bool = True):
        self._port = port
        self._ready = ready

    def get_port(self):
        return self._port if self._ready else None

    def is_ready(self):
        return self._ready


def _reset_proxy_session(proxy_context):
    """Drop a ProxyContext's cached aiohttp session so it rebinds to the next loop.

    The test driver runs each ASGI call under its own asyncio.run loop; aiohttp
    sessions are loop-bound, so we reset the lazily-created session between the
    HTTP and WebSocket calls. Best-effort close of the stale session.
    """
    session = getattr(proxy_context, "_session", None)
    if session is not None:
        try:
            if not session.closed:
                # The owning loop is already closed; just detach without awaiting.
                session._connector = None
        except Exception:
            pass
    proxy_context._session = None


def _close_proxy_session(proxy_context):
    """Best-effort close of a ProxyContext's aiohttp session on a throwaway loop."""
    session = getattr(proxy_context, "_session", None)
    if session is None:
        return
    try:
        asyncio.run(session.close())
    except Exception:
        # Session may be bound to an already-closed loop; detach quietly.
        try:
            session._connector = None
        except Exception:
            pass
    proxy_context._session = None


def _ws_request_app(app, path: str, *, params: dict | None = None, send_text: str = "ping"):
    """Drive an ASGI websocket round-trip through `app`.

    Returns (accepted: bool, frames: list[str], close_code: int | None). Used to
    confirm the live interactive kernel channel is reachable through the proxy.
    """
    query_string = urlencode(params or {}, doseq=True).encode()
    sent: list[dict] = []
    # State machine for the client side: emit connect, then the text frame, then
    # WITHHOLD the disconnect until the upstream echo has been bridged back (or the
    # upstream closed). This avoids tearing down the bridge before the round-trip
    # completes, since the proxy runs both directions concurrently.
    state = {"phase": 0}
    got_reply = asyncio.Event()

    async def receive():
        if state["phase"] == 0:
            state["phase"] = 1
            return {"type": "websocket.connect"}
        if state["phase"] == 1:
            state["phase"] = 2
            return {"type": "websocket.receive", "text": send_text}
        # Phase 2+: wait until the proxy delivers a frame or closes the socket,
        # then disconnect so the bridge loop can wind down cleanly.
        try:
            await asyncio.wait_for(got_reply.wait(), timeout=10)
        except asyncio.TimeoutError:
            pass
        return {"type": "websocket.disconnect", "code": 1000}

    async def send(message):
        sent.append(message)
        if message["type"] in ("websocket.send", "websocket.close"):
            got_reply.set()

    scope = {
        "type": "websocket",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "scheme": "ws",
        "path": path,
        "raw_path": path.encode(),
        "query_string": query_string,
        "headers": [(b"host", b"testserver")],
        "subprotocols": [],
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "root_path": "",
        "app": app,
    }

    asyncio.run(app(scope, receive, send))

    accepted = any(m["type"] == "websocket.accept" for m in sent)
    frames = [m.get("text") for m in sent if m["type"] == "websocket.send" and m.get("text") is not None]
    close = next((m.get("code") for m in sent if m["type"] == "websocket.close"), None)
    return accepted, frames, close


def _render_query(nb_url: str) -> dict[str, str]:
    return {
        "url": nb_url,
        "access_key": "AKIA-LOCAL",
        "secret_key": "secret-local",
        "session_token": "token-local",
        "pkg_bucket": "demo-bucket",
        "pkg_name": "local/demo",
        "pkg_top_hash": "a" * 64,
    }


def _simulate_voila_installed(monkeypatch):
    """Pretend the opt-in ``local-voila`` extra is installed in this interpreter.

    main.py gates the proxy mount on ``voila_available()`` (the flag AND the
    package present). The test env does not install voila, so patch the import
    probe to report both packages present; the QUILT_LOCAL_VOILA flag still
    governs the opt-in half of the gate. Patch BEFORE _reload_local_main so the
    reloaded main.py's import-time mount block sees the patched probe.
    """
    real_find_spec = importlib.util.find_spec

    def fake_find_spec(name, *args, **kwargs):
        if name in {"voila", "jupyter_server"}:
            return object()  # truthy non-None spec stand-in
        return real_find_spec(name, *args, **kwargs)

    monkeypatch.setattr(importlib.util, "find_spec", fake_find_spec)


def test_voila_enabled_serves_health_render_and_channel(monkeypatch, tmp_path):
    """ENABLED state: health 200, render proxied (query preserved), WS channel live."""
    bucket_root = tmp_path / "demo-bucket"
    bucket_root.mkdir()
    # Reuse the curated ipynb fixture as the staged dashboard notebook.
    stage_preview_fixtures(bucket_root)
    ipynb = FIXTURES_BY_NAME["ipynb"]
    assert (bucket_root / ipynb.bucket_key).exists()

    upstream = _FakeUpstreamVoila()
    upstream_port = upstream.start()

    # Turn the opt-in flag ON and simulate the local-voila extra being installed
    # so main.py's voila_available() gate mounts the dedicated /__reg/voila proxy.
    monkeypatch.setenv("QUILT_LOCAL_VOILA", "1")
    monkeypatch.setenv("QUILT_LOCAL_VOILA_DIR", str(tmp_path / "voila-staging"))
    _simulate_voila_installed(monkeypatch)
    local_main = _reload_local_main(monkeypatch, tmp_path)
    _patch_lambda_lifespan(monkeypatch, local_main)

    try:
        with _app_lifespan(local_main.app):
            # main.py wires the proxy's get_manager to read app.state.voila_manager
            # lazily per request; swap in a fake pointed at the upstream we control
            # instead of launching real voila (absent in this env).
            local_main.app.state.voila_manager = _FakeVoilaManager(upstream_port, ready=True)

            health = _request_app(local_main.app, "GET", "/__reg/voila/")

            nb_url = "http://testserver/__s3proxy/demo-bucket/" + ipynb.bucket_key
            query = _render_query(nb_url)
            render = _request_app(
                local_main.app,
                "GET",
                "/__reg/voila/voila/render/nb_1200727.ipynb",
                params=query,
            )

            # The proxy's aiohttp session is created lazily and bound to whichever
            # event loop first used it (the render request's asyncio.run loop, now
            # closed). Each _request_app/_ws_request_app uses a fresh asyncio.run
            # loop, so drop the cached session before the WS round-trip to let the
            # ProxyContext rebuild it on the live loop.
            _reset_proxy_session(local_main.voila_proxy_context)
            accepted, frames, close = _ws_request_app(
                local_main.app,
                "/__reg/voila/api/kernels/k-123/channels",
                params={"session_id": "s-1"},
                send_text="hello-kernel",
            )
    finally:
        # Close the WS-loop-bound proxy session on a fresh loop to avoid leaking
        # an aiohttp ClientSession across the per-call asyncio.run loops.
        _close_proxy_session(local_main.voila_proxy_context)
        upstream.stop()

    # Health probe: catalog/app/utils/voila.ts treats resp.ok as availability.
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}

    # Render request is proxied to the live process with the full query preserved.
    assert render.status_code == 200
    rendered = render.json()
    assert rendered["rendered"] is True
    assert rendered["query"]["url"] == nb_url
    assert rendered["query"]["pkg_bucket"] == "demo-bucket"
    assert rendered["query"]["pkg_name"] == "local/demo"
    assert rendered["query"]["pkg_top_hash"] == "a" * 64
    assert rendered["query"]["access_key"] == "AKIA-LOCAL"
    assert rendered["query"]["secret_key"] == "secret-local"
    assert rendered["query"]["session_token"] == "token-local"

    # The proxy preserved the full /__reg/voila prefix on the way upstream so it
    # lines up with --Voila.base_url=/__reg/voila/. (The health probe is answered
    # by the shim itself and never reaches upstream, so it is not in this list.)
    upstream_paths = [path for path, _ in upstream.requests]
    assert "/__reg/voila/voila/render/nb_1200727.ipynb" in upstream_paths
    assert "/__reg/voila/api/kernels/k-123/channels" in upstream_paths

    # Live interactive channel reachable through the proxy (WS upgrade + echo).
    assert accepted is True
    assert frames == ["echo:hello-kernel"]
    assert close is None or close == 1000

    # Per-session kernel env is built from the render query params.
    from quilt3_local.voila_subprocess import translate_render_params

    session_env = translate_render_params(query)
    assert session_env["QUILT_PKG_BUCKET"] == "demo-bucket"
    assert session_env["QUILT_PKG_NAME"] == "local/demo"
    assert session_env["QUILT_PKG_TOP_HASH"] == "a" * 64
    assert session_env["AWS_ACCESS_KEY_ID"] == "AKIA-LOCAL"
    assert session_env["AWS_SECRET_ACCESS_KEY"] == "secret-local"
    assert session_env["AWS_SESSION_TOKEN"] == "token-local"
    # Inherited LOCAL backend knobs ride along into the kernel (the kernel reads
    # S3 directly with the injected session credentials, like deployed Voila).
    assert session_env["QUILT_LOCAL_OBJECT_BACKEND"] == "filesystem"
    assert session_env["QUILT_LOCAL_ORIGIN"] == "http://testserver"
    assert "QUILT_LOCAL_S3PROXY_ORIGIN" not in session_env


def test_voila_enabled_but_not_ready_returns_404_and_rejects_ws(monkeypatch, tmp_path):
    """ENABLED flag but manager not ready (e.g. voila still starting/crashed) => 404 + WS reject."""
    bucket_root = tmp_path / "demo-bucket"
    bucket_root.mkdir()
    stage_preview_fixtures(bucket_root)

    monkeypatch.setenv("QUILT_LOCAL_VOILA", "1")
    monkeypatch.setenv("QUILT_LOCAL_VOILA_DIR", str(tmp_path / "voila-staging"))
    _simulate_voila_installed(monkeypatch)
    local_main = _reload_local_main(monkeypatch, tmp_path)
    _patch_lambda_lifespan(monkeypatch, local_main)

    with _app_lifespan(local_main.app):
        # Manager present but not ready (get_port -> None, is_ready -> False).
        local_main.app.state.voila_manager = _FakeVoilaManager(0, ready=False)
        health = _request_app(local_main.app, "GET", "/__reg/voila/")
        render = _request_app(
            local_main.app,
            "GET",
            "/__reg/voila/voila/render/nb_1200727.ipynb",
            params=_render_query("http://testserver/x.ipynb"),
        )
        accepted, _frames, close = _ws_request_app(local_main.app, "/__reg/voila/api/kernels/k-1/channels")

    assert health.status_code == 404
    assert health.json()["detail"] == (
        "Voila dashboards are not implemented in LOCAL mode; installing the Python package alone is insufficient."
    )
    assert render.status_code == 404
    # WS upgrade is rejected (the proxy closes with 1011, never accepts).
    assert accepted is False
    assert close == 1011


def test_launch_local_catalog_defaults_origin_to_bound_port(monkeypatch):
    # The lambda URL-validation patch only accepts proxy URLs on QUILT_LOCAL_ORIGIN's
    # port, so a non-default --port must propagate into the origin or every preview
    # fails. Stub the heavy bits; we only care about the env side effect.
    import quilt3.main as quilt3_main

    monkeypatch.delenv("QUILT_LOCAL_ORIGIN", raising=False)
    monkeypatch.setitem(sys.modules, "uvicorn", types.SimpleNamespace(run=lambda *a, **k: None))
    monkeypatch.setitem(sys.modules, "quilt3_local.main", types.SimpleNamespace(app=object()))
    monkeypatch.setattr(quilt3_main._thread, "start_new_thread", lambda *a, **k: None)

    quilt3_main._launch_local_catalog(host="127.0.0.1", port=8123)
    assert os.environ["QUILT_LOCAL_ORIGIN"] == "http://127.0.0.1:8123"


def test_launch_local_catalog_respects_explicit_origin(monkeypatch):
    import quilt3.main as quilt3_main

    monkeypatch.setenv("QUILT_LOCAL_ORIGIN", "http://localhost:3000")
    monkeypatch.setitem(sys.modules, "uvicorn", types.SimpleNamespace(run=lambda *a, **k: None))
    monkeypatch.setitem(sys.modules, "quilt3_local.main", types.SimpleNamespace(app=object()))
    monkeypatch.setattr(quilt3_main._thread, "start_new_thread", lambda *a, **k: None)

    quilt3_main._launch_local_catalog(host="127.0.0.1", port=8123)
    assert os.environ["QUILT_LOCAL_ORIGIN"] == "http://localhost:3000"
