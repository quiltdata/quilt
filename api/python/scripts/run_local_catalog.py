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
import signal
import subprocess
import sys
import time
from pathlib import Path

DEFAULT_DATA_DIR = Path.home() / ".cache" / "quilt-local-catalog"
DEFAULT_BUCKET = "demo-bucket"


def _stage(data_dir: Path, bucket: str) -> None:
    from tests.preview_fixtures import stage_local_catalog_demo

    bucket_root = data_dir / bucket
    staged, _ = stage_local_catalog_demo(bucket_root)
    print(f"Staged {len(staged)} preview fixtures into {bucket_root}")


def _is_built_bundle(path: Path) -> bool:
    """A usable bundle has an index.html that references a hashed app chunk."""
    index = path / "index.html"
    if not index.is_file():
        return False
    import re

    return bool(re.search(r"app\.[0-9a-f]+\.js", index.read_text(errors="ignore")))


def _find_catalog_bundle() -> Path | None:
    candidates = []

    # Fresh production build from `cd catalog && npm run build`.
    try:
        from quilt3_local.lambda_subprocess import detect_repo_root

        candidates.append(detect_repo_root() / "catalog" / "build")
    except Exception:
        pass

    # The bundle shipped inside the installed quilt3_local package.
    try:
        import sysconfig

        candidates.append(Path(sysconfig.get_paths()["purelib"]) / "quilt3_local" / "catalog_bundle")
    except Exception:
        pass

    for c in candidates:
        if _is_built_bundle(c):
            return c
    return None


def _free_port(port: int) -> None:
    """Kill whatever is already bound to `port` so a relaunch wins cleanly.

    Backgrounded uvicorn launches can leave stale servers bound to the port
    (and, with SO_REUSEPORT, several at once), which silently shadow new
    launches. Find the listeners via lsof and terminate them, escalating to
    SIGKILL if they don't exit.
    """
    try:
        out = subprocess.run(
            ["lsof", "-ti", f"tcp:{port}", "-sTCP:LISTEN"],
            capture_output=True,
            text=True,
            check=False,
        ).stdout
    except FileNotFoundError:
        return  # no lsof (non-macOS/Linux); nothing we can do portably

    pids = [int(p) for p in out.split() if p.strip().isdigit() and int(p) != os.getpid()]
    if not pids:
        return

    print(f"Port {port} in use by pid(s) {pids}; terminating the running catalog…")
    for sig in (signal.SIGTERM, signal.SIGKILL):
        alive = []
        for pid in pids:
            try:
                os.kill(pid, sig)
                alive.append(pid)
            except ProcessLookupError:
                pass
        if not alive:
            break
        time.sleep(1.5)
        pids = alive


def main() -> int:
    # Line-buffer stdout so our progress messages flush promptly even when the
    # launcher's output is piped/redirected (e.g. `> log 2>&1 &`).
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except (AttributeError, ValueError):
        pass

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
    parser.add_argument(
        "--keep-existing",
        action="store_true",
        help="Don't kill a catalog already bound to the port before launching",
    )
    args = parser.parse_args()

    data_dir = args.data_dir.expanduser().resolve()
    data_dir.mkdir(parents=True, exist_ok=True)

    if not args.no_stage:
        _stage(data_dir, args.bucket)

    if not args.keep_existing:
        _free_port(args.port)

    # Configure the filesystem backend before importing the app, which reads
    # these at import/startup. QUILT_LOCAL_ORIGIN must carry the bound port so
    # the lambdas' proxy-URL validation accepts our preview requests.
    os.environ["QUILT_LOCAL_OBJECT_BACKEND"] = "filesystem"
    os.environ["QUILT_LOCAL_DATA_DIR"] = str(data_dir)
    os.environ.setdefault("QUILT_LOCAL_ORIGIN", f"http://{args.host}:{args.port}")
    os.environ.setdefault("QUILT_DISABLE_USAGE_METRICS", "true")

    # Serve a real built bundle if one exists; the in-repo catalog/app is
    # unbuilt webpack source and renders blank. Prefer an explicit override,
    # then a fresh `catalog/build`, then the installed package's bundle.
    if not os.environ.get("QUILT_CATALOG_BUNDLE"):
        bundle = _find_catalog_bundle()
        if bundle:
            os.environ["QUILT_CATALOG_BUNDLE"] = str(bundle)
            print(f"Serving catalog bundle: {bundle}")
        else:
            print("WARNING: no built catalog bundle found; UI may render blank. Run `cd catalog && npm run build`.")

    try:
        import uvicorn
    except ModuleNotFoundError:
        print("Run with the catalog extra: uv run --extra catalog python -m scripts.run_local_catalog")
        return 1

    # Translate SIGTERM into the same graceful shutdown uvicorn does for SIGINT,
    # so `kill <pid>` (and our own _free_port on the next launch) stops it cleanly.
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))

    url = f"http://{args.host}:{args.port}/b/{args.bucket}"
    print(f"LOCAL catalog (filesystem mode) → {url}")
    try:
        uvicorn.run(
            "quilt3_local.main:app",
            host=args.host,
            port=args.port,
            reload=not args.no_reload,
            log_level="info",
        )
    except KeyboardInterrupt:
        print("\nLOCAL catalog stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
