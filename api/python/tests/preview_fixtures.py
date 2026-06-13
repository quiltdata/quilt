from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import urllib.request
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
PREVIEW_FIXTURE_CACHE_ROOT = REPO_ROOT / ".cache" / "preview-fixtures"


@dataclass(frozen=True)
class RemotePreviewSource:
    url: str
    sha256: str
    cache_key: str


@dataclass(frozen=True)
class PreviewFixture:
    name: str
    family: str
    bucket_key: str
    source: Path | RemotePreviewSource


CURATED_PREVIEW_FIXTURES = (
    PreviewFixture("text", "text", "preview/text/short.txt", REPO_ROOT / "lambdas/preview/test/data/short.txt"),
    PreviewFixture("csv", "tabular", "preview/tabular/sample.csv", REPO_ROOT / "lambdas/preview/test/data/sample.csv"),
    PreviewFixture(
        "tsv", "tabular", "preview/tabular/avengers.tsv", REPO_ROOT / "lambdas/preview/test/data/avengers.tsv"
    ),
    PreviewFixture(
        "excel", "tabular", "preview/tabular/sample.xlsx", REPO_ROOT / "lambdas/preview/test/data/sample.xlsx"
    ),
    PreviewFixture(
        "jsonl",
        "tabular",
        "preview/tabular/test.jsonl",
        REPO_ROOT / "lambdas/tabular_preview/tests/data/simple/test.jsonl",
    ),
    PreviewFixture(
        "parquet",
        "structured",
        "preview/structured/atlantic_storms.parquet",
        REPO_ROOT / "lambdas/preview/test/data/atlantic_storms.parquet",
    ),
    PreviewFixture(
        "vcf", "structured", "preview/structured/example.vcf", REPO_ROOT / "lambdas/preview/test/data/example.vcf"
    ),
    # AnnData single-cell matrix; previewed via the tabular-preview lambda (input=h5ad).
    PreviewFixture(
        "h5ad", "structured", "preview/structured/test.h5ad", REPO_ROOT / "api/python/tests/data/test.h5ad"
    ),
    PreviewFixture(
        "ipynb",
        "structured",
        "preview/notebooks/nb_1200727.ipynb",
        REPO_ROOT / "lambdas/preview/test/data/nb_1200727.ipynb",
    ),
    PreviewFixture(
        "fcs", "scientific", "preview/scientific/normal.fcs", REPO_ROOT / "lambdas/shared/tests/data/fcs/normal.fcs"
    ),
    # Flow-cytometry samples (tlnagy/fcsexamples), downsampled to ~5k events for
    # the repo; bd-facs-aria-ii-100k is the unmodified 100k-event original for a
    # realistic-scale gating preview. Channel/marker variety exercises the
    # multi-panel gating grid and $PnS marker labels.
    *(
        PreviewFixture(
            f"fcs_{name.replace('-', '_')}",
            "scientific",
            f"preview/scientific/fcs/{name}.fcs",
            REPO_ROOT / "api/python/tests/data/fcs_samples" / f"{name}.fcs",
        )
        for name in (
            "accuri-c6",
            "attune",
            "bd-facs-aria-ii",
            "beckman-cyan",
            "cytof-day3",
            "millipore-easycyte",
            "bd-facs-aria-ii-100k",
        )
    ),
    PreviewFixture(
        "image", "image", "preview/images/penguin.jpg", REPO_ROOT / "lambdas/thumbnail/tests/data/penguin.jpg"
    ),
    PreviewFixture(
        "pdf", "document", "preview/documents/MUMmer.pdf", REPO_ROOT / "lambdas/thumbnail/tests/data/MUMmer.pdf"
    ),
    PreviewFixture(
        "dog_pdf",
        "document",
        "preview/documents/dog_watermark.pdf",
        REPO_ROOT / "api/python/tests/data/dog_watermark.pdf",
    ),
    PreviewFixture(
        "pptx", "document", "preview/documents/in.pptx", REPO_ROOT / "lambdas/thumbnail/tests/data/pptx/in.pptx"
    ),
    PreviewFixture(
        "video",
        "media",
        "preview/media/object-expand.webm",
        REPO_ROOT / "catalog/app/components/JsonEditor/object-expand.webm",
    ),
)


EXTERNAL_H5AD_PREVIEW_FIXTURES = (
    PreviewFixture(
        "h5ad_tm_droplet",
        "structured",
        "preview/structured/h5ad/tm_droplet_mat.h5ad",
        RemotePreviewSource(
            url="https://raw.githubusercontent.com/scverse/scvi-tools/main/tests/test_data/TM_droplet_mat.h5ad",
            sha256="3bcf1085e6ba8001faf15b2f5d8021a63e4f4b125dc98a3421f16ca39621808f",
            cache_key="h5ad/scvi-tools/TM_droplet_mat.h5ad",
        ),
    ),
    PreviewFixture(
        "h5ad_brainlarge",
        "structured",
        "preview/structured/h5ad/brainlarge_dataset_test.h5ad",
        RemotePreviewSource(
            url="https://raw.githubusercontent.com/scverse/scvi-tools/main/tests/test_data/brainlarge_dataset_test.h5ad",
            sha256="ca417fac32678ced9734ad4aaff6863323b980ddc2a2dd5b782aba59f88e7d5b",
            cache_key="h5ad/scvi-tools/brainlarge_dataset_test.h5ad",
        ),
    ),
    PreviewFixture(
        "h5ad_squidpy_test",
        "structured",
        "preview/structured/h5ad/squidpy_test_data.h5ad",
        RemotePreviewSource(
            url="https://raw.githubusercontent.com/scverse/squidpy/main/tests/_data/test_data.h5ad",
            sha256="f0227d2639b803401afd65c432ac047c6f04710221dbdf7f3d70a18eff1a3766",
            cache_key="h5ad/squidpy/test_data.h5ad",
        ),
    ),
    PreviewFixture(
        "h5ad_scanpy_reduced",
        "structured",
        "preview/structured/h5ad/scanpy_pbmc68k_reduced.h5ad",
        RemotePreviewSource(
            url="https://raw.githubusercontent.com/scverse/scanpy/main/src/scanpy/datasets/10x_pbmc68k_reduced.h5ad",
            sha256="863e19914ab2d4ba97edc9623ac3a343c0461f1e40b121bfb5fa92638b22e9bd",
            cache_key="h5ad/scanpy/10x_pbmc68k_reduced.h5ad",
        ),
    ),
)


ALL_PREVIEW_FIXTURES = CURATED_PREVIEW_FIXTURES + EXTERNAL_H5AD_PREVIEW_FIXTURES
FIXTURES_BY_NAME = {fixture.name: fixture for fixture in ALL_PREVIEW_FIXTURES}
DEMO_PACKAGE_NAME = "demo"
DEMO_PACKAGE_HASH = "a" * 64


def local_catalog_demo_fixtures() -> tuple[PreviewFixture, ...]:
    return ALL_PREVIEW_FIXTURES


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download_remote_preview_source(source: RemotePreviewSource) -> Path:
    cached_path = PREVIEW_FIXTURE_CACHE_ROOT / source.cache_key
    if cached_path.exists() and _sha256_file(cached_path) == source.sha256:
        return cached_path

    cached_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = cached_path.with_suffix(cached_path.suffix + ".tmp")
    digest = hashlib.sha256()
    try:
        with urllib.request.urlopen(source.url) as response, temp_path.open("wb") as handle:
            for chunk in iter(lambda: response.read(1024 * 1024), b""):
                digest.update(chunk)
                handle.write(chunk)
        actual_sha256 = digest.hexdigest()
        if actual_sha256 != source.sha256:
            raise ValueError(
                f"SHA-256 mismatch for {source.url}: expected {source.sha256}, got {actual_sha256}"
            )
        temp_path.replace(cached_path)
    finally:
        if temp_path.exists():
            temp_path.unlink()
    return cached_path


def resolve_preview_fixture_source(source: Path | RemotePreviewSource) -> Path:
    if isinstance(source, Path):
        return source
    return _download_remote_preview_source(source)


def stage_preview_fixtures(
    bucket_root: Path, fixtures: tuple[PreviewFixture, ...] = CURATED_PREVIEW_FIXTURES
) -> list[Path]:
    bucket_root.mkdir(parents=True, exist_ok=True)
    staged: list[Path] = []
    for fixture in fixtures:
        target = bucket_root / fixture.bucket_key
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(resolve_preview_fixture_source(fixture.source), target)
        staged.append(target)
    return staged


def stage_demo_package(bucket_root: Path, fixtures: tuple[PreviewFixture, ...] = CURATED_PREVIEW_FIXTURES) -> Path:
    manifest_path = bucket_root / ".quilt" / "packages" / DEMO_PACKAGE_HASH
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    entries: list[dict[str, object]] = [
        {
            "logical_key": fixture.bucket_key,
            "physical_keys": [fixture.bucket_key],
            "size": (bucket_root / fixture.bucket_key).stat().st_size,
            "meta": {"family": fixture.family},
        }
        for fixture in fixtures
    ]
    root_record: dict[str, object] = {
        "message": "demo package",
        "user_meta": {
            "source": "catalog-test",
            "fixture_count": len(fixtures),
        },
    }
    manifest_path.write_text("\n".join([json.dumps(root_record), *(json.dumps(entry) for entry in entries)]) + "\n")

    latest_pointer = bucket_root / ".quilt" / "named_packages" / DEMO_PACKAGE_NAME / "latest"
    latest_pointer.parent.mkdir(parents=True, exist_ok=True)
    latest_pointer.write_text(DEMO_PACKAGE_HASH)
    return manifest_path


def stage_local_catalog_demo(bucket_root: Path) -> tuple[list[Path], Path]:
    fixtures = local_catalog_demo_fixtures()
    staged = stage_preview_fixtures(bucket_root, fixtures)
    manifest_path = stage_demo_package(bucket_root, fixtures)
    return staged, manifest_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Stage the curated LOCAL preview fixture pack into a filesystem bucket"
    )
    parser.add_argument("bucket_root", help="Destination bucket directory, e.g. /tmp/quilt-local-data/demo-bucket")
    args = parser.parse_args(argv)

    bucket_root = Path(args.bucket_root).expanduser().resolve()
    staged, manifest_path = stage_local_catalog_demo(bucket_root)
    print(f"Staged {len(staged)} preview fixtures into {bucket_root}")
    for path in staged:
        print(path.relative_to(bucket_root))
    print(f".quilt/packages/{manifest_path.name}")
    print(f".quilt/named_packages/{DEMO_PACKAGE_NAME}/latest")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
