"""
phone data into elastic for supported file extensions
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
# TODO: eliminate hardcoded index
ES_INDEX = "drive"
MAX_RETRY = 10 # prevent long-running lambdas due to malformed calls
NB_VERSION = 4 # default notebook version for nbformat
RETRY_429 = 5
S3_CLIENT = boto3.client("s3")

class DocumentQueue:
    """transient in-memory queue for documents to be indexed"""
    def __init__(self, context):
        """constructor"""
        self.queue = []
        self.size = 0
        self.context = context

    def append(self, event_type, size=0, meta=None, last_modified="", *, key, text, version_id):
        """format event as document and queue it up"""
        if text:
            # documents will dominate memory footprint, there is also a fixed
            # size for the rest of the doc that we do not account for
            self.size += size
        if self.size > 5E8:# 500 MB
            print(f"Warning: Lambda may run out of memory. {self.size} bytes queued.")

        body = {
            # ES native keys
            "_index": ES_INDEX,
            "_op_type": "index",
            "_type": "_doc",
            # Quilt keys
            "type": event_type,
            "size": size,
            "text": text,
            "key": key,
            "last_modified": last_modified,
            "updated": datetime.utcnow().isoformat(),
            "version_id": version_id
        }

        body = {**body, **transform_meta(meta or {})}

        body["meta_text"] = " ".join([body["meta_text"], key])

        self.queue.append(body)

    def send_all(self):
        """flush self.queue in a bulk call"""
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
                use_ssl=True,
                verify_certs=True,
                connection_class=RequestsHttpConnection
            )

            _, errors = bulk(
                elastic,
                iter(self.queue),
                # number of retries for 429 (too many requests only)
                max_retries=RETRY_429,
                # we'll process errors on our own
                raise_on_error=False,
                raise_on_exception=False
            )
            # TODO: remove print statements
            for err in errors:
                # TODO: error handling
                print(err)
                """
                if e.error == 'mapper_parsing_exception':
                    # retry with just plaintext
                    print('Mapping exception. Retrying without user_meta and system_meta', e)
                    # TODO: zero out metadata on the correspoding doc
                    # maybe we don't need to zero out system_meta?
                    data['user_meta'] = {}
                    data['system_meta'] = {}

                    try:
                        res = es.index(index=ES_INDEX, doc_type='_doc', body=data)
                    except Exception as e:
                        print('Failover failed. data: ' + json.dumps(data))
                        print(e)
                        import traceback
                        traceback.print_tb(e.__traceback__)
                else:
                    print("Unable to index a document", e)
                    import traceback
                    traceback.print_tb(e.__traceback__)
                """

        except Exception as ex:# pylint: disable=broad-except
            print("Fatal, unexpected Exception in send_all", ex)
            import traceback
            traceback.print_tb(e.__traceback__)

def get_config(bucket):
    """return a dict of DEFAULT_CONFIG merged the user's config (if available)"""
    # TODO - do not fetch from S3 for this; it's slow and we can get throttled
    # e.g. a FixedResponse from the ELB might be better, with user overrides in
    # the CFN template
    try:
        # Warning: eventual consistency could return an outdated object
        loaded_object = S3_CLIENT.get_object(Bucket=bucket, Key=".quilt/config.json")
        loaded_config = json.load(loaded_object["Body"])
        return {**DEFAULT_CONFIG, **loaded_config}
    except ClientError as ex:
        # Eat NoSuchKey; pass all other exceptions on
        # NoSuchKey can happen if user has no .quilt/config.json (which is fine)
        if ex.response['Error']['Code'] != "NoSuchKey":
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

    return text

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
        text = extract_text(notebook)
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

def to_event_type(name):
    """convert form S3 event types to Quilt Elastic event types"""
    if name == "ObjectRemoved:Delete":
        return "Delete"
    if name == "ObjectCreated:Put":
        return "Create"
    return name

def transform_meta(meta):
    """ Reshapes metadata for indexing in ES """
    helium = meta.get("helium")
    user_meta = {}
    comment = ""
    target = ""
    meta_text = ""
    if helium:
        user_meta = helium.pop("user_meta", {})
        comment = helium.pop("comment", "") or ""
        target = helium.pop("target", "") or ""
    meta_text_parts = [comment, target]
    if helium:
        meta_text_parts.append(json.dumps(helium))
    if user_meta:
        meta_text_parts.append(json.dumps(user_meta))
    if meta_text_parts:
        meta_text = " ".join(meta_text_parts)

    return {
        "system_meta": helium,
        "user_meta": user_meta,
        "comment": comment,
        "target": target,
        "meta_text": meta_text
    }

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

def get_time_remaining(context):
    """returns time remaining in seconds before lambda context is shut down"""
    time_remaining = floor(context.get_remaining_time_in_millis()/1000)
    if time_remaining < 30:
        print(
            f"Warning: Lambda function has less than {time_remaining} seconds."
            " Consider reducing bulk batch size."
        )

    return time_remaining

def handler(event, context):
    """enumerate S3 keys in event, extract relevant data and metadata,
    queue events, send to elastic via bulk() API
    """
    try:
        # TODO: eliminate
        print("event['Records']", event["Records"])
        for msg in event["Records"]:
            # TODO: eliminate
            print("msg", msg)
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

                    if event_type == "Delete":
                        batch_processor.append(
                            event_type,
                            key=key,
                            text="",
                            version_id=version_id
                        )
                        continue

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
                        key=key,
                        meta=meta,
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
        print("in call routine")
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
