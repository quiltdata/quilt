from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from urllib.parse import quote

import fastapi

from . import aws

s3proxy = fastapi.FastAPI()

HOST_RE = re.compile(r"^(?P<bucket>.+)\.s3(?:\.(?P<region>[^.]+))?\.amazonaws\.com$")


def _cors_headers(request: fastapi.Request) -> dict:
    return {
        "access-control-allow-headers": request.headers.get("access-control-request-headers", ""),
        "access-control-allow-methods": request.headers.get("access-control-request-method", ""),
        "access-control-allow-origin": "*",
        "access-control-max-age": "3000",
        "access-control-expose-headers": ", ".join([
            "Content-Length",
            "Content-Range",
            "ETag",
            "x-amz-bucket-region",
            "x-amz-delete-marker",
            "x-amz-request-id",
            "x-amz-version-id",
            "x-amz-storage-class",
        ]),
    }


def _parse_host_style(host: str) -> tuple[str, str | None]:
    match = HOST_RE.match(host)
    if not match:
        raise fastapi.HTTPException(400, f"Invalid S3 proxy host: {host}")
    return match.group("bucket"), match.group("region")


def _encode(value: str, encoding_type: str | None) -> str:
    if encoding_type == "url":
        return quote(value, safe="/")
    return value


def _has_flag_param(request: fastapi.Request, name: str) -> bool:
    if name in request.query_params:
        return True
    return any(part == name or part.startswith(f"{name}=") for part in request.url.query.split("&") if part)


def _serialize_list_bucket_result(result: dict, encoding_type: str | None) -> bytes:
    root = ET.Element("ListBucketResult", xmlns="http://s3.amazonaws.com/doc/2006-03-01/")
    ET.SubElement(root, "Name").text = result["Name"]
    ET.SubElement(root, "Prefix").text = _encode(result.get("Prefix") or "", encoding_type)
    ET.SubElement(root, "KeyCount").text = str(result.get("KeyCount", 0))
    ET.SubElement(root, "MaxKeys").text = str(result.get("MaxKeys", 0))
    if result.get("Delimiter"):
        ET.SubElement(root, "Delimiter").text = result["Delimiter"]
    if encoding_type:
        ET.SubElement(root, "EncodingType").text = encoding_type
    ET.SubElement(root, "IsTruncated").text = str(result.get("IsTruncated", False)).lower()
    if result.get("NextContinuationToken"):
        ET.SubElement(root, "NextContinuationToken").text = _encode(
            result["NextContinuationToken"],
            encoding_type,
        )

    for prefix in result.get("CommonPrefixes", []):
        common = ET.SubElement(root, "CommonPrefixes")
        ET.SubElement(common, "Prefix").text = _encode(prefix["Prefix"], encoding_type)

    for item in result.get("Contents", []):
        content = ET.SubElement(root, "Contents")
        ET.SubElement(content, "Key").text = _encode(item["Key"], encoding_type)
        last_modified = item.get("LastModified")
        if last_modified is not None:
            ET.SubElement(content, "LastModified").text = last_modified.isoformat().replace("+00:00", "Z")
        ET.SubElement(content, "ETag").text = item.get("ETag", "")
        ET.SubElement(content, "Size").text = str(item.get("Size", 0))
        ET.SubElement(content, "StorageClass").text = item.get("StorageClass", "STANDARD")

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _serialize_list_versions_result(result: dict, encoding_type: str | None) -> bytes:
    root = ET.Element("ListVersionsResult", xmlns="http://s3.amazonaws.com/doc/2006-03-01/")
    ET.SubElement(root, "Name").text = result["Name"]
    ET.SubElement(root, "Prefix").text = _encode(result.get("Prefix") or "", encoding_type)
    ET.SubElement(root, "KeyMarker").text = _encode(result.get("KeyMarker") or "", encoding_type)
    ET.SubElement(root, "VersionIdMarker").text = result.get("VersionIdMarker") or ""
    ET.SubElement(root, "MaxKeys").text = str(result.get("MaxKeys", 0))
    if encoding_type:
        ET.SubElement(root, "EncodingType").text = encoding_type
    ET.SubElement(root, "IsTruncated").text = str(result.get("IsTruncated", False)).lower()

    for item in result.get("Versions", []):
        version = ET.SubElement(root, "Version")
        ET.SubElement(version, "Key").text = _encode(item["Key"], encoding_type)
        ET.SubElement(version, "VersionId").text = item.get("VersionId") or "null"
        ET.SubElement(version, "IsLatest").text = str(item.get("IsLatest", False)).lower()
        last_modified = item.get("LastModified")
        if last_modified is not None:
            ET.SubElement(version, "LastModified").text = last_modified.isoformat().replace("+00:00", "Z")
        ET.SubElement(version, "ETag").text = item.get("ETag", "")
        ET.SubElement(version, "Size").text = str(item.get("Size", 0))
        ET.SubElement(version, "StorageClass").text = item.get("StorageClass", "STANDARD")

    for item in result.get("DeleteMarkers", []):
        marker = ET.SubElement(root, "DeleteMarker")
        ET.SubElement(marker, "Key").text = _encode(item["Key"], encoding_type)
        ET.SubElement(marker, "VersionId").text = item.get("VersionId") or "null"
        ET.SubElement(marker, "IsLatest").text = str(item.get("IsLatest", False)).lower()
        last_modified = item.get("LastModified")
        if last_modified is not None:
            ET.SubElement(marker, "LastModified").text = last_modified.isoformat().replace("+00:00", "Z")

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _serialize_object_tagging_result(result: dict) -> bytes:
    root = ET.Element("Tagging", xmlns="http://s3.amazonaws.com/doc/2006-03-01/")
    tag_set = ET.SubElement(root, "TagSet")
    for item in result.get("TagSet", []):
        tag = ET.SubElement(tag_set, "Tag")
        ET.SubElement(tag, "Key").text = item.get("Key", "")
        ET.SubElement(tag, "Value").text = item.get("Value", "")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


async def _dispatch(request: fastapi.Request, bucket: str, key: str):
    cors_headers = _cors_headers(request)
    if request.method == "OPTIONS":
        return fastapi.Response(content=b"", status_code=200, headers=cors_headers)

    if request.method == "GET" and request.query_params.get("list-type") == "2":
        result = await aws.list_objects_page(
            Bucket=bucket,
            Prefix=request.query_params.get("prefix", ""),
            Delimiter=request.query_params.get("delimiter"),
            ContinuationToken=request.query_params.get("continuation-token"),
            MaxKeys=int(request.query_params.get("max-keys", "1000")),
        )
        headers = dict(cors_headers)
        headers["content-type"] = "application/xml"
        headers["x-amz-bucket-region"] = request.path_params.get("s3_region") or "us-east-1"
        return fastapi.Response(
            content=_serialize_list_bucket_result(result, request.query_params.get("encoding-type")),
            status_code=200,
            headers=headers,
        )

    if request.method == "GET" and _has_flag_param(request, "versions"):
        result = await aws.list_object_versions(
            Bucket=bucket,
            Prefix=request.query_params.get("prefix", ""),
            MaxKeys=int(request.query_params.get("max-keys", "1000")),
        )
        headers = dict(cors_headers)
        headers["content-type"] = "application/xml"
        headers["x-amz-bucket-region"] = request.path_params.get("s3_region") or "us-east-1"
        return fastapi.Response(
            content=_serialize_list_versions_result(result, request.query_params.get("encoding-type")),
            status_code=200,
            headers=headers,
        )

    if request.method in {"GET", "HEAD"} and _has_flag_param(request, "tagging"):
        result = await aws.get_object_tagging(
            Bucket=bucket,
            Key=key,
            VersionId=request.query_params.get("versionId"),
        )
        if result is None:
            headers = dict(cors_headers)
            headers["content-type"] = "text/plain"
            return fastapi.Response(content=b"Not found", status_code=404, headers=headers)

        headers = dict(cors_headers)
        headers["content-type"] = "application/xml"
        headers["x-amz-bucket-region"] = request.path_params.get("s3_region") or "us-east-1"
        if result.get("VersionId"):
            headers["x-amz-version-id"] = result["VersionId"]
        return fastapi.Response(
            content=b"" if request.method == "HEAD" else _serialize_object_tagging_result(result),
            status_code=200,
            headers=headers,
        )

    response = await aws.fetch_object(
        Bucket=bucket,
        Key=key,
        VersionId=request.query_params.get("versionId"),
        Method=request.method,
        Range=request.headers.get("range"),
        ContentType=request.headers.get("content-type"),
        Body=await request.body(),
    )

    headers = dict(response["headers"])
    headers.update(cors_headers)
    headers.pop("date", None)
    headers.pop("server", None)
    headers.setdefault("content-type", "application/octet-stream")
    headers["x-amz-bucket-region"] = request.path_params.get("s3_region") or "us-east-1"

    return fastapi.Response(
        content=response["body"],
        status_code=response["status"],
        headers=headers,
    )


@s3proxy.api_route("/{host}", methods=["GET", "HEAD", "PUT", "OPTIONS"])
@s3proxy.api_route("/{host}/{s3_path:path}", methods=["GET", "HEAD", "PUT", "OPTIONS"])
async def host_style_proxy(request: fastapi.Request, host: str, s3_path: str = ""):
    try:
        bucket, _region = _parse_host_style(host)
        return await _dispatch(request, bucket, s3_path)
    except fastapi.HTTPException:
        if not s3_path:
            raise
        bucket, _, key = s3_path.partition("/")
        request.path_params["s3_region"] = host
        return await _dispatch(request, bucket, key)


@s3proxy.api_route("/{s3_region}/{s3_bucket}", methods=["GET", "HEAD", "PUT", "OPTIONS"])
@s3proxy.api_route("/{s3_region}/{s3_bucket}/{s3_path:path}", methods=["GET", "HEAD", "PUT", "OPTIONS"])
async def legacy_proxy(request: fastapi.Request, s3_region: str, s3_bucket: str, s3_path: str = ""):
    return await _dispatch(request, s3_bucket, s3_path)
