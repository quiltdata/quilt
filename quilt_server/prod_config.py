# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Config file for prod/stage. Overrides values in config.py.
"""
import os

SQLALCHEMY_DATABASE_URI = os.getenv('SQLALCHEMY_DATABASE_URI')
OAUTH = dict(
    redirect_uri='https://%s/oauth_callback' % os.getenv('PACKAGE_HOST'),
    base_url='https://%s' % os.getenv('AUTH_HOST'),
    client_id=os.getenv('OAUTH_CLIENT_ID'),
    client_secret=os.getenv('OAUTH_CLIENT_SECRET')
)

PACKAGE_BUCKET_NAME = os.getenv('PACKAGE_BUCKET_NAME')

MIXPANEL_PROJECT_TOKEN = os.getenv('MIXPANEL_PROJECT_TOKEN')

STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')
