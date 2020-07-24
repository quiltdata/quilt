"""
Helper functions.
"""
from base64 import b64decode
import gzip
from typing import Iterable
import json
import os

from psutil import virtual_memory


POINTER_PREFIX = ".quilt/named_packages/"
MANIFEST_PREFIX = ".quilt/packages/"


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


def get_available_memory():
    """how much virtual memory is available to us (bytes)?"""
    return virtual_memory().available


def make_json_response(status_code, json_object, extra_headers=None):
    """
    Helper function to serialize a JSON object and add the JSON content type header.
    """
    headers = {
        "Content-Type": 'application/json'
    }
    if extra_headers is not None:
        headers.update(extra_headers)

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
