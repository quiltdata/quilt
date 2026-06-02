from __future__ import annotations

import asyncio
import dataclasses
import datetime
import re
import typing as T

from . import aws, context

NAMED_PACKAGES_PREFIX = ".quilt/named_packages/"
MANIFESTS_PREFIX = ".quilt/packages/"
LOCAL_PACKAGE_NAMESPACE = "local"
HASH_RE = re.compile("^[a-f0-9]{64}$")
TIMESTAMP_RE = re.compile("^1[0-9]{9}$")


@dataclasses.dataclass
class RevisionPointer:
    pointer: str
    modified: datetime.datetime
    tags: T.List[str] = dataclasses.field(default_factory=list)


@dataclasses.dataclass
class PackageFileEntry:
    path: str
    size: int
    physical_key: str


@dataclasses.dataclass
class PackageFile(PackageFileEntry):
    metadata: dict


@dataclasses.dataclass
class PackageDirEntry:
    path: str
    size: int


@dataclasses.dataclass
class PackageDir:
    path: str
    metadata: dict
    children: T.List[PackageDirEntry | PackageFileEntry]


def _is_timestamp(value: str) -> bool:
    return bool(TIMESTAMP_RE.match(value))


def _is_hash(value: str) -> bool:
    return bool(HASH_RE.match(value))


def _transform_char(char: str) -> str:
    if char == "*":
        return ".*"
    if char == "?":
        return ".{0,1}"
    return re.escape(char)


def _make_filter_re(filter_value: str | None) -> re.Pattern | None:
    if not filter_value:
        return None

    value = "".join(_transform_char(char) for char in filter_value)
    if not re.match("[*?]", filter_value):
        value = f".*{value}.*"
    return re.compile(f"^{value}$", re.I)


def _append_path(base: str, child: str) -> str:
    if not base:
        return child
    base_norm = base if base.endswith("/") else base + "/"
    return base_norm + child


def _physical_key(record: dict) -> str:
    physical_keys = record.get("physical_keys") or []
    return physical_keys[0] if physical_keys else record.get("physical_key", "")


def _physical_key_url(bucket: str, record: dict) -> str:
    key = _physical_key(record)
    if "://" in key:
        return key
    return f"s3://{bucket}/{key}"


def public_name(name: str) -> str:
    return name if "/" in name else f"{LOCAL_PACKAGE_NAMESPACE}/{name}"


def internal_name(name: str) -> str:
    prefix = f"{LOCAL_PACKAGE_NAMESPACE}/"
    if name.startswith(prefix) and name.count("/") == 1:
        return name[len(prefix) :]
    return name


@context.cached
async def _manifest_records(bucket: str, hash_: str) -> list[dict]:
    return await aws.read_json_lines(Bucket=bucket, Key=f"{MANIFESTS_PREFIX}{hash_}")


def _root_record(records: list[dict]) -> dict:
    for record in records:
        if record.get("logical_key") is None:
            return record
    return {}


def _find_record(records: list[dict], logical_key: str) -> dict | None:
    for record in records:
        if record.get("logical_key") == logical_key:
            return record
    return None


def _file_records(records: list[dict]) -> list[dict]:
    return [record for record in records if record.get("logical_key") is not None]


@context.cached
async def resolve_pointer(bucket: str, package: str, pointer: str) -> str:
    if _is_hash(pointer):
        return pointer
    return await aws.read_text(Bucket=bucket, Key=f"{NAMED_PACKAGES_PREFIX}{package}/{pointer}")


@context.cached
async def get_all_package_pointers(bucket: str, filter: T.Optional[str] = None) -> dict:
    pointers = {}
    by_etag = {}
    tags = {}
    filter_re = _make_filter_re(filter)

    async for obj in aws.list_all_objects(Bucket=bucket, Prefix=NAMED_PACKAGES_PREFIX):
        name, _sep, pointer = obj["Key"][len(NAMED_PACKAGES_PREFIX) :].rpartition("/")
        if filter_re and not (filter_re.match(name) or filter_re.match(public_name(name))):
            continue

        etag = obj["ETag"]

        pointers.setdefault(name, [])
        by_etag.setdefault(name, {})
        tags.setdefault(name, {})

        if _is_timestamp(pointer):
            modified = datetime.datetime.fromtimestamp(int(pointer), datetime.timezone.utc)
            pointer_obj = RevisionPointer(pointer, modified)
            by_etag[name][etag] = pointer_obj
            pointers[name].append(pointer_obj)
        else:
            tags[name][pointer] = (etag, obj.get("LastModified"))

    for name, package_tags in tags.items():
        for tag, (etag, modified) in package_tags.items():
            if etag not in by_etag[name]:
                pointer_obj = RevisionPointer(
                    tag,
                    modified or datetime.datetime.now(datetime.timezone.utc),
                )
                by_etag[name][etag] = pointer_obj
                pointers[name].append(pointer_obj)
            by_etag[name][etag].tags.append(tag)

    for name, package_pointers in pointers.items():
        package_pointers.reverse()

    return pointers


@context.cached
async def get_package_pointers(bucket: str, package: str) -> T.List[RevisionPointer]:
    try:
        all_pointers = await get_all_package_pointers.get_cached(bucket)
        return all_pointers[package]
    except get_all_package_pointers.NotCached:
        pass
    except KeyError:
        return []

    pointers = []
    by_etag = {}
    tags = {}

    async for obj in aws.list_all_objects(Bucket=bucket, Prefix=f"{NAMED_PACKAGES_PREFIX}{package}/"):
        _name, _sep, pointer = obj["Key"][len(NAMED_PACKAGES_PREFIX) :].rpartition("/")
        etag = obj["ETag"]
        if _is_timestamp(pointer):
            modified = datetime.datetime.fromtimestamp(int(pointer), datetime.timezone.utc)
            pointer_obj = RevisionPointer(pointer, modified)
            by_etag[etag] = pointer_obj
            pointers.append(pointer_obj)
        else:
            tags[pointer] = (etag, obj.get("LastModified"))

    for tag, (etag, modified) in tags.items():
        if etag not in by_etag:
            pointer_obj = RevisionPointer(
                tag,
                modified or datetime.datetime.now(datetime.timezone.utc),
            )
            by_etag[etag] = pointer_obj
            pointers.append(pointer_obj)
        by_etag[etag].tags.append(tag)

    pointers.reverse()
    return pointers


@context.cached
async def get_revision_pointer(bucket: str, package: str, hash_or_tag: str) -> RevisionPointer | None:
    pointers = await get_package_pointers(bucket, package)
    if _is_hash(hash_or_tag):
        hashes = await asyncio.gather(*(resolve_pointer(bucket, package, pointer.pointer) for pointer in pointers))
        for pointer, hash_ in zip(pointers, hashes):
            if hash_ == hash_or_tag:
                return pointer
        return None

    for pointer in pointers:
        if pointer.pointer == hash_or_tag or hash_or_tag in pointer.tags:
            return pointer
    return None


@context.cached
async def package_exists(bucket: str, name: str):
    name = internal_name(name)
    result = await aws.list_objects_v2(Bucket=bucket, Prefix=f"{NAMED_PACKAGES_PREFIX}{name}/", MaxKeys=1)
    return result["KeyCount"] != 0


@context.cached
async def get_user_meta(bucket: str, package: str, hash_: str) -> T.Optional[dict]:
    return _root_record(await _manifest_records(bucket, hash_)).get("user_meta")


@context.cached
async def get_root_record(bucket: str, package: str, hash_: str) -> dict:
    return _root_record(await _manifest_records(bucket, hash_))


@context.cached
async def get_message(bucket: str, package: str, hash_: str) -> T.Optional[str]:
    return _root_record(await _manifest_records(bucket, hash_)).get("message")


@context.cached
async def get_workflow(bucket: str, package: str, hash_: str) -> T.Optional[dict | str]:
    return _root_record(await _manifest_records(bucket, hash_)).get("workflow")


@context.cached
async def get_total_files(bucket: str, package: str, hash_: str) -> T.Optional[int]:
    return len(_file_records(await _manifest_records(bucket, hash_)))


@context.cached
async def get_total_bytes(bucket: str, package: str, hash_: str) -> T.Optional[int]:
    return sum(record.get("size", 0) for record in _file_records(await _manifest_records(bucket, hash_)))


@context.cached
async def get_dir(bucket: str, hash_: str, path: str) -> T.Optional[PackageDir]:
    records = await _manifest_records(bucket, hash_)
    prefix = f"{path.rstrip('/')}/" if path else ""

    dirs = {}
    files = {}
    for record in _file_records(records):
        logical_key = record.get("logical_key", "")
        if prefix and not logical_key.startswith(prefix):
            continue
        relative = logical_key[len(prefix) :] if prefix else logical_key
        if not relative:
            continue
        child, _, remainder = relative.partition("/")
        if remainder:
            entry = dirs.setdefault(child, 0)
            dirs[child] = entry + int(record.get("size", 0))
        else:
            files[child] = record

    metadata_record = _root_record(records) if not path else _find_record(records, path)
    metadata = metadata_record or {}
    if path and metadata_record is not None:
        metadata = metadata_record.get("meta", {})

    dir_entries = [
        PackageDirEntry(path=_append_path(path, f"{name}/"), size=size) for name, size in sorted(dirs.items())
    ]
    file_entries = [
        PackageFileEntry(
            path=_append_path(path, name),
            size=record.get("size", 0),
            physical_key=_physical_key_url(bucket, record),
        )
        for name, record in sorted(files.items())
    ]

    return PackageDir(path=path, metadata=metadata, children=dir_entries + file_entries)


@context.cached
async def get_file(bucket: str, hash_: str, path: str) -> T.Optional[PackageFile]:
    record = _find_record(await _manifest_records(bucket, hash_), path)
    if not record:
        return None
    return PackageFile(
        path=path,
        size=record["size"],
        physical_key=_physical_key_url(bucket, record),
        metadata=record.get("meta", {}),
    )
