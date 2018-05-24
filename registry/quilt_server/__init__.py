# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Sets up the Flask app.

See:
http://flask.pocoo.org/docs/0.12/patterns/packages/
https://github.com/pallets/flask/wiki/Large-app-how-to
"""

import json

from flask import Flask
from flask_json import FlaskJSON
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

from . import middleware
from .core import decode_node, encode_node

app = Flask(__name__.split('.')[0])
app.wsgi_app = middleware.RequestEncodingMiddleware(app.wsgi_app)
app.config.from_object('quilt_server.config')
app.config.from_envvar('QUILT_SERVER_CONFIG')

class ApiException(Exception):
    """
    Base class for API exceptions.
    """
    def __init__(self, status_code, message):
        super().__init__()
        self.status_code = status_code
        self.message = message

def set_secret_key():
    if app.config['TESTING'] and not app.secret_key:
        app.secret_key = 'testing'
    if not app.secret_key:
        raise Exception("Secret key not defined! You must set the "
                        "QUILT_SECRET_KEY environment variable!")

app.before_first_request(set_secret_key)

class QuiltSQLAlchemy(SQLAlchemy):
    def apply_driver_hacks(self, app, info, options):
        """
        Set custom SQLAlchemy engine options:
        - Teach it to encode and decode our node objects
        - Enable pre-ping (i.e., test the DB connection before trying to use it)
        """
        options.update(dict(
            json_serializer=lambda data: json.dumps(data, default=encode_node),
            json_deserializer=lambda data: json.loads(data, object_hook=decode_node),
            pool_pre_ping=True,
        ))
        super(QuiltSQLAlchemy, self).apply_driver_hacks(app, info, options)

db = QuiltSQLAlchemy(app, session_options=dict(expire_on_commit=False))

FlaskJSON(app)
Migrate(app, db, compare_type=True)

@app.cli.command('createdb')
def createdb_command():
    import sqlalchemy_utils
    sqlalchemy_utils.create_database(db.engine.url)

# Need to import views.py in order for the routes to get set up.
from . import views

# Need tables to run migrations.
# Should already be imported by `views` above, but just to be safe...
from . import models
