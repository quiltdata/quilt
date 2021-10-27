import datetime
import typing as T

import ariadne
import importlib_resources


# TODO: load schema from a public shared folder
with importlib_resources.path("quilt_lite", "schema.graphql") as schema_path:
    type_defs = ariadne.load_schema_from_path(str(schema_path))

datetime_scalar = ariadne.ScalarType("Datetime")

@datetime_scalar.serializer
def serialize_datetime(value):
    return value.isoformat()


query = ariadne.QueryType()


# Buckets
@query.field("bucketConfigs")
def query_bucket_configs(*_):
    return []

@query.field("bucketConfig")
def query_bucket_config(*_, name: str):
    return None


# Packages
class Package:
    def __init__(self, bucket: str, name: str):
        self.bucket = bucket
        self.name = name

    def modified(self, *_):
        # return None # Datetime
        return datetime.datetime.now()

    # def set_revisions(self, revisions: list(PackageRevision)):
    def set_revisions(self, revisions):
        self._revisions = revisions

    def get_revisions(self):
        return self._revisions

    def revisions(self, *_):
        # return {} # PackageRevisionList!
        return PackageRevisionList(self)

    def accessCounts(self, *_, window: int):
        return None #{} # AccessCounts


class PackageRevision:
    def __init__(self, package: Package, pointer: str, hash: str):
        self.package = package
        self.pointer = pointer
        self.hash = hash

    # def pointer(self):
    #     return "" # String!
    #
    # def hash(self):
    #     return "" # String!

    def modified(self, *_):
        # return None # Datetime!
        return datetime.datetime.now()

    def message(self, *_):
        return "test message" # String

    def metadata(self, *_):
        return {} # JsonDict!

    def entries(self, *_):
        # return {} #PackageEntryList!
        return PackageEntryList(self)


pkg1 = Package(
    bucket="quilt-nl0-stage",
    name="nl0/pkg1",
)
pkg1.set_revisions([PackageRevision(pkg1, pointer="latest", hash="hash1")])

pkg2 = Package(
    bucket="quilt-nl0-stage",
    name="nl0/pkg2",
)
pkg2.set_revisions([PackageRevision(pkg2, pointer="latest", hash="hash2")])

dummy_pkg_list = [pkg1, pkg2]


class PackageList:
    def __init__(self, bucket: str, filter: T.Optional[str] = None):
        self.bucket = bucket
        self.filter = filter

    def total(self, *_):
        # count packages
        return len(dummy_pkg_list)
        # return 0

    # TODO: ensure perPage is converted to per_page
    def page(self, *_, number: int, perPage: int):
        # fetch packages
        return dummy_pkg_list
        # return [] # Package[]


class PackageEntryList:
    def __init__(self, package: Package):
        self.package = package

    def total(self, *_):
        return 10

    def total_bytes(self, *_):
        return 100000


class PackageRevisionList:
    def __init__(self, package: Package):
        self.package = package

    def total(self, *_):
        # return 0
        return len(self.package.get_revisions())

    def page(self, *_, number: int, perPage: int):
        return self.package.get_revisions()
        # return [] # PackageRevision[]


@query.field("packages")
# filter is optional
def query_packages(_query, _info, bucket: str, filter: T.Optional[str] = None):
    return PackageList(bucket=bucket, filter=filter)

@query.field("package")
def package(_query, _info, bucket: str, name: str):
    return Package(bucket=bucket, name=name)


schema = ariadne.make_executable_schema(type_defs, query, datetime_scalar)
