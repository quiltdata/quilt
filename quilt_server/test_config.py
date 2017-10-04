# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Config file for dev. Overrides values in config.py.
"""
import os

SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root@db/quilt'
OAUTH = dict(
    access_token_url='https://auth:5002/o/token/',
    authorize_url='https://auth:5002/o/authorize/',
    client_id='chrOhbIPVtJAey7LcT1ez7PnIaV9tFLqNYXapcG3',
    client_secret=os.getenv('OAUTH_CLIENT_SECRET'),
    redirect_url='http://flask:5000/oauth_callback',
    user_api='https://auth:5002/api-root',
    profile_api='https://auth:5002/profiles/%s/',
    have_refresh_token=True,
)

INVITE_SEND_URL = 'https://quilt-heroku.herokuapp.com/pkginvite/send/'

AWS_ACCESS_KEY_ID = 'fake_id'
AWS_SECRET_ACCESS_KEY = 'fake_secret'

S3_ENDPOINT = 'http://s3:5001'
PACKAGE_BUCKET_NAME = 'package'

SQLALCHEMY_ECHO = True

MIXPANEL_PROJECT_TOKEN = os.getenv('MIXPANEL_PROJECT_TOKEN')

STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')
