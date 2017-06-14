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

MIXPANEL_PROJECT_TOKEN = ''  # Disable mixpanel in dev
