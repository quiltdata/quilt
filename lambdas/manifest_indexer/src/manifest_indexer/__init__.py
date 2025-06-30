import datetime
import json
import urllib.parse

import jsonpointer
from quilt_shared.const import MANIFESTS_PREFIX
from quilt_shared.es import (
    make_elastic,
    make_s3_client,
    PACKAGE_INDEX_SUFFIX,
    Batcher,
    get_es_aliases,
    get_object_doc_id,
    get_manifest_doc_id,
    get_manifest_entry_doc_id,
)
from quilt_shared.log import get_quilt_logger


MAX_KEYWORD_LEN = 256


logger = get_quilt_logger()
s3_client = make_s3_client()
es = make_elastic()


def parse_s3_physical_key(pk: str):
    parsed = urllib.parse.urlparse(pk)
    if parsed.scheme != "s3":
        logger.warning("Expected S3 URL, got %s", pk)
        return
    if not (bucket := parsed.netloc):
        logger.warning("Expected S3 bucket, got %s", pk)
        return
    assert not parsed.path or parsed.path.startswith("/")
    path = urllib.parse.unquote(parsed.path)[1:]
    # Parse the version ID the way the Java SDK does:
    # https://github.com/aws/aws-sdk-java/blob/master/aws-java-sdk-s3/src/main/java/com/amazonaws/services/s3/AmazonS3URI.java#L192
    query = urllib.parse.parse_qs(parsed.query)
    version_id = query.pop("versionId", [None])[0]
    if query:
        logger.warning("Unexpected S3 query string: %s in %s", parsed.query, pk)
        return
    return {
        "bucket": bucket,
        "key": path,
        "version_id": version_id,
    }


def _try_parse_date(s: str) -> datetime.datetime | None:
    # XXX: do we need to support more formats?
    if s[-1:] == "Z":
        s = s[:-1]
    try:
        return datetime.datetime.fromisoformat(s)
    except ValueError:
        return None


def _get_metadata_fields(path: tuple, d: dict):
    for k, raw_value in d.items():
        if isinstance(raw_value, dict):
            yield from _get_metadata_fields(path + (k,), raw_value)
        else:
            v = raw_value
            if isinstance(v, str):
                date = _try_parse_date(v)
                if date is not None:
                    type_ = "date"
                    v = date
                else:
                    type_ = "keyword" if len(v) <= MAX_KEYWORD_LEN else "text"
            elif isinstance(v, bool):
                type_ = "boolean"
            elif isinstance(v, (int, float)):
                # XXX: do something on ints that can't be converted to float without loss?
                type_ = "double"
            elif isinstance(v, list):
                if not (v and all(isinstance(x, str) for x in v)):
                    continue
                type_ = "keyword" if all(len(x) <= MAX_KEYWORD_LEN for x in v) else "text"
            else:
                logger.warning("ignoring value of type %s", type(v))
                continue

            yield path + (k,), type_, raw_value, v


def get_metadata_fields(meta):
    if not isinstance(meta, dict):
        # XXX: can we do something better?
        return None
    return [
        {
            "json_pointer": jsonpointer.JsonPointer.from_parts(path).path,
            "type": type_,
            "text": json.dumps(raw_value, ensure_ascii=False),
            type_: value,
        }
        for path, type_, raw_value, value in _get_metadata_fields((), meta)
    ]


def _prepare_workflow_for_es(workflow, bucket):
    if workflow is None:
        return None

    try:
        config_url = workflow["config"]
        if not config_url.startswith(f"s3://{bucket}/.quilt/workflows/config.yml"):
            raise Exception(f"Bad workflow config URL {config_url}")

        config_url_parsed = urllib.parse.urlparse(config_url)
        query = urllib.parse.parse_qs(config_url_parsed.query)
        version_id = query.pop("versionId", [None])[0]
        if query:
            raise Exception(f"Unexpected S3 query string: {config_url_parsed.query!r}")

        return {
            "config_version_id": version_id,  # XXX: how to handle None?
            "id": workflow["id"],
            "schemas": [
                {
                    "id": k,
                    "url": v,
                }
                for k, v in workflow.get("schemas", {}).items()
            ],
        }
    except Exception:
        logger.exception("Bad workflow object: %s", json.dumps(workflow, indent=2))
        return None


def index_manifest(
    doc_queue: Batcher,
    *,
    bucket: str,
    key: str,
):
    if not key.startswith(MANIFESTS_PREFIX):
        logger.debug("Not indexing as manifest file s3://%s/%s", bucket, key)
        return

    manifest_hash = key[len(MANIFESTS_PREFIX) :]
    to_index = False
    try:
        to_index = manifest_hash.islower() and len(bytes.fromhex(manifest_hash)) == 32
    except ValueError:
        pass
    if not to_index:
        logger.warning("Not indexing as manifest file s3://%s/%s because of hash %s", bucket, key, manifest_hash)
        return

    index = bucket + PACKAGE_INDEX_SUFFIX
    doc_id = get_manifest_doc_id(manifest_hash)

    def get_pkg_data():
        try:
            resp = s3_client.get_object(Bucket=bucket, Key=key)
        except s3_client.exceptions.NoSuchKey:
            logger.debug("No manifest found: s3://%s/%s.", bucket, key)
            return
        manifest_entries = map(json.loads, resp["Body"].iter_lines())
        first = next(manifest_entries, None)
        if not first:
            return
        user_meta = first.get("user_meta")

        # yield {
        #     "_index": index,
        #     "_id": doc_id,
        #     "_op_type": "index",
        #     "join_field": {"name": "mnfst"},
        #     "mnfst_hash": manifest_hash,
        #     "mnfst_last_modified": resp["LastModified"],
        #     "mnfst_metadata": json.dumps(user_meta) if user_meta else None,
        #     "mnfst_metadata_fields": get_metadata_fields(user_meta),
        #     "mnfst_message": str(first.get("message", "")),
        #     "mnfst_workflow": _prepare_workflow_for_es(first.get("workflow"), bucket),
        # }

        total_bytes = 0
        total_files = 0
        for entry in manifest_entries:
            logger.debug("Processing manifest entry %s", entry)
            lk = entry["logical_key"]
            if lk.endswith("/"):  # XXX: do we need this?
                # skip directories
                logger.debug("Skipping directory entry %s", lk)
                continue
            total_files += 1
            total_bytes += entry["size"]
            meta = entry.get("meta")  # XXX: both system and user metadata, do we need only user?
            pk = entry["physical_keys"][0]
            pk_parsed = parse_s3_physical_key(pk)

            yield {
                "_index": index,
                "_op_type": "index",
                "_id": get_manifest_entry_doc_id(manifest_hash, entry["logical_key"]),
                "join_field": {"name": "entry", "parent": doc_id},
                "routing": doc_id,
                "entry_lk": entry["logical_key"],
                "entry_pk": pk,
                "entry_pk_parsed.s3": pk_parsed,
                "entry_size": entry["size"],
                "entry_hash": entry["hash"],
                "entry_metadata": json.dumps(meta) if meta else None,
            }
            if pk_parsed is not None:
                if pk_parsed["bucket"] in get_es_aliases():
                    yield {
                        "_index": pk_parsed["bucket"],
                        "_op_type": "update",
                        # TODO: check version_id for non-versioned buckets
                        "_id": get_object_doc_id(pk_parsed["key"], pk_parsed["version_id"]),
                        "doc": {"was_packaged": True},
                        "doc_as_upsert": True,
                    }
                else:
                    logger.info("Index %r doesn't exist, skipping entry %s", pk_parsed["bucket"], lk)

        yield {
            "_index": index,
            "_id": doc_id,
            "_op_type": "index",
            "join_field": {"name": "mnfst"},
            "mnfst_hash": manifest_hash,
            "mnfst_last_modified": resp["LastModified"],
            "mnfst_metadata": json.dumps(user_meta) if user_meta else None,
            "mnfst_metadata_fields": get_metadata_fields(user_meta),
            "mnfst_message": str(first.get("message", "")),
            "mnfst_workflow": _prepare_workflow_for_es(first.get("workflow"), bucket),
        }

    doc_data = None
    for doc_data in get_pkg_data():
        doc_queue.append(doc_data)
    if doc_data is None:
        logger.debug("No manifest entries found for s3://%s/%s. Removing.", bucket, key)
        make_elastic().delete_by_query(
            index=index,
            body={
                "query": {
                    "parent_id": {
                        "type": "entry",
                        "id": doc_id,
                    }
                }
            },
        )
        # XXX: remove it with delete_by_query from above?
        doc_queue.append(
            {
                "_index": index,
                "_op_type": "delete",
                "_id": doc_id,
            }
        )

    # return doc_data is not None


def handler(event, context):
    """Handler for package indexer events"""
    logger.debug("Package indexer handler called with event: %s", event)

    assert len(event["Records"]) == 1, "Package indexer handler expects exactly one record"

    with Batcher(s3_client, logger) as batcher:
        for record in event["Records"]:
            body = json.loads(record["body"])
            bucket = body["detail"]["s3"]["bucket"]["name"]
            key = body["detail"]["s3"]["object"]["key"]

            index_manifest(
                batcher,
                bucket=bucket,
                key=key,
            )
