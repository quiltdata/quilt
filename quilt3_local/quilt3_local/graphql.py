import asyncio
import dataclasses
import datetime
import typing as T

import ariadne
import importlib_resources

from . import buckets, packages

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
PackageFileType.set_alias("physicalKey", "physical_key")


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


@dataclasses.dataclass
class PackageDirContext:
    revision: PackageRevisionContext
    path: str


@QueryType.field("bucketConfigs")
def query_bucket_configs(*_):
    return []


@QueryType.field("bucketConfig")
def query_bucket_config(*_, name: str):
    return None


@PackageEntryType.type_resolver
def package_entry_typename(e: T.Any, *_) -> T.Optional[str]:
    if isinstance(e, packages.PackageDirEntry):
        return "PackageDir"
    if isinstance(e, packages.PackageFileEntry):
        return "PackageFile"


@PackageRevisionType.field("userMeta")
async def package_revision_user_meta(r: PackageRevisionContext, *_) -> T.Optional[dict]:
    return await packages.get_user_meta(r.package.bucket, r.package.name, r.hash)


@PackageRevisionType.field("message")
async def package_revision_message(r: PackageRevisionContext, *_) -> T.Optional[str]:
    return await packages.get_message(r.package.bucket, r.package.name, r.hash)


@PackageRevisionType.field("totalEntries")
async def package_revision_total_entries(r: PackageRevisionContext, *_) -> T.Optional[int]:
    return await packages.get_total_files(r.package.bucket, r.package.name, r.hash)


@PackageRevisionType.field("totalBytes")
async def package_revision_total_bytes(r: PackageRevisionContext, *_) -> T.Optional[int]:
    return await packages.get_total_bytes(r.package.bucket, r.package.name, r.hash)


@PackageRevisionType.field("dir")
async def package_revision_dir(r: PackageRevisionContext, *_, path: str):
    return await packages.get_dir(r.package.bucket, r.hash, path)


@PackageRevisionType.field("file")
async def package_revision_file(r: PackageRevisionContext, *_, path: str):
    return await packages.get_file(r.package.bucket, r.hash, path)


@PackageRevisionListType.field("total")
async def package_revision_list_total(p: PackageContext, *_):
    return len(await packages.get_package_pointers(p.bucket, p.name))


@PackageRevisionListType.field("page")
@ariadne.convert_kwargs_to_snake_case
async def package_revision_list_page(p: PackageContext, *_, number: int, per_page: int):
    pointers = await packages.get_package_pointers(p.bucket, p.name)
    offset = (number - 1) * per_page
    pointers = pointers[offset:offset + per_page]

    hashes = await asyncio.gather(*(
        packages.resolve_pointer(p.bucket, p.name, pointer.pointer)
        for pointer in pointers
    ))

    return [
        PackageRevisionContext(p, hash_, pointer.modified)
        for pointer, hash_ in zip(pointers, hashes)
    ]


@PackageType.field("modified")
async def package_modified(p: PackageContext, *_):
    pointers = await packages.get_package_pointers(p.bucket, p.name)
    return max(p.modified for p in pointers)


@PackageType.field("revisions")
async def package_revisions(p: PackageContext, *_):
    packages.get_package_pointers.schedule(p.bucket, p.name)
    return p


@PackageType.field("revision")
@ariadne.convert_kwargs_to_snake_case
async def package_revision(
    p: PackageContext,
    *_,
    hash_or_tag: str,
) -> PackageRevisionContext:
    return PackageRevisionContext(
        package=p,
        hash=await packages.resolve_pointer(p.bucket, p.name, hash_or_tag),
    )


@PackageListType.field("total")
async def package_list_total(pl: PackageListContext, *_) -> int:
    return len(await packages.get_all_package_pointers(pl.bucket, pl.filter))


@PackageListType.field("page")
@ariadne.convert_kwargs_to_snake_case
async def package_list_page(
    pl: PackageListContext,
    *_,
    number: int,
    per_page: int,
    order: str,  # "NAME" | "MODIFIED"
) -> T.List[PackageContext]:
    pointers = await packages.get_all_package_pointers(pl.bucket, pl.filter)
    package_names = list(pointers)

    if order == "NAME":
        # packages are sorted by name initially, so nothing to do here
        pass

    elif order == "MODIFIED":
        package_names.sort(
            key=lambda name: max(p.modified for p in pointers[name]),
            reverse=True,
        )

    else:
        raise ValueError(f"Unsupported 'order': '{order}'")

    offset = (number - 1) * per_page
    return [
        PackageContext(pl.bucket, name)
        for name in package_names[offset:offset + per_page]
    ]


@QueryType.field("packages")
async def query_packages(*_, bucket: str, filter: T.Optional[str] = None):
    if not await buckets.bucket_is_readable(bucket):
        return None

    return PackageListContext(bucket, filter)


@QueryType.field("package")
async def query_package(*_, bucket: str, name: str):
    if not all(await asyncio.gather(
        buckets.bucket_is_readable(bucket),
        packages.package_exists(bucket, name),
    )):
        return None

    return PackageContext(bucket, name)


# TODO: load schema from a public shared folder
with importlib_resources.path("quilt3_local", "schema.graphql") as schema_path:
    type_defs = ariadne.load_schema_from_path(str(schema_path))

schema = ariadne.make_executable_schema(
    type_defs,
    QueryType,
    DatetimeScalar,
    PackageListType,
    PackageType,
    PackageRevisionListType,
    PackageRevisionType,
    PackageEntryType,
    PackageFileType,
)
