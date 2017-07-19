# Copyright (c) 2017 Quilt Data, Inc.

"""
Config file for dev. Overrides values in config.py.
"""
import os

SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root@localhost/quilt'
OAUTH = dict(
    redirect_uri='http://localhost:5000/oauth_callback',
    base_url='https://quilt-heroku.herokuapp.com',
    client_id='chrOhbIPVtJAey7LcT1ez7PnIaV9tFLqNYXapcG3',
    client_secret=os.getenv('OAUTH_CLIENT_SECRET')
)

S3_ENDPOINT = 'http://localhost:5001'
PACKAGE_BUCKET_NAME = 'package'

SQLALCHEMY_ECHO = True

MIXPANEL_PROJECT_TOKEN = os.getenv('MIXPANEL_PROJECT_TOKEN')

STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')
