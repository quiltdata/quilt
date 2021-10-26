import ariadne
import importlib_resources


# TODO: load schema from a public shared folder
with importlib_resources.path('quilt_lite', 'schema.graphql') as schema_path:
    type_defs = ariadne.load_schema_from_path(str(schema_path))

query = ariadne.QueryType()


# Buckets
@query.field("bucketConfigs")
def query_bucket_configs(*_):
    return []

@query.field("bucketConfig")
def query_bucket_config(*_, name: str):
    return None


# Packages
class PackageList:
    def __init__(self, bucket: str, filter: str):
        self.bucket = bucket
        self.filter = filter

    def total(self):
        return 0

    # TODO: ensure perPage is converted to per_page
    def page(self, number: int, per_page: int):
        return [] # Package[]


class Package:
    def __init__(self, bucket: str, name: str):
        self.bucket = bucket
        self.name = name

    def modified(self):
        return None # Datetime

    def revisions(self):
        return {} # PackageRevisionList!

    def accessCounts(self, window: int):
        return {} # AccessCounts


class PackageEntryList:
    def __init__(self, package: Package):
        self.package = package

    def total(self):
        return 0

    def total_bytes(self):
        return 0


class PackageRevision:
    def __init__(self, package: Package):
        self.package = package

    def pointer(self):
        return "" # String!

    def hash(self):
        return "" # String!

    def modified(self):
        return None # Datetime!

    def message(self):
        return "" # String

    def metadata(self):
        return {} # JsonDict!

    def entries(self):
        return {} #PackageEntryList!


class PackageRevisionList:
    def __init__(self, package: Package):
        self.package = package

    def total(self):
        return 0

    def page(self, number: int, per_page: int):
        return [] # PackageRevision[]


@query.field("packages")
# filter is optional
def query_packages(_query, _info, bucket: str, filter: str):
    return PackageList(bucket=bucket, filter=filter)

@query.field("package")
def package(_query, _info, bucket: str, name: str):
    return Package(bucket=bucket, name=name)


schema = ariadne.make_executable_schema(type_defs, query)
