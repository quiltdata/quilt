""" core logic for fetching documents from S3 and queueing them locally before
sending to elastic search in memory-limited batches"""
import os
from datetime import datetime
from enum import Enum
from math import floor
from typing import Dict, List

import boto3
from aws_requests_auth.aws_auth import AWSRequestsAuth
from elasticsearch import Elasticsearch, RequestsHttpConnection
from elasticsearch.helpers import bulk

from t4_lambda_shared.preview import ELASTIC_LIMIT_BYTES
from t4_lambda_shared.utils import (
    PACKAGE_INDEX_SUFFIX,
    get_quilt_logger,
    separated_env_to_iter,
)

CONTENT_INDEX_EXTS = separated_env_to_iter("CONTENT_INDEX_EXTS") or {
    ".csv",
    ".ipynb",
    ".json",
    ".md",
    ".parquet",
    ".rmd",
    ".tsv",
    ".txt"
}

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
            event_type: str,
            doc_type: DocTypes,
            # properties unique to a document type are non-required kwargs
            ext: str = '',
            handle: str = '',
            metadata: str = '',
            pointer_file: str = '',
            # this could the hash OR tag; to be used in _id primary key
            package_hash: str = '',
            package_stats: Dict[str, int] = None,
            tags: List[str] = (),
            text: str = '',
            version_id=None,
            *,
            # common properties are required kwargs
            bucket: str,
            comment: str = '',
            key: str,
            etag: str,
            last_modified: str,
            size: int = 0
    ):
        """format event as a document and then queue the document"""
        logger_ = get_quilt_logger()
        if not bucket or not key:
            raise ValueError(f"bucket={bucket} or key={key} required but missing")
        is_delete_marker = False
        # we index delete markers, instead of deleting them, so as to match
        # the state of S3 in ES
        if event_type.startswith(EVENT_PREFIX["Created"]) or is_delete_marker:
            _op_type = "index"
        elif event_type.startswith(EVENT_PREFIX["Removed"]):
            _op_type = "delete"
            if event_type.endswith("DeleteMarkerCreated"):
                is_delete_marker = True
        else:
            logger_.error("Skipping unrecognized event type %s", event_type)
            return
        # On types and fields, see
        # https://www.elastic.co/guide/en/elasticsearch/reference/master/mapping.html
        # Set common properties on the document
        # BE CAREFUL changing these values, as type changes or missing fields
        # can cause exceptions from ES
        index_name = bucket
        if doc_type == DocTypes.PACKAGE:
            index_name += PACKAGE_INDEX_SUFFIX
        if not index_name:
            raise ValueError(f"Can't infer index name; bucket={bucket}, doc_type={doc_type}")
        # core properties for all document types;
        # see https://elasticsearch-py.readthedocs.io/en/6.3.1/helpers.html
        body = {
            "_index": index_name,
            "_op_type": _op_type,  # determines if action is upsert (index) or delete
            # TODO remove this; it's not meaningful since we use a different index
            # type for object vs. package documents
            "_type": "_doc",
            # TODO nest fields under "document" and maybe use _type:{package, object}
            "comment": comment,
            "etag": etag,
            "key": key,
            "last_modified": last_modified,
            "size": size,
            "delete_marker": is_delete_marker,
            "version_id": version_id,
        }
        if doc_type == DocTypes.PACKAGE:
            if not handle:
                raise ValueError("missing required argument for package doc")
            if _op_type == "index":
                if not (pointer_file and package_hash):
                    raise ValueError("missing required argument for package doc")
            if not (
                package_stats is None
                or isinstance(package_stats, dict)
                and {'total_files', 'total_bytes'}.issubset(package_stats)
            ):
                raise ValueError("Malformed package_stats")
            body.update({
                "_id": f"{handle}:{package_hash}",
                "handle": handle,
                "hash": package_hash,
                "metadata": metadata,
                "pointer_file": pointer_file,
                "tags": ",".join(tags)
            })
            if package_stats:
                body.update({
                    "package_stats": package_stats,
                })
        elif doc_type == DocTypes.OBJECT:
            if not version_id:
                # ensure the same versionId and primary keys (_id) as given by
                #  list-object-versions in the enterprise bulk_scanner
                version_id = "null"
            body.update({
                # Elastic native keys
                "_id": f"{key}:{version_id}",
                # TODO: remove this field from ES in /enterprise (now deprecated and unused)
                # here we explicitly drop the comment
                "comment": "",
                "content": text,  # field for full-text search
                "event": event_type,
                "ext": ext,
                # TODO: remove this field from ES in /enterprise (now deprecated and unused)
                "meta_text": "",
                "target": "",
                "updated": datetime.utcnow().isoformat(),
            })
        else:
            logger_.error("Skipping unexpected document type: %s", doc_type)

        self._append_document(body)

        if self.size >= QUEUE_LIMIT_BYTES:
            self.send_all()

    def _append_document(self, doc):
        """append well-formed documents (used for retry or by append())"""
        logger_ = get_quilt_logger()
        if doc.get("content"):
            # document text dominates memory footprint; OK to neglect the
            # small fixed size for the JSON metadata
            self.size += min(doc["size"], ELASTIC_LIMIT_BYTES)
        logger_.debug("Appending document %s", doc)
        self.queue.append(doc)

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

    def _filter_and_delete_packages(self, elastic):
        """handle package hard delete"""
        logger_ = get_quilt_logger()
        true_docs = []
        for doc in self.queue:
            pointer_file = doc.get("pointer_file")
            # handle hard package delete outside of the bulk operation
            if doc["_op_type"] == "delete" and pointer_file and not doc.get("delete_marker"):
                index = doc.get("_index")
                assert index.endswith(PACKAGE_INDEX_SUFFIX), f"Refuse to delete non-package: {doc}"
                handle = doc.get("handle")
                assert handle, "Cannot delete package without handle"
                # no try/except because failure to delete, or trying to delete things
                # that aren't in ES, does not throw
                deletes = elastic.delete_by_query(
                    index=index,
                    body={
                        "query": {
                            "bool": {
                                "must": [
                                    # use match (not term) because some of these fields are analyzed
                                    {"match": {"handle": handle}},
                                    {"match": {"pointer_file": pointer_file}},
                                    {"match": {"delete_marker": False}},
                                ]
                            }
                        }
                    },
                    # we delete synchronously, so don't let it linger too long
                    timeout='20s'
                )
                logger_.debug("Deleted %s stamped %s: %s", handle, pointer_file, deletes)
                if not deletes.get("deleted"):
                    logger_.warning("Unable to delete: %s", doc)
            # send everything else to bulk()
            else:
                logger_.debug("Not filtering docs: %s", doc)
                true_docs.append(doc)
        # the queue is now everything we didn't delete by query above
        self.queue = true_docs

    def send_all(self):
        """flush self.queue in 1-2 bulk calls"""
        if not self.queue:
            return
        elastic = self._make_elastic()
        # For response format see
        # https://www.elastic.co/guide/en/elasticsearch/reference/6.7/docs-bulk.html
        # (We currently use Elastic 6.7 per quiltdata/deployment search.py)
        # note that `elasticsearch` post-processes this response
        self._filter_and_delete_packages(elastic)
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
