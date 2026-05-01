from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

OBJECT_BACKEND_AWS = "aws"
OBJECT_BACKEND_FILESYSTEM = "filesystem"


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


def is_local_proxy_url(url: str) -> bool:
    parsed = urlparse(url, allow_fragments=False)
    if parsed.scheme not in {"http", "https"}:
        return False
    local_netloc = urlparse(local_origin()).netloc
    return parsed.netloc == local_netloc and parsed.path.startswith("/__s3proxy/")


def fake_credentials() -> dict:
    return {
        "AccessKeyId": "LOCALMODEACCESSKEY",
        "SecretAccessKey": "LOCALMODESECRETKEY",
        "SessionToken": "LOCALMODESESSIONTOKEN",
        "Expiration": None,
    }
