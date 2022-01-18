import asyncio
import dataclasses
import datetime
import json
import re
import typing as T

import pandas as pd

from . import aws, context
from .lambdas.shared.utils import sql_escape

NAMED_PACKAGES_PREFIX = ".quilt/named_packages/"
MANIFESTS_PREFIX = ".quilt/packages/"
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
    children: T.List[T.Union[PackageDirEntry, PackageFileEntry]]


def _is_timestamp(s: str) -> bool:
    return bool(TIMESTAMP_RE.match(s))


def _is_hash(s: str) -> bool:
    return bool(HASH_RE.match(s))


def _transform_char(char: str) -> str:
    if char == "*":
        return ".*"
    if char == "?":
        return ".{0,1}"
    return re.escape(char)


def _make_filter_re(filter: T.Optional[str]) -> T.Optional[re.Pattern]:
    """
    Make a case-insensitive RegEx out of a string.
    Support shell-style wildcards (* and ?).
    Substring match if pattern has no wildcards.
    Escape special characters (treat them literally, not as RegEx).
    """
    if not filter:
        return None

    value = "".join(_transform_char(char) for char in filter)
    # un-anchor pattern if it doesn't contain wildcards
    if not re.match("[*?]", filter):
        value = f".*{value}.*"
    return re.compile(f"^{value}$", re.I)


def _try_parse_json(input: T.Optional[str]) -> T.Optional[dict]:
    if not isinstance(input, str):
        return None
    try:
        return json.loads(input)
    except json.JSONDecodeError:
        return None


def _append_path(base: str, child: str) -> str:
    if not base:
        return child
    base_norm = base if base.endswith("/") else base + "/"
    return base_norm + child


@context.cached
async def resolve_pointer(bucket: str, package: str, pointer: str) -> str:
    if _is_hash(pointer):
        return pointer

    s3 = await aws.get_aio_s3()
    resp = await s3.get_object(
        Bucket=bucket,
        Key=f"{NAMED_PACKAGES_PREFIX}{package}/{pointer}",
    )
    async with resp["Body"] as stream:
        return (await stream.read()).decode()


@context.cached
async def _select_meta(bucket: str, hash: str, path: T.Optional[str] = None) -> dict:
    if path:
        exp = f"SELECT s.meta FROM s3object s WHERE s.logical_key = '{sql_escape(path)}' LIMIT 1"
    else:
        exp = "SELECT s.* FROM s3object s WHERE s.logical_key is NULL LIMIT 1"

    records = await aws.s3_select(
        Bucket=bucket,
        Key=f"{MANIFESTS_PREFIX}{hash}",
        Expression=exp,
        InputSerialization={
            "JSON": {"Type": "LINES"},
            "CompressionType": "NONE",
        },
    )
    return records[0] if records else {}


@context.cached
async def _select_stats(bucket: str, hash: str) -> dict:
    records = await aws.s3_select(
        Bucket=bucket,
        Key=f"{MANIFESTS_PREFIX}{hash}",
        Expression=(
            """
            SELECT
                SUM(s."size") as total_bytes,
                COUNT(s.logical_key) as total_files
            FROM s3object s
            WHERE s.logical_key is NOT NULL
            """
        ),
        InputSerialization={
            "JSON": {"Type": "LINES"},
            "CompressionType": "NONE",
        },
    )
    return records[0] if records else {}


@context.cached
async def get_all_package_pointers(bucket: str, filter: T.Optional[str] = None) -> dict:
    """
    Return a mapping from package names to sorted lists of `RevisionPointer`s
    (most recent first) for all packages in a bucket.
    """
    pointers = {}  # package -> pointers
    by_etag = {}  # package -> etag -> pointer obj
    tags = {}  # package -> tag -> etag
    filter_re = _make_filter_re(filter)

    async for obj in aws.list_all_objects(
        Bucket=bucket,
        Prefix=NAMED_PACKAGES_PREFIX,
    ):
        name, _sep, pointer = obj["Key"][len(NAMED_PACKAGES_PREFIX):].rpartition("/")
        if filter_re and not filter_re.match(name):
            continue

        etag = obj["ETag"]

        if name not in pointers:
            pointers[name] = []
        if name not in by_etag:
            by_etag[name] = {}
        if name not in tags:
            tags[name] = {}

        if _is_timestamp(pointer):
            modified = datetime.datetime.fromtimestamp(
                int(pointer),
                datetime.timezone.utc,
            )
            pointer_obj = RevisionPointer(pointer, modified)
            by_etag[name][etag] = pointer_obj
            pointers[name].append(pointer_obj)

        # a tag, e.g. "latest"
        else:
            tags[name][pointer] = etag

    for name, package_tags in tags.items():
        for tag, etag in package_tags.items():
            by_etag[name][etag].tags.append(tag)

    for name, package_pointers in pointers.items():
        # we need pointers ordered from the most recent
        package_pointers.reverse()

    return pointers


@context.cached
async def get_package_pointers(bucket: str, package: str) -> T.List[RevisionPointer]:
    """
    Return a sorted list of `RevisionPointer`s for a package (most recent first).
    """
    try:
        all_pointers = await get_all_package_pointers.get_cached(bucket)
        return all_pointers[package]
    except get_all_package_pointers.NotCached:
        pass

    pointers = []
    by_etag = {}  # etag -> pointer obj
    tags = {}  # tag -> etag

    async for obj in aws.list_all_objects(
        Bucket=bucket,
        Prefix=f"{NAMED_PACKAGES_PREFIX}{package}/",
    ):
        _name, _sep, pointer = obj["Key"][len(NAMED_PACKAGES_PREFIX):].rpartition("/")
        etag = obj["ETag"]

        if _is_timestamp(pointer):
            modified = datetime.datetime.fromtimestamp(
                int(pointer),
                datetime.timezone.utc,
            )
            pointer_obj = RevisionPointer(pointer, modified)
            by_etag[etag] = pointer_obj
            pointers.append(pointer_obj)

        # a tag, e.g. "latest"
        else:
            tags[pointer] = etag

    for tag, etag in tags.items():
        by_etag[etag].tags.append(tag)

    # we need pointers ordered from the most recent
    pointers.reverse()
    return pointers


@context.cached
async def package_exists(bucket: str, name: str):
    s3 = await aws.get_aio_s3()
    result = await s3.list_objects_v2(
        Bucket=bucket,
        Prefix=f"{NAMED_PACKAGES_PREFIX}{name}/",
        MaxKeys=1,
    )
    return result["KeyCount"] != 0


@context.cached
async def get_user_meta(bucket: str, package: str, hash: str) -> T.Optional[dict]:
    return (await _select_meta(bucket, hash)).get("user_meta")


@context.cached
async def get_message(bucket: str, package: str, hash: str) -> T.Optional[str]:
    return (await _select_meta(bucket, hash)).get("message")


@context.cached
async def get_total_files(bucket: str, package: str, hash: str) -> T.Optional[int]:
    return (await _select_stats(bucket, hash)).get("total_files")


@context.cached
async def get_total_bytes(bucket: str, package: str, hash: str) -> T.Optional[int]:
    return (await _select_stats(bucket, hash)).get("total_bytes")


@context.cached
async def get_dir(bucket: str, hash: str, path: str) -> T.Optional[PackageDir]:
    meta = asyncio.create_task(_select_meta(bucket, hash, path))

    prefix_len = len(path)
    exp = \
        f"""
        SELECT
            SUBSTRING(s.logical_key, {prefix_len + 1}) as logical_key,
            s."size",
            s.physical_keys[0] as physical_key
        FROM s3object s
        """

    if path:
        exp += f" WHERE SUBSTRING(s.logical_key, 1, {prefix_len}) = '{sql_escape(path)}'"

    result = await aws.s3_select(
        Bucket=bucket,
        Key=f"{MANIFESTS_PREFIX}{hash}",
        Expression=exp,
        InputSerialization={
            "JSON": {"Type": "LINES"},
            "CompressionType": "NONE",
        },
        parse=False,
    )

    if result is not None:
        df = pd.read_json(
            result,
            lines=True,
            dtype=dict(logical_key="string", physical_key="string"),
        )
    else:
        df = pd.DataFrame()

    # XXX: consider executing this in a thread, since it looks quite CPU-heavy
    if {"physical_key", "logical_key", "size"}.issubset(df.columns):
        groups = df.groupby(df.logical_key.str.extract("([^/]+/?).*")[0], dropna=True)
        folder = groups.agg(
            size=("size", "sum"),
            physical_key=("physical_key", "first")
        )
        folder.reset_index(inplace=True)  # move the logical_key from the index to column[0]
        folder.rename(columns={0: "logical_key"}, inplace=True)  # name the new column
        folder.sort_values(by=["logical_key"], inplace=True)

        # Do not return physical_key for prefixes
        prefixes = folder[folder.logical_key.str.contains("/")].drop(
            ["physical_key"],
            axis=1,
        ).to_dict(orient="records")
        objects = folder[~folder.logical_key.str.contains("/")].to_dict(orient="records")
    else:
        # df might not have the expected columns if either:
        # (1) the package is empty (has zero package entries) or,
        # (2) zero package entries match the prefix filter.
        # In either case, the folder view is empty.
        prefixes = []
        objects = []

    dirs = [PackageDirEntry(
        path=_append_path(path, p["logical_key"]),
        size=p["size"],
    ) for p in prefixes]

    files = [PackageFileEntry(
        path=_append_path(path, o["logical_key"]),
        size=o["size"],
        physical_key=o["physical_key"],
    ) for o in objects]

    return PackageDir(
        path=path,
        metadata=await meta,
        children=dirs + files,
    )


@context.cached
async def get_file(bucket: str, hash: str, path: str) -> T.Optional[PackageFile]:
    res = await aws.s3_select(
        Bucket=bucket,
        Key=f"{MANIFESTS_PREFIX}{hash}",
        Expression=(
            f"""
            SELECT s.physical_keys[0] as physical_key, s."size", s.hash."value" as hash, s.meta
            FROM s3object s
            WHERE s.logical_key = '{sql_escape(path)}'
            LIMIT 1
            """
        ),
        InputSerialization={
            "JSON": {"Type": "LINES"},
            "CompressionType": "NONE",
        },
    )
    return None if not res else PackageFile(
        path=path,
        size=res[0]["size"],
        physical_key=res[0]["physical_key"],
        metadata=res[0]["meta"],
    )
