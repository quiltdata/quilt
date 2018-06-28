"""
Config file that takes configuration from the environment.
Overrides values in config.py.
"""
import os

def to_bool(str):
    if str in ['true', '1']:
        return True
    if str in ['false', '0']:
        return False
    raise ValueError(("Invalid value '%s' supplied for boolean env var, "
        "should be one of: 'true', '1', 'false', '0'.") % str)

DEBUG = to_bool(os.getenv('DEBUG', 'false'))

SQLALCHEMY_DATABASE_URI = os.environ['SQLALCHEMY_DATABASE_URI']
SQLALCHEMY_ECHO = DEBUG

REGISTRY_URL = os.environ['REGISTRY_URL']
CATALOG_URL = os.environ['CATALOG_URL']

AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
S3_ENDPOINT = os.environ['S3_ENDPOINT']
PACKAGE_BUCKET_NAME = os.getenv('PACKAGE_BUCKET_NAME', 'package')

MIXPANEL_PROJECT_TOKEN = os.getenv('MIXPANEL_PROJECT_TOKEN', '')
DEPLOYMENT_ID = ''
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')

ENABLE_USER_ENDPOINTS = to_bool(os.getenv('ENABLE_USER_ENDPOINTS', 'false'))

MAIL_SERVER = os.getenv('SMTP_HOST')
MAIL_PORT = os.getenv('SMTP_PORT')
MAIL_USERNAME = os.getenv('SMTP_USERNAME')
MAIL_PASSWORD = os.getenv('SMTP_PASSWORD')
MAIL_USE_TLS = to_bool(os.getenv('SMTP_USE_TLS', 'true'))

SECRET_KEY = os.environ['QUILT_SECRET_KEY']
