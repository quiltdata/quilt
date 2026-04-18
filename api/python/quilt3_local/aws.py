from __future__ import annotations

import asyncio
import datetime
import hashlib
import json
import mimetypes
from functools import lru_cache
from pathlib import Path
from typing import AsyncIterator, Callable, Literal, TypedDict, cast

import boto3
from botocore.exceptions import ClientError

from . import settings


class FilesystemObjectEntry(TypedDict):
    Key: str
    Size: int
    ETag: str
    LastModified: datetime.datetime
    StorageClass: str


class ObjectListingEntry(TypedDict, total=False):
    Key: str
    Size: int
    ETag: str
    LastModified: datetime.datetime
    StorageClass: str
    VersionId: str


class FilesystemObjectMetadata(FilesystemObjectEntry):
    Body: bytes
    ContentType: str


PageItem = tuple[str, Literal["prefix", "content"], FilesystemObjectEntry | None]


CONVENTIONAL_KEY_GROUPS: tuple[tuple[str, ...], ...]
CONVENTIONAL_KEY_LOOKUP: dict[str, tuple[str, ...]]
CONVENTIONAL_DEFAULT_FACTORIES: dict[str, Callable[[str], bytes]]


def _default_readme(bucket: str) -> bytes:
    return (
        f"# {bucket}\n\n"
        "This is a filesystem-backed LOCAL Quilt bucket.\n\n"
        "Quilt exposes a few conventional config files by default in LOCAL mode:\n\n"
        "- `.quilt/catalog/config.yml`\n"
        "- `.quilt/workflows/config.yml`\n"
        "- `.quilt/queries/config.yaml`\n"
        "- `quilt_summarize.json`\n"
    ).encode()


def _default_bucket_preferences(bucket: str) -> bytes:
    return (
        "ui:\n"
        "  sourceBuckets:\n"
        f'    "{bucket}": {{}}\n'
    ).encode()


def _default_experiment_universal_schema(_bucket: str) -> bytes:
    return (
        b'{\n'
        b'  "$schema": "http://json-schema.org/draft-07/schema#",\n'
        b'  "type": "object"\n'
        b'}\n'
    )


def _default_workflows_config(bucket: str) -> bytes:
    schema_url = _bucket_root(bucket).joinpath(
        ".quilt", "workflows", "schemas", "experiment-universal.json"
    ).as_uri()
    return b"".join((
        b'version:\n',
        b'  base: "1"\n',
        b'  catalog: "1"\n',
        b'default_workflow: "experiment"\n',
        b'is_workflow_required: false\n',
        b'workflows:\n',
        b'  experiment:\n',
        b'    name: Experiment\n',
        b'    metadata_schema: experiment-universal\n',
        b'schemas:\n',
        b'  experiment-universal:\n',
        f'    url: {schema_url}\n'.encode(),
    ))


def _default_queries_config(_bucket: str) -> bytes:
    return b'version: "1"\nqueries: {}\n'


_DEFAULT_SUMMARIZE_GROUP_ORDER = (
    "text",
    "tabular",
    "structured",
    "notebooks",
    "scientific",
    "images",
    "documents",
    "media",
)


def _default_quilt_summarize(bucket: str) -> bytes:
    preview_objects = [
        item["Key"]
        for item in _filesystem_real_objects(bucket)
        if item["Key"].startswith("preview/")
    ]
    if not preview_objects:
        return b"[]\n"

    grouped: dict[str, list[str]] = {}
    for key in sorted(preview_objects):
        parts = key.split("/", 2)
        group = parts[1] if len(parts) > 2 else "misc"
        grouped.setdefault(group, []).append(key)

    ordered_groups = [
        group for group in _DEFAULT_SUMMARIZE_GROUP_ORDER if group in grouped
    ]
    ordered_groups.extend(
        sorted(group for group in grouped if group not in _DEFAULT_SUMMARIZE_GROUP_ORDER)
    )

    summarize = [
        [
            {
                "path": key,
                "title": Path(key).name,
                "expand": True,
            }
            for key in grouped[group]
        ]
        for group in ordered_groups
    ]
    return (json.dumps(summarize, indent=2) + "\n").encode()


CONVENTIONAL_KEY_GROUPS = (
    ("README.md",),
    ("README.txt",),
    ("README.ipynb",),
    ("quilt_summarize.json",),
    (".quilt/workflows/config.yml", ".quilt/workflows/config.yaml"),
    (".quilt/workflows/schemas/experiment-universal.json",),
    (".quilt/catalog/config.yml", ".quilt/catalog/config.yaml"),
    (".quilt/queries/config.yaml", ".quilt/queries/config.yml"),
)

CONVENTIONAL_KEY_LOOKUP = {
    alias.casefold(): group
    for group in CONVENTIONAL_KEY_GROUPS
    for alias in group
}

CONVENTIONAL_DEFAULT_FACTORIES = {
    "README.md": _default_readme,
    "quilt_summarize.json": _default_quilt_summarize,
    ".quilt/workflows/config.yml": _default_workflows_config,
    ".quilt/workflows/schemas/experiment-universal.json": _default_experiment_universal_schema,
    ".quilt/catalog/config.yml": _default_bucket_preferences,
    ".quilt/queries/config.yaml": _default_queries_config,
}


def _etag_for_path(path: Path) -> str:
    digest = hashlib.md5(path.read_bytes()).hexdigest()  # noqa: S324
    return f'"{digest}"'


def _etag_for_bytes(data: bytes) -> str:
    digest = hashlib.md5(data).hexdigest()  # noqa: S324
    return f'"{digest}"'


def _bucket_root(bucket: str) -> Path:
    root = settings.data_dir()
    if root is None:
        raise RuntimeError("QUILT_LOCAL_DATA_DIR must be set for filesystem local mode")
    candidate = (root / bucket).resolve()
    if not candidate.is_relative_to(root):
        raise PermissionError("Bucket name escapes data root")
    return candidate


def _object_path(bucket: str, key: str) -> Path:
    bucket_root = _bucket_root(bucket).resolve()
    candidate = (bucket_root / key).resolve()
    if not candidate.is_relative_to(bucket_root):
        raise PermissionError("Object path escapes bucket root")
    return candidate


def _mtime(path: Path) -> datetime.datetime:
    return datetime.datetime.fromtimestamp(path.stat().st_mtime, datetime.timezone.utc)


def _content_type_for_key(key: str) -> str:
    return mimetypes.guess_type(key)[0] or "application/octet-stream"


def _conventional_variants(key: str) -> tuple[str, ...]:
    return CONVENTIONAL_KEY_LOOKUP.get(key.casefold(), (key,))


def _conventional_default_key(key: str) -> str | None:
    for candidate in _conventional_variants(key):
        if candidate in CONVENTIONAL_DEFAULT_FACTORIES:
            return candidate
    return None


def _find_case_insensitive_path(bucket: str, key: str) -> Path | None:
    bucket_root = _bucket_root(bucket)
    if not bucket_root.exists():
        return None

    parts = tuple(filter(None, key.split("/")))
    for part in parts:
        if part in {".", ".."}:
            raise PermissionError("Object path escapes bucket root")

    def _walk(current: Path, index: int) -> Path | None:
        if index >= len(parts):
            return current
        if not current.is_dir():
            return None
        part = parts[index]
        exact = current / part
        matches = []
        if exact.exists():
            matches.append(exact)
        matches.extend(sorted(
            (
                child
                for child in current.iterdir()
                if child.name.casefold() == part.casefold() and child != exact
            ),
            key=lambda child: child.name,
        ))
        for candidate in matches:
            resolved = _walk(candidate, index + 1)
            if resolved is not None:
                return resolved
        return None

    return _walk(bucket_root, 0)


def _filesystem_object_metadata(bucket: str, key: str) -> FilesystemObjectMetadata | None:
    bucket_root = _bucket_root(bucket)
    if not bucket_root.exists():
        return None

    for candidate_key in _conventional_variants(key):
        path = _find_case_insensitive_path(bucket, candidate_key)
        if path is None or not path.is_file():
            continue
        actual_key = path.relative_to(bucket_root).as_posix()
        data = path.read_bytes()
        return {
            "Key": actual_key,
            "Body": data,
            "ETag": _etag_for_path(path),
            "LastModified": _mtime(path),
            "Size": len(data),
            "StorageClass": "STANDARD",
            "ContentType": _content_type_for_key(actual_key),
        }

    canonical_key = _conventional_default_key(key)
    if canonical_key is None:
        return None

    for candidate_key in _conventional_variants(canonical_key):
        path = _find_case_insensitive_path(bucket, candidate_key)
        if path is not None and path.is_file():
            return None

    data = CONVENTIONAL_DEFAULT_FACTORIES[canonical_key](bucket)
    return {
        "Key": canonical_key,
        "Body": data,
        "ETag": _etag_for_bytes(data),
        "LastModified": _mtime(bucket_root),
        "Size": len(data),
        "StorageClass": "STANDARD",
        "ContentType": _content_type_for_key(canonical_key),
    }


def _filesystem_real_objects(bucket: str) -> list[FilesystemObjectEntry]:
    bucket_root = _bucket_root(bucket)
    if not bucket_root.exists():
        return []

    objects = []
    for path in sorted(bucket_root.rglob("*")):
        if not path.is_file():
            continue
        key = path.relative_to(bucket_root).as_posix()
        objects.append({
            "Key": key,
            "Size": path.stat().st_size,
            "ETag": _etag_for_path(path),
            "LastModified": _mtime(path),
            "StorageClass": "STANDARD",
        })

    return sorted(objects, key=lambda item: item["Key"])


def _filesystem_objects(bucket: str) -> list[FilesystemObjectEntry]:
    objects = list(_filesystem_real_objects(bucket))

    for canonical_key in CONVENTIONAL_DEFAULT_FACTORIES:
        metadata = _filesystem_object_metadata(bucket, canonical_key)
        if metadata is None or metadata["Key"] != canonical_key:
            continue
        objects.append({
            "Key": canonical_key,
            "Size": metadata["Size"],
            "ETag": metadata["ETag"],
            "LastModified": metadata["LastModified"],
            "StorageClass": "STANDARD",
        })

    return sorted(objects, key=lambda item: item["Key"])


@lru_cache
def _sync_s3_client(region: str | None = None):
    return boto3.client("s3", region_name=region or settings.default_region())


async def bucket_exists(bucket: str) -> bool:
    if settings.filesystem_mode():
        return _bucket_root(bucket).is_dir()

    def _head():
        try:
            _sync_s3_client().head_bucket(Bucket=bucket)
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] in {"403", "404", "NoSuchBucket", "NotFound"}:
                return False
            raise

    return await asyncio.to_thread(_head)


async def list_objects_v2(*, Bucket: str, Prefix: str = "", MaxKeys: int = 1000) -> dict:
    if settings.filesystem_mode():
        count = sum(1 for item in _filesystem_objects(Bucket) if item["Key"].startswith(Prefix))
        return {"KeyCount": count}

    def _list():
        return _sync_s3_client().list_objects_v2(Bucket=Bucket, Prefix=Prefix, MaxKeys=MaxKeys)

    return await asyncio.to_thread(_list)


async def list_object_versions(*, Bucket: str, Prefix: str = "", MaxKeys: int = 1000) -> dict:
    if settings.filesystem_mode():
        versions = []
        metadata = _filesystem_object_metadata(Bucket, Prefix)
        if metadata is not None:
            versions.append({
                "Key": Prefix,
                "VersionId": "null",
                "IsLatest": True,
                "LastModified": metadata["LastModified"],
                "ETag": metadata["ETag"],
                "Size": metadata["Size"],
                "StorageClass": "STANDARD",
            })
        return {
            "Name": Bucket,
            "Prefix": Prefix,
            "KeyMarker": "",
            "VersionIdMarker": "",
            "MaxKeys": MaxKeys,
            "IsTruncated": False,
            "Versions": versions,
            "DeleteMarkers": [],
        }

    def _list_versions():
        return _sync_s3_client().list_object_versions(Bucket=Bucket, Prefix=Prefix, MaxKeys=MaxKeys)

    return await asyncio.to_thread(_list_versions)


async def list_objects_page(
    *,
    Bucket: str,
    Prefix: str = "",
    Delimiter: str | None = None,
    ContinuationToken: str | None = None,
    MaxKeys: int = 1000,
) -> dict:
    if settings.filesystem_mode():
        objects = [item for item in _filesystem_objects(Bucket) if item["Key"].startswith(Prefix)]
        if not objects and not _bucket_root(Bucket).exists():
            return {
                "Name": Bucket,
                "Prefix": Prefix,
                "Delimiter": Delimiter,
                "MaxKeys": MaxKeys,
                "KeyCount": 0,
                "IsTruncated": False,
                "Contents": [],
                "CommonPrefixes": [],
            }

        prefixes: set[str] = set()
        contents: list[FilesystemObjectEntry] = []
        for item in objects:
            key = item["Key"]
            remainder = key[len(Prefix):]
            if Delimiter and Delimiter in remainder:
                child = remainder.split(Delimiter, 1)[0]
                prefixes.add(f"{Prefix}{child}{Delimiter}")
                continue
            contents.append(item)

        items: list[PageItem] = []
        items.extend((prefix_value, "prefix", None) for prefix_value in prefixes)
        items.extend((content["Key"], "content", content) for content in contents)
        items.sort(key=lambda item: item[0])

        if ContinuationToken:
            items = [
                item
                for item in items
                if item[0] > ContinuationToken
            ]

        truncated = len(items) > MaxKeys
        page = items[:MaxKeys]
        next_token = None
        if truncated and page:
            last_item = page[-1]
            next_token = last_item[0]

        return {
            "Name": Bucket,
            "Prefix": Prefix,
            "Delimiter": Delimiter,
            "MaxKeys": MaxKeys,
            "KeyCount": len(page),
            "IsTruncated": truncated,
            "NextContinuationToken": next_token,
            "Contents": [item[2] for item in page if item[1] == "content"],
            "CommonPrefixes": [
                {"Prefix": item[0]}
                for item in page
                if item[1] == "prefix"
            ],
        }

    def _list_page():
        kwargs = {"Bucket": Bucket, "Prefix": Prefix, "MaxKeys": MaxKeys}
        if Delimiter is not None:
            kwargs["Delimiter"] = Delimiter
        if ContinuationToken is not None:
            kwargs["ContinuationToken"] = ContinuationToken
        return _sync_s3_client().list_objects_v2(**kwargs)

    return await asyncio.to_thread(_list_page)


async def list_all_objects(*, Bucket: str, Prefix: str = "") -> AsyncIterator[ObjectListingEntry]:
    if settings.filesystem_mode():
        for item in _filesystem_real_objects(Bucket):
            if item["Key"].startswith(Prefix):
                yield cast(ObjectListingEntry, item)
        return

    def _collect() -> list[ObjectListingEntry]:
        paginator = _sync_s3_client().get_paginator("list_objects_v2")
        out: list[ObjectListingEntry] = []
        for page in paginator.paginate(Bucket=Bucket, Prefix=Prefix):
            out.extend(page.get("Contents", ()))
        return out

    for obj in await asyncio.to_thread(_collect):
        yield obj


async def read_bytes(*, Bucket: str, Key: str, VersionId: str | None = None) -> bytes:
    if settings.filesystem_mode():
        metadata = _filesystem_object_metadata(Bucket, Key)
        if metadata is None:
            raise FileNotFoundError(f"No such local object: s3://{Bucket}/{Key}")
        return metadata["Body"]

    def _read():
        kwargs = {"Bucket": Bucket, "Key": Key}
        if VersionId:
            kwargs["VersionId"] = VersionId
        response = _sync_s3_client().get_object(**kwargs)
        return response["Body"].read()

    return await asyncio.to_thread(_read)


async def read_text(*, Bucket: str, Key: str, VersionId: str | None = None) -> str:
    return (await read_bytes(Bucket=Bucket, Key=Key, VersionId=VersionId)).decode()


async def read_json_lines(*, Bucket: str, Key: str) -> list[dict]:
    body = await read_bytes(Bucket=Bucket, Key=Key)
    return [json.loads(line) for line in body.splitlines() if line]


async def get_object_tagging(*, Bucket: str, Key: str, VersionId: str | None = None) -> dict | None:
    if settings.filesystem_mode():
        metadata = _filesystem_object_metadata(Bucket, Key)
        if metadata is None:
            return None
        return {
            "VersionId": VersionId or "null",
            "TagSet": [],
        }

    def _get_object_tagging():
        kwargs = {"Bucket": Bucket, "Key": Key}
        if VersionId:
            kwargs["VersionId"] = VersionId
        try:
            return _sync_s3_client().get_object_tagging(**kwargs)
        except ClientError as exc:
            error = exc.response.get("Error", {})
            status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if status == 404 or error.get("Code") in {"404", "NoSuchKey", "NotFound"}:
                return None
            raise

    return await asyncio.to_thread(_get_object_tagging)


async def fetch_object(
    *,
    Bucket: str,
    Key: str,
    VersionId: str | None = None,
    Method: str = "GET",
    Range: str | None = None,
    ContentType: str | None = None,
    Body: bytes | None = None,
) -> dict:
    method = Method.upper()
    if settings.filesystem_mode():
        if method == "HEAD" and Key == "" and _bucket_root(Bucket).is_dir():
            return {
                "status": 200,
                "headers": {
                    "content-length": "0",
                    "content-type": "application/octet-stream",
                    "etag": "",
                    "x-amz-bucket-region": settings.default_region(),
                },
                "body": b"",
            }

        if method == "PUT":
            path = _object_path(Bucket, Key)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(Body or b"")
            return {
                "status": 200,
                "headers": {
                    "content-type": ContentType or "application/octet-stream",
                    "etag": _etag_for_path(path),
                },
                "body": b"",
            }

        metadata = _filesystem_object_metadata(Bucket, Key)
        if metadata is None:
            return {
                "status": 404,
                "headers": {"content-type": "text/plain"},
                "body": b"Not found",
            }

        data = metadata["Body"]
        status = 200
        headers = {
            "content-type": metadata["ContentType"],
            "content-length": str(len(data)),
            "etag": metadata["ETag"],
        }
        if Range and Range.startswith("bytes="):
            start_s, _, end_s = Range[6:].partition("-")
            start = int(start_s) if start_s else 0
            end = int(end_s) if end_s else len(data) - 1
            data = data[start:end + 1]
            status = 206
            headers["content-range"] = f"bytes {start}-{end}/{metadata['Size']}"
            headers["content-length"] = str(len(data))
        if method == "HEAD":
            data = b""
        return {"status": status, "headers": headers, "body": data}

    def _aws_fetch():
        client = _sync_s3_client()
        if method == "PUT":
            kwargs = {"Bucket": Bucket, "Key": Key, "Body": Body or b""}
            if ContentType:
                kwargs["ContentType"] = ContentType
            client.put_object(**kwargs)
            return {
                "status": 200,
                "headers": {"content-type": ContentType or "application/octet-stream"},
                "body": b"",
            }

        kwargs = {"Bucket": Bucket, "Key": Key}
        if VersionId:
            kwargs["VersionId"] = VersionId
        if Range:
            kwargs["Range"] = Range
        try:
            if method == "HEAD":
                response = client.head_object(**kwargs)
                return {
                    "status": 200,
                    "headers": {
                        "content-type": response.get("ContentType", "application/octet-stream"),
                        "content-length": str(response.get("ContentLength", 0)),
                        "etag": response.get("ETag", ""),
                    },
                    "body": b"",
                }

            response = client.get_object(**kwargs)
            headers = {
                "content-type": response.get("ContentType", "application/octet-stream"),
                "content-length": str(response.get("ContentLength", 0)),
                "etag": response.get("ETag", ""),
            }
            if "ContentRange" in response:
                headers["content-range"] = response["ContentRange"]
            return {
                "status": 206 if Range else 200,
                "headers": headers,
                "body": response["Body"].read(),
            }
        except ClientError as exc:
            metadata = exc.response.get("ResponseMetadata", {})
            status = metadata.get("HTTPStatusCode", 500)
            return {
                "status": status,
                "headers": {"content-type": "text/plain"},
                "body": str(exc).encode(),
            }

    return await asyncio.to_thread(_aws_fetch)
