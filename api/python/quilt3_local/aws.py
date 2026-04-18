from __future__ import annotations

import asyncio
import datetime
import hashlib
import json
import mimetypes
from functools import lru_cache
from pathlib import Path
from typing import AsyncIterator

import boto3
from botocore.exceptions import ClientError

from . import settings


def _etag_for_path(path: Path) -> str:
    digest = hashlib.md5(path.read_bytes()).hexdigest()  # noqa: S324
    return f'"{digest}"'


def _bucket_root(bucket: str) -> Path:
    root = settings.data_dir()
    if root is None:
        raise RuntimeError("QUILT_LOCAL_DATA_DIR must be set for filesystem local mode")
    return root / bucket


def _object_path(bucket: str, key: str) -> Path:
    bucket_root = _bucket_root(bucket).resolve()
    candidate = (bucket_root / key).resolve()
    if not candidate.is_relative_to(bucket_root):
        raise PermissionError("Object path escapes bucket root")
    return candidate


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
            if exc.response["Error"]["Code"] == "403":
                return False
            raise

    return await asyncio.to_thread(_head)


async def list_objects_v2(*, Bucket: str, Prefix: str = "", MaxKeys: int = 1000) -> dict:
    if settings.filesystem_mode():
        count = 0
        async for _ in list_all_objects(Bucket=Bucket, Prefix=Prefix):
            count += 1
            if count >= MaxKeys:
                break
        return {"KeyCount": count}

    def _list():
        return _sync_s3_client().list_objects_v2(Bucket=Bucket, Prefix=Prefix, MaxKeys=MaxKeys)

    return await asyncio.to_thread(_list)


async def list_object_versions(*, Bucket: str, Prefix: str = "", MaxKeys: int = 1000) -> dict:
    if settings.filesystem_mode():
        bucket_root = _bucket_root(Bucket)
        versions = []
        if bucket_root.exists():
            for path in sorted(bucket_root.rglob("*")):
                if not path.is_file():
                    continue
                key = path.relative_to(bucket_root).as_posix()
                if key != Prefix:
                    continue
                stat = path.stat()
                versions.append({
                    "Key": key,
                    "VersionId": "null",
                    "IsLatest": True,
                    "LastModified": datetime.datetime.fromtimestamp(stat.st_mtime, datetime.timezone.utc),
                    "ETag": _etag_for_path(path),
                    "Size": stat.st_size,
                    "StorageClass": "STANDARD",
                })
                break
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
        bucket_root = _bucket_root(Bucket)
        if not bucket_root.exists():
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
        contents: list[dict] = []
        for path in sorted(bucket_root.rglob("*")):
            if not path.is_file():
                continue
            key = path.relative_to(bucket_root).as_posix()
            if not key.startswith(Prefix):
                continue

            remainder = key[len(Prefix):]
            if Delimiter and Delimiter in remainder:
                child = remainder.split(Delimiter, 1)[0]
                prefixes.add(f"{Prefix}{child}{Delimiter}")
                continue

            stat = path.stat()
            contents.append({
                "Key": key,
                "Size": stat.st_size,
                "ETag": _etag_for_path(path),
                "LastModified": datetime.datetime.fromtimestamp(
                    stat.st_mtime,
                    tz=datetime.timezone.utc,
                ),
                "StorageClass": "STANDARD",
            })

        items = sorted(
            [("prefix", prefix_value) for prefix_value in prefixes]
            + [("content", content) for content in contents],
            key=lambda item: item[1] if item[0] == "prefix" else item[1]["Key"],
        )

        if ContinuationToken:
            items = [
                item
                for item in items
                if (item[1] if item[0] == "prefix" else item[1]["Key"]) > ContinuationToken
            ]

        truncated = len(items) > MaxKeys
        page = items[:MaxKeys]
        next_token = None
        if truncated and page:
            last_item = page[-1]
            next_token = last_item[1] if last_item[0] == "prefix" else last_item[1]["Key"]

        return {
            "Name": Bucket,
            "Prefix": Prefix,
            "Delimiter": Delimiter,
            "MaxKeys": MaxKeys,
            "KeyCount": len(page),
            "IsTruncated": truncated,
            "NextContinuationToken": next_token,
            "Contents": [item[1] for item in page if item[0] == "content"],
            "CommonPrefixes": [
                {"Prefix": item[1]}
                for item in page
                if item[0] == "prefix"
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


async def list_all_objects(*, Bucket: str, Prefix: str = "") -> AsyncIterator[dict]:
    if settings.filesystem_mode():
        bucket_root = _bucket_root(Bucket)
        if not bucket_root.exists():
            return
        for path in sorted(bucket_root.rglob("*")):
            if not path.is_file():
                continue
            stat = path.stat()
            key = path.relative_to(bucket_root).as_posix()
            if not key.startswith(Prefix):
                continue
            yield {
                "Key": key,
                "Size": stat.st_size,
                "ETag": _etag_for_path(path),
                "LastModified": datetime.datetime.fromtimestamp(stat.st_mtime, datetime.timezone.utc),
            }
        return

    def _collect() -> list[dict]:
        paginator = _sync_s3_client().get_paginator("list_objects_v2")
        out = []
        for page in paginator.paginate(Bucket=Bucket, Prefix=Prefix):
            out.extend(page.get("Contents", ()))
        return out

    for obj in await asyncio.to_thread(_collect):
        yield obj


async def read_bytes(*, Bucket: str, Key: str, VersionId: str | None = None) -> bytes:
    if settings.filesystem_mode():
        return _object_path(Bucket, Key).read_bytes()

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
        path = _object_path(Bucket, Key)
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

        if not path.exists() or path.is_dir():
            return {
                "status": 404,
                "headers": {"content-type": "text/plain"},
                "body": b"Not found",
            }

        data = path.read_bytes()
        status = 200
        headers = {
            "content-type": ContentType or mimetypes.guess_type(path.name)[0] or "application/octet-stream",
            "content-length": str(len(data)),
            "etag": _etag_for_path(path),
        }
        if Range and Range.startswith("bytes="):
            start_s, _, end_s = Range[6:].partition("-")
            start = int(start_s) if start_s else 0
            end = int(end_s) if end_s else len(data) - 1
            data = data[start:end + 1]
            status = 206
            headers["content-range"] = f"bytes {start}-{end}/{path.stat().st_size}"
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
