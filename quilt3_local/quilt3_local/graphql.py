import asyncio
import datetime
from functools import partial
import re
import typing as T

import ariadne
import boto3
from cached_property import cached_property
import importlib_resources
import quilt3


NAMED_PACKAGES_PREFIX = ".quilt/named_packages/"

s3 = boto3.client("s3")


async def run_async(fn, executor=None, loop=None):
    if loop is None:
        loop = asyncio.get_running_loop()
    return await loop.run_in_executor(executor, fn)


datetime_scalar = ariadne.ScalarType("Datetime")

@datetime_scalar.serializer
def serialize_datetime(value):
    return value.isoformat()


query_type = ariadne.QueryType()


# Buckets
@query_type.field("bucketConfigs")
def query_bucket_configs(*_):
    return []

@query_type.field("bucketConfig")
def query_bucket_config(*_, name: str):
    return None


def append_path(base: str, child: str):
    if not base: return child
    return f"{base}/{child}"


class PackageDirWrapper:
    def __init__(self, path: str, subpkg: quilt3.Package):
        self.path = path
        self._subpkg = subpkg

    @property
    def metadata(self):
        return self._subpkg._meta

    @cached_property
    def children(self):
        dirs = []
        files = []
        for path in self._subpkg.keys():
            sub = self._subpkg[path]
            full_path = append_path(self.path, path)
            if isinstance(sub, quilt3.Package):
                dirs.append(PackageDirWrapper(full_path, sub))
            else:
                files.append(PackageFileWrapper(full_path, sub))

        return dirs + files

    @property
    def size(self):
        # TODO: compute size
        return 0

class PackageFileWrapper:
    def __init__(self, path: str, entry: quilt3.packages.PackageEntry):
        self.path = path
        self.entry = entry

    @cached_property
    def size(self):
        return self.entry.size

    @cached_property
    def metadata(self):
        return self.entry._meta

    @cached_property
    def physicalKey(self):
        return str(self.entry.physical_key)

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
    async def _browse(self):
        return await run_async(partial(
            quilt3.Package.browse,
            self.name,
            f"s3://{self.bucket}",
            self.hash,
        ))

    #XXX: get from s3select
    @property
    async def metadata(self):
        return (await self._browse)._meta

    #XXX: get from s3select
    @property
    async def userMeta(self):
        return (await self.metadata).get("user_meta")

    #XXX: get from s3select
    @cached_property
    async def message(self):
        return (await self.metadata).get("message")

    #XXX: get from s3select
    @cached_property
    async def totalEntries(self):
        return sum(1 for _ in (await self._browse).walk())

    #XXX: get from s3select
    @cached_property
    async def totalBytes(self, *_):
        return sum(entry.size for key, entry in (await self._browse).walk())

    #XXX: get from s3select
    async def dir(self, *_, path: str):
        try:
            pkg = await self._browse
            subpkg = pkg[path] if path else pkg
        except KeyError:
            return None

        if not isinstance(subpkg, quilt3.Package):
            return None
        return PackageDirWrapper(path, subpkg)

    #XXX: get from s3select
    async def file(self, *_, path: str):
        try:
            entry = (await self._browse)[path]
        except KeyError:
            return None

        if not isinstance(entry, quilt3.packages.PackageEntry):
            return None
        return PackageFileWrapper(path, entry)


class RevisionListWrapper:
    def __init__(self, bucket: str, name: str, revision_map: dict):
        self.bucket = bucket
        self.name = name
        self._revision_map = revision_map

    async def _get_hash(self, pointer: str):
        registry = quilt3.backends.get_package_registry(f"s3://{self.bucket}")
        hash_bytes = await run_async(partial(
            quilt3.data_transfer.get_bytes,
            registry.pointer_pk(self.name, pointer),
        ))
        return hash_bytes.decode()

    @cached_property
    async def _revisions_by_hash(self):
        hashes_futures = {pointer: self._get_hash(pointer) for pointer in self._revision_map}
        by_hash = {}
        for pointer, modified in self._revision_map.items():
            hash_ = await hashes_futures[pointer]
            if hash_ in by_hash:
                by_hash[hash_].append(pointer)
            else:
                by_hash[hash_] = [pointer]
        return by_hash

    def _get_modified(self, pointers: T.List[str]):
        return max(m for pointer, m in self._revision_map.items()
            if pointer in pointers)

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
        return len(self._revision_map) - 1 # minus "latest"

    async def page(self, *_, number: int, perPage: int):
        offset = (number - 1) * perPage
        return (await self._revision_wrappers)[offset:offset + perPage]


POINTER_RE = re.compile("^1[0-9]{9}$")


def is_pointer(hash_or_tag: str):
    if hash_or_tag == "latest": return True
    if POINTER_RE.match(hash_or_tag): return True
    return False

class PackageWrapper:
    def __init__(self, bucket: str, name: str, revisions: T.Optional[dict] = None):
        self.bucket = bucket
        self.name = name
        self._revision_map = revisions

    @cached_property
    async def revision_map(self):
        if self._revision_map:
            return self._revision_map

        #TODO: drain past 1k
        resp = await run_async(partial(
            s3.list_objects_v2,
            Bucket=self.bucket,
            Prefix=f"{NAMED_PACKAGES_PREFIX}{self.name}",
        ))
        revisions = {}
        for obj in resp["Contents"]:
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

    def revision(self, *_, hashOrTag: str):
        #TODO: s3/s3select?
        registry = quilt3.backends.get_package_registry(f"s3://{self.bucket}")
        hash_ = (
            quilt3.data_transfer.get_bytes(registry.pointer_pk(self.name, hashOrTag)).decode()
            if is_pointer(hashOrTag) else
            registry.resolve_top_hash(self.name, hashOrTag)
        )
        return RevisionWrapper(bucket=self.bucket, name=self.name, hash=hash_)


class PackageListWrapper:
    def __init__(self, bucket: str, filter: T.Optional[str] = None):
        self.bucket = bucket
        self.filter = filter

    @cached_property
    async def _package_list(self):
        resp = await run_async(partial(
            s3.list_objects_v2,
            Bucket=self.bucket,
            Prefix=NAMED_PACKAGES_PREFIX,
        ))
        packages = {}
        #XXX: consider draining pointers past 1k
        for obj in resp["Contents"]:
            name, _, pointer = obj["Key"][len(NAMED_PACKAGES_PREFIX):].rpartition("/")
            modified = obj["LastModified"]
            if name not in packages:
                packages[name] = {}
            packages[name][pointer] = modified
        return packages

    # TODO: proper filtering
    # pipeThru(filter)(
    #           R.unless(R.test(/[*?]/), (f) => `*${f}*`),
    #           R.map(
    #             R.cond([
    #               [isLetter, bothCases],
    #               [isReserved, escapeReserved],
    #               [R.equals('*'), () => '.*'],
    #               [R.equals('?'), () => '.{0,1}'],
    #               [R.T, R.identity],
    #             ]),
    #           ),
    #           R.join(''),
    @cached_property
    async def _filtered_package_list(self):
        packages = await self._package_list
        if self.filter:
            packages = {name: v for name, v in packages if self.filter in name}
        return packages

    @cached_property
    async def _package_wrappers(self):
        packages = await self._filtered_package_list
        return [PackageWrapper(self.bucket, name, revisions)
            for name, revisions in packages.items()]

    async def total(self, *_):
        return len(await self._filtered_package_list)

    # TODO: ensure perPage is converted to per_page
    # order is actually an enum 'NAME' | 'MODIFIED'
    async def page(self, *_, number: int, perPage: int, order: str):
        key = lambda p: p.name
        reverse = False
        package_wrappers = await self._package_wrappers
        if order == 'MODIFIED':
            modified_awaited = {p.modified: await p.modified for p in package_wrappers}
            key = lambda p: modified_awaited[p.modified]
            reverse = True
        sorted_packages = sorted(package_wrappers, key=key, reverse=reverse)
        offset = (number - 1) * perPage
        return sorted_packages[offset:offset + perPage]


def resolve_package_entry_type(obj, *_):
    if isinstance(obj, PackageFileWrapper): return "PackageFile"
    if isinstance(obj, PackageDirWrapper): return "PackageDir"
    return None

package_entry_type = ariadne.UnionType("PackageEntry", resolve_package_entry_type)

@query_type.field("packages")
def query_packages(_query, _info, bucket: str, filter: T.Optional[str] = None):
    return PackageListWrapper(bucket=bucket, filter=filter)

@query_type.field("package")
def package(_query, _info, bucket: str, name: str):
    return PackageWrapper(bucket, name)


# TODO: load schema from a public shared folder
with importlib_resources.path("quilt3_local", "schema.graphql") as schema_path:
    type_defs = ariadne.load_schema_from_path(str(schema_path))

schema = ariadne.make_executable_schema(
    type_defs,
    query_type,
    package_entry_type,
    datetime_scalar,
)
