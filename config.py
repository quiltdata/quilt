"""
Config object for the Flask app.

See `app.config.from_object('config')` in app.py.
"""

from const import PRODUCTION

if PRODUCTION:
    assert False
else:
    SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root@localhost/quilt'

SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ECHO = False  # Turn it on for debugging.
