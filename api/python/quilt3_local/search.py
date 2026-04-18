from __future__ import annotations

import base64
import datetime
import fnmatch
import json
import math
import typing as T

from . import aws, buckets, packages

DEFAULT_PAGE_SIZE = 25
MAX_SAMPLE_OBJECTS = 20
MAX_IMAGE_OBJECTS = 100


class _SearchStatsSize(T.TypedDict):
    value: float


class _SearchStatsBucket(T.TypedDict):
    key: str
    doc_count: int
    size: _SearchStatsSize


def _to_datetime(value: T.Any) -> datetime.datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime.datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _matches_number(value: float | int, predicate: dict | None) -> bool:
    if not predicate:
        return True
    gte = predicate.get("gte")
    lte = predicate.get("lte")
    if gte is not None and value < gte:
        return False
    if lte is not None and value > lte:
        return False
    return True


def _matches_datetime(value: datetime.datetime | None, predicate: dict | None) -> bool:
    if not predicate:
        return True
    if value is None:
        return False
    gte = _to_datetime(predicate.get("gte"))
    lte = _to_datetime(predicate.get("lte"))
    if gte is not None and value < gte:
        return False
    if lte is not None and value > lte:
        return False
    return True


def _matches_keyword(value: str | None, predicate: dict | None) -> bool:
    if not predicate:
        return True
    haystack = (value or "").lower()
    terms = predicate.get("terms") or []
    wildcard = predicate.get("wildcard")
    if terms and haystack not in {str(term).lower() for term in terms}:
        return False
    if wildcard and not fnmatch.fnmatch(haystack, wildcard.lower()):
        return False
    return True


def _matches_text(value: str | None, predicate: dict | None) -> bool:
    if not predicate:
        return True
    query = (predicate.get("queryString") or "").strip().lower()
    if not query:
        return True
    return query in (value or "").lower()


def _workflow_payload(value: T.Any) -> dict | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        return {"id": value}
    return None


def _workflow_id(value: T.Any) -> str | None:
    payload = _workflow_payload(value)
    if not payload:
        return None
    workflow_id = payload.get("id") or payload.get("slug") or payload.get("name")
    return str(workflow_id) if workflow_id else None


def _ext(key: str) -> str:
    name = key.rsplit("/", 1)[-1]
    if "." not in name:
        return ""
    return "." + name.split(".", 1)[1].lower()


def _is_internal_key(key: str) -> bool:
    return key.startswith(".quilt/")


def _bucket_names(requested: list[str] | None) -> list[str]:
    if requested:
        return requested
    return []


async def _all_bucket_names(requested: list[str] | None) -> list[str]:
    if requested:
        return requested
    return [config["name"] for config in await buckets.list_bucket_configs()]


def _sort_hits(hits: list[dict], order: str | None, *, key_field: str) -> list[dict]:
    order = order or "BEST_MATCH"
    if order == "NEWEST":
        return sorted(hits, key=lambda hit: hit["modified"], reverse=True)
    if order == "OLDEST":
        return sorted(hits, key=lambda hit: hit["modified"])
    if order == "LEX_ASC":
        return sorted(hits, key=lambda hit: str(hit[key_field]).lower())
    if order == "LEX_DESC":
        return sorted(hits, key=lambda hit: str(hit[key_field]).lower(), reverse=True)
    return sorted(
        hits,
        key=lambda hit: (hit.get("score", 0), hit["modified"]),
        reverse=True,
    )


def _encode_cursor(kind: str, payload: dict) -> str:
    raw = json.dumps({"kind": kind, **payload}, separators=(",", ":"))
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> dict:
    return json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())


def _page(hits: list[dict], *, offset: int, size: int, cursor_payload: dict | None, kind: str) -> dict:
    page_hits = hits[offset:offset + size]
    next_cursor = None
    if offset + size < len(hits) and cursor_payload is not None:
        next_cursor = _encode_cursor(kind, {**cursor_payload, "offset": offset + size})
    return {
        "__typename": f"{kind}SearchResultSetPage",
        "cursor": next_cursor,
        "hits": page_hits,
    }


def _datetime_extents(values: list[datetime.datetime]) -> dict:
    return {
        "__typename": "DatetimeExtents",
        "min": min(values),
        "max": max(values),
    }


def _number_extents(values: list[int | float]) -> dict:
    return {
        "__typename": "NumberExtents",
        "min": min(values),
        "max": max(values),
    }


def _keyword_extents(values: list[str]) -> dict:
    return {
        "__typename": "KeywordExtents",
        "values": sorted({value for value in values if value}),
    }


async def object_hits(
    *,
    buckets_filter: list[str] | None = None,
    search_string: str | None = None,
    filter: dict | None = None,
) -> list[dict]:
    hits: list[dict] = []
    lowered_search = (search_string or "").strip().lower()
    for bucket in await _all_bucket_names(buckets_filter):
        if not await buckets.bucket_is_readable(bucket):
            continue
        async for obj in aws.list_all_objects(Bucket=bucket):
            key = obj["Key"]
            if _is_internal_key(key):
                continue
            ext = _ext(key)
            modified_value = obj.get("LastModified")
            modified = (
                modified_value
                if isinstance(modified_value, datetime.datetime)
                else datetime.datetime.now(datetime.timezone.utc)
            )
            version_value = obj.get("VersionId")
            size_value = obj.get("Size", 0)
            hit = {
                "__typename": "SearchHitObject",
                "id": f"{bucket}:{key}",
                "bucket": bucket,
                "key": key,
                "version": version_value if isinstance(version_value, str) else "",
                "size": float(size_value) if isinstance(size_value, (int, float)) else 0.0,
                "modified": modified,
                "deleted": False,
                "indexedContent": None,
                "score": 1.0,
                "ext": ext,
            }
            if lowered_search and lowered_search not in key.lower():
                continue
            if filter:
                if not _matches_keyword(key, filter.get("key")):
                    continue
                if not _matches_keyword(ext, filter.get("ext")):
                    continue
                if not _matches_number(hit["size"], filter.get("size")):
                    continue
                if not _matches_datetime(hit["modified"], filter.get("modified")):
                    continue
            hits.append(hit)
    return hits


async def _package_hit(bucket: str, name: str, pointer: packages.RevisionPointer) -> dict:
    hash_ = await packages.resolve_pointer(bucket, name, pointer.pointer)
    user_meta = await packages.get_user_meta(bucket, name, hash_)
    workflow = await packages.get_workflow(bucket, name, hash_)
    display_name = packages.public_name(name)
    return {
        "__typename": "SearchHitPackage",
        "id": f"{bucket}:{display_name}:{hash_}",
        "bucket": bucket,
        "name": display_name,
        "pointer": pointer.pointer,
        "hash": hash_,
        "size": float(await packages.get_total_bytes(bucket, name, hash_) or 0),
        "modified": pointer.modified,
        "totalEntriesCount": await packages.get_total_files(bucket, name, hash_) or 0,
        "comment": await packages.get_message(bucket, name, hash_),
        "meta": json.dumps(user_meta, sort_keys=True) if user_meta is not None else None,
        "workflow": _workflow_payload(workflow),
        "matchLocations": {
            "__typename": "SearchHitPackageMatchLocations",
            "name": False,
            "comment": False,
            "meta": False,
            "workflow": False,
        },
        "matchingEntries": [],
        "score": 1.0,
    }


async def package_hits(
    *,
    buckets_filter: list[str] | None = None,
    search_string: str | None = None,
    filter: dict | None = None,
    latest_only: bool = True,
    user_meta_filters: list[dict] | None = None,
) -> list[dict]:
    hits: list[dict] = []
    lowered_search = (search_string or "").strip().lower()
    for bucket in await _all_bucket_names(buckets_filter):
        if not await buckets.bucket_is_readable(bucket):
            continue
        all_pointers = await packages.get_all_package_pointers(bucket)
        for name, revisions in all_pointers.items():
            selected = revisions[:1] if latest_only else revisions
            for pointer in selected:
                hit = await _package_hit(bucket, name, pointer)
                display_name = hit["name"]
                workflow_id = _workflow_id(hit["workflow"])
                match_locations = hit["matchLocations"]
                if lowered_search:
                    match_locations["name"] = lowered_search in display_name.lower()
                    match_locations["comment"] = lowered_search in (hit["comment"] or "").lower()
                    match_locations["meta"] = lowered_search in (hit["meta"] or "").lower()
                    match_locations["workflow"] = lowered_search in (workflow_id or "").lower()
                    score = sum(1 for key in ("name", "comment", "meta", "workflow") if match_locations[key])
                    if not score:
                        continue
                    hit["score"] = float(score)
                if filter:
                    if not _matches_keyword(display_name, filter.get("name")):
                        continue
                    if not _matches_keyword(hit["hash"], filter.get("hash")):
                        continue
                    if not _matches_keyword(workflow_id, filter.get("workflow")):
                        continue
                    if not _matches_text(hit["comment"], filter.get("comment")):
                        continue
                    if not _matches_number(hit["size"], filter.get("size")):
                        continue
                    if not _matches_number(hit["totalEntriesCount"], filter.get("entries")):
                        continue
                    if not _matches_datetime(hit["modified"], filter.get("modified")):
                        continue
                if user_meta_filters:
                    continue
                hits.append(hit)
    return hits


def _package_stats(hits: list[dict]) -> dict:
    return {
        "__typename": "PackagesSearchStats",
        "modified": _datetime_extents([hit["modified"] for hit in hits]),
        "size": _number_extents([hit["size"] for hit in hits]),
        "entries": _number_extents([hit["totalEntriesCount"] for hit in hits]),
        "workflow": _keyword_extents([
            _workflow_id(hit["workflow"]) or ""
            for hit in hits
        ]),
        "userMeta": [],
        "userMetaTruncated": False,
    }


def _object_stats(hits: list[dict]) -> dict:
    return {
        "__typename": "ObjectsSearchStats",
        "modified": _datetime_extents([hit["modified"] for hit in hits]),
        "size": _number_extents([hit["size"] for hit in hits]),
        "ext": _keyword_extents([hit["ext"] for hit in hits]),
    }


async def package_search_result(
    *,
    buckets_filter: list[str] | None = None,
    search_string: str | None = None,
    filter: dict | None = None,
    latest_only: bool = True,
    user_meta_filters: list[dict] | None = None,
) -> dict:
    hits = await package_hits(
        buckets_filter=buckets_filter,
        search_string=search_string,
        filter=filter,
        latest_only=latest_only,
        user_meta_filters=user_meta_filters,
    )
    if not hits:
        return {"__typename": "EmptySearchResultSet", "_": None}
    return {
        "__typename": "PackagesSearchResultSet",
        "hits": hits,
        "stats": _package_stats(hits),
        "params": {
            "buckets": buckets_filter,
            "searchString": search_string,
            "filter": filter,
            "latestOnly": latest_only,
            "userMetaFilters": user_meta_filters,
        },
    }


async def object_search_result(
    *,
    buckets_filter: list[str] | None = None,
    search_string: str | None = None,
    filter: dict | None = None,
) -> dict:
    hits = await object_hits(
        buckets_filter=buckets_filter,
        search_string=search_string,
        filter=filter,
    )
    if not hits:
        return {"__typename": "EmptySearchResultSet", "_": None}
    return {
        "__typename": "ObjectsSearchResultSet",
        "hits": hits,
        "stats": _object_stats(hits),
        "params": {
            "buckets": buckets_filter,
            "searchString": search_string,
            "filter": filter,
        },
    }


def package_result_page(result: dict, *, size: int | None, order: str | None) -> dict:
    ordered = _sort_hits(result["hits"], order, key_field="name")
    page_size = size or DEFAULT_PAGE_SIZE
    cursor_payload = {**result["params"], "order": order}
    return _page(ordered, offset=0, size=page_size, cursor_payload=cursor_payload, kind="Packages")


def object_result_page(result: dict, *, size: int | None, order: str | None) -> dict:
    ordered = _sort_hits(result["hits"], order, key_field="key")
    page_size = size or DEFAULT_PAGE_SIZE
    cursor_payload = {**result["params"], "order": order}
    return _page(ordered, offset=0, size=page_size, cursor_payload=cursor_payload, kind="Objects")


async def search_more_packages(after: str, size: int | None = None) -> dict:
    payload = decode_cursor(after)
    result = await package_search_result(
        buckets_filter=payload.get("buckets"),
        search_string=payload.get("searchString"),
        filter=payload.get("filter"),
        latest_only=payload.get("latestOnly", True),
        user_meta_filters=payload.get("userMetaFilters"),
    )
    if result["__typename"] != "PackagesSearchResultSet":
        return {"__typename": "OperationError", "name": "CursorError", "message": "Search cursor is invalid.", "context": None}
    ordered = _sort_hits(result["hits"], payload.get("order"), key_field="name")
    return _page(
        ordered,
        offset=payload.get("offset", 0),
        size=size or DEFAULT_PAGE_SIZE,
        cursor_payload={k: v for k, v in payload.items() if k not in {"kind", "offset"}},
        kind="Packages",
    )


async def search_more_objects(after: str, size: int | None = None) -> dict:
    payload = decode_cursor(after)
    result = await object_search_result(
        buckets_filter=payload.get("buckets"),
        search_string=payload.get("searchString"),
        filter=payload.get("filter"),
    )
    if result["__typename"] != "ObjectsSearchResultSet":
        return {"__typename": "OperationError", "name": "CursorError", "message": "Search cursor is invalid.", "context": None}
    ordered = _sort_hits(result["hits"], payload.get("order"), key_field="key")
    return _page(
        ordered,
        offset=payload.get("offset", 0),
        size=size or DEFAULT_PAGE_SIZE,
        cursor_payload={k: v for k, v in payload.items() if k not in {"kind", "offset"}},
        kind="Objects",
    )


async def search_stats(bucket: str) -> dict:
    hits = await object_hits(buckets_filter=[bucket])
    ext_map: dict[str, _SearchStatsBucket] = {}
    for hit in hits:
        ext = hit["ext"]
        if ext not in ext_map:
            ext_map[ext] = {"key": ext, "doc_count": 0, "size": {"value": 0.0}}
        data = ext_map[ext]
        data["doc_count"] = int(data["doc_count"]) + 1
        size_data = data["size"]
        size_data["value"] = float(size_data["value"]) + float(hit["size"])
    buckets_list = sorted(ext_map.values(), key=lambda item: float(item["size"]["value"]), reverse=True)
    return {
        "hits": {"total": len(hits)},
        "aggregations": {
            "totalBytes": {"value": sum(float(hit["size"]) for hit in hits)},
            "exts": {"buckets": buckets_list},
        },
    }


def _bucket_agg_hits(hits: list[dict]) -> list[dict]:
    return [
        {
            "key": hit["key"],
            "latest": {
                "hits": {
                    "hits": [
                        {
                            "_source": {
                                "key": hit["key"],
                                "version_id": hit["version"],
                                "ext": hit["ext"],
                            }
                        }
                    ]
                }
            },
        }
        for hit in hits
    ]


async def search_sample(bucket: str) -> dict:
    hits = await object_hits(buckets_filter=[bucket])
    preferred = [hit for hit in hits if hit["ext"] in {".parquet", ".csv", ".tsv", ".txt", ".md", ".pdf", ".json", ".ipynb"}]
    ordered = _sort_hits(preferred or hits, "NEWEST", key_field="key")
    return {"aggregations": {"objects": {"buckets": _bucket_agg_hits(ordered[:MAX_SAMPLE_OBJECTS])}}}


async def search_images(bucket: str) -> dict:
    hits = await object_hits(buckets_filter=[bucket])
    images = [hit for hit in hits if hit["ext"] in {".png", ".jpg", ".jpeg", ".gif", ".webp"}]
    ordered = _sort_hits(images, "NEWEST", key_field="key")
    return {"aggregations": {"objects": {"buckets": _bucket_agg_hits(ordered[:MAX_IMAGE_OBJECTS])}}}
