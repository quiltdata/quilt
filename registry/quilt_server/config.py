# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Default config values the Flask app.
Shared between dev, stage, and production.

See `app.config.from_object('...')` in __init__.py.
"""
import os

TEAM_ID = os.getenv('TEAM_ID')
TEAM_NAME = os.getenv('TEAM_NAME')
ALLOW_ANONYMOUS_ACCESS = bool(os.getenv('ALLOW_ANONYMOUS_ACCESS', ''))
ALLOW_TEAM_ACCESS = bool(os.getenv('ALLOW_TEAM_ACCESS', ''))

SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ECHO = False  # Turn it on for debugging.

PACKAGE_URL_EXPIRATION = 60*60*24 # 24 hours

JSON_USE_ENCODE_METHODS = True  # Support the __json__ method in Node

# 100MB max for request body.
MAX_CONTENT_LENGTH = 100 * 1024 * 1024

SECRET_KEY = os.environ['QUILT_SECRET_KEY']

DEFAULT_SENDER = os.getenv('QUILT_DEFAULT_SENDER')

REGISTRY_HOST = os.getenv('REGISTRY_HOST')

DISABLE_SIGNUP = os.getenv('DISABLE_SIGNUP', False)

MAIL_DEV = False

MAIL_SERVER = os.getenv('SMTP_HOST')
MAIL_USERNAME = os.getenv('SMTP_USERNAME')
MAIL_PASSWORD = os.getenv('SMTP_PASSWORD')
MAIL_USE_TLS = True
