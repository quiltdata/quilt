import asyncio
import dataclasses
import datetime
import typing as T

import ariadne

from . import buckets, packages, search
from ._upstream import resource_path

DatetimeScalar = ariadne.ScalarType(
    "Datetime",
    serializer=lambda value: value if value is None else value.isoformat(),
)

QueryType = ariadne.QueryType()

PackageListType = ariadne.ObjectType("PackageList")
PackageType = ariadne.ObjectType("Package")
PackageRevisionListType = ariadne.ObjectType("PackageRevisionList")
PackageRevisionType = ariadne.ObjectType("PackageRevision")
PackageEntryType = ariadne.UnionType("PackageEntry")
PackageFileType = ariadne.ObjectType("PackageFile")
PackagesSearchResultType = ariadne.UnionType("PackagesSearchResult")
PackagesSearchMoreResultType = ariadne.UnionType("PackagesSearchMoreResult")
ObjectsSearchResultType = ariadne.UnionType("ObjectsSearchResult")
ObjectsSearchMoreResultType = ariadne.UnionType("ObjectsSearchMoreResult")
PackageUserMetaFacetType = ariadne.InterfaceType("IPackageUserMetaFacet")
PackagesSearchResultSetType = ariadne.ObjectType("PackagesSearchResultSet")
ObjectsSearchResultSetType = ariadne.ObjectType("ObjectsSearchResultSet")
PackageFileType.set_alias("physicalKey", "physical_key")

LOCAL_SEARCH_TYPE_DEFS = ariadne.gql(
        """
        extend type Query {
            searchObjects(
                buckets: [String!]
                searchString: String
                filter: ObjectsSearchFilter
            ): ObjectsSearchResult!
            searchPackages(
                buckets: [String!]
                searchString: String
                filter: PackagesSearchFilter
                userMetaFilters: [PackageUserMetaPredicate!]
                latestOnly: Boolean = false
            ): PackagesSearchResult!
            searchMoreObjects(after: String!, size: Int): ObjectsSearchMoreResult!
            searchMorePackages(after: String!, size: Int): PackagesSearchMoreResult!
        }

        enum SearchResultOrder {
            BEST_MATCH
            NEWEST
            OLDEST
            LEX_ASC
            LEX_DESC
        }

        input DatetimeSearchPredicate {
            gte: Datetime
            lte: Datetime
        }

        input NumberSearchPredicate {
            gte: Float
            lte: Float
        }

        input KeywordSearchPredicate {
            terms: [String!]
            wildcard: String
        }

        input TextSearchPredicate {
            queryString: String!
        }

        input BooleanSearchPredicate {
            true: Boolean
            false: Boolean
        }

        input ObjectsSearchFilter {
            modified: DatetimeSearchPredicate
            size: NumberSearchPredicate
            ext: KeywordSearchPredicate
            key: KeywordSearchPredicate
            content: TextSearchPredicate
            deleted: BooleanSearchPredicate
        }

        input PackagesSearchFilter {
            modified: DatetimeSearchPredicate
            size: NumberSearchPredicate
            name: KeywordSearchPredicate
            hash: KeywordSearchPredicate
            entries: NumberSearchPredicate
            comment: TextSearchPredicate
            workflow: KeywordSearchPredicate
        }

        input PackageUserMetaPredicate {
            path: String!
            datetime: DatetimeSearchPredicate
            number: NumberSearchPredicate
            text: TextSearchPredicate
            keyword: KeywordSearchPredicate
            boolean: BooleanSearchPredicate
        }

        type EmptySearchResultSet {
            _: Boolean
        }

        type DatetimeExtents {
            min: Datetime!
            max: Datetime!
        }

        type NumberExtents {
            min: Float!
            max: Float!
        }

        type KeywordExtents {
            values: [String!]!
        }

        interface IPackageUserMetaFacet {
            path: String!
        }

        enum PackageUserMetaFacetType {
            NUMBER
            DATETIME
            KEYWORD
            TEXT
            BOOLEAN
        }

        type NumberPackageUserMetaFacet implements IPackageUserMetaFacet {
            path: String!
            extents: NumberExtents!
        }

        type DatetimePackageUserMetaFacet implements IPackageUserMetaFacet {
            path: String!
            extents: DatetimeExtents!
        }

        type KeywordPackageUserMetaFacet implements IPackageUserMetaFacet {
            path: String!
            extents: KeywordExtents!
        }

        type TextPackageUserMetaFacet implements IPackageUserMetaFacet {
            path: String!
        }

        type BooleanPackageUserMetaFacet implements IPackageUserMetaFacet {
            path: String!
        }

        type SearchHitObject {
            id: ID!
            score: Float!
            bucket: String!
            key: String!
            version: String!
            size: Float!
            modified: Datetime!
            deleted: Boolean!
            indexedContent: String
        }

        type ObjectsSearchResultSetPage {
            cursor: String
            hits: [SearchHitObject!]!
        }

        type ObjectsSearchStats {
            modified: DatetimeExtents!
            size: NumberExtents!
            ext: KeywordExtents!
        }

        type ObjectsSearchResultSet {
            total: Int!
            stats: ObjectsSearchStats!
            firstPage(size: Int, order: SearchResultOrder): ObjectsSearchResultSetPage!
        }

        union ObjectsSearchResult = ObjectsSearchResultSet | EmptySearchResultSet | InvalidInput | OperationError
        union ObjectsSearchMoreResult = ObjectsSearchResultSetPage | InvalidInput | OperationError

        type SearchHitPackageEntryMatchLocations {
            logicalKey: Boolean!
            physicalKey: Boolean!
            meta: Boolean!
            contents: Boolean!
        }

        type SearchHitPackageMatchingEntry {
            logicalKey: String!
            physicalKey: String!
            size: Float!
            meta: String
            matchLocations: SearchHitPackageEntryMatchLocations!
        }

        type SearchHitPackageMatchLocations {
            name: Boolean!
            comment: Boolean!
            meta: Boolean!
            workflow: Boolean!
        }

        type SearchHitPackage {
            id: ID!
            score: Float!
            bucket: String!
            name: String!
            pointer: String!
            hash: String!
            size: Float!
            modified: Datetime!
            totalEntriesCount: Int!
            comment: String
            meta: String
            workflow: JsonRecord
            matchLocations: SearchHitPackageMatchLocations!
            matchingEntries: [SearchHitPackageMatchingEntry!]!
        }

        type PackagesSearchResultSetPage {
            cursor: String
            hits: [SearchHitPackage!]!
        }

        type PackagesSearchStats {
            modified: DatetimeExtents!
            size: NumberExtents!
            entries: NumberExtents!
            workflow: KeywordExtents!
            userMeta: [IPackageUserMetaFacet!]!
            userMetaTruncated: Boolean!
        }

        type PackagesSearchResultSet {
            total: Int!
            stats: PackagesSearchStats!
            filteredUserMetaFacets(path: String!, type: PackageUserMetaFacetType): [IPackageUserMetaFacet!]!
            firstPage(size: Int, order: SearchResultOrder): PackagesSearchResultSetPage!
        }

        union PackagesSearchResult = PackagesSearchResultSet | EmptySearchResultSet | InvalidInput | OperationError
        union PackagesSearchMoreResult = PackagesSearchResultSetPage | InvalidInput | OperationError
        """
)


@dataclasses.dataclass
class PackageListContext:
    bucket: str
    filter: T.Optional[str] = None


@dataclasses.dataclass
class PackageContext:
    bucket: str
    name: str


@dataclasses.dataclass
class PackageRevisionContext:
    package: PackageContext
    hash: str
    modified: T.Optional[datetime.datetime] = None


def _typename(obj: T.Any) -> T.Optional[str]:
    if isinstance(obj, dict):
        return obj.get("__typename")
    return None


@QueryType.field("bucketConfigs")
async def query_bucket_configs(*_):
    return await buckets.list_bucket_configs()


@QueryType.field("bucketConfig")
async def query_bucket_config(*_, name: str):
    return await buckets.get_bucket_config(name)


@PackageEntryType.type_resolver
def package_entry_typename(entry: T.Any, *_):
    if isinstance(entry, packages.PackageDirEntry):
        return "PackageDir"
    if isinstance(entry, packages.PackageFileEntry):
        return "PackageFile"
    return None


@PackagesSearchResultType.type_resolver
@PackagesSearchMoreResultType.type_resolver
@ObjectsSearchResultType.type_resolver
@ObjectsSearchMoreResultType.type_resolver
def search_result_typename(result: T.Any, *_):
    return _typename(result)


@PackageUserMetaFacetType.type_resolver
def package_user_meta_facet_typename(result: T.Any, *_):
    return _typename(result)


@PackageRevisionType.field("userMeta")
async def package_revision_user_meta(revision: PackageRevisionContext, *_):
    return await packages.get_user_meta(revision.package.bucket, revision.package.name, revision.hash)


@PackageRevisionType.field("message")
async def package_revision_message(revision: PackageRevisionContext, *_):
    return await packages.get_message(revision.package.bucket, revision.package.name, revision.hash)


@PackageRevisionType.field("totalEntries")
async def package_revision_total_entries(revision: PackageRevisionContext, *_):
    return await packages.get_total_files(revision.package.bucket, revision.package.name, revision.hash)


@PackageRevisionType.field("totalBytes")
async def package_revision_total_bytes(revision: PackageRevisionContext, *_):
    return await packages.get_total_bytes(revision.package.bucket, revision.package.name, revision.hash)


@PackageRevisionType.field("dir")
async def package_revision_dir(revision: PackageRevisionContext, *_, path: str):
    return await packages.get_dir(revision.package.bucket, revision.hash, path)


@PackageRevisionType.field("file")
async def package_revision_file(revision: PackageRevisionContext, *_, path: str):
    return await packages.get_file(revision.package.bucket, revision.hash, path)


@PackageRevisionListType.field("total")
async def package_revision_list_total(package: PackageContext, *_):
    return len(await packages.get_package_pointers(package.bucket, package.name))


@PackageRevisionListType.field("page")
@ariadne.convert_kwargs_to_snake_case
async def package_revision_list_page(package: PackageContext, *_, number: int, per_page: int):
    pointers = await packages.get_package_pointers(package.bucket, package.name)
    offset = (number - 1) * per_page
    pointers = pointers[offset:offset + per_page]
    hashes = await asyncio.gather(*(
        packages.resolve_pointer(package.bucket, package.name, pointer.pointer)
        for pointer in pointers
    ))
    return [
        PackageRevisionContext(package, hash_, pointer.modified)
        for pointer, hash_ in zip(pointers, hashes)
    ]


@PackageType.field("modified")
async def package_modified(package: PackageContext, *_):
    pointers = await packages.get_package_pointers(package.bucket, package.name)
    return max(pointer.modified for pointer in pointers)


@PackageType.field("name")
def package_name(package: PackageContext, *_):
    return packages.public_name(package.name)


@PackageType.field("revisions")
async def package_revisions(package: PackageContext, *_):
    packages.get_package_pointers.schedule(package.bucket, package.name)
    return package


@PackageType.field("revision")
@ariadne.convert_kwargs_to_snake_case
async def package_revision(package: PackageContext, *_, hash_or_tag: str):
    pointer = await packages.get_revision_pointer(package.bucket, package.name, hash_or_tag)
    return PackageRevisionContext(
        package=package,
        hash=await packages.resolve_pointer(package.bucket, package.name, hash_or_tag),
        modified=pointer.modified if pointer else None,
    )


@PackageListType.field("total")
async def package_list_total(package_list: PackageListContext, *_):
    return len(await packages.get_all_package_pointers(package_list.bucket, package_list.filter))


@PackageListType.field("page")
@ariadne.convert_kwargs_to_snake_case
async def package_list_page(package_list: PackageListContext, *_, number: int, per_page: int, order: str):
    pointers = await packages.get_all_package_pointers(package_list.bucket, package_list.filter)
    package_names = list(pointers)
    if order == "MODIFIED":
        package_names.sort(key=lambda name: max(pointer.modified for pointer in pointers[name]), reverse=True)
    elif order != "NAME":
        raise ValueError(f"Unsupported 'order': '{order}'")
    offset = (number - 1) * per_page
    return [PackageContext(package_list.bucket, name) for name in package_names[offset:offset + per_page]]


@QueryType.field("packages")
async def query_packages(*_, bucket: str, filter: T.Optional[str] = None):
    if not await buckets.bucket_is_readable(bucket):
        return None
    return PackageListContext(bucket, filter)


@QueryType.field("package")
async def query_package(*_, bucket: str, name: str):
    resolved_name = packages.internal_name(name)
    if not all(await asyncio.gather(buckets.bucket_is_readable(bucket), packages.package_exists(bucket, resolved_name))):
        return None
    return PackageContext(bucket, resolved_name)


@QueryType.field("searchPackages")
@ariadne.convert_kwargs_to_snake_case
async def query_search_packages(
    *_: T.Any,
    buckets: T.Optional[list[str]] = None,
    search_string: T.Optional[str] = None,
    filter: T.Optional[dict] = None,
    user_meta_filters: T.Optional[list[dict]] = None,
    latest_only: bool = False,
):
    return await search.package_search_result(
        buckets_filter=buckets,
        search_string=search_string,
        filter=filter,
        latest_only=latest_only,
        user_meta_filters=user_meta_filters,
    )


@QueryType.field("searchObjects")
@ariadne.convert_kwargs_to_snake_case
async def query_search_objects(
    *_: T.Any,
    buckets: T.Optional[list[str]] = None,
    search_string: T.Optional[str] = None,
    filter: T.Optional[dict] = None,
):
    return await search.object_search_result(
        buckets_filter=buckets,
        search_string=search_string,
        filter=filter,
    )


@QueryType.field("searchMorePackages")
@ariadne.convert_kwargs_to_snake_case
async def query_search_more_packages(*_, after: str, size: T.Optional[int] = None):
    return await search.search_more_packages(after, size)


@QueryType.field("searchMoreObjects")
@ariadne.convert_kwargs_to_snake_case
async def query_search_more_objects(*_, after: str, size: T.Optional[int] = None):
    return await search.search_more_objects(after, size)


@QueryType.field("status")
async def query_status(*_):
    return {"__typename": "Unavailable"}


@PackagesSearchResultSetType.field("total")
def packages_search_result_total(result: dict, *_):
    return len(result["hits"])


@PackagesSearchResultSetType.field("stats")
def packages_search_result_stats(result: dict, *_):
    return result["stats"]


@PackagesSearchResultSetType.field("filteredUserMetaFacets")
def packages_search_result_filtered_user_meta_facets(*_):
    return []


@PackagesSearchResultSetType.field("firstPage")
@ariadne.convert_kwargs_to_snake_case
def packages_search_result_first_page(result: dict, *_, size: T.Optional[int] = None, order: T.Optional[str] = None):
    return search.package_result_page(result, size=size, order=order)


@ObjectsSearchResultSetType.field("total")
def objects_search_result_total(result: dict, *_):
    return len(result["hits"])


@ObjectsSearchResultSetType.field("stats")
def objects_search_result_stats(result: dict, *_):
    return result["stats"]


@ObjectsSearchResultSetType.field("firstPage")
@ariadne.convert_kwargs_to_snake_case
def objects_search_result_first_page(result: dict, *_, size: T.Optional[int] = None, order: T.Optional[str] = None):
    return search.object_result_page(result, size=size, order=order)


type_defs = ariadne.load_schema_from_path(str(resource_path("schema.graphql")))

schema = ariadne.make_executable_schema(
    [type_defs, LOCAL_SEARCH_TYPE_DEFS],
    QueryType,
    DatetimeScalar,
    PackageListType,
    PackageType,
    PackageRevisionListType,
    PackageRevisionType,
    PackageEntryType,
    PackageFileType,
    PackageUserMetaFacetType,
    PackagesSearchResultType,
    PackagesSearchMoreResultType,
    ObjectsSearchResultType,
    ObjectsSearchMoreResultType,
    PackagesSearchResultSetType,
    ObjectsSearchResultSetType,
)
