"""
Config file that takes configuration from the environment.
Overrides values in config.py.
"""
import os
import socket

Required = object()

def to_bool(str):
    if str in ['true', '1']:
        return True
    if str in ['false', '0']:
        return False
    raise EnvironmentError(("Invalid value '%s' supplied for boolean env var, "
        "should be one of: 'true', '1', 'false', '0'.") % str)

def getenv(name, default):
    value = os.getenv(name)
    if value in [None, '']:
        if default is Required:
            raise EnvironmentError("Expected variable {!r}, but it wasn't present.".format(name))
        else:
            return default
    return value

# Development
DEBUG = to_bool(getenv('DEBUG', 'false'))

DEV_USERNAME = getenv('DEV_USERNAME', None)
DEV_PASSWORD = getenv('DEV_PASSWORD', None)
DEV_EMAIL = getenv('DEV_EMAIL', 'support@quiltdata.io')

MAIL_DEV = to_bool(getenv('MAIL_DEV', 'false'))

# DB
SQLALCHEMY_DATABASE_URI = getenv('SQLALCHEMY_DATABASE_URI')
SQLALCHEMY_ECHO = DEBUG

# Base URLs
REGISTRY_URL = getenv('REGISTRY_URL', Required)
CATALOG_URL = getenv('CATALOG_URL', Required)
if not CATALOG_URL.startswith("https"):
    print("WARNING: INSECURE CONNECTION TO CATALOG")
    # require verbose environment variable to be defined
    assert to_bool(getenv('ALLOW_INSECURE_CATALOG_ACCESS', 'false'))

STAGE_AUTH_URL = getenv('STAGE_AUTH_URL', '')
QUILT_AUTH_URL = getenv('QUILT_AUTH_URL', STAGE_AUTH_URL)


# S3
S3_ENDPOINT = getenv('S3_ENDPOINT', Required)
PACKAGE_BUCKET_NAME = getenv('PACKAGE_BUCKET_NAME', 'package')
# `None` uses the environment/AWS config.
AWS_ACCESS_KEY_ID = getenv('AWS_ACCESS_KEY_ID', None)
AWS_SECRET_ACCESS_KEY = getenv('AWS_SECRET_ACCESS_KEY', None)

# Mixpanel config
MIXPANEL_PROJECT_TOKEN = getenv('MIXPANEL_PROJECT_TOKEN', '')
DEPLOYMENT_ID = getenv('DEPLOYMENT_ID', socket.gethostname())

# Stripe config -- Falsey values will disable payments.
STRIPE_SECRET_KEY = getenv('STRIPE_SECRET_KEY', '')

# Quilt features
ENABLE_USER_ENDPOINTS = to_bool(os.getenv('ENABLE_USER_ENDPOINTS', 'false'))


# Mail
DEFAULT_SENDER = getenv('QUILT_DEFAULT_SENDER')
MAIL_SERVER = getenv('SMTP_HOST', '' if DEBUG else Required)
MAIL_PORT = getenv('SMTP_PORT', None)
MAIL_USERNAME = getenv('SMTP_USERNAME', '')
MAIL_PASSWORD = getenv('SMTP_PASSWORD', '')
MAIL_USE_TLS = to_bool(getenv('SMTP_USE_TLS', 'true'))


# deprecated or inactive (?)
# Only referenced in configs
AUTH_PROVIDER = os.getenv('AUTH_PROVIDER', 'quilt')
# This is Only referenced in configs, appears to do nothing, but is a required value..
SECRET_KEY = getenv('QUILT_SECRET_KEY')
