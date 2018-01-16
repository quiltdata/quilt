# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Config file for dev. Overrides values in config.py.
"""
import os
import socket

SQLALCHEMY_DATABASE_URI = 'postgres://postgres@localhost/packages'

AUTH_PROVIDER = os.getenv('AUTH_PROVIDER', 'quilt')

if AUTH_PROVIDER == 'quilt':
    OAUTH = dict(
        access_token_url='https://quilt-heroku.herokuapp.com/o/token/',
        authorize_url='https://quilt-heroku.herokuapp.com/o/authorize/',
        client_id='packages',
        client_secret=os.getenv('OAUTH_CLIENT_SECRET_QUILT', os.getenv('OAUTH_CLIENT_SECRET')),
        user_api='https://quilt-heroku.herokuapp.com/api-root',
        profile_api='https://quilt-heroku.herokuapp.com/accounts/profile?user=%s',
        have_refresh_token=True,
    )
elif AUTH_PROVIDER == 'github':
    OAUTH = dict(
        access_token_url='https://github.com/login/oauth/access_token',
        authorize_url='https://github.com/login/oauth/authorize',
        client_id='d246dca7c81ef4272f9e',
        client_secret=os.getenv('OAUTH_CLIENT_SECRET_GITHUB', os.getenv('OAUTH_CLIENT_SECRET')),
        user_api='https://api.github.com/user',
        profile_api='https://api.github.com/users/%s',  # NO trailing slash
        have_refresh_token=False,
    )
else:
    assert False, "Unknown auth provider: %s" % AUTH_PROVIDER

OAUTH.update(dict(
    redirect_url='http://localhost:5000/oauth_callback',
))

CATALOG_REDIRECT_URLS = ['http://localhost:3000/oauth_callback']

INVITE_SEND_URL = 'https://quilt-heroku.herokuapp.com/pkginvite/send/'  # XXX

AWS_ACCESS_KEY_ID = 'fake_id'
AWS_SECRET_ACCESS_KEY = 'fake_secret'

S3_ENDPOINT = 'http://localhost:5001'
PACKAGE_BUCKET_NAME = 'package'

SQLALCHEMY_ECHO = True

MIXPANEL_PROJECT_TOKEN = os.getenv('MIXPANEL_PROJECT_TOKEN', '')
DEPLOYMENT_ID = socket.gethostname()
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')
