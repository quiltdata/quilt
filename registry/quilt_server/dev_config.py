# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Config file for dev. Overrides values in config.py.
"""
import os
import socket

DEBUG = True

SQLALCHEMY_DATABASE_URI = os.getenv('SQLALCHEMY_DATABASE_URI', 'postgresql://postgres@localhost/packages')

# XXX: Does this actually do anything right now?
AUTH_PROVIDER = os.getenv('AUTH_PROVIDER', 'quilt')

STAGE_AUTH_URL = 'https://stage-auth.quiltdata.com'

QUILT_AUTH_URL = os.getenv('QUILT_AUTH_URL', STAGE_AUTH_URL)

CATALOG_URL = 'http://localhost:3000'

REGISTRY_URL = 'http://localhost:5000'

AWS_ACCESS_KEY_ID = 'fake_id'
AWS_SECRET_ACCESS_KEY = 'fake_secret'

S3_ENDPOINT = os.getenv('S3_ENDPOINT', 'http://localhost:5001')
PACKAGE_BUCKET_NAME = 'package'

SQLALCHEMY_ECHO = True

MIXPANEL_PROJECT_TOKEN = os.getenv('MIXPANEL_PROJECT_TOKEN', '')
DEPLOYMENT_ID = socket.gethostname()
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')

ENABLE_USER_ENDPOINTS = True

SECRET_KEY = os.getenv('QUILT_SECRET_KEY', 'testing') # hardcoded default for dev/testing
DEFAULT_SENDER = os.getenv('QUILT_DEFAULT_SENDER', 'support@quiltdata.io')

DEV_USERNAME = os.getenv('DEV_USERNAME')
DEV_PASSWORD = os.getenv('DEV_PASSWORD')
DEV_EMAIL = os.getenv('DEV_EMAIL', 'support@quiltdata.io')

MAIL_DEV = True
