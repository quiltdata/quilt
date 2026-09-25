"""
Map an RO-Crate metadata document onto a Quilt package, as the consumer
described by the Quilt RO-Crate profile (https://w3id.org/quilt/ro-crate).

Package entries are exactly the root dataset's `hasPart`, with each `File`
entity's remaining properties attached as entry metadata; that is how
`dateCreated` survives S3, which only knows when an object landed. A part
that is a web URI (nf-prov WRROC lists the license there) is a reference
with no object behind it, so it is not an entry.

Package metadata is a flat projection keyed by the role an entity plays for
the root (creator, producer, instrument, ELN entry) rather than by its
`@type`, so a search schema built on those keys does not freeze the crate's
shape. The crate itself ships in the package as the verbatim graph.

A crate is rejected only when it cannot be packaged as written: a part that
cannot be resolved, an invalid explicit package name, conflicting ids. How
it models people, instruments, actions and everything else is the
producer's business; a crate that departs from the profile's recommendations
is packaged with whatever projection can be read from it.
"""

from __future__ import annotations

import dataclasses
import json
import re
import typing as T
import urllib.parse

from quilt3.util import PACKAGE_NAME_FORMAT, PhysicalKey, QuiltException, validate_key

CRATE_FILENAME = "ro-crate-metadata.json"
ROOT_ID = "./"

PROFILE_URI = "https://w3id.org/quilt/ro-crate"
# The profile's terms appear only as propertyID / additionalType values, never
# as JSON-LD keys, so they survive expansion under the stock RO-Crate context.
PACKAGE_NAME_TERM = f"{PROFILE_URI}#packageName"
PACKAGE_NAMESPACE_TERM = f"{PROFILE_URI}#packageNamespace"
ELN_ENTRY_TERM = f"{PROFILE_URI}#ELNEntry"

# An explicit package name or namespace is the producer's to get right, so it is
# rejected rather than corrected. The root's `name` is a title written for
# people, so the name half derived from it is sanitized instead.
_NAMESPACE_RE = re.compile(r"[\w-]+")
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
    package_name: str
    # Role -> human-readable values; the caller adds the name it publishes under.
    user_meta: dict[str, list[str]]
    entries: list[CrateEntry]
    # Entry metadata for File entities beneath a directory part, by (bucket, key):
    # the caller expands directories, so it matches them to the objects it lists.
    nested_meta: dict[tuple[str, str], dict[str, T.Any]]


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


def _reject_non_json(meta: dict[str, T.Any], part_id: str) -> None:
    """
    The manifest encoder runs with allow_nan=False, after the checksum work; a
    crate carrying NaN/Infinity has to fail here instead of at the end.
    """
    try:
        json.dumps(meta, allow_nan=False)
    except ValueError as e:
        raise RoCrateError("RoCrateInvalidEntryMeta", {"id": part_id}) from e


def _normalize_id(entity_id: str) -> str:
    """
    Ids are URI references, so "./x", "x" and "%20"-style escapes are all the same
    reference and entity lookup has to agree with `_resolve_part` on which one it is.
    A trailing slash is left alone: "x" and "x/" can be a File and a Dataset that
    both legally exist.
    """
    if entity_id == ROOT_ID or entity_id.startswith("s3://"):
        return entity_id
    return urllib.parse.unquote(entity_id[2:] if entity_id.startswith("./") else entity_id)


def _lookup_part(by_id: dict[str, dict[str, T.Any]], part_id: str) -> dict[str, T.Any]:
    """
    A Dataset is idiomatically written "x/" while `hasPart` may reference it either
    way, so a reference without the slash still has to find it. Only the slash is
    added, never dropped: "x/" must not resolve to a File named "x".
    """
    normalized = _normalize_id(part_id)
    entity = by_id.get(normalized)
    if entity is None and not normalized.endswith("/"):
        entity = by_id.get(normalized + "/")
    return entity or {}


def _entity_body(entity: dict[str, T.Any]) -> dict[str, T.Any]:
    """
    An entity minus its `@id` spelling: "./x" and "x" name one entity, so only
    the content decides whether a repeated id is a copy or a conflict.
    """
    return {k: v for k, v in entity.items() if k != "@id"}


def _is_web_uri(part_id: str) -> bool:
    return part_id.startswith(("http://", "https://"))


def _sanitize_name(name: str | None) -> str | None:
    if name is None:
        return None
    sanitized = _NAME_UNSAFE_RE.sub("-", name)
    # All-punctuation sanitizes to a name that is valid but says nothing, so the
    # caller's S3-inferred name is the better half.
    return sanitized if sanitized.strip("-") else None


def _as_list(value: T.Any) -> list[T.Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _text(value: T.Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _iris(value: T.Any) -> list[str]:
    """
    The IRIs a property states. `propertyID` and `additionalType` are written
    both as `{"@id": iri}` and as a plain string, and both mean the same term.
    """
    iris = []
    for v in _as_list(value):
        iri = v.get("@id") if isinstance(v, dict) else v
        if isinstance(iri, str):
            iris.append(iri)
    return iris


def _entities(by_id: dict[str, dict[str, T.Any]], value: T.Any) -> list[dict[str, T.Any]]:
    """
    The entities a property points at: a `{"@id"}` reference resolved in the
    graph, or an entity written inline, which RO-Crate asks producers to avoid
    but which says the same thing. Literals and dangling references say nothing
    to follow.
    """
    found = []
    for v in _as_list(value):
        if not isinstance(v, dict):
            continue
        entity = by_id.get(_normalize_id(v["@id"])) if isinstance(v.get("@id"), str) else None
        if entity is None and set(v) - {"@id"}:
            entity = v
        if entity is not None:
            found.append(entity)
    return found


def _identifiers(by_id: dict[str, dict[str, T.Any]], entity: dict[str, T.Any]) -> list[str]:
    """`identifier` is a plain string or, like a DOI, a PropertyValue carrying the string as `value`."""
    ids = [v for v in _as_list(entity.get("identifier")) if isinstance(v, str)]
    ids += [v["value"] for v in _entities(by_id, entity.get("identifier")) if isinstance(v.get("value"), str)]
    return ids


def _package_name(by_id: dict[str, dict[str, T.Any]], root: dict[str, T.Any], default_name: str) -> str:
    """
    An explicit packageName; else packageNamespace joined to the root's name;
    else `default_name`. Both terms are PropertyValues under the root's
    `identifier`, the way the base spec expresses a DOI.
    """
    declared: dict[str, set[str]] = {PACKAGE_NAME_TERM: set(), PACKAGE_NAMESPACE_TERM: set()}
    for entity in _entities(by_id, root.get("identifier")):
        for term in set(_iris(entity.get("propertyID"))) & declared.keys():
            value = entity.get("value")
            if not isinstance(value, str):
                raise RoCrateError("RoCrateInvalidPackageName", {"term": term, "value": value})
            declared[term].add(value)

    for term, pattern in ((PACKAGE_NAME_TERM, PACKAGE_NAME_FORMAT), (PACKAGE_NAMESPACE_TERM, _NAMESPACE_RE)):
        if len(declared[term]) > 1:
            raise RoCrateError("RoCrateInvalidPackageName", {"term": term, "values": sorted(declared[term])})
        for value in declared[term]:
            if not re.fullmatch(pattern, value):
                raise RoCrateError("RoCrateInvalidPackageName", {"term": term, "value": value})

    if declared[PACKAGE_NAME_TERM]:
        return next(iter(declared[PACKAGE_NAME_TERM]))
    if declared[PACKAGE_NAMESPACE_TERM]:
        (namespace,) = declared[PACKAGE_NAMESPACE_TERM]
        return f"{namespace}/{_sanitize_name(_text(root.get('name'))) or default_name.split('/')[1]}"
    return default_name


def _project(by_id: dict[str, dict[str, T.Any]], root: dict[str, T.Any]) -> dict[str, list[str]]:
    """
    Package metadata keyed by the property that links an entity to the root.
    That is what tells a lab group from its parent, both `Organization`, without
    compounding their ids into keys.
    """
    producer = []
    # By object, not @id: an inline organization need not have one.
    seen: set[int] = set()
    queue = _entities(by_id, root.get("producer"))
    while queue:
        org = queue.pop(0)
        if id(org) in seen:
            continue
        seen.add(id(org))
        producer.append(org.get("name"))
        # A parent organization is the same role, one level up.
        queue += _entities(by_id, org.get("parentOrganization"))

    # Acquisition actions are reachable only through `mentions`; each names its instrument.
    instruments = [i for a in _entities(by_id, root.get("mentions")) for i in _entities(by_id, a.get("instrument"))]

    projection = {
        "creator": [e.get("name") for e in _entities(by_id, root.get("creator"))],
        "producer": producer,
        "instrument": [e.get("name") for e in instruments],
        "instrument_id": [i for e in instruments for i in _identifiers(by_id, e)],
        "eln_entry": [
            e.get("name")
            for e in _entities(by_id, root.get("subjectOf"))
            if ELN_ENTRY_TERM in _iris(e.get("additionalType"))
        ],
    }
    projection = {role: list(dict.fromkeys(v for v in values if _text(v))) for role, values in projection.items()}
    return {role: values for role, values in projection.items() if values}


def _resolve_part(part_id: str, folder: PhysicalKey, is_dir: bool) -> tuple[str, PhysicalKey]:
    """
    Return (logical_key, physical_key) for a `hasPart` reference. For a
    directory both end in "/" and the physical key is a prefix to expand.
    """
    if part_id.startswith("s3://"):
        # As in a relative id, a "#" that belongs to the key arrives percent-encoded;
        # a fragment means nothing for an object, and dropping it would package another key.
        if "#" in part_id:
            raise RoCrateError("RoCrateInvalidPart", {"id": part_id})
        try:
            pk = PhysicalKey.from_url(part_id)
        # URLParseError is a ValueError, and urlparse raises a bare one for a malformed authority.
        except ValueError as e:
            raise RoCrateError("RoCrateInvalidPart", {"id": part_id}) from e
        if not pk.path or (pk.path.endswith("/") and not is_dir):
            raise RoCrateError("RoCrateInvalidPart", {"id": part_id})
        # Same segment rules as a relative id: the S3 key is what gets HEADed and
        # its basename becomes a logical key, so "." and ".." are equally invalid.
        try:
            validate_key(pk.path[:-1] if pk.path.endswith("/") else pk.path)
        except QuiltException as e:
            raise RoCrateError("RoCrateInvalidPart", {"id": part_id}) from e
        path = pk.path if pk.path.endswith("/") or not is_dir else pk.path + "/"
        logical_key = path.rstrip("/").rsplit("/", 1)[-1] + ("/" if is_dir else "")
        return logical_key, PhysicalKey(pk.bucket, path, None if is_dir else pk.version_id)

    # Relative ids are URI references too, so they are unquoted like the s3://
    # ones PhysicalKey.from_url handles: "sample%201.csv" is the key with a space.
    # A literal "?" or "#" in a key has to arrive percent-encoded, so an unescaped
    # one is a query or fragment this resolver has no meaning for.
    if "?" in part_id or "#" in part_id:
        raise RoCrateError("RoCrateInvalidPart", {"id": part_id})
    rel = urllib.parse.unquote(part_id[2:] if part_id.startswith("./") else part_id)
    if not rel or (rel.endswith("/") and not is_dir) or rel.startswith("/") or "://" in rel:
        raise RoCrateError("RoCrateInvalidPart", {"id": part_id})
    # A directory's trailing "/" is this reference's own syntax, not a path segment;
    # every segment inside the path still has to be a real one.
    try:
        validate_key(rel[:-1] if rel.endswith("/") else rel)
    except QuiltException as e:
        raise RoCrateError("RoCrateInvalidPart", {"id": part_id}) from e
    if is_dir and not rel.endswith("/"):
        rel += "/"
    return rel, PhysicalKey(folder.bucket, folder.path + rel, None)


def _nested_meta(
    by_id: dict[str, dict[str, T.Any]], folder: PhysicalKey, entries: dict[str, CrateEntry]
) -> dict[tuple[str, str], dict[str, T.Any]]:
    """
    A File entity describing an object inside a directory part keeps its metadata
    the way a listed file does. Only those are read: a File entity outside every
    directory part is not packaged, so it cannot fail the crate.
    """
    prefixes = [(e.physical_key.bucket, e.physical_key.path) for e in entries.values() if e.is_dir]
    found: dict[tuple[str, str], dict[str, T.Any]] = {}
    if not prefixes:
        return found
    for entity in by_id.values():
        # The raw id, which _resolve_part decodes; by_id's keys are already decoded.
        entity_id = entity["@id"]
        if "File" not in _types(entity) or _is_web_uri(entity_id):
            continue
        try:
            _, pk = _resolve_part(entity_id, folder, False)
        except RoCrateError:
            continue
        if not any(pk.bucket == bucket and pk.path.startswith(prefix) for bucket, prefix in prefixes):
            continue
        meta = {k: v for k, v in entity.items() if k not in _FILE_STRUCTURAL_PROPS}
        if meta:
            _reject_non_json(meta, entity_id)
            found[(pk.bucket, pk.path)] = meta
    return found


def parse(doc: dict[str, T.Any], crate_pk: PhysicalKey, default_name: str) -> Crate:
    """
    `crate_pk` is the crate document's own location; relative `hasPart` ids
    resolve against its folder. `default_name` is the name the caller would
    otherwise infer, used when the crate names no package.
    """
    graph = _graph(doc)
    assert graph is not None
    folder = PhysicalKey(crate_pk.bucket, crate_pk.path.rsplit("/", 1)[0] + "/" if "/" in crate_pk.path else "", None)

    by_id: dict[str, dict[str, T.Any]] = {}
    for entity in graph:
        entity_id = entity.get("@id")
        if not isinstance(entity_id, str):
            continue
        entity_id = _normalize_id(entity_id)
        # Ids are unique per the spec, but nf-prov WRROC emitters repeat a
        # provenance node verbatim; a copy that says the same thing is that
        # entity, so the first one stands. Two entities that disagree would
        # mean is_rocrate() and the rest of parse() read different roots.
        if entity_id in by_id:
            if _entity_body(by_id[entity_id]) == _entity_body(entity):
                continue
            raise RoCrateError("RoCrateDuplicateId", {"id": entity_id})
        by_id[entity_id] = entity
    root = by_id[ROOT_ID]

    package_name = _package_name(by_id, root, default_name)
    user_meta = _project(by_id, root)

    entries: dict[str, CrateEntry] = {}
    parts = root.get("hasPart") or []
    if not isinstance(parts, list):
        parts = [parts]
    for part in parts:
        part_id = part.get("@id") if isinstance(part, dict) else part
        if not isinstance(part_id, str):
            raise RoCrateError("RoCrateInvalidPart", {"id": part_id})
        # A web-based data entity (e.g. a license URL, idiomatic in nf-prov
        # WRROC) is legal RO-Crate but is a reference, not an object a package
        # entry can point at, so it is left out rather than failing the crate.
        if _is_web_uri(part_id):
            continue
        entity = _lookup_part(by_id, part_id)
        is_dir = "Dataset" in _types(entity) or part_id.endswith("/")
        logical_key, physical_key = _resolve_part(part_id, folder, is_dir)
        if logical_key in entries:
            raise RoCrateError("RoCrateDuplicateEntry", {"logical_key": logical_key})
        meta = None if is_dir else {k: v for k, v in entity.items() if k not in _FILE_STRUCTURAL_PROPS} or None
        if meta is not None:
            _reject_non_json(meta, part_id)
        entries[logical_key] = CrateEntry(logical_key, physical_key, meta, is_dir)

    # An empty or all-web hasPart would package the crate alone. That is legal
    # RO-Crate but means a data-less package, so it fails rather than publish
    # one silently.
    if not entries:
        raise RoCrateError("RoCrateNoParts", {"id": ROOT_ID})

    # The crate is the package's provenance, so it always ships with it — at the
    # version that was read, and never displaced by another part resolving to the
    # same logical key. A part naming a different object, or pinning a different
    # version of this one, is a conflict rather than a silent substitution.
    existing = entries.get(CRATE_FILENAME)
    if existing is not None and (existing.physical_key.bucket, existing.physical_key.path) != (
        crate_pk.bucket,
        crate_pk.path,
    ):
        raise RoCrateError("RoCrateDuplicateEntry", {"logical_key": CRATE_FILENAME})
    if (
        existing is not None
        and existing.physical_key.version_id is not None
        and existing.physical_key.version_id != crate_pk.version_id
    ):
        raise RoCrateError("RoCrateDuplicateEntry", {"logical_key": CRATE_FILENAME})
    entries[CRATE_FILENAME] = CrateEntry(
        CRATE_FILENAME,
        PhysicalKey(crate_pk.bucket, crate_pk.path, crate_pk.version_id),
        existing.user_meta if existing is not None else None,
        False,
    )

    return Crate(package_name, user_meta, list(entries.values()), _nested_meta(by_id, folder, entries))
