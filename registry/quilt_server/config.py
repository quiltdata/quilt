# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Default config values the Flask app.
Shared between dev, stage, and production.

See `app.config.from_object('...')` in __init__.py.
"""

SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ECHO = False  # Turn it on for debugging.

PACKAGE_URL_EXPIRATION = 60*60*12 # 12 Hours

JSON_USE_ENCODE_METHODS = True  # Support the __json__ method in Node

# 100MB max for request body.
MAX_CONTENT_LENGTH = 100 * 1024 * 1024
