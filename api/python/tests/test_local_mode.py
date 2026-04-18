import asyncio

from graphql import graphql

from quilt3_local import buckets
from quilt3_local.context import QuiltContext


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
    assert summarize["body"] == b"[]\n"
    assert b"workflows: {}" in workflows["body"]
    assert b"sourceBuckets" in prefs["body"]
    assert b"queries: {}" in queries["body"]
    assert any(item["Key"] == "README.md" for item in listing["Contents"])
    assert any(item["Key"] == "quilt_summarize.json" for item in listing["Contents"])
    assert {"Prefix": ".quilt/"} in listing["CommonPrefixes"]


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

    xml = _serialize_object_tagging_result(result).decode()

    assert "<Tagging" in xml
    assert "<TagSet" in xml


def test_local_graphql_search_and_api_search(monkeypatch, tmp_path):
        bucket = tmp_path / "demo-bucket"
        bucket.mkdir()
        (bucket / "hello.txt").write_text("hello world\n")
        quilt_dir = bucket / ".quilt"
        (quilt_dir / "named_packages" / "demo").mkdir(parents=True)
        manifest_hash = "a" * 64
        (quilt_dir / "named_packages" / "demo" / "latest").write_text(manifest_hash)
        (quilt_dir / "packages").mkdir(parents=True)
        (quilt_dir / "packages" / manifest_hash).write_text(
                '{"message":"demo package","user_meta":{"source":"local-test"}}\n'
                '{"logical_key":"hello.txt","physical_key":"hello.txt","size":12,"meta":{}}\n'
        )

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


def test_local_text_preview_matches_frontend_contract():
    from quilt3_local.lambdas import preview

    html, info = preview.extract_txt(["hello local"])

    assert html == ""
    assert info == {
        "data": {"head": ["hello local"], "tail": []},
        "note": "Rows and columns truncated for preview. S3 object contains more data than shown.",
    }
