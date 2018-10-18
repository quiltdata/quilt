# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Default config values the Flask app.
Shared between dev, stage, and production.

See `app.config.from_object('...')` in __init__.py.
"""
import os


# Added to avoid things like "ALLOW_ANONYMOUS_ACCESS=false" from being true
def to_bool(str, default=None):
    string = str.strip().lower()
    if string in ['true', '1']:
        return True
    if string in ['false', '0']:
        return False
    if default is not None and string in ['', None]:
        return default
    raise ValueError(("Invalid value '%s' supplied for boolean env var, "
        "should be one of: 'true', '1', 'false', '0'.") % str)


TEAM_ID = os.getenv('TEAM_ID')
TEAM_NAME = os.getenv('TEAM_NAME')
ALLOW_ANONYMOUS_ACCESS = to_bool(os.getenv('ALLOW_ANONYMOUS_ACCESS'), default=False)
ALLOW_TEAM_ACCESS = to_bool(os.getenv('ALLOW_TEAM_ACCESS'), default=False)

SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ECHO = False  # Turn it on for debugging.

PACKAGE_URL_EXPIRATION = 60*60*24 # 24 hours

JSON_USE_ENCODE_METHODS = True  # Support the __json__ method in Node

# 100MB max for request body.
MAX_CONTENT_LENGTH = 100 * 1024 * 1024

DISABLE_SIGNUP = to_bool(os.getenv('DISABLE_SIGNUP', ''))

MAIL_DEV = False

MAIL_USE_TLS = True
