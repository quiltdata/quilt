"""
Flask app for Quilt.

Make sure you have the FLASK_APP environment variable set.
"""

from flask import Flask
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_json import FlaskJSON, as_json

from const import PRODUCTION

app = Flask(__name__)
app.config.from_object('config')
db = SQLAlchemy(app)

FlaskJSON(app)
Migrate(app, db)

@app.route('/')
def index():
    return "Hello World"

@app.route('/api/test', methods=['POST'])
@as_json
def test():
    return dict(status='ok')
