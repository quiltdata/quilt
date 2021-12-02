import asyncio
import datetime
import re
import typing as T
from functools import partial

import ariadne
import boto3
import graphql
import importlib_resources
from cached_property import cached_property

from . import pkgselect
from .run_async import run_async

NAMED_PACKAGES_PREFIX = ".quilt/named_packages/"
MANIFESTS_PREFIX = ".quilt/packages/"
HASH_RE = re.compile("^[0-9a-f]{64}$")
POINTER_RE = re.compile("^1[0-9]{9}$")


def is_pointer(hash_or_tag: str):
    return hash_or_tag == "latest" or bool(POINTER_RE.match(hash_or_tag))


def is_hash(hash_or_tag: str):
    return bool(HASH_RE.match(hash_or_tag))


def append_path(base: str, child: str):
    if not base:
        return child
    return f"{base}/{child}"


s3 = boto3.client("s3")


def get_all_objects(**kw):
    return [
        obj for page in s3.get_paginator("list_objects_v2").paginate(**kw)
        for obj in page["Contents"]
    ]


def get_hash_sync(bucket: str, package: str, pointer: str):
    return s3.get_object(
        Bucket=bucket,
        Key=f"{NAMED_PACKAGES_PREFIX}{package}/{pointer}",
    )["Body"].read().decode()


async def get_hash(*args, **kwargs):
    return await run_async(partial(get_hash_sync, *args, **kwargs))


datetime_scalar = ariadne.ScalarType(
    "Datetime",
    serializer=lambda value: value and value.isoformat(),
)


query_type = ariadne.QueryType()


@query_type.field("bucketConfigs")
def query_bucket_configs(*_):
    return []


@query_type.field("bucketConfig")
def query_bucket_config(*_, name: str):
    return None


class RevisionWrapper:
    def __init__(
        self,
        bucket: str,
        name: str,
        hash: str,
        modified: T.Optional[datetime.datetime] = None,
    ):
        self.bucket = bucket
        self.name = name
        self.hash = hash
        self.modified = modified

    @cached_property
    async def _root(self):
        return await pkgselect.select_root(
            bucket=self.bucket,
            manifest=f"{MANIFESTS_PREFIX}{self.hash}",
        )

    @property
    async def metadata(self):
        return (await self._root)["meta"]

    @property
    async def userMeta(self):
        return (await self.metadata).get("user_meta")

    @property
    async def message(self):
        return (await self.metadata).get("message")

    @property
    async def totalEntries(self):
        return (await self._root)["total_files"]

    @property
    async def totalBytes(self):
        return (await self._root)["total_bytes"]

    async def dir(self, *_, path: str):
        res = await pkgselect.select_dir(
            bucket=self.bucket,
            manifest=f"{MANIFESTS_PREFIX}{self.hash}",
            path=path,
            limit=20_000,
        )
        if res is None:
            return None

        dirs = [{
            "__typename": "PackageDir",
            "path": append_path(path, p["logical_key"]),
            "size": p["size"],
        } for p in res["prefixes"]]

        files = [{
            "__typename": "PackageFile",
            "path": append_path(path, o["logical_key"]),
            "size": o["size"],
            "physicalKey": o["physical_key"],
        } for o in res["objects"]]

        return {
            "path": path,
            "metadata": res["meta"],
            "children": dirs + files,
        }

    async def file(self, *_, path: str):
        res = await pkgselect.select_file(
            bucket=self.bucket,
            manifest=f"{MANIFESTS_PREFIX}{self.hash}",
            path=path,
        )
        if res is None:
            return None
        return {
            "path": path,
            "size": res["size"],
            "physicalKey": res["physical_key"],
            "metadata": res["meta"],
        }


class RevisionListWrapper:
    def __init__(self, bucket: str, name: str, revision_map: dict):
        self.bucket = bucket
        self.name = name
        self._revision_map = revision_map

    @cached_property
    async def _revisions_by_hash(self):
        hashes_futures = {
            pointer: get_hash(self.bucket, self.name, pointer)
            for pointer in self._revision_map
        }
        by_hash = {}
        for pointer, modified in self._revision_map.items():
            hash_ = await hashes_futures[pointer]
            if hash_ in by_hash:
                by_hash[hash_].append(pointer)
            else:
                by_hash[hash_] = [pointer]
        return by_hash

    def _get_modified(self, pointers: T.List[str]):
        return max(
            m for pointer, m in self._revision_map.items()
            if pointer in pointers
        )

    @cached_property
    async def _revision_wrappers(self):
        revisions_by_hash = await self._revisions_by_hash
        wrappers = [RevisionWrapper(
            bucket=self.bucket,
            name=self.name,
            hash=hash_,
            modified=self._get_modified(pointers),
        ) for hash_, pointers in revisions_by_hash.items()]

        return sorted(
            wrappers,
            key=lambda rw: rw.modified,
            reverse=True,
        )

    @property
    def total(self):
        return len(self._revision_map) - 1  # minus "latest"

    async def page(self, *_, number: int, perPage: int):
        offset = (number - 1) * perPage
        return (await self._revision_wrappers)[offset:offset + perPage]


class PackageWrapper:
    def __init__(self, bucket: str, name: str, revisions: T.Optional[dict] = None):
        self.bucket = bucket
        self.name = name
        self._revision_map = revisions

    @cached_property
    async def revision_map(self):
        if self._revision_map:
            return self._revision_map

        revisions = {}
        for obj in await run_async(partial(
            get_all_objects,
            Bucket=self.bucket,
            Prefix=f"{NAMED_PACKAGES_PREFIX}{self.name}/",
        )):
            name, _, pointer = obj["Key"][len(NAMED_PACKAGES_PREFIX):].rpartition("/")
            modified = obj["LastModified"]
            revisions[pointer] = modified
        return revisions

    @cached_property
    async def modified(self):
        return max((await self.revision_map).values())

    @cached_property
    async def revisions(self):
        return RevisionListWrapper(self.bucket, self.name, await self.revision_map)

    async def revision(self, *_, hashOrTag: str):
        if is_hash(hashOrTag):
            hash_ = hashOrTag
        elif is_pointer(hashOrTag):
            hash_ = await get_hash(self.bucket, self.name, hashOrTag)
        else:
            return None
        return RevisionWrapper(bucket=self.bucket, name=self.name, hash=hash_)


def transform_char(char: str) -> str:
    if char == "*":
        return ".*"
    if char == "?":
        return ".{0,1}"
    if char.isalpha():
        return f"[{char.lower()}{char.capitalize()}]"
    if char in '.+|{}[]()"\\#@&<>~':
        return f"\\{char}"
    return char


def make_filter_re(filter: str):
    if not filter:
        return {"match_all": {}}
    if not re.match("[*?]", filter):
        filter = f"*{filter}*"
    value = "".join(transform_char(char) for char in filter)
    return re.compile(f"^{value}$")


class PackageListWrapper:
    def __init__(self, bucket: str, filter: T.Optional[str] = None):
        self.bucket = bucket
        self.filter = filter

    @cached_property
    async def _package_list(self):
        packages = {}
        for obj in await run_async(partial(
            get_all_objects,
            Bucket=self.bucket,
            Prefix=NAMED_PACKAGES_PREFIX,
        )):
            name, _, pointer = obj["Key"][len(NAMED_PACKAGES_PREFIX):].rpartition("/")
            modified = obj["LastModified"]
            if name not in packages:
                packages[name] = {}
            packages[name][pointer] = modified
        return packages

    @cached_property
    async def _filtered_package_list(self):
        packages = await self._package_list
        if self.filter:
            filter_re = make_filter_re(self.filter)
            packages = {name: v for name, v in packages.items() if filter_re.match(name)}
        return packages

    @cached_property
    async def _package_wrappers(self):
        packages = await self._filtered_package_list
        return [
            PackageWrapper(self.bucket, name, revisions)
            for name, revisions in packages.items()
        ]

    async def total(self, *_):
        return len(await self._filtered_package_list)

    # TODO: ensure perPage is converted to per_page
    # order is actually an enum 'NAME' | 'MODIFIED'
    async def page(self, *_, number: int, perPage: int, order: str):
        package_wrappers = await self._package_wrappers
        if order == "NAME":
            reverse = False

            def key(p):
                return p.name

        elif order == "MODIFIED":
            reverse = True
            modified_awaited = dict(zip(
                [p.name for p in package_wrappers],
                await asyncio.gather(*[p.modified for p in package_wrappers]),
            ))

            def key(p):
                return modified_awaited[p.name]

        else:
            raise ValueError(f"Unsupported 'order': '{order}'")

        sorted_packages = sorted(package_wrappers, key=key, reverse=reverse)
        offset = (number - 1) * perPage
        return sorted_packages[offset:offset + perPage]


@query_type.field("packages")
def query_packages(_query, _info, bucket: str, filter: T.Optional[str] = None):
    return PackageListWrapper(bucket, filter)


@query_type.field("package")
def package(_query, _info, bucket: str, name: str):
    return PackageWrapper(bucket, name)


# TODO: load schema from a public shared folder
with importlib_resources.path("quilt3_local", "schema.graphql") as schema_path:
    type_defs = ariadne.load_schema_from_path(str(schema_path))

schema = ariadne.make_executable_schema(
    type_defs,
    query_type,
    datetime_scalar,
)

# patch graphql constraints to supports largest ints JS can handle
# (graphql only supports 32-bit ints by the spec)
graphql.type.scalars.MAX_INT = 2**53 - 1
graphql.type.scalars.MIN_INT = -(2**53 - 1)
