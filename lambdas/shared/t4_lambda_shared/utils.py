"""
Helper functions.
"""
import gzip
import json
import os
from base64 import b64decode


def get_default_origins():
    """
    Returns a list of origins that should normally be passed into the @api decorator.
    """
    return [
        'http://localhost:3000',
        os.environ.get('WEB_ORIGIN')
    ]


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
