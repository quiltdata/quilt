"""Launch a filesystem-backed LOCAL Quilt catalog in one command.

Stages the curated preview fixtures (and a demo package) into a data dir, then
serves the catalog UI + backend with `QUILT_LOCAL_OBJECT_BACKEND=filesystem`,
so no AWS credentials are required.

Usage (from api/python):
    uv run --extra catalog python -m scripts.run_local_catalog
    uv run --extra catalog python -m scripts.run_local_catalog --port 8080
    uv run --extra catalog python -m scripts.run_local_catalog --data-dir /tmp/my-data --no-stage

Open http://127.0.0.1:<port>/b/demo-bucket once it starts.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

DEFAULT_DATA_DIR = Path.home() / ".cache" / "quilt-local-catalog"
DEFAULT_BUCKET = "demo-bucket"


def _stage(data_dir: Path, bucket: str) -> None:
    from tests.preview_fixtures import stage_local_catalog_demo

    bucket_root = data_dir / bucket
    staged, _ = stage_local_catalog_demo(bucket_root)
    print(f"Staged {len(staged)} preview fixtures into {bucket_root}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=3000, help="Bind port (default: 3000)")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help=f"Filesystem bucket root (default: {DEFAULT_DATA_DIR})",
    )
    parser.add_argument("--bucket", default=DEFAULT_BUCKET, help=f"Demo bucket name (default: {DEFAULT_BUCKET})")
    parser.add_argument("--no-stage", action="store_true", help="Skip staging demo fixtures (reuse existing data-dir)")
    parser.add_argument("--no-reload", action="store_true", help="Disable uvicorn autoreload")
    args = parser.parse_args()

    data_dir = args.data_dir.expanduser().resolve()
    data_dir.mkdir(parents=True, exist_ok=True)

    if not args.no_stage:
        _stage(data_dir, args.bucket)

    # Configure the filesystem backend before importing the app, which reads
    # these at import/startup. QUILT_LOCAL_ORIGIN must carry the bound port so
    # the lambdas' proxy-URL validation accepts our preview requests.
    os.environ["QUILT_LOCAL_OBJECT_BACKEND"] = "filesystem"
    os.environ["QUILT_LOCAL_DATA_DIR"] = str(data_dir)
    os.environ.setdefault("QUILT_LOCAL_ORIGIN", f"http://{args.host}:{args.port}")
    os.environ.setdefault("QUILT_DISABLE_USAGE_METRICS", "true")

    try:
        import uvicorn
    except ModuleNotFoundError:
        print("Run with the catalog extra: uv run --extra catalog python -m scripts.run_local_catalog")
        return 1

    url = f"http://{args.host}:{args.port}/b/{args.bucket}"
    print(f"LOCAL catalog (filesystem mode) → {url}")
    uvicorn.run(
        "quilt3_local.main:app",
        host=args.host,
        port=args.port,
        reload=not args.no_reload,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
