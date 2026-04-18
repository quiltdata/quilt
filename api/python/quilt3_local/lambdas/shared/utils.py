"""Helper functions."""

import json
import logging
import os

LOGGER_NAME = "quilt-lambda"


def get_default_origins():
    return [
        "http://localhost:3000",
        os.environ.get("WEB_ORIGIN"),
    ]


def get_quilt_logger():
    logger_ = logging.getLogger(LOGGER_NAME)
    level = os.environ.get("QUILT_LOG_LEVEL", "WARNING")
    logger_.setLevel(level)
    return logger_


def get_available_memory():
    from psutil import virtual_memory

    return virtual_memory().available


def make_json_response(status_code, json_object, extra_headers=None, add_status=False):
    headers = {"Content-Type": "application/json"}
    if extra_headers is not None:
        headers.update(extra_headers)
    if add_status:
        json_object["status"] = status_code
    return status_code, json.dumps(json_object), headers


def sql_escape(value):
    escaped = value or ""
    return escaped.replace("'", "''")
