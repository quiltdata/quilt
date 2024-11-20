"""
Helper functions.
"""
import gzip
import json
import logging
import os
from base64 import b64decode
from typing import Iterable

LOGGER_NAME = "quilt-lambda"
MANIFEST_PREFIX_V1 = ".quilt/packages/"
POINTER_PREFIX_V1 = ".quilt/named_packages/"

PACKAGE_INDEX_SUFFIX = "_packages"

LAMBDA_TMP_SPACE = 512 * 2 ** 20


def separated_env_to_iter(
        env_var: str,
        *,
        deduplicate=True,
        lower=True,
        predicate=None,
        separator=","
) -> Iterable[str]:
    """turn a comma-separated string in the environment into a python list"""
    candidate = os.getenv(env_var, "")
    result = []
    if candidate:
        for c in candidate.split(separator):
            token = c.strip().lower() if lower else c.strip()
            if token:
                if predicate:
                    if predicate(token):
                        result.append(token)
                else:
                    result.append(token)
    return set(result) if deduplicate else result


def get_default_origins():
    """
    Returns a list of origins that should normally be passed into the @api decorator.
    """
    return [
        'http://localhost:3000',
        os.environ.get('WEB_ORIGIN')
    ]


def get_quilt_logger():
    """inject a logger via kwargs, with level set by the environment"""
    logger_ = logging.getLogger(LOGGER_NAME)
    # See https://docs.python.org/3/library/logging.html#logging-levels
    level = os.environ.get("QUILT_LOG_LEVEL", "WARNING")
    logger_.setLevel(level)

    return logger_


def get_available_memory():
    """how much virtual memory is available to us (in bytes)"""
    from psutil import virtual_memory

    return virtual_memory().available


def make_json_response(status_code, json_object, extra_headers=None, add_status=False):
    """
    Helper function to serialize a JSON object and add the JSON content type header.
    """
    headers = {
        "Content-Type": 'application/json'
    }
    if extra_headers is not None:
        headers.update(extra_headers)
    if add_status:
        json_object['status'] = status_code

    return status_code, json.dumps(json_object), headers


def read_body(resp):
    """
    Helper function to decode response body depending on how the body was encoded
    prior to transfer to and from lambda.
    """
    body = resp['body']
    if resp['isBase64Encoded']:
        body = b64decode(body)
    if resp['headers'].get('Content-Encoding') == 'gzip':
        body = gzip.decompress(body)
    return body


def sql_escape(s):
    """
    Escape strings that might contain single quotes for use in Athena
    or S3 Select
    """
    escaped = s or ""
    return escaped.replace("'", "''")
