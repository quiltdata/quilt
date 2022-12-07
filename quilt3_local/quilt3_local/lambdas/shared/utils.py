"""
Helper functions.
"""
import json
import logging
import os

LOGGER_NAME = "quilt-lambda"

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
