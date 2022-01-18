"""
Helper functions.
"""
import json
import os


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


def sql_escape(s):
    """
    Escape strings that might contain single quotes for use in Athena
    or S3 Select
    """
    escaped = s or ""
    return escaped.replace("'", "''")
