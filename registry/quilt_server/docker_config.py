# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Config file for dev in Docker. Overrides values in config.py.
"""
import os

AWS_ACCESS_KEY_ID = 'fake_id'
AWS_SECRET_ACCESS_KEY = 'fake_secret'

CATALOG_URL = 'http://localhost:3000'
DEPLOYMENT_ID = ''
ENABLE_USER_ENDPOINTS = True

DEFAULT_SENDER = os.getenv('QUILT_DEFAULT_SENDER', 'support@quiltdata.io')
MAIL_DEV = os.getenv('MAIL_DEV')
MAIL_SERVER = os.getenv('SMTP_HOST')
MAIL_USERNAME = os.getenv('SMTP_USERNAME')
MAIL_PASSWORD = os.getenv('SMTP_PASSWORD')

MIXPANEL_PROJECT_TOKEN = os.getenv('MIXPANEL_PROJECT_TOKEN', '')
PACKAGE_BUCKET_NAME = 'package'
REGISTRY_URL = os.environ['REGISTRY_URL']
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')
S3_ENDPOINT = 'http://s3:5001'
SECRET_KEY = os.environ['QUILT_SECRET_KEY']
SQLALCHEMY_DATABASE_URI = 'postgresql://postgres:testing@db/packages'
SQLALCHEMY_ECHO = True
