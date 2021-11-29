import datetime
import functools
import re
import typing as T

import ariadne
from cached_property import cached_property
import importlib_resources
import quilt3


# TODO: load schema from a public shared folder
with importlib_resources.path("quilt3_local", "schema.graphql") as schema_path:
    type_defs = ariadne.load_schema_from_path(str(schema_path))

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
    def __init__(self, bucket: str, name: str, hash: str, tags: T.Optional[T.List[str]] = None):
        self.bucket = bucket
        self.name = name
        self.hash = hash
        self.tags = tags

    @cached_property
    def _browse(self):
        return quilt3.Package.browse(self.name, f"s3://{self.bucket}", self.hash)

    def modified(self, *_):
        # TODO: figure out where to find mtime (manifest timestamp maybe?)
        return datetime.datetime.now()

    @property
    def metadata(self):
        return self._browse._meta

    @property
    def userMeta(self):
        return self.metadata.get("user_meta")

    @cached_property
    def message(self):
        return self.metadata.get("message")

    @cached_property
    def totalEntries(self):
        return sum(1 for _ in self._browse.walk())

    @cached_property
    def totalBytes(self, *_):
        return sum(entry.size for key, entry in self._browse.walk())

    def dir(self, *_, path: str):
        try:
            subpkg = self._browse[path] if path else self._browse
        except KeyError:
            return None

        if not isinstance(subpkg, quilt3.Package):
            return None
        return PackageDirWrapper(path, subpkg)

    def file(self, *_, path: str):
        try:
            entry = self._browse[path]
        except KeyError:
            return None

        if not isinstance(entry, quilt3.packages.PackageEntry):
            return None
        return PackageFileWrapper(path, entry)


class RevisionListWrapper:
    def __init__(self, bucket: str, name: str):
        self.bucket = bucket
        self.name = name

    @cached_property
    def _package_versions(self):
        # XXX: for some reason it's sooooooo slow
        return dict(quilt3.list_package_versions(self.name, f"s3://{self.bucket}"))

    @cached_property
    def _revisions_by_hash(self):
        by_hash = {}
        for tag, hash in self._package_versions.items():
            if hash in by_hash:
                by_hash[hash].append(tag)
            else:
                by_hash[hash] = [tag]
        return by_hash

    @cached_property
    def _revision_wrappers(self):
        #XXX: order?
        wrappers = [RevisionWrapper(bucket=self.bucket, name=self.name, hash=hash, tags=tags) for hash, tags in self._revisions_by_hash.items()]
        return wrappers

    @cached_property
    def total(self):
        return len(self._revisions_by_hash)

    def page(self, *_, number: int, perPage: int):
        offset = (number - 1) * perPage
        return self._revision_wrappers[offset:offset + perPage]


POINTER_RE = re.compile("^1[0-9]{9}$")


def is_pointer(hash_or_tag: str):
    if hash_or_tag == "latest": return True
    if POINTER_RE.match(hash_or_tag): return True
    return False

class PackageWrapper:
    def __init__(self, bucket: str, name: str):
        self.bucket = bucket
        self.name = name

    @cached_property
    def _browse(self):
        return quilt3.Package.browse(self.name, f"s3://{self.bucket}")

    @cached_property
    def modified(self):
        # TODO: figure out where to find mtime (manifest timestamp maybe?)
        return datetime.datetime.fromisoformat("2021-10-21")

    @cached_property
    def revisions(self):
        return RevisionListWrapper(self.bucket, self.name)

    def revision(self, *_, hashOrTag: str):
        registry = quilt3.backends.get_package_registry(f"s3://{self.bucket}")
        hash = (
            quilt3.data_transfer.get_bytes(registry.pointer_pk(self.name, hashOrTag)).decode()
            if is_pointer(hashOrTag) else
            registry.resolve_top_hash(self.name, hashOrTag)
        )
        return RevisionWrapper(bucket=self.bucket, name=self.name, hash=hash)


class PackageListWrapper:
    def __init__(self, bucket: str, filter: T.Optional[str] = None):
        self.bucket = bucket
        self.filter = filter

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
    def _filtered_package_list(self):
        packages = quilt3.list_packages(f"s3://{self.bucket}")
        if self.filter:
            packages = filter(lambda package_name: self.filter in package_name, packages)
        return list(packages)

    @cached_property
    def _package_wrappers(self):
        return [PackageWrapper(self.bucket, name) for name in self._filtered_package_list]

    def total(self, *_):
        return len(self._filtered_package_list)

    # TODO: ensure perPage is converted to per_page
    # order is actually an enum 'NAME' | 'MODIFIED'
    def page(self, *_, number: int, perPage: int, order: str):
        key = lambda p: p.name
        reverse = False
        if order == 'MODIFIED':
            key = lambda p: p.modified
            reverse = True
        sorted_packages = sorted(self._package_wrappers, key=key, reverse=reverse)
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


schema = ariadne.make_executable_schema(
    type_defs,
    query_type,
    package_entry_type,
    datetime_scalar,
)
