"""
phone data into elastic for supported file extensions.
note: we truncate outbound documents to DOC_SIZE_LIMIT characters
(to bound memory pressure and request size to elastic)
"""

import json
import pathlib
from urllib.parse import unquote, unquote_plus

import boto3
import botocore
import nbformat
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from t4_lambda_shared.preview import get_bytes, get_preview_lines, MAX_LINES
from .document_queue import (DocumentQueue, CHUNK_LIMIT_BYTES, CONTENT_INDEX_EXTS, DOC_LIMIT_BYTES,
                             ELASTIC_TIMEOUT, MAX_RETRY, OBJECT_DELETE, QUEUE_LIMIT_BYTES,
                             RETRY_429)

# 10 MB, see https://amzn.to/2xJpngN
NB_VERSION = 4 # default notebook version for nbformat
TEST_EVENT = "s3:TestEvent"
# we need to filter out GetObject and HeadObject calls generated by the present
#  lambda in order to display accurate analytics in the Quilt catalog
#  a custom user agent enables said filtration
USER_AGENT_EXTRA = " quilt3-lambdas-es-indexer"


def should_retry_exception(exception):
    error_code = exception.response.get('Error', {}).get('Code', 218)
    return error_code not in ["402", "403", "404"]

def get_contents(bucket, key, ext, *, etag, version_id, s3_client, size):
    """get the byte contents of a file"""
    if ext == '.gz':
        compression = 'gz'
        ext = pathlib.PurePosixPath(key[:-len(ext)]).suffix.lower()
    else:
        compression = None

    content = ""
    if ext in CONTENT_INDEX_EXTS:
        if ext == ".ipynb":
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
                )
            )
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
        except (KeyError, AttributeError)  as err:
            print(f"Missing key in {key}: {err}")
        # there might be more errors than covered by test_read_notebook
        # better not to fail altogether
        except Exception as exc:#pylint: disable=broad-except
            print(f"Exception in file {key}: {exc}")
    except UnicodeDecodeError as uni:
        print(f"Unicode decode error in {key}: {uni}")

    return text

def get_plain_text(bucket, key, size, compression, *, etag, s3_client, version_id):
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
            limit=DOC_LIMIT_BYTES,
            version_id=version_id
        )
        lines = get_preview_lines(obj["Body"], compression, MAX_LINES, DOC_LIMIT_BYTES)
        text = ''.join(lines)
    except UnicodeDecodeError as ex:
        print(f"Unicode decode error in {key}", ex)

    return text

def make_s3_client():
    """make a client with a custom user agent string so that we can
    filter the present lambda's requests to S3 from object analytics"""
    configuration = botocore.config.Config(user_agent_extra=USER_AGENT_EXTRA)
    return boto3.client("s3", config=configuration)

def handler(event, context):
    """enumerate S3 keys in event, extract relevant data and metadata,
    queue events, send to elastic via bulk() API
    """
    # message is a proper SQS message, which either contains a single event
    # (from the bucket notification system) or batch-many events as determined
    # by enterprise/**/bulk_loader.py
    for message in event["Records"]:
        body = json.loads(message["body"])
        body_message = json.loads(body["Message"])
        if "Records" not in body_message:
            if body_message.get("Event") == TEST_EVENT:
                # Consume and ignore this event, which is an initial message from
                # SQS; see https://forums.aws.amazon.com/thread.jspa?threadID=84331
                continue
            else:
                print("Unexpected message['body']. No 'Records' key.", message)
                raise Exception("Unexpected message['body']. No 'Records' key.")
        batch_processor = DocumentQueue(context)
        events = body_message.get("Records", [])
        s3_client = make_s3_client()
        # event is a single S3 event
        for event_ in events:
            try:
                event_name = event_["eventName"]
                bucket = unquote(event_["s3"]["bucket"]["name"])
                # In the grand tradition of IE6, S3 events turn spaces into '+'
                key = unquote_plus(event_["s3"]["object"]["key"])
                version_id = event_["s3"]["object"].get("versionId")
                version_id = unquote(version_id) if version_id else None
                etag = unquote(event_["s3"]["object"]["eTag"])

                ext = pathlib.PurePosixPath(key).suffix.lower()

                try:
                    head = retry_s3(
                        "head",
                        bucket,
                        key,
                        s3_client=s3_client,
                        version_id=version_id,
                        etag=etag
                    )
                except botocore.exceptions.ClientError as exception:
                    # "null" version sometimes results in 403s for buckets
                    # that have changed versioning, retry without it
                    if (exception.response.get('Error', {}).get('Code') == "403"
                            and version_id == "null"):
                        head = retry_s3(
                            "head",
                            bucket,
                            key,
                            s3_client=s3_client,
                            version_id=None,
                            etag=etag
                        )
                    else:
                        raise exception

                size = head["ContentLength"]
                last_modified = head["LastModified"]
                meta = head["Metadata"]
                text = ""

                if event_name == OBJECT_DELETE:
                    batch_processor.append(
                        event_name,
                        bucket=bucket,
                        ext=ext,
                        etag=etag,
                        key=key,
                        last_modified=last_modified,
                        text=text,
                        version_id=version_id
                    )
                    continue

                text = get_contents(
                    bucket,
                    key,
                    ext,
                    etag=etag,
                    version_id=version_id,
                    s3_client=s3_client,
                    size=size
                )
                # decode Quilt-specific metadata
                if meta and "helium" in meta:
                    try:
                        decoded_helium = json.loads(meta["helium"])
                        meta["helium"] = decoded_helium or {}
                    except (KeyError, json.JSONDecodeError):
                        print("Unable to parse Quilt 'helium' metadata", meta)

                batch_processor.append(
                    event_name,
                    bucket=bucket,
                    key=key,
                    ext=ext,
                    meta=meta,
                    etag=etag,
                    version_id=version_id,
                    last_modified=last_modified,
                    size=size,
                    text=text
                )
            except botocore.exceptions.ClientError as boto_exc:
                if not should_retry_exception(boto_exc):
                    continue
                else:
                    print("Fatal exception for record", event_, boto_exc)
                    import traceback
                    traceback.print_tb(boto_exc.__traceback__)
                    raise boto_exc
            except Exception as exc:# pylint: disable=broad-except
                print("Fatal exception for record", event_, exc)
                import traceback
                traceback.print_tb(exc.__traceback__)
                raise exc
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
        arguments['Range'] = f"bytes=0-{limit}"
    if version_id:
        arguments['VersionId'] = version_id
    else:
        arguments['IfMatch'] = etag

    @retry(
        # debug
        reraise=True,
        stop=stop_after_attempt(MAX_RETRY),
        wait=wait_exponential(multiplier=2, min=4, max=30),
        retry=(retry_if_exception(should_retry_exception))
    )
    def call():
        """local function so we can set stop_after_delay dynamically"""
        # TODO: remove all this, stop_after_delay is not dynamically loaded anymore
        return function_(**arguments)

    return call()

def trim_to_bytes(string, limit=DOC_LIMIT_BYTES):
    """trim string to specified number of bytes"""
    encoded = string.encode("utf-8")
    size = len(encoded)
    if size <= limit:
        return string
    return encoded[:limit].decode("utf-8", "ignore")
