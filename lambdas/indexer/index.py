"""
send documents representing object data to elasticsearch for supported file extensions.
note: we truncate outbound documents to DOC_SIZE_LIMIT characters
(to bound memory pressure and request size to elastic)

a little knowledge on deletes and delete markers:
if bucket versioning is on:
    - `aws s3api delete-object (no --version-id)` or `aws s3 rm`
        - push a new delete marker onto the stack with a version-id
        - generate ObjectRemoved:DeleteMarkerCreated

if bucket versioning was on and is then turned off:
    - `aws s3 rm` or `aws s3api delete-object (no --version-id)`
        - replace event at top of stack
            - if a versioned delete marker, push a new one on top of it
            - if an un-versioned delete marker, replace that marker with new marker
            with version "null" (ObjectCreate will similarly replace the same with an object
            of version "null")
            - if object, destroy object
        - generate ObjectRemoved:DeleteMarkerCreated
            - problem: no way of knowing if DeleteMarkerCreated destroyed bytes
            or just created a DeleteMarker; this is usually given by the return
            value of `delete-object` but the S3 event has no knowledge of the same
    - `aws s3api delete-object --version-id VERSION`
        - destroy corresponding delete marker or object; v may be null in which
        case it will destroy the object with version null (occurs when adding
        new objects to a bucket that aws versioned but is no longer)
        - generate ObjectRemoved:Deleted

if bucket version is off and has always been off:
    - `aws s3 rm` or `aws s3api delete-object`
        - destroy object
        - generate a single ObjectRemoved:Deleted

counterintuitive things:
    - turning off versioning doesn't mean version stack can't get deeper (by at
    least 1) as indicated above in the case where a new marker is pushed onto
    the version stack
    - both creating a delete marker (soft delete) and hard deleting a delete marker
    by providing it's version-id will result in an eventType of DeleteObject
    and $.detail.responseElements.x-amz-delete-marker = true; it is therefore
    not possible to tell the difference between a new delete marker and the deletion
    of an existing one

See docs/EventBridge.md for more
"""


import datetime
import functools
import hashlib
import json
import logging
import os
import pathlib
import random
import re
import time
import urllib.parse
from os.path import split
from typing import Optional, Tuple
from urllib.parse import unquote_plus

import boto3
import botocore
import elasticsearch
import elasticsearch.helpers
import jsonpointer
import nbformat
from aws_requests_auth.aws_auth import AWSRequestsAuth
from dateutil.tz import tzutc
from document_queue import (
    EVENT_PREFIX,
    MAX_RETRY,
    DocumentQueue,
    get_content_index_bytes,
    get_content_index_extensions,
    get_object_id,
)
from jsonschema import ValidationError, draft7_format_checker, validate
from pdfminer.high_level import extract_text as extract_pdf_text
import tenacity
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from t4_lambda_shared.preview import (
    ELASTIC_LIMIT_LINES,
    extract_excel,
    extract_fcs,
    extract_parquet,
    get_bytes,
    get_preview_lines,
    trim_to_bytes,
)
from t4_lambda_shared.utils import (
    MANIFEST_PREFIX_V1,
    PACKAGE_INDEX_SUFFIX,
    POINTER_PREFIX_V1,
    get_available_memory,
    get_quilt_logger,
    separated_env_to_iter,
)

# translate events to S3 native names
EVENTBRIDGE_TO_S3 = {
    "PutObject": EVENT_PREFIX["Created"] + "Put",
    "CopyObject": EVENT_PREFIX["Created"] + "Copy",
    "CompleteMultipartUpload": EVENT_PREFIX["Created"] + "CompleteMultipartUpload",
    # see map_event_name for complete logic
    "DeleteObject": None,
    # "DeleteObjects" is not handled since it does not contain enough information on
    # which objects where deleted
}

# ensure that we process events of known and expected shape
EVENT_SCHEMA = {
    'type': 'object',
    'properties': {
        'awsRegion': {
            'type': 'string'
        },
        'eventName': {
            'type': 'string'
        },
        'eventTime': {
            'type': 'string',
            'format': 'date-time'
        },
        's3': {
            'type': 'object',
            'properties': {
                'bucket': {
                    'type': 'object',
                    'properties': {
                        'name': {
                            'type': 'string'
                        }
                    },
                    'required': ['name'],
                    'additionalProperties': True
                },
                'object': {
                    'type': 'object',
                    'properties': {
                        'eTag': {
                            'type': 'string'
                        },
                        'isDeleteMarker': {
                            'type': 'string'
                        },
                        'key': {
                            'type': 'string'
                        },
                        'versionId': {
                            'type': 'string'
                        }
                    },
                    'required': ['key'],
                    'additionalProperties': True
                },
            },
            'required': ['bucket', 'object'],
            'additionalProperties': True
        },
    },
    'required': ['s3', 'eventName'],
    'additionalProperties': True
}
# Max number of PDF pages to extract because it can be slow
MAX_PDF_PAGES = 100
# 10 MB, see https://amzn.to/2xJpngN
NB_VERSION = 4  # default notebook version for nbformat
# currently only affects .parquet, TODO: extend to other extensions
assert 'SKIP_ROWS_EXTS' in os.environ
SKIP_ROWS_EXTS = separated_env_to_iter('SKIP_ROWS_EXTS')
# DUCKDB_SELECT_LAMBDA_ARN = os.environ["DUCKDB_SELECT_LAMBDA_ARN"]
TEST_EVENT = "s3:TestEvent"
# we need to filter out GetObject and HeadObject calls generated by the present
#  lambda in order to display accurate analytics in the Quilt catalog
#  a custom user agent enables said filtration
USER_AGENT_EXTRA = " quilt3-lambdas-es-indexer"
ELASTIC_TIMEOUT = 30


logger = get_quilt_logger()
s3_client = boto3.client("s3", config=botocore.config.Config(user_agent_extra=USER_AGENT_EXTRA))


class JSONEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle datetime and bytes"""

    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()

        return super().default(obj)


class Batcher:
    json_encode = JSONEncoder(ensure_ascii=False, separators=(",", ":")).encode
    BATCH_INDEXER_BUCKET = os.getenv("BATCH_INDEXER_BUCKET")
    BATCH_MAX_BYTES = int(os.getenv("BATCH_MAX_BYTES", 8_000_000))
    BATCH_MAX_DOCS = int(os.getenv("BATCH_MAX_DOCS", 10_000))

    @staticmethod
    def _make_key():
        return f"{random.randbytes(4).hex()}/object"

    def _reset(self):
        """reset the current batch"""
        self.current_batch: list[bytes] = []
        self.current_batch_size = 0

    def __init__(self) -> None:
        self._reset()

    def _send_batch(self):
        """send the current batch to S3"""
        if not self.current_batch:
            return
        batch = self.current_batch
        self._reset()
        key = self._make_key()
        s3_client.put_object(
            Bucket=self.BATCH_INDEXER_BUCKET,
            Key=key,
            Body=b"\n".join(batch),
            ContentType="application/json",
        )
        logger.debug("Batch sent to s3://%s/%s", self.BATCH_INDEXER_BUCKET, key)

    def append(self, doc: dict):
        # get doc ownership
        doc["_type"] = "_doc"  # ES 6.x compatibility
        data = "\n".join(
            map(self.json_encode, filter(None.__ne__, elasticsearch.helpers.expand_action(doc)))
        ).encode()
        assert (
            len(data) < self.BATCH_MAX_BYTES
        ), f"Document size {len(data)} exceeds max batch size {self.BATCH_MAX_BYTES}"

        if (
            len(self.current_batch) >= self.BATCH_MAX_DOCS
            or self.current_batch_size + len(data) > self.BATCH_MAX_BYTES
        ):
            self._send_batch()

        self.current_batch.append(data)
        self.current_batch_size += len(data)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        """Send the remaining batch on exit"""
        self._send_batch()


@functools.cache
def make_elastic():
    elastic_host = os.environ["ES_HOST"]
    session = boto3.session.Session()
    credentials = session.get_credentials().get_frozen_credentials()
    awsauth = AWSRequestsAuth(
        # These environment variables are automatically set by Lambda
        aws_access_key=credentials.access_key,
        aws_secret_access_key=credentials.secret_key,
        aws_token=credentials.token,
        aws_host=elastic_host,
        aws_region=session.region_name,
        aws_service="es"
    )

    return elasticsearch.Elasticsearch(
        hosts=[{"host": elastic_host, "port": 443}],
        http_auth=awsauth,
        # Give ES time to respond when under load
        timeout=ELASTIC_TIMEOUT,
        use_ssl=True,
        verify_certs=True,
        connection_class=elasticsearch.RequestsHttpConnection,
    )


@functools.cache
def get_es_aliases() -> frozenset[str]:
    return frozenset(a for v in make_elastic().indices.get_alias().values() for a in v["aliases"])


def now_like_boto3():
    """ensure timezone UTC for consistency with boto3:
    Example of what boto3 returns on head_object:
        'LastModified': datetime.datetime(2019, 11, 6, 3, 1, 16, tzinfo=tzutc()),
    """
    return datetime.datetime.now(tz=tzutc())


def hash_string(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def get_compression(ext: str):
    """return the compression type or None if not supported"""
    return "gz" if ext == ".gz" else None


def get_normalized_extensions(key) -> Tuple[str, str]:
    """standard function turning keys into a list of (possibly empty) extensions"""
    path = pathlib.PurePosixPath(key)
    try:
        ext_last = path.suffix.lower()
        ext_next_last = path.with_suffix('').suffix.lower()
    except ValueError:
        return ("", "")

    # return in left-to-right order as they occur in the key
    return (ext_next_last, ext_last)


def infer_extensions(key, exts: Tuple[str, str], compression):
    """guess extensions if possible"""
    # Handle special case of hive partitions
    # see https://www.qubole.com/blog/direct-writes-to-increase-spark-performance/
    long_ext = "".join(exts)
    # pylint: disable=too-many-boolean-expressions)
    if (
            re.fullmatch(r".c\d{3,5}", long_ext) or re.fullmatch(r".*-c\d{3,5}$", key)
            or key.endswith("_0")
            or exts[-1] == ".pq"
            or (compression and exts[0] == ".pq")
    ):
        return ".parquet"
    elif compression:
        return exts[0]

    return exts[-1]


def should_retry_exception(exception):
    """don't retry certain 40X errors"""
    if hasattr(exception, 'response'):
        error_code = exception.response.get('Error', {}).get('Code', 218)
        return error_code not in ["402", "403", "404"]
    return False


# TODO: remove
@retry(
    stop=stop_after_attempt(MAX_RETRY),
    wait=wait_exponential(multiplier=2, min=4, max=10),
    retry=(retry_if_exception(should_retry_exception))
)
def select_manifest_meta(s3_client, bucket: str, key: str):
    """
    wrapper for retry and returning a string
    """
    try:
        body = s3_client.get_object(Bucket=bucket, Key=key)["Body"]
        with body:  # this *might* be needed to close the stream ASAP
            for line in body.iter_lines():
                return json.loads(line)
    except (botocore.exceptions.ClientError, json.JSONDecodeError) as cle:
        print(f"Unable to S3 select manifest: {cle}")

    return None


def do_index(
        s3_client,
        doc_queue: DocumentQueue,
        event_type: str,
        *,
        bucket: str,
        etag: str,
        ext: str,
        key: str,
        last_modified: str,
        text: str = '',
        size: int = 0,
        version_id: Optional[str] = None,
        s3_tags: Optional[dict] = None,
):
    """wrap dual indexing of packages and objects"""
    logger_ = get_quilt_logger()
    # index as object (always)
    logger_.debug("%s to indexing queue (%s)", key, event_type)
    index_object(
        doc_queue=doc_queue,
        event_type=event_type,
        bucket=bucket,
        ext=ext,
        etag=etag,
        key=key,
        last_modified=last_modified,
        size=size,
        text=text,
        version_id=version_id,
        s3_tags=s3_tags,
    )

    if index_if_pointer(
        doc_queue=doc_queue,
        bucket=bucket,
        key=key,
    ):
        logger.debug("Indexed pointer for package %s/%s", bucket, key)


def _try_parse_date(s: str) -> Optional[datetime.datetime]:
    # XXX: do we need to support more formats?
    if s[-1:] == "Z":
        s = s[:-1]
    try:
        return datetime.datetime.fromisoformat(s)
    except ValueError:
        return None


MAX_KEYWORD_LEN = 256


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
        version_id = query.pop('versionId', [None])[0]
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


def read_manifest_entries(s3_client, bucket: str, key: str):
    try:
        body = s3_client.get_object(Bucket=bucket, Key=key)["Body"]
        return map(json.loads, body.iter_lines())
    except (botocore.exceptions.ClientError, json.JSONDecodeError) as cle:
        print(f"Unable to S3 select manifest: {cle}")

    return None


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


def index_if_pointer(
    doc_queue: DocumentQueue,
    *,
    bucket: str,
    key: str,
) -> bool:
    """index manifest pointer files as package documents in ES
        Returns:
            - True if pointer to manifest (and passes to doc_queue for indexing)
            - False if not a manifest (no attempt at indexing)
    """
    pointer_prefix, pointer_file = split(key)
    handle = pointer_prefix[len(POINTER_PREFIX_V1):]
    if (
            not pointer_file
            or not pointer_prefix.startswith(POINTER_PREFIX_V1)
            or len(handle) < 3
            or '/' not in handle
    ):
        logger.debug("Not indexing as pointer s3://%s/%s", bucket, key)
        return False
    try:
        manifest_timestamp = int(pointer_file)
        if not 1451631600 <= manifest_timestamp <= 1767250800:
            logger.warning("Unexpected manifest timestamp s3://%s/%s", bucket, key)
            return False
    except ValueError as err:
        logger.debug("Non-integer manifest pointer: s3://%s/%s, %s", bucket, key, err)

    index = bucket + PACKAGE_INDEX_SUFFIX
    pointer_doc_id = f"ptr:{hash_string(handle + '/' + pointer_file)}"  # XXX: is this ok?

    try:
        resp = s3_client.get_object(
            Bucket=bucket,
            Key=key,
        )
    except s3_client.exceptions.NoSuchKey:
        logger.debug("No pointer found: s3://%s/%s. Removing.", bucket, key)
        doc_queue.append_document(
            {
                "_index": index,
                "_op_type": "delete",
                "_id": pointer_doc_id,
            }
        )
        return False  # XXX: ???

    manifest_hash = resp["Body"].read().decode()
    manifest_doc_id = f"mnfst:{manifest_hash}"
    logger.debug("Package hash %s found for s3://%s/%s", manifest_hash, bucket, key)
    doc_queue.append_document(
        {
            "_index": index,
            "_op_type": "index",
            "_id": pointer_doc_id,
            "join_field": {"name": "ptr", "parent": manifest_doc_id},
            "routing": manifest_doc_id,
            "ptr_name": handle,
            "ptr_tag": pointer_file,
            "ptr_last_modified": resp["LastModified"],
        }
    )
    return True


def index_manifest(
    doc_queue: Batcher,
    *,
    bucket: str,
    key: str,
):
    if not key.startswith(MANIFEST_PREFIX_V1):
        logger.debug("Not indexing as manifest file s3://%s/%s", bucket, key)
        return

    manifest_hash = key[len(MANIFEST_PREFIX_V1):]
    to_index = False
    try:
        to_index = manifest_hash.islower() and len(bytes.fromhex(manifest_hash)) == 32
    except ValueError:
        pass
    if not to_index:
        logger.warning("Not indexing as manifest file s3://%s/%s because of hash %s", bucket, key, manifest_hash)
        return

    index = bucket + PACKAGE_INDEX_SUFFIX
    doc_id = f"mnfst:{manifest_hash}"

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
                "_id": f"entry:{manifest_hash}:{hash_string(entry['logical_key'])}",
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
                        "_id": get_object_id(pk_parsed["key"], pk_parsed["version_id"]),
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


def index_object(
    *,
    doc_queue: DocumentQueue,
    bucket: str,
    key: str,
    etag: str,
    last_modified: str,
    size: int,
    text: str,
    event_type: str,
    ext: str,
    version_id,
    s3_tags,
):
    """format event as a document and then queue the document"""
    if not bucket or not key:
        raise ValueError(f"bucket={bucket} or key={key} required but missing")
    is_delete_marker = False
    if event_type.startswith(EVENT_PREFIX["Created"]):
        _op_type = "update"
    elif event_type.startswith(EVENT_PREFIX["Removed"]):
        _op_type = "delete"
        if event_type.endswith("DeleteMarkerCreated"):
            is_delete_marker = True
            # we index (not delete) delete markers to sync state with S3
            _op_type = "index"
    else:
        logger.error("Skipping unrecognized event type %s", event_type)
        return
    # On types and fields, see
    # https://www.elastic.co/guide/en/elasticsearch/reference/master/mapping.html
    # Set common properties on the document
    # BE CAREFUL changing these values, as type changes or missing fields
    # can cause exceptions from ES
    # ensure the same versionId and primary keys (_id) as given by
    #  list-object-versions in the enterprise bulk_scanner
    version_id = version_id or "null"
    # core properties for all document types;
    # see https://elasticsearch-py.readthedocs.io/en/6.3.1/helpers.html
    data = {
        "etag": etag,
        "key": key,
        "last_modified": last_modified,
        "size": size,
        "delete_marker": is_delete_marker,
        "version_id": version_id,
        "content": text,  # field for full-text search
        "event": event_type,
        "ext": ext,
        "updated": datetime.datetime.utcnow().isoformat(),
        "s3_tags": " ".join([f"{key} {value}" for key, value in s3_tags.items()]) if s3_tags else None,
    }
    body = {
        "_index": bucket,
        "_op_type": _op_type,  # determines if action is upsert (index) or delete
        "_id": get_object_id(key, version_id),
    }
    if _op_type == "update":
        body.update(
            doc=data,
            doc_as_upsert=True,
        )
    else:
        body.update(data)
    doc_queue.append_document(body)


@functools.lru_cache(maxsize=None)
def get_bucket_region(bucket: str) -> str:
    resp = s3_client.head_bucket(Bucket=bucket)
    return resp["ResponseMetadata"]["HTTPHeaders"]["x-amz-bucket-region"]


@functools.lru_cache(maxsize=None)
def get_presigner_client(bucket: str):
    return boto3.client(
        "s3",
        region_name=get_bucket_region(bucket),
        config=botocore.config.Config(signature_version="s3v4"),
    )


# TODO: remove
def select_package_stats(bucket, manifest_key) -> Optional[dict]:
    """use s3 select to generate file stats for package"""
    logger_ = get_quilt_logger()
    presigner_client = get_presigner_client(bucket)
    url = presigner_client.generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": bucket,
            "Key": manifest_key,
        },
    )
    lambda_ = make_lambda_client()
    q = f"""
    SELECT
        COALESCE(SUM(size), 0) AS total_bytes,
        COUNT(size) AS total_files FROM read_ndjson('{url}', columns={{size: 'UBIGINT'}}) obj
    """
    resp = lambda_.invoke(
        FunctionName=DUCKDB_SELECT_LAMBDA_ARN,
        Payload=json.dumps({"query": q, "user_agent": f"DuckDB Select {USER_AGENT_EXTRA}"}),
    )

    payload = resp["Payload"].read()
    if "FunctionError" in resp:
        logger_.error("DuckDB select unhandled error: %s", payload)
        return None
    parsed = json.loads(payload)
    if "error" in parsed:
        logger_.error("DuckDB select error: %s", parsed["error"])
        return None

    rows = parsed["rows"]
    return rows[0] if rows else None


def extract_pptx(fileobj, max_size: int) -> str:
    import pptx

    out = []
    prs = pptx.Presentation(fileobj)

    def iter_text_parts():
        for slide in prs.slides:
            for shape in slide.shapes:
                if shape.has_text_frame:
                    text = shape.text.strip()
                    if text:
                        yield text

    for part in iter_text_parts():
        max_size -= len(part) + 1
        if max_size < 0:
            break
        out.append(part)
    return '\n'.join(out)


def maybe_get_contents(bucket, key, inferred_ext, *, etag, version_id, s3_client, size, compression=None):
    """get the byte contents of a file if it's a target for deep indexing"""
    logger_ = get_quilt_logger()
    logger_.debug(
        "Entering maybe_get_contents (could run out of mem.) %s %s %s", bucket, key, version_id
    )
    content = ""
    if inferred_ext in get_content_index_extensions(bucket_name=bucket):
        def _get_obj():
            return retry_s3(
                "get",
                bucket,
                key,
                size,
                etag=etag,
                s3_client=s3_client,
                version_id=version_id,
            )

        if inferred_ext == ".fcs":
            obj = _get_obj()
            body, info = extract_fcs(get_bytes(obj["Body"], compression), as_html=False)
            # be smart and just send column names to ES (instead of bloated full schema)
            # if this is not an HTML/catalog preview
            content = trim_to_bytes(f"{body}\n{info}", get_content_index_bytes(bucket_name=bucket))
        elif inferred_ext == ".ipynb":
            content = trim_to_bytes(
                # we have no choice but to fetch the entire notebook, because we
                # are going to parse it
                # warning: huge notebooks could spike memory here
                get_notebook_cells(
                    bucket,
                    key,
                    size,
                    compression,
                    etag=etag,
                    s3_client=s3_client,
                    version_id=version_id
                ),
                get_content_index_bytes(bucket_name=bucket),
            )
        elif inferred_ext == ".parquet":
            if size >= get_available_memory():
                print(f"{bucket}/{key} too large to deserialize; skipping contents")
                # at least index the key and other stats, but don't overrun memory
                # and fail indexing altogether
                return ""
            obj = _get_obj()
            body, info = extract_parquet(
                get_bytes(obj["Body"], compression),
                as_html=False,
                skip_rows=(inferred_ext in SKIP_ROWS_EXTS),
                max_bytes=get_content_index_bytes(bucket_name=bucket),
            )
            # be smart and just send column names to ES (instead of bloated full schema)
            # if this is not an HTML/catalog preview
            columns = ','.join(list(info['schema']['names']))
            content = trim_to_bytes(f"{columns}\n{body}", get_content_index_bytes(bucket_name=bucket))
        elif inferred_ext == ".pdf":
            obj = _get_obj()
            content = trim_to_bytes(
                extract_pdf(get_bytes(obj["Body"], compression)),
                get_content_index_bytes(bucket_name=bucket),
            )
        elif inferred_ext in (".xls", ".xlsx"):
            obj = _get_obj()
            body, _ = extract_excel(get_bytes(obj["Body"], compression), as_html=False)
            content = trim_to_bytes(
                body,
                get_content_index_bytes(bucket_name=bucket),
            )
        elif inferred_ext == ".pptx":
            obj = _get_obj()
            content = extract_pptx(get_bytes(obj["Body"], compression), get_content_index_bytes(bucket_name=bucket))
        else:
            content = get_plain_text(
                bucket,
                key,
                size,
                compression,
                etag=etag,
                s3_client=s3_client,
                version_id=version_id
            )

    return content


def extract_pdf(file_):
    """Get plain text form PDF for searchability.
    Args:
        file_ - file-like object opened in binary mode, pointing to XLS or XLSX
    Returns:
        pdf text as a string

    Warning:
        This function can be slow. The 8-page test PDF takes ~10 sec to turn into a string.
    """
    txt = extract_pdf_text(file_, maxpages=MAX_PDF_PAGES)
    # crunch down space; extract_text inserts multiple spaces
    # between words, literal newlines, etc.
    return re.sub(r"\s+", " ", txt)


def extract_text(notebook_str):
    """ Extract code and markdown
    Args:
        * nb - notebook as a string
    Returns:
        * str - select code and markdown source (and outputs)
    Pre:
        * notebook is well-formed per notebook version 4
        * "cell_type" is defined for all cells
        * "source" defined for all "code" and "markdown" cells
    Throws:
        * Anything nbformat.reads() can throw :( which is diverse and poorly
        documented, hence the `except Exception` in handler()
    Notes:
        * Deliberately decided not to index output streams and display strings
        because they were noisy and low value
        * Tested this code against ~6400 Jupyter notebooks in
        s3://alpha-quilt-storage/tree/notebook-search/
        * Might be useful to index "cell_type" : "raw" in the future
    See also:
        * Format reference https://nbformat.readthedocs.io/en/latest/format_description.html
    """
    formatted = nbformat.reads(notebook_str, as_version=NB_VERSION)
    text = []
    for cell in formatted.get("cells", []):
        if "source" in cell and cell.get("cell_type") in ("code", "markdown"):
            text.append(cell["source"])

    return "\n".join(text)


def get_notebook_cells(bucket, key, size, compression, *, etag, s3_client, version_id):
    """extract cells for ipynb notebooks for indexing"""
    text = ""
    try:
        obj = retry_s3(
            "get",
            bucket,
            key,
            size,
            etag=etag,
            s3_client=s3_client,
            version_id=version_id
        )
        data = get_bytes(obj["Body"], compression)
        notebook = data.getvalue().decode("utf-8")
        try:
            text = extract_text(notebook)
        except (json.JSONDecodeError, nbformat.reader.NotJSONError):
            print(f"Invalid JSON in {key}.")
        except (KeyError, AttributeError) as err:
            print(f"Missing key in {key}: {err}")
        # there might be more errors than covered by test_read_notebook
        # better not to fail altogether
        except Exception as exc:  # pylint: disable=broad-except
            print(f"Exception in file {key}: {exc}")
    except UnicodeDecodeError as uni:
        print(f"Unicode decode error in {key}: {uni}")

    return text


def get_plain_text(
        bucket,
        key,
        size,
        compression,
        *,
        etag,
        s3_client,
        version_id
) -> str:
    """get plain text object contents"""
    text = ""
    try:
        obj = retry_s3(
            "get",
            bucket,
            key,
            size,
            etag=etag,
            s3_client=s3_client,
            limit=get_content_index_bytes(bucket_name=bucket),
            version_id=version_id
        )
        lines = get_preview_lines(
            obj["Body"],
            compression,
            ELASTIC_LIMIT_LINES,
            get_content_index_bytes(bucket_name=bucket),
        )
        text = '\n'.join(lines)
    except UnicodeDecodeError as ex:
        print(f"Unicode decode error in {key}", ex)

    return text


def make_s3_client():
    """make a client with a custom user agent string so that we can
    filter the present lambda's requests to S3 from object analytics"""
    configuration = botocore.config.Config(user_agent_extra=USER_AGENT_EXTRA)
    return boto3.client("s3", config=configuration)


@functools.lru_cache(maxsize=None)
def make_lambda_client():
    return boto3.client("lambda")


def map_event_name(event: dict):
    """transform eventbridge names into S3-like ones"""
    input_ = event["eventName"]
    if input_ in EVENTBRIDGE_TO_S3:
        if input_ == "DeleteObject":
            if event["s3"]["object"].get("isDeleteMarker"):
                return EVENT_PREFIX["Removed"] + "DeleteMarkerCreated"
            return EVENT_PREFIX["Removed"] + "Delete"
        # all non-delete events just use the map
        return EVENTBRIDGE_TO_S3[input_]
    # leave event type unchanged if we don't recognize it
    return input_


def shape_event(event: dict):
    """check event schema, return None if schema check fails"""
    logger_ = get_quilt_logger()

    try:
        validate(
            instance=event,
            schema=EVENT_SCHEMA,
            # format_checker= required for for format:date-time validation
            # (we also need strict-rfc3339 in requirements.txt)
            format_checker=draft7_format_checker,
        )
    except ValidationError as error:
        logger_.error("Invalid event format: %s\n%s", error, event)
        return None
    # be a good citizen and don't modify params
    return {
        **event,
        'eventName': map_event_name(event),
    }


def handler(event, context):
    """enumerate S3 keys in event, extract relevant data, queue events, send to
    elastic via bulk() API
    """
    logger_ = get_quilt_logger()
    # message is a proper SQS message, which either contains a single event
    # (from the bucket notification system) or batch-many events as determined
    # by enterprise/**/bulk_loader.py
    # An exception that we'll want to re-raise after the batch sends
    # TODO: handle s3:ObjectTagging:* events to keep s3_tags updated
    content_exception = None
    batch_processor = DocumentQueue(context, make_elastic())
    s3_client = make_s3_client()
    for message in event["Records"]:
        body = json.loads(message["body"])
        body_message = json.loads(body["Message"])
        if "Records" not in body_message:
            # could be TEST_EVENT, or another unexpected event; skip it
            logger_.error("No 'Records' key in message['body']: %s", message)
            continue
        events = body_message["Records"]
        # event is a single S3 event
        for event_ in events:
            validated = shape_event(event_)
            if not validated:
                logger_.debug("Skipping invalid event %s", event_)
                continue
            event_ = validated
            logger_.debug("Processing %s", event_)
            try:
                event_name = event_["eventName"]
                # Process all Create:* and Remove:* events
                if not any(event_name.startswith(n) for n in EVENT_PREFIX.values()):
                    logger_.warning("Skipping unknown event type: %s", event_name)
                    continue
                bucket = event_["s3"]["bucket"]["name"]
                # In the grand tradition of IE6, S3 events turn spaces into '+'
                # TODO: check if eventbridge events do the same thing with +
                key = unquote_plus(event_["s3"]["object"]["key"])
                version_id = event_["s3"]["object"].get("versionId", None)
                # ObjectRemoved:Delete does not include "eTag"
                etag = event_["s3"]["object"].get("eTag", "")
                # synthetic events from bulk scanner might define lastModified
                last_modified = (
                    event_["s3"]["object"].get("lastModified") or event_["eventTime"]
                )
                # Get two levels of extensions to handle files like .csv.gz
                ext_next_last, ext_last = get_normalized_extensions(key)
                compression = get_compression(ext_last)
                ext = ext_next_last + ext_last
                # Handle delete and deletemarker first and then continue so that
                # head_object and get_object (below) don't fail
                if event_name.startswith(EVENT_PREFIX["Removed"]):
                    do_index(
                        s3_client,
                        batch_processor,
                        event_name,
                        bucket=bucket,
                        etag=etag,
                        ext=ext,
                        key=key,
                        last_modified=last_modified,
                        version_id=version_id
                    )
                    continue
                try:
                    head = retry_s3(
                        "head",
                        bucket,
                        key,
                        s3_client=s3_client,
                        version_id=version_id,
                        etag=etag
                    )
                except botocore.exceptions.ClientError as first:
                    logger_.warning("head_object error: %s", first)
                    # "null" version sometimes results in 403s for buckets
                    # that have changed versioning, retry without it
                    if (first.response.get('Error', {}).get('Code') == "403"
                            and version_id == "null"):
                        try:
                            head = retry_s3(
                                "head",
                                bucket,
                                key,
                                s3_client=s3_client,
                                version_id=None,
                                etag=etag
                            )
                        except botocore.exceptions.ClientError as second:
                            # this will bypass the DLQ but that's the right thing to do
                            # as some listed objects may NEVER succeed head requests
                            # (e.g. foreign owner) and there's no reason to torpedo
                            # the whole batch (which might include good files)
                            logger_.warning("Retried head_object error: %s", second)
                    logger_.error("Fatal head_object, skipping event: %s", event_)
                    continue
                # backfill fields based on the head_object
                size = head["ContentLength"]
                last_modified = last_modified or head["LastModified"].isoformat()
                etag = head.get("etag") or etag
                version_id = head.get("VersionId") or version_id
                try:
                    text = maybe_get_contents(
                        bucket,
                        key,
                        infer_extensions(key, (ext_next_last, ext_last), compression),
                        etag=etag,
                        version_id=version_id,
                        s3_client=s3_client,
                        size=size,
                        compression=compression
                    )
                # we still want an entry for this document in elastic so that, e.g.,
                # the file counts from elastic are correct
                # these exceptions can happen for a variety of reasons (e.g. glacier
                # storage class, index event arrives after delete has occurred, etc.)
                # given how common they are, we shouldn't fail the batch for this
                except Exception as exc:  # pylint: disable=broad-except
                    text = ""
                    logger_.warning("Content extraction failed %s %s %s", bucket, key, exc)

                # XXX: we could replace head_object() call above with get_object(Range='bytes=0-0')
                #      which returns TagsCount, so we could optimize out get_object_tagging() call
                #      for objects without tags.

                do_index(
                    s3_client,
                    batch_processor,
                    event_name,
                    bucket=bucket,
                    etag=etag,
                    ext=ext,
                    key=key,
                    last_modified=last_modified,
                    size=size,
                    text=text,
                    version_id=version_id,
                    s3_tags=get_object_tagging(
                        s3_client=s3_client,
                        bucket=bucket,
                        key=key,
                        version_id=version_id,
                    ),
                )

            except botocore.exceptions.ClientError as boto_exc:
                if not should_retry_exception(boto_exc):
                    logger_.warning("Skipping non-fatal exception: %s", boto_exc)
                    continue
                logger_.critical("Failed record: %s, %s", event, boto_exc)
                raise boto_exc
    # flush the queue
    batch_processor.send_all()


def retry_s3(
        operation,
        bucket,
        key,
        size=None,
        limit=None,
        *,
        etag,
        version_id,
        s3_client
):
    """retry head or get operation to S3 with; stop before we run out of time.
    retry is necessary since, due to eventual consistency, we may not
    always get the required version of the object.
    """
    logger_ = get_quilt_logger()

    if operation == "head":
        function_ = s3_client.head_object
    elif operation == "get":
        function_ = s3_client.get_object
    else:
        raise ValueError(f"unexpected operation: {operation}")
    # Keyword arguments to function_
    arguments = {
        "Bucket": bucket,
        "Key": key
    }
    if operation == 'get' and size and limit:
        # can only request range if file is not empty
        arguments['Range'] = f"bytes=0-{min(size, limit) - 1}"
    if version_id:
        arguments['VersionId'] = version_id
    elif etag:
        arguments['IfMatch'] = etag

    logger_.debug("Entering @retry: %s, %s", operation, arguments)

    @retry(
        # debug
        reraise=True,
        stop=stop_after_attempt(MAX_RETRY),
        wait=wait_exponential(multiplier=2, min=4, max=10),
        retry=(retry_if_exception(should_retry_exception))
    )
    def call():
        """local function so we can set stop_after_delay dynamically"""
        # TODO: remove all this, stop_after_delay is not dynamically loaded anymore
        return function_(**arguments)

    return call()


def get_object_tagging(*, s3_client, bucket: str, key: str, version_id: Optional[str]) -> Optional[dict]:
    params = {
        "Bucket": bucket,
        "Key": key,
    }
    if version_id:
        params["VersionId"] = version_id

    try:
        s3_tags = s3_client.get_object_tagging(**params)["TagSet"]
        return {t["Key"]: t["Value"] for t in s3_tags}
    except botocore.exceptions.ClientError as e:
        if e.response["Error"]["Code"] != "AccessDenied":
            raise
        get_quilt_logger().error(
            "AccessDenied while getting tags for Bucket=%s, Key=%s, VersionId=%s",
            bucket, key, version_id
        )
        return None


def batch_indexer_handler(event, context):
    logger.debug("Batch indexer handler called with event: %s", event)
    assert len(event["Records"]) == 1, "Batch indexer handler expects exactly one record"
    event, = event["Records"]
    event = json.loads(event["body"])
    assert len(event["Records"]) == 1, "Batch indexer handler expects exactly one S3 event record"
    event, = event["Records"]

    bucket = event["s3"]["bucket"]["name"]
    key = event["s3"]["object"]["key"]
    # XXX: use version?

    class BulkDocumentError(Exception):
        pass

    class TooManyRequestsError(Exception):
        pass

    class LambdaTimeoutError(Exception):
        pass

    def sleep_until_timeout():
        """Sleep until the lambda timeout"""
        remaining = context.get_remaining_time_in_millis() / 1000 - 1
        logger.warning("Sleeping for %s seconds just before lambda timeout", remaining)
        # good night, sweet prince
        time.sleep(remaining)

    # # it looks like ES internal bulk API has a 60s timeout by default
    # # so we should wait hoping ES will be able to process the request
    # read_timeout = 61

    # @tenacity.retry(
    #     reraise=True,
    #     wait=tenacity.wait_random_exponential(min=8, multiplier=8),
    #     retry=tenacity.retry_if_exception_type(TooManyRequestsError),
    #     before_sleep=tenacity.before_log(logger, logging.WARNING),
    # )
    def bulk(context, es, data: bytes):
        # if context.get_remaining_time_in_millis() < read_timeout * 1000:
        #     logger.warning("Not enough time left to process bulk request, sleeping till lambda timeout")
        #     sleep_until_timeout()
        #     raise LambdaTimeoutError
        try:
            resp = es.bulk(
                data,
                filter_path="errors",
                request_timeout=context.get_remaining_time_in_millis() / 1000 - 1,
            )
        except elasticsearch.exceptions.ConnectionTimeout as e:
            # At this point ES seems to start returning 5xx errors
            logger.warning("We got a connection timeout, sleeping until lambda timeout")
            sleep_until_timeout()
            raise
        except elasticsearch.exceptions.TransportError as e:
            if e.status_code == 429:
                logger.warning("Got a 429 Too Many Requests error, sleeping until lambda timeout")
                sleep_until_timeout()
                raise TooManyRequestsError
            raise

        if resp["errors"]:
            # TODO: log errors from items.*.error?
            # TODO: ignore index_not_found_exception for delete operations?
            raise BulkDocumentError

    data = s3_client.get_object(Bucket=bucket, Key=key)["Body"].read()
    bulk(context, make_elastic(), data)
    s3_client.delete_object(Bucket=bucket, Key=key)


def pkg_indexer_handler(event, context):
    """Handler for package indexer events"""
    logger.debug("Package indexer handler called with event: %s", event)

    assert len(event["Records"]) == 1, "Package indexer handler expects exactly one record"

    with Batcher() as batcher:
        for record in event["Records"]:
            body = json.loads(record["body"])
            bucket = body["detail"]["s3"]["bucket"]["name"]
            key = body["detail"]["s3"]["object"]["key"]

            index_manifest(
                batcher,
                bucket=bucket,
                key=key,
            )
