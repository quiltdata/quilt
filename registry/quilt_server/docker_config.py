# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Config file for dev in Docker. Overrides values in config.py.
"""
import os

SQLALCHEMY_DATABASE_URI = 'postgresql://postgres:testing@db/packages'

AUTH_PROVIDER = os.getenv('AUTH_PROVIDER', 'quilt')

CATALOG_URL = 'http://localhost:3000'

REGISTRY_URL = os.environ['REGISTRY_URL']

AWS_ACCESS_KEY_ID = 'fake_id'
AWS_SECRET_ACCESS_KEY = 'fake_secret'

S3_ENDPOINT = 'http://s3:5001'
PACKAGE_BUCKET_NAME = 'package'

SQLALCHEMY_ECHO = True

MIXPANEL_PROJECT_TOKEN = os.getenv('MIXPANEL_PROJECT_TOKEN', '')
DEPLOYMENT_ID = ''
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')

print('*** AUTH_PROVIDER=%s' % AUTH_PROVIDER)

ENABLE_USER_ENDPOINTS = True

MAIL_SERVER = os.getenv('SMTP_HOST')
MAIL_USERNAME = os.getenv('SMTP_USERNAME')
MAIL_PASSWORD = os.getenv('SMTP_PASSWORD')

SECRET_KEY = os.environ['QUILT_SECRET_KEY']

DEFAULT_SENDER = os.getenv('QUILT_DEFAULT_SENDER', 'support@quiltdata.io')
