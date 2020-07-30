"""
Helper functions.
"""
from base64 import b64decode
import gzip
from typing import Iterable
import io
import json
import os

from psutil import virtual_memory


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


class IncompleteResultException(Exception):
    """
    Exception indicating an incomplete response
    (e.g., from S3 Select)
    """


def buffer_s3response(s3response):
    """
    Read a streaming response (botocore.eventstream.EventStream) from s3 select
    into a StringIO buffer
    """
    response = io.StringIO()
    end_event_received = False
    stats = None
    for event in s3response['Payload']:
        if 'Records' in event:
            records = event['Records']['Payload'].decode()
            response.write(records)
        elif 'Progress' in event:
            print(event['Progress']['Details'])
        elif 'Stats' in event:
            print(stats)
        elif 'End' in event:
            # End event indicates that the request finished successfully
            end_event_received = True

    if not end_event_received:
        raise IncompleteResultException("Error: Received an incomplete response from S3 Select.")
    response.seek(0)
    return response
