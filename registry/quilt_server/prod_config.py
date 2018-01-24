# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Config file for prod/stage. Overrides values in config.py.
"""
import os

SQLALCHEMY_DATABASE_URI = os.environ['SQLALCHEMY_DATABASE_URI']

REGISTRY_HOST = os.environ['REGISTRY_HOST']
OAUTH_HOST = os.environ['OAUTH_HOST']
OAUTH_API_HOST = os.environ['OAUTH_API_HOST']
CATALOG_HOST = os.environ['CATALOG_HOST']

CATALOG_URL = 'https://%s' % CATALOG_HOST

QUILT_AUTH_URL = 'https://%s' % OAUTH_API_HOST  # TODO: Disable it for GitHub?

OAUTH = dict(
    access_token_url='https://%s/o/token/' % OAUTH_HOST,
    authorize_url='https://%s/o/authorize/' % OAUTH_HOST,
    client_id=os.environ['OAUTH_CLIENT_ID'],
    client_secret=os.environ['OAUTH_CLIENT_SECRET'],
    redirect_url='https://%s/oauth_callback' % REGISTRY_HOST,
    user_api='https://%s/accounts/api-root' % OAUTH_API_HOST,
    profile_api='https://%s/accounts/profile?user=%%s' % OAUTH_API_HOST,
    have_refresh_token=True
)

PACKAGE_BUCKET_NAME = os.environ['PACKAGE_BUCKET_NAME']

INVITE_SEND_URL = 'https://%s/pkginvite/send/' % OAUTH_API_HOST

# Optional
MIXPANEL_PROJECT_TOKEN = os.getenv('MIXPANEL_PROJECT_TOKEN')
DEPLOYMENT_ID = os.getenv('DEPLOYMENT_ID')
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')
