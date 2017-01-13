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

app = Flask(__name__.split('.')[0])
app.config.from_object('quilt_server.config')

db = SQLAlchemy(app)

FlaskJSON(app)
Migrate(app, db)

# Need to import views.py in order for the routes to get set up.
from . import views
