"""
Default config values the Flask app.
Shared between dev, stage, and production.

See `app.config.from_object('...')` in __init__.py.
"""

SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ECHO = False  # Turn it on for debugging.

PACKAGE_URL_EXPIRATION = 600  # 10 minutes

JSON_USE_ENCODE_METHODS = True  # Support the __json__ method in Node
