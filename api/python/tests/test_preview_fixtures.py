from __future__ import annotations

import hashlib
import io

from tests import preview_fixtures


class _FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()
        return False


def test_local_catalog_demo_fixtures_include_external_h5ad_by_default():
    fixtures = preview_fixtures.local_catalog_demo_fixtures()

    assert len(fixtures) == len(preview_fixtures.ALL_PREVIEW_FIXTURES)
    assert all(fixture in fixtures for fixture in preview_fixtures.EXTERNAL_H5AD_PREVIEW_FIXTURES)


def test_stage_preview_fixtures_caches_remote_downloads(monkeypatch, tmp_path):
    fixture_bytes = (preview_fixtures.REPO_ROOT / "api/python/tests/data/test.h5ad").read_bytes()
    fixture_hash = hashlib.sha256(fixture_bytes).hexdigest()
    cache_root = tmp_path / "fixture-cache"
    calls: list[str] = []

    def fake_urlopen(url: str):
        calls.append(url)
        return _FakeResponse(fixture_bytes)

    monkeypatch.setattr(preview_fixtures, "PREVIEW_FIXTURE_CACHE_ROOT", cache_root)
    monkeypatch.setattr(preview_fixtures.urllib.request, "urlopen", fake_urlopen)

    fixture = preview_fixtures.PreviewFixture(
        "h5ad_remote_probe",
        "structured",
        "preview/structured/h5ad/probe.h5ad",
        preview_fixtures.RemotePreviewSource(
            url="https://example.com/probe.h5ad",
            sha256=fixture_hash,
            cache_key="h5ad/example/probe.h5ad",
        ),
    )

    first_bucket = tmp_path / "bucket-one"
    first_staged = preview_fixtures.stage_preview_fixtures(first_bucket, fixtures=(fixture,))

    assert len(calls) == 1
    assert first_staged == [first_bucket / fixture.bucket_key]
    assert first_staged[0].read_bytes() == fixture_bytes
    assert (cache_root / "h5ad/example/probe.h5ad").read_bytes() == fixture_bytes

    def unexpected_urlopen(url: str):
        raise AssertionError(f"unexpected download for cached fixture: {url}")

    monkeypatch.setattr(preview_fixtures.urllib.request, "urlopen", unexpected_urlopen)

    second_bucket = tmp_path / "bucket-two"
    second_staged = preview_fixtures.stage_preview_fixtures(second_bucket, fixtures=(fixture,))

    assert second_staged == [second_bucket / fixture.bucket_key]
    assert second_staged[0].read_bytes() == fixture_bytes
