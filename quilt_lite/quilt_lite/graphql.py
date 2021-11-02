import datetime
import functools
import typing as T

import ariadne
import importlib_resources
import quilt3


# TODO: load schema from a public shared folder
with importlib_resources.path("quilt_lite", "schema.graphql") as schema_path:
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


class RevisionWrapper:
    def __init__(self, bucket: str, name: str, hash: str, tags: T.Optional[list[str]]):
        self.bucket = bucket
        self.name = name
        self.hash = hash
        self.tags = tags

    @functools.cached_property
    def _browse(self):
        return quilt3.Package.browse(self.name, f"s3://${self.bucket}", self.hash)

    def modified(self, *_):
        return datetime.datetime.now()

    def message(self, *_):
        #TODO: get from meta
        return "test message" # String

    @functools.cached_property
    def metadata(self):
        #TODO: return meta (all meta or just user_meta?)
        return {"test": "meta"} # JsonDict!

    def totalEntries(self, *_):
        #TODO
        return 1

    def totalBytes(self, *_):
        #TODO
        return 1

    def dir(self, *_, path: str):
        #TODO -> PackageDir
        return None

    def file(self, *_, path: str):
        #TODO -> PackageFile
        return None

    def accessCounts(self, *_, **__):
        return None

class RevisionListWrapper:
    def __init__(self, bucket: str, name: str):
        self.bucket = bucket
        self.name = name

    @functools.cached_property
    def _package_versions(self):
        # XXX: for some reason it's sooooooo slow
        return dict(quilt3.list_package_versions(self.name, f"s3://{self.bucket}"))

    @functools.cached_property
    def _revisions_by_hash(self):
        by_hash = {}
        for tag, hash in self._package_versions.items():
            if hash in by_hash:
                by_hash[hash].append(tag)
            else:
                by_hash[hash] = [tag]
        return by_hash

    @functools.cached_property
    def _revision_wrappers(self):
        #XXX: order?
        wrappers = [RevisionWrapper(bucket=self.bucket, name=self.name, hash=hash, tags=tags) for hash, tags in self._revisions_by_hash.items()]
        return wrappers

    @functools.cached_property
    def total(self):
        print('versions', self._revisions_by_hash)
        return len(self._revisions_by_hash)

    def page(self, *_, number: int, perPage: int):
        offset = (number - 1) * perPage
        return self._revision_wrappers[offset:offset + perPage]


class PackageWrapper:
    def __init__(self, bucket: str, name: str):
        self.bucket = bucket
        self.name = name

    @functools.cached_property
    def _browse(self):
        return quilt3.Package.browse(self.name, f"s3://${self.bucket}")

    @functools.cached_property
    def modified(self):
        # TODO: get meta, find mtime
        return datetime.datetime.fromisoformat("2021-10-21")

    @functools.cached_property
    def revisions(self):
        return RevisionListWrapper(self.bucket, self.name)

    def revision(self, *_, hashOrTag: str):
        # TODO: resolve revision
        return None

    def accessCounts(self, *_, **__):
        return None


class PackageListWrapper:
    def __init__(self, bucket: str, filter: T.Optional[str] = None):
        self.bucket = bucket
        self.filter = filter

    @functools.cached_property
    def _package_list(self):
        return quilt3.list_packages(f"s3://{self.bucket}")

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
    def _filter(self, package_name):
        if not self.filter: return True
        return self.filter in package_name

    @functools.cached_property
    def _filtered_package_list(self):
        return list(filter(self._filter, self._package_list))

    @functools.cached_property
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


@query_type.field("packages")
def query_packages(_query, _info, bucket: str, filter: T.Optional[str] = None):
    return PackageListWrapper(bucket=bucket, filter=filter)

@query_type.field("package")
def package(_query, _info, bucket: str, name: str):
    return PackageWrapper(bucket, name)


schema = ariadne.make_executable_schema(type_defs, query_type, datetime_scalar)
