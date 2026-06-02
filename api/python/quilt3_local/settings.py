from __future__ import annotations

import ipaddress
import os
import tempfile
from pathlib import Path
from urllib.parse import urlparse

OBJECT_BACKEND_AWS = "aws"
OBJECT_BACKEND_FILESYSTEM = "filesystem"

S3_PROXY_PREFIX = "/__s3proxy"
_TRUTHY = {"1", "true", "yes", "on"}


def object_backend() -> str:
    return os.getenv("QUILT_LOCAL_OBJECT_BACKEND", OBJECT_BACKEND_AWS).strip().lower()


def filesystem_mode() -> bool:
    return object_backend() == OBJECT_BACKEND_FILESYSTEM


def data_dir() -> Path | None:
    value = os.getenv("QUILT_LOCAL_DATA_DIR")
    if not value:
        return None
    return Path(value).expanduser().resolve()


def default_region() -> str:
    return os.getenv("QUILT_LOCAL_DEFAULT_REGION", "us-east-1")


def local_origin() -> str:
    return os.getenv("QUILT_LOCAL_ORIGIN", "http://localhost:3000")


def _is_loopback_host(hostname: str | None) -> bool:
    if hostname in {"localhost", "127.0.0.1", "::1"}:
        return True
    if hostname is None:
        return False
    try:
        return ipaddress.ip_address(hostname).is_loopback
    except ValueError:
        return False


def _same_local_host(left: str | None, right: str | None) -> bool:
    if left == right:
        return True
    return _is_loopback_host(left) and _is_loopback_host(right)


def is_local_proxy_url(url: str) -> bool:
    parsed = urlparse(url, allow_fragments=False)
    if parsed.scheme not in {"http", "https"}:
        return False
    local = urlparse(local_origin(), allow_fragments=False)
    return (
        parsed.port == local.port
        and _same_local_host(parsed.hostname, local.hostname)
        and parsed.path.startswith("/__s3proxy/")
    )


def fake_credentials() -> dict:
    return {
        "AccessKeyId": "LOCALMODEACCESSKEY",
        "SecretAccessKey": "LOCALMODESECRETKEY",
        "SessionToken": "LOCALMODESESSIONTOKEN",
        "Expiration": None,
    }


def voila_enabled() -> bool:
    """Whether interactive Voila dashboards are enabled in LOCAL mode (opt-in)."""
    return os.getenv("QUILT_LOCAL_VOILA", "").strip().lower() in _TRUTHY


def voila_notebook_dir() -> Path:
    """Directory Voila serves notebooks from (the staging dir).

    Honors QUILT_LOCAL_VOILA_DIR, otherwise a stable staging dir under the
    system temp dir. Created on demand.
    """
    value = os.getenv("QUILT_LOCAL_VOILA_DIR")
    path = Path(value).expanduser().resolve() if value else Path(tempfile.gettempdir()) / "quilt-local-voila"
    path.mkdir(parents=True, exist_ok=True)
    return path


def local_backend_env() -> dict[str, str]:
    """Snapshot of the LOCAL backend knobs inherited into the Voila kernel.

    The kernel runs ``quilt3`` against real S3 using the per-session AWS
    credentials injected by the proxy (see voila_subprocess.translate_render_params),
    exactly like deployed Voila stacks: object reads go directly to S3 via boto3
    with those credentials, scoped read-oriented by what the credentials permit.
    No new storage path is introduced, and the browser-side ``/__s3proxy`` CORS
    shim is intentionally NOT on the kernel's read path (an in-kernel boto3 client
    talks to S3 directly, not through the catalog's browser proxy).

    These knobs (region, backend marker) are inherited so the kernel's quilt3
    region/backend assumptions match the LOCAL backend. They only affect AWS-backed
    reads; LOCAL ``filesystem`` mode is a browser/registry storage mock and does not
    provide an in-kernel object read path.
    """
    env: dict[str, str] = {
        "QUILT_LOCAL_OBJECT_BACKEND": object_backend(),
        "QUILT_LOCAL_DEFAULT_REGION": default_region(),
        "QUILT_LOCAL_ORIGIN": local_origin(),
    }
    dd = data_dir()
    if dd is not None:
        env["QUILT_LOCAL_DATA_DIR"] = str(dd)
    repo_root = os.getenv("QUILT_REPO_ROOT")
    if repo_root:
        env["QUILT_REPO_ROOT"] = repo_root
    return env
