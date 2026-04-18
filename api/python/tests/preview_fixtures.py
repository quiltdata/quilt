from __future__ import annotations

import argparse
import shutil
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class PreviewFixture:
    name: str
    family: str
    bucket_key: str
    source: Path


CURATED_PREVIEW_FIXTURES = (
    PreviewFixture("text", "text", "preview/text/short.txt", REPO_ROOT / "lambdas/preview/test/data/short.txt"),
    PreviewFixture("csv", "tabular", "preview/tabular/sample.csv", REPO_ROOT / "lambdas/preview/test/data/sample.csv"),
    PreviewFixture("tsv", "tabular", "preview/tabular/avengers.tsv", REPO_ROOT / "lambdas/preview/test/data/avengers.tsv"),
    PreviewFixture("excel", "tabular", "preview/tabular/sample.xlsx", REPO_ROOT / "lambdas/preview/test/data/sample.xlsx"),
    PreviewFixture("jsonl", "tabular", "preview/tabular/test.jsonl", REPO_ROOT / "lambdas/tabular_preview/tests/data/simple/test.jsonl"),
    PreviewFixture("parquet", "structured", "preview/structured/atlantic_storms.parquet", REPO_ROOT / "lambdas/preview/test/data/atlantic_storms.parquet"),
    PreviewFixture("vcf", "structured", "preview/structured/example.vcf", REPO_ROOT / "lambdas/preview/test/data/example.vcf"),
    PreviewFixture("ipynb", "structured", "preview/notebooks/nb_1200727.ipynb", REPO_ROOT / "lambdas/preview/test/data/nb_1200727.ipynb"),
    PreviewFixture("fcs", "scientific", "preview/scientific/normal.fcs", REPO_ROOT / "lambdas/shared/tests/data/fcs/normal.fcs"),
    PreviewFixture("image", "image", "preview/images/penguin.jpg", REPO_ROOT / "lambdas/thumbnail/tests/data/penguin.jpg"),
    PreviewFixture("pdf", "document", "preview/documents/MUMmer.pdf", REPO_ROOT / "lambdas/thumbnail/tests/data/MUMmer.pdf"),
    PreviewFixture("dog_pdf", "document", "preview/documents/dog_watermark.pdf", REPO_ROOT / "api/python/tests/data/dog_watermark.pdf"),
    PreviewFixture("pptx", "document", "preview/documents/in.pptx", REPO_ROOT / "lambdas/thumbnail/tests/data/pptx/in.pptx"),
    PreviewFixture("video", "media", "preview/media/object-expand.webm", REPO_ROOT / "catalog/app/components/JsonEditor/object-expand.webm"),
)


FIXTURES_BY_NAME = {fixture.name: fixture for fixture in CURATED_PREVIEW_FIXTURES}


def stage_preview_fixtures(bucket_root: Path) -> list[Path]:
    bucket_root.mkdir(parents=True, exist_ok=True)
    staged = []
    for fixture in CURATED_PREVIEW_FIXTURES:
        target = bucket_root / fixture.bucket_key
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(fixture.source, target)
        staged.append(target)
    return staged


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Stage the curated LOCAL preview fixture pack into a filesystem bucket")
    parser.add_argument("bucket_root", help="Destination bucket directory, e.g. /tmp/quilt-local-data/demo-bucket")
    args = parser.parse_args(argv)

    bucket_root = Path(args.bucket_root).expanduser().resolve()
    staged = stage_preview_fixtures(bucket_root)
    print(f"Staged {len(staged)} preview fixtures into {bucket_root}")
    for path in staged:
        print(path.relative_to(bucket_root))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
