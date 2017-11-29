# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Sets up the Flask app.

See:
http://flask.pocoo.org/docs/0.12/patterns/packages/
https://github.com/pallets/flask/wiki/Large-app-how-to
"""

from flask import Flask
from flask_json import FlaskJSON
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

from . import middleware

app = Flask(__name__.split('.')[0])
app.wsgi_app = middleware.RequestEncodingMiddleware(app.wsgi_app)
app.config.from_object('quilt_server.config')
app.config.from_envvar('QUILT_SERVER_CONFIG')

db = SQLAlchemy(app)

FlaskJSON(app)
Migrate(app, db)

# Need to import views.py in order for the routes to get set up.
from . import views

# Need tables to run migrations.
# Should already be imported by `views` above, but just to be safe...
from . import models
