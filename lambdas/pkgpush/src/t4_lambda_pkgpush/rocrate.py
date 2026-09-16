"""
Map an RO-Crate 1.1 metadata document onto a Quilt package.

Package-level metadata is `lower(@type).@id -> name` for every contextual
entity, so two entities of the same type (e.g. lab group and lab subgroup,
both `Organization`) get distinct keys and the value is what people search on.
Package entries are exactly the root dataset's `hasPart`, with each `File`
entity's remaining properties attached as entry metadata; that is how
`dateCreated` survives S3, which only knows when an object landed.
"""

from __future__ import annotations

import dataclasses
import re
import typing as T
import urllib.parse

from quilt3.util import PhysicalKey, QuiltException, validate_key

CRATE_FILENAME = "ro-crate-metadata.json"
ROOT_ID = "./"

# Package names are validated against PACKAGE_NAME_FORMAT, but crate names are
# written for people, so a name half is sanitized the way an inferred one is.
_NAME_UNSAFE_RE = re.compile(r"[^\w-]")

# Structural properties of a File entity; everything else is entry metadata.
_FILE_STRUCTURAL_PROPS = frozenset(("@id", "@type", "name"))


class RoCrateError(Exception):
    def __init__(self, name: str, context: dict[str, T.Any]):
        super().__init__(name, context)
        self.name = name
        self.context = context


@dataclasses.dataclass(frozen=True)
class CrateEntry:
    logical_key: str
    physical_key: PhysicalKey
    user_meta: dict[str, T.Any] | None
    # A directory part: logical and physical keys are prefixes, expanded by the caller.
    is_dir: bool


@dataclasses.dataclass(frozen=True)
class Crate:
    name_prefix: str | None
    name_suffix: str | None
    user_meta: dict[str, T.Any]
    entries: list[CrateEntry]


def _types(entity: dict[str, T.Any]) -> list[str]:
    t = entity.get("@type")
    if isinstance(t, str):
        return [t]
    if isinstance(t, list):
        return [x for x in t if isinstance(x, str)]
    return []


def _graph(doc: T.Any) -> list[dict[str, T.Any]] | None:
    if not isinstance(doc, dict):
        return None
    graph = doc.get("@graph")
    if not isinstance(graph, list):
        return None
    return [e for e in graph if isinstance(e, dict)]


def is_rocrate(doc: T.Any) -> bool:
    graph = _graph(doc)
    if graph is None:
        return False
    return any(e.get("@id") == ROOT_ID and "Dataset" in _types(e) for e in graph)


def _sanitize_name(name: str | None) -> str | None:
    if name is None:
        return None
    sanitized = _NAME_UNSAFE_RE.sub("-", name)
    # All-punctuation sanitizes to a name that is valid but says nothing, so the
    # caller's S3-inferred name is the better half.
    return sanitized if sanitized.strip("-") else None


def _resolve_part(part_id: str, folder: PhysicalKey, is_dir: bool) -> tuple[str, PhysicalKey]:
    """
    Return (logical_key, physical_key) for a `hasPart` reference. For a
    directory both end in "/" and the physical key is a prefix to expand.
    """
    if part_id.startswith("s3://"):
        pk = PhysicalKey.from_url(part_id)
        if not pk.path or (pk.path.endswith("/") and not is_dir):
            raise RoCrateError("RoCrateInvalidPart", {"id": part_id})
        path = pk.path if pk.path.endswith("/") or not is_dir else pk.path + "/"
        logical_key = path.rstrip("/").rsplit("/", 1)[-1] + ("/" if is_dir else "")
        return logical_key, PhysicalKey(pk.bucket, path, None if is_dir else pk.version_id)

    # Relative ids are URI references too, so they are unquoted like the s3://
    # ones PhysicalKey.from_url handles: "sample%201.csv" is the key with a space.
    rel = urllib.parse.unquote(part_id[2:] if part_id.startswith("./") else part_id)
    if not rel or rel == "/" or (rel.endswith("/") and not is_dir) or rel.startswith("/") or "://" in rel:
        raise RoCrateError("RoCrateInvalidPart", {"id": part_id})
    try:
        validate_key(rel.rstrip("/"))
    except QuiltException as e:
        raise RoCrateError("RoCrateInvalidPart", {"id": part_id}) from e
    if is_dir and not rel.endswith("/"):
        rel += "/"
    return rel, PhysicalKey(folder.bucket, folder.path + rel, None)


def parse(doc: dict[str, T.Any], crate_pk: PhysicalKey) -> Crate:
    """
    `crate_pk` is the crate document's own location; relative `hasPart` ids
    resolve against its folder.
    """
    graph = _graph(doc)
    assert graph is not None
    folder = PhysicalKey(crate_pk.bucket, crate_pk.path.rsplit("/", 1)[0] + "/" if "/" in crate_pk.path else "", None)

    by_id = {e["@id"]: e for e in graph if isinstance(e.get("@id"), str)}
    root = by_id[ROOT_ID]

    name_prefix = None
    name_suffix = root.get("name") if isinstance(root.get("name"), str) and root.get("name") else None
    user_meta: dict[str, T.Any] = {}

    for entity in graph:
        entity_id = entity.get("@id")
        if not isinstance(entity_id, str) or entity_id in (ROOT_ID, CRATE_FILENAME):
            continue
        types = _types(entity)
        if not types or "File" in types:
            continue
        if types[0] == "Namespace":
            if isinstance(entity.get("name"), str) and entity["name"]:
                name_prefix = entity["name"]
            continue

        value = entity.get("name")
        if not isinstance(value, str) or not value:
            value = entity.get("identifier")
        if not isinstance(value, str) or not value:
            continue
        key = f"{types[0].lower()}.{entity_id[1:] if entity_id.startswith('#') else entity_id}"
        if key in user_meta:
            raise RoCrateError("RoCrateDuplicateKey", {"key": key})
        user_meta[key] = value

    entries: dict[str, CrateEntry] = {}
    parts = root.get("hasPart") or []
    if not isinstance(parts, list):
        parts = [parts]
    for part in parts:
        part_id = part.get("@id") if isinstance(part, dict) else part
        if not isinstance(part_id, str):
            raise RoCrateError("RoCrateInvalidPart", {"id": part_id})
        entity = by_id.get(part_id, {})
        is_dir = "Dataset" in _types(entity) or part_id.endswith("/")
        logical_key, physical_key = _resolve_part(part_id, folder, is_dir)
        if logical_key in entries:
            raise RoCrateError("RoCrateDuplicateEntry", {"logical_key": logical_key})
        meta = None if is_dir else {k: v for k, v in entity.items() if k not in _FILE_STRUCTURAL_PROPS} or None
        entries[logical_key] = CrateEntry(logical_key, physical_key, meta, is_dir)

    # The crate is the package's provenance, so it always ships with it — at the
    # version that was read, and never displaced by another part resolving to the
    # same logical key.
    existing = entries.get(CRATE_FILENAME)
    if existing is not None and (existing.physical_key.bucket, existing.physical_key.path) != (
        crate_pk.bucket,
        crate_pk.path,
    ):
        raise RoCrateError("RoCrateDuplicateEntry", {"logical_key": CRATE_FILENAME})
    entries[CRATE_FILENAME] = CrateEntry(
        CRATE_FILENAME,
        PhysicalKey(crate_pk.bucket, crate_pk.path, crate_pk.version_id),
        existing.user_meta if existing is not None else None,
        False,
    )

    return Crate(_sanitize_name(name_prefix), _sanitize_name(name_suffix), user_meta, list(entries.values()))
