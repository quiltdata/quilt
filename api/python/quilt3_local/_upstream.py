"""Resolve paths to upstream repo resources (GraphQL schema, catalog bundle)."""

from __future__ import annotations

from pathlib import Path

from .lambda_subprocess import detect_repo_root

_RESOURCE_MAP = {
    "schema.graphql": "shared/graphql/schema.graphql",
    "catalog_bundle": "catalog/app",
}


def resource_path(name: str) -> Path:
    repo_root = detect_repo_root()
    if name in _RESOURCE_MAP:
        return repo_root / _RESOURCE_MAP[name]
    return repo_root / name
