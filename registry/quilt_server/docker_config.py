# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Config file for dev in Docker. Overrides values in config.py.
"""
import os

SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root@db/quilt'

AUTH_PROVIDER = os.getenv('AUTH_PROVIDER', 'quilt')

if AUTH_PROVIDER == 'quilt':
    OAUTH = dict(
        access_token_url='http://auth:5002/o/token/',
        authorize_url='http://auth:5002/o/authorize/',
        client_id='chrOhbIPVtJAey7LcT1ez7PnIaV9tFLqNYXapcG3',
        client_secret=os.getenv('OAUTH_CLIENT_SECRET'),
        user_api='http://auth:5002/api-root',
        profile_api='http://auth:5002/profiles/%s/',
        have_refresh_token=True,
    )
elif AUTH_PROVIDER == 'github':
    OAUTH = dict(
        access_token_url='https://github.com/login/oauth/access_token',
        authorize_url='https://github.com/login/oauth/authorize',
        client_id=os.getenv('OAUTH_CLIENT_ID_GITHUB', '411a75cc2b4f6669a418'),
        client_secret=os.getenv('OAUTH_CLIENT_SECRET_GITHUB', os.getenv('OAUTH_CLIENT_SECRET')),        
        user_api='https://api.github.com/user',
        profile_api='https://api.github.com/users/%s',  # NO trailing slash
        have_refresh_token=False,
    )
else:
    assert False, "Unknown auth provider: %s" % AUTH_PROVIDER

OAUTH.update(dict(
    redirect_url='http://flask:5000/oauth_callback',
))

CATALOG_REDIRECT_URLS = ['http://localhost:3000/oauth_callback']

INVITE_SEND_URL = 'https://quilt-heroku.herokuapp.com/pkginvite/send/'  # XXX

AWS_ACCESS_KEY_ID = 'fake_id'
AWS_SECRET_ACCESS_KEY = 'fake_secret'

S3_ENDPOINT = 'http://s3:5001'
PACKAGE_BUCKET_NAME = 'package'

SQLALCHEMY_ECHO = True

MIXPANEL_PROJECT_TOKEN = os.getenv('MIXPANEL_PROJECT_TOKEN', '')
DEPLOYMENT_ID = ''
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')
