""" core logic for fetching documents from S3 and queueing them locally before
sending to elastic search in memory-limited batches"""
import functools
import json
import os
from datetime import datetime
from enum import Enum
from math import floor

import boto3
from aws_requests_auth.aws_auth import AWSRequestsAuth
from elasticsearch import Elasticsearch, RequestsHttpConnection
from elasticsearch.helpers import bulk

from t4_lambda_shared.utils import get_quilt_logger, separated_env_to_iter

# number of bytes we take from each document before sending to elastic-search
# DOC_LIMIT_BYTES is the legacy variable name; leave as-is for now; requires
# change to CloudFormation templates to use the new name
assert 'DOC_LIMIT_BYTES' in os.environ
ELASTIC_LIMIT_BYTES = int(os.getenv('DOC_LIMIT_BYTES'))
assert 'CONTENT_INDEX_EXTS' in os.environ
CONTENT_INDEX_EXTS = separated_env_to_iter("CONTENT_INDEX_EXTS")

EVENT_PREFIX = {
    "Created": "ObjectCreated:",
    "Removed": "ObjectRemoved:"
}

# See https://amzn.to/2xJpngN for chunk size as a function of container size
CHUNK_LIMIT_BYTES = int(os.getenv('CHUNK_LIMIT_BYTES') or 9_500_000)
ELASTIC_TIMEOUT = 30
MAX_BACKOFF = 360  # seconds
MAX_RETRY = 2  # prevent long-running lambdas due to malformed calls
QUEUE_LIMIT_BYTES = 100_000_000  # 100MB
RETRY_429 = 3


PER_BUCKET_CONFIGS = os.getenv('PER_BUCKET_CONFIGS')
PER_BUCKET_CONFIGS = json.loads(PER_BUCKET_CONFIGS) if PER_BUCKET_CONFIGS else {}


@functools.lru_cache(maxsize=None)
def get_content_index_extensions(*, bucket_name: str):
    try:
        extensions = PER_BUCKET_CONFIGS[bucket_name]['content_extensions']
    except KeyError:
        extensions = None
    return frozenset(CONTENT_INDEX_EXTS if extensions is None else extensions)


@functools.lru_cache(maxsize=None)
def get_content_index_bytes(*, bucket_name: str):
    try:
        content_index_bytes = PER_BUCKET_CONFIGS[bucket_name]['content_bytes']
    except KeyError:
        content_index_bytes = None
    return ELASTIC_LIMIT_BYTES if content_index_bytes is None else content_index_bytes


def get_id(key, version_id):
    """
    Generate unique value for every object in the bucket to be used as
    document `_id`. This value must not exceed 512 bytes in size:
    https://www.elastic.co/guide/en/elasticsearch/reference/7.10/mapping-id-field.html.
    # TODO: both object key and version ID are up to 1024 bytes long, so
    # we need to use something like `_hash(key) + _hash(version_id)` to
    # overcome the mentioned size restriction.
    """
    return f"{key}:{version_id}"


# pylint: disable=super-init-not-called
class RetryError(Exception):
    """Fatal and final error if docs fail after multiple retries"""
    def __init__(self, message):
        pass


class DocTypes(Enum):
    OBJECT = 1  # S3 objects
    PACKAGE = 2  # Quilt packages


class DocumentQueue:
    """transient in-memory queue for documents to be indexed"""
    def __init__(self, context):
        """constructor"""
        self.queue = []
        self.size = 0
        self.context = context

    def append(
        self,
        *,
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
        logger_ = get_quilt_logger()
        if not bucket or not key:
            raise ValueError(f"bucket={bucket} or key={key} required but missing")
        is_delete_marker = False
        if event_type.startswith(EVENT_PREFIX["Created"]):
            _op_type = "index"
        elif event_type.startswith(EVENT_PREFIX["Removed"]):
            _op_type = "delete"
            if event_type.endswith("DeleteMarkerCreated"):
                is_delete_marker = True
                # we index (not delete) delete markers to sync state with S3
                _op_type = "index"
        else:
            logger_.error("Skipping unrecognized event type %s", event_type)
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
        body = {
            "_index": bucket,
            "_op_type": _op_type,  # determines if action is upsert (index) or delete
            "_id": get_id(key, version_id),
            "etag": etag,
            "key": key,
            "last_modified": last_modified,
            "size": size,
            "delete_marker": is_delete_marker,
            "version_id": version_id,
            "content": text,  # field for full-text search
            "event": event_type,
            "ext": ext,
            "updated": datetime.utcnow().isoformat(),
            "s3_tags": " ".join([f"{key} {value}" for key, value in s3_tags.items()]) if s3_tags else None,
        }

        self.append_document(body)

    def append_document(self, doc):
        """append well-formed documents (used for retry or by append())"""
        logger_ = get_quilt_logger()
        # This should be removed when we migrate to recent ES versions, see
        # https://www.elastic.co/guide/en/elasticsearch/reference/6.7/removal-of-types.html
        doc["_type"] = "_doc"
        # document text dominates memory footprint; OK to neglect the
        # small fixed size for the JSON metadata
        self.size += len(doc.get("content") or "")
        logger_.debug("Appending document %s", doc)
        self.queue.append(doc)

        if self.size >= QUEUE_LIMIT_BYTES:
            self.send_all()

    def _make_elastic(self):
        """create elasticsearch client"""
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

        return Elasticsearch(
            hosts=[{"host": elastic_host, "port": 443}],
            http_auth=awsauth,
            max_backoff=get_time_remaining(self.context) if self.context else MAX_BACKOFF,
            # Give ES time to respond when under load
            timeout=ELASTIC_TIMEOUT,
            use_ssl=True,
            verify_certs=True,
            connection_class=RequestsHttpConnection
        )

    def send_all(self):
        """flush self.queue in 1-2 bulk calls"""
        if not self.queue:
            return
        elastic = self._make_elastic()
        # For response format see
        # https://www.elastic.co/guide/en/elasticsearch/reference/6.7/docs-bulk.html
        # (We currently use Elastic 6.7 per quiltdata/deployment search.py)
        # note that `elasticsearch` post-processes this response
        _, errors = bulk_send(elastic, self.queue)
        if errors:
            id_to_doc = {d["_id"]: d for d in self.queue}
            send_again = []
            for error in errors:
                # retry index and delete errors
                if "index" in error or "delete" in error:
                    if "index" in error:
                        inner = error["index"]
                    if "delete" in error:
                        inner = error["delete"]
                        # don't retry deleting things that aren't there
                        if "not_found" in inner.get("result", ""):
                            continue
                    if "_id" in inner:
                        doc = id_to_doc[inner["_id"]]
                        # Always retry the source document if we can identify it.
                        # This catches temporary 403 on index write blocks & other
                        # transient issues.
                        send_again.append(doc)
                # retry the entire batch
                else:
                    # Unclear what would cause an error that's neither index nor delete
                    # but if there's an unknown error we need to assume it applies to
                    # the batch.
                    send_again = self.queue
            # Last retry (though elasticsearch might retry 429s tho)
            if send_again:
                _, errors = bulk_send(elastic, send_again)
                if errors:
                    raise RetryError(
                        "Failed to load messages into Elastic on second retry.\n"
                        f"{_}\nErrors: {errors}\nTo resend:{send_again}"
                    )
        # empty the queue
        self.size = 0
        self.queue = []


def get_time_remaining(context):
    """returns time remaining in seconds before lambda context is shut down"""
    logger_ = get_quilt_logger()
    time_remaining = floor(context.get_remaining_time_in_millis()/1000)
    if time_remaining < 30:
        logger_.warning(
            "Lambda function has {time_remaining} sec remaining. Reduce batch size?"
        )

    return time_remaining


def bulk_send(elastic, list_):
    """make a bulk() call to elastic"""
    logger_ = get_quilt_logger()
    logger_.debug("bulk_send(): %s", list_)
    return bulk(
        elastic,
        list_,
        # Some magic numbers to reduce memory pressure
        # e.g. see https://github.com/wagtail/wagtail/issues/4554
        chunk_size=100,  # max number of documents sent in one chunk
        # The stated default is max_chunk_bytes=10485760, but with default
        # ES will still return an exception stating that the very
        # same request size limit has been exceeded
        max_chunk_bytes=CHUNK_LIMIT_BYTES,
        # number of retries for 429 (too many requests only)
        # all other errors handled by our code
        max_retries=RETRY_429,
        # we'll process errors on our own
        raise_on_error=False,
        raise_on_exception=False
    )
