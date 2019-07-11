"""
phone data into elastic for supported file extensions.
note: we truncated inbound documents to no more than DOC_SIZE_LIMIT characters
(this bounds memory pressure and request size to elastic)
"""

from datetime import datetime
from math import floor
import json
import os
from urllib.parse import unquote, unquote_plus

from aws_requests_auth.aws_auth import AWSRequestsAuth
import boto3
from botocore.exceptions import ClientError
from elasticsearch import Elasticsearch, RequestsHttpConnection
from elasticsearch.helpers import bulk
import nbformat
from tenacity import stop_after_attempt, stop_after_delay, retry, wait_exponential

DEFAULT_CONFIG = {
    "to_index": [
        ".ipynb",
        ".md",
        ".rmd",
    ]
}
DOC_SIZE_LIMIT = 10_000_000 # 10MB (stay under 10MiB request size limit)
# TODO: eliminate hardcoded index
ELASTIC_TIMEOUT = 20
ES_INDEX = "drive"
MAX_RETRY = 10 # prevent long-running lambdas due to malformed calls
NB_VERSION = 4 # default notebook version for nbformat
RETRY_429 = 5
S3_CLIENT = boto3.client("s3")

class DocumentQueue:
    """transient in-memory queue for documents to be indexed"""
    def __init__(self, context, retry_errors=True):
        """constructor"""
        self.queue = []
        self.retry_errors = retry_errors
        self.size = 0
        self.context = context

    def append(
            self,
            event_type,
            size=0,
            meta=None,
            *,
            last_modified,
            bucket,
            key,
            text,
            etag,
            version_id
    ):
        """format event as document and queue it up"""
        if text:
            # documents will dominate memory footprint, there is also a fixed
            # size for the rest of the doc that we do not account for
            self.size += min(size, DOC_SIZE_LIMIT)
        if self.size > 5E8:# 500 MB
            print(f"Warning: Lambda may run out of memory. {self.size} bytes queued.")

        # On types and fields, see
        # https://www.elastic.co/guide/en/elasticsearch/reference/master/mapping.html
        body = {
            # ES native keys
            "_id": f"{bucket}/{key}:{etag}:{version_id}",
            "_index": ES_INDEX,
            "_op_type": "index",
            "_type": "_doc",
            # Quilt keys
            # Be VERY CAREFUL changing these values as a type change can cause
            # mapper_parsing_exception that below code won't recover from
            "etag": etag,
            "type": event_type,
            "size": size,
            "text": text,
            "key": key,
            "last_modified": last_modified.isoformat(),
            "updated": datetime.utcnow().isoformat(),
            "version_id": version_id
        }

        body = {**body, **transform_meta(meta or {})}

        body["meta_text"] = " ".join([body["meta_text"], key])

        self.append_document(body)

    def append_document(self, doc):
        """append well-formed documents (used for retry or by append())"""
        self.queue.append(doc)

    def is_empty(self):
        """is the queue empty?"""
        return len(self.queue) == 0

    def send_all(self):
        """flush self.queue in a bulk call"""
        if self.is_empty():
            return
        elastic_host = os.environ["ES_HOST"]
        try:
            awsauth = AWSRequestsAuth(
                # These environment variables are automatically set by Lambda
                aws_access_key=os.environ["AWS_ACCESS_KEY_ID"],
                aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
                aws_token=os.environ["AWS_SESSION_TOKEN"],
                aws_host=elastic_host,
                aws_region=boto3.session.Session().region_name,
                aws_service="es"
            )

            time_remaining = get_time_remaining(self.context)
            elastic = Elasticsearch(
                hosts=[{"host": elastic_host, "port": 443}],
                http_auth=awsauth,
                max_backoff=time_remaining,
                # Give ES time to repsond when under laod
                timeout=ELASTIC_TIMEOUT,
                use_ssl=True,
                verify_certs=True,
                connection_class=RequestsHttpConnection
            )

            _, errors = bulk(
                elastic,
                iter(self.queue),
                # Some magic numbers to avoid memory pressure
                # e.g. see https://github.com/wagtail/wagtail/issues/4554
                # The stated default is max_chunk_bytes=10485760, but with default
                # ES will still return an exception stating that the very
                # same request size limit has been exceeded
                chunk_size=100,
                # See https://amzn.to/2xJpngN
                max_chunk_bytes=DOC_SIZE_LIMIT, # 10MB
                # number of retries for 429 (too many requests only)
                # all other errors handled by our code
                max_retries=RETRY_429,
                # we'll process errors on our own
                raise_on_error=False,
                raise_on_exception=False
            )
            # Retry only if this is a first-generation queue
            # (prevents infinite regress on failing documents)
            if self.retry_errors:
                # this is a second genration queue, so don't let it retry
                error_queue = DocumentQueue(self.context, retry_errors=False)
                for error in errors:
                    print(error)
                    # can be dict or string, sigh
                    inner = error.get("index", {})
                    error_info = inner.get("error")
                    doc_id = inner.get("_id")

                    if isinstance(error_info, dict):
                        error_type = error_info.get("type", "")
                        if 'mapper_parsing_exception' in error_type:
                            replay = next(doc for doc in self.queue if doc["_id"] == doc_id)
                            replay['user_meta'] = replay['system'] = {}
                            error_queue.append_document(replay)
                # recursive but never goes more than one level deep
                error_queue.send_all()

        except Exception as ex:# pylint: disable=broad-except
            print("Fatal, unexpected Exception in send_all", ex)
            import traceback
            traceback.print_tb(ex.__traceback__)

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
        if "source" in cell and "cell_type" in cell:
            if cell["cell_type"] == "code" or cell["cell_type"] == "markdown":
                text.append(cell["source"])

    return "\n".join(text)

def get_config(bucket):
    """return a dict of DEFAULT_CONFIG merged the user's config (if available)"""
    try:
        # Warning: eventual consistency could return an outdated object
        loaded_object = S3_CLIENT.get_object(Bucket=bucket, Key=".quilt/config.json")
        loaded_config = json.load(loaded_object["Body"])
        return {**DEFAULT_CONFIG, **loaded_config}
    except ClientError as ex:
        # Eat NoSuchKey; pass all other exceptions on
        # NoSuchKey can happen if user has no .quilt/config.json (which is fine)
        if ex.response["Error"]["Code"] != "NoSuchKey":
            raise ex
    except Exception as ex:# pylint: disable=broad-except
        print("get_config", ex)
        import traceback
        traceback.print_tb(ex.__traceback__)

    return DEFAULT_CONFIG

def get_extensions_to_index(bucket, configs):
    """returns: which file extensions should be plain-text indexed?"""
    if bucket not in configs:
        configs[bucket] = get_config(bucket)
    to_index = configs[bucket].get("to_index", [])
    return (x.lower() for x in to_index)

def get_notebook_cells(context, **kwargs):
    """extract cells for ipynb notebooks for indexing"""
    _validate_kwargs(kwargs)
    text = ""
    try:
        obj = retry_s3(
            "get",
            context,
            bucket=kwargs["bucket"],
            key=kwargs["key"],
            etag=kwargs["etag"],
            version_id=kwargs["version_id"]
        )
        notebook = obj["Body"].read().decode("utf-8")
        text = extract_text(notebook)[:DOC_SIZE_LIMIT]
    except UnicodeDecodeError as uni:
        print(f"Unicode decode error in {kwargs['key']}: {uni}")
    except (json.JSONDecodeError, nbformat.reader.NotJSONError):
        print(f"Invalid JSON in {kwargs['key']}.")
    except (KeyError, AttributeError)  as err:
        print(f"Missing key in {kwargs['key']}: {err}")
    # there might be more errors than covered by test_read_notebook
    # better not to fail altogether
    except Exception as exc:#pylint: disable=broad-except
        print(f"Exception in file {kwargs['key']}: {exc}")

    return text

def get_plain_text(context, **kwargs):
    """get plain text object contents"""
    _validate_kwargs(kwargs)
    text = ""
    try:
        obj = retry_s3(
            "get",
            context,
            bucket=kwargs["bucket"],
            key=kwargs["key"],
            etag=kwargs["etag"],
            version_id=kwargs["version_id"]
        )
        text = obj["Body"].read().decode("utf-8")
    except UnicodeDecodeError as ex:
        print(f"Unicode decode error in {kwargs['key']}", ex)

    return text[:DOC_SIZE_LIMIT]
def to_event_type(name):
    """convert form S3 event types to Quilt Elastic event types"""
    if name == "ObjectRemoved:Delete":
        return "Delete"
    if name == "ObjectCreated:Put":
        return "Create"
    return name

def get_time_remaining(context):
    """returns time remaining in seconds before lambda context is shut down"""
    time_remaining = floor(context.get_remaining_time_in_millis()/1000)
    if time_remaining < 30:
        print(
            f"Warning: Lambda function has less than {time_remaining} seconds."
            " Consider reducing bulk batch size."
        )

    return time_remaining

def transform_meta(meta):
    """ Reshapes metadata for indexing in ES """
    helium = meta.get("helium")
    user_meta = {}
    comment = ""
    target = ""

    if helium:
        user_meta = helium.pop("user_meta", {})
        comment = helium.pop("comment", "") or ""
        target = helium.pop("target", "") or ""

    meta_text_parts = [comment, target]

    if helium:
        meta_text_parts.append(json.dumps(helium))
    if user_meta:
        meta_text_parts.append(json.dumps(user_meta))

    return {
        "system_meta": helium,
        "user_meta": user_meta,
        "comment": comment,
        "target": target,
        "meta_text": " ".join(meta_text_parts)
    }

def handler(event, context):
    """enumerate S3 keys in event, extract relevant data and metadata,
    queue events, send to elastic via bulk() API
    """
    try:
        for msg in event["Records"]:
            print(">msg<", msg)
            records = json.loads(json.loads(msg["body"])["Message"])["Records"]
            batch_processor = DocumentQueue(context)
            # reduce requests to S3: get .quilt/config.json once per batch per bucket
            configs = {}
            for record in records:
                try:
                    eventname = record["eventName"]
                    bucket = unquote(record["s3"]["bucket"]["name"]) if records else None
                    # In the grand tradition of IE6, S3 events turn spaces into `+`
                    key = unquote_plus(record["s3"]["object"]["key"])
                    version_id = record["s3"]["object"].get("versionId")
                    version_id = unquote(version_id) if version_id else None
                    etag = unquote(record["s3"]["object"]["eTag"])
                    event_type = to_event_type(eventname)

                    head = retry_s3(
                        "head",
                        context,
                        bucket=bucket,
                        key=key,
                        version_id=version_id,
                        etag=etag
                    )

                    size = head["ContentLength"]
                    last_modified = head["LastModified"]
                    meta = head["Metadata"]
                    text = ""

                    if event_type == "Delete":
                        batch_processor.append(
                            event_type,
                            bucket=bucket,
                            etag=etag,
                            key=key,
                            last_modified=last_modified,
                            text=text,
                            version_id=version_id
                        )
                        continue

                    _, ext = os.path.splitext(key)
                    ext = ext.lower()
                    if ext in get_extensions_to_index(bucket, configs):
                        # try to index data from the object itself
                        if ext == ".ipynb":
                            text = get_notebook_cells(
                                context,
                                bucket=bucket,
                                key=key,
                                etag=etag,
                                version_id=version_id
                            )
                        # else treat as plain_text (including .rmd, .md)
                        text = get_plain_text(
                            context,
                            bucket=bucket,
                            key=key,
                            etag=etag,
                            version_id=version_id
                        )
                    # decode Quilt-specific metadata
                    try:
                        if "helium" in meta:
                            meta["helium"] = json.loads(meta["helium"])
                    except (KeyError, json.JSONDecodeError):
                        print("Unable to parse Quilt 'helium' metadata", meta)

                    batch_processor.append(
                        event_type,
                        bucket=bucket,
                        key=key,
                        meta=meta,
                        etag=etag,
                        version_id=version_id,
                        last_modified=last_modified,
                        size=size,
                        text=text
                    )
                except Exception as exc:# pylint: disable=broad-except
                    print("Fatal exception for record", record, exc)
                    import traceback
                    traceback.print_tb(exc.__traceback__)
            # flush the queue
            batch_processor.send_all()

    except Exception as exc:# pylint: disable=broad-except
        print("Exception encountered for event", exc)
        import traceback
        traceback.print_tb(exc.__traceback__)
        print(event, msg)
        # Fail the lambda so the message is not dequeued
        raise exc

def retry_s3(operation, context, **kwargs):
    """retry head or get operation to S3 with; stop before we run out of time.
    retry is necessary since, due to eventual consistency, we may not
    always get the required version of the object.
    """
    _validate_kwargs(kwargs)
    if operation not in ["get", "head"]:
        raise ValueError(f"unexpected operation: {operation}")
    if operation == "head":
        function_ = S3_CLIENT.head_object
    else:
        function_ = S3_CLIENT.get_object

    time_remaining = get_time_remaining(context)
    # use a local function so that we can parameterize to time_remaining
    @retry(
        # debug
        stop=(stop_after_delay(time_remaining) | stop_after_attempt(MAX_RETRY)),
        wait=wait_exponential(multiplier=2, min=4, max=30)
    )
    def call():
        if kwargs["version_id"]:
            return function_(
                Bucket=kwargs["bucket"],
                Key=kwargs["key"],
                VersionId=kwargs["version_id"]
            )
        # else
        return function_(
            Bucket=kwargs["bucket"],
            Key=kwargs["key"],
            IfMatch=kwargs["etag"]
        )

    return call()

def _validate_kwargs(kwargs, required=("bucket", "key", "etag", "version_id")):
    """check for the existence of necessary object metadata in kwargs dict"""
    for word in required:
        if word not in kwargs:
            raise TypeError(f"Missing required keyword argument: {word}")
