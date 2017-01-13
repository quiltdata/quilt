"""
Config object for the Flask app.

See `app.config.from_object('...')` in __init__.py.
"""

from .const import PRODUCTION

if PRODUCTION:
    assert False
else:
    SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root@localhost/quilt'
    SECRET_KEY = 'this is very secret'  # Used to sign cookies.

    QUILT_AUTH = dict(
        base_url='https://quilt-heroku.herokuapp.com',
        request_token_url=None,
        access_token_url='/o/token/',
        authorize_url='/o/authorize/',
        consumer_key='chrOhbIPVtJAey7LcT1ez7PnIaV9tFLqNYXapcG3',
        # This one is really sensitive, but it's for the stage environment, so whatever.
        consumer_secret=(
            'ihhjjcPioqbdsNyo6xfjMmTALqsJzSLgVWd5SgPfAJ5gxRBUCjZR7jT8Yy2IJrVp' +
            'Nbd0UHaKJHoBlFgjwwokTiaOEnmjGtS6KwaPDaXRb1jbrHkvpX82CNNAtwV44Nt3'
        )
    )

SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ECHO = False  # Turn it on for debugging.
