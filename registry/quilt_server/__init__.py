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
from flask_security import Security, SQLAlchemyUserDatastore, \
       UserMixin, RoleMixin, login_required

from . import middleware
from .core import decode_node, encode_node

app = Flask(__name__.split('.')[0])
app.wsgi_app = middleware.RequestEncodingMiddleware(app.wsgi_app)
app.config.from_object('quilt_server.config')
app.config.from_envvar('QUILT_SERVER_CONFIG')

app.config['SECURITY_LOGIN_URL'] = '/beans/login'
app.config['SECURITY_LOGOUT_URL'] = '/beans/logout'
app.config['WTF_CSRF_ENABLED'] = False
app.config['SECURITY_PASSWORD_HASH'] = 'pbkdf2_sha512'
app.config['SECURITY_TRACKABLE'] = True
app.config['SECURITY_PASSWORD_SALT'] = 'something_super_secret_change_in_production'
app.config['SECURITY_POST_LOGIN_VIEW'] = '/beans/secret'
app.config['SECRET_KEY'] = 'ooh secrets'
app.config['SECURITY_TOKEN_MAX_AGE'] = 10

class QuiltSQLAlchemy(SQLAlchemy):
    def apply_driver_hacks(self, app, info, options):
        """
        Teach SQLAlchemy to encode and decode our node objects.
        """
        options.update(dict(
            json_serializer=lambda data: json.dumps(data, default=encode_node),
            json_deserializer=lambda data: json.loads(data, object_hook=decode_node)
        ))
        super(QuiltSQLAlchemy, self).apply_driver_hacks(app, info, options)

db = QuiltSQLAlchemy(app, session_options=dict(expire_on_commit=False))

FlaskJSON(app)
Migrate(app, db, compare_type=True)


class Base(db.Model):
    __abstract__ = True
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    modified_at = db.Column(db.DateTime, default=db.func.current_timestamp(),
                            onupdate=db.func.current_timestamp())


roles_users = db.Table('roles_users',
                       db.Column('user_id', db.Integer(),
                                 db.ForeignKey('auth_user.id')),
                       db.Column('role_id', db.Integer(),
                                 db.ForeignKey('auth_role.id')))

class Role(Base, RoleMixin):
    __tablename__ = 'auth_role'
    name = db.Column(db.String(80), nullable=False, unique=True)
    description = db.Column(db.String(255))

    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return '<Role %r>' % self.name


class User(Base, UserMixin):
    __tablename__ = 'auth_user'
    email = db.Column(db.String(255), nullable=False, unique=True)
    password = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(255))
    last_name = db.Column(db.String(255))
    active = db.Column(db.Boolean())
    confirmed_at = db.Column(db.DateTime())
    last_login_at = db.Column(db.DateTime())
    current_login_at = db.Column(db.DateTime())
    # Why 45 characters for IP Address ?
    # See http://stackoverflow.com/questions/166132/maximum-length-of-the-textual-representation-of-an-ipv6-address/166157#166157
    last_login_ip = db.Column(db.String(45))
    current_login_ip = db.Column(db.String(45))
    login_count = db.Column(db.Integer)
    roles = db.relationship('Role', secondary=roles_users,
                            backref=db.backref('users', lazy='dynamic'))

    def __repr__(self):
        return '<User %r>' % self.email

# Setup Flask-Security
user_datastore = SQLAlchemyUserDatastore(db, User, Role)
security = Security(app, user_datastore)

# Create a user to test with
@app.before_first_request
def create_user():
    db.create_all()
    if not User.query.first:
        user_datastore.create_user(email='calvin+beans@quiltdata.io', password='beans')
        db.session.commit()

@app.cli.command('createdb')
def createdb_command():
    import sqlalchemy_utils
    sqlalchemy_utils.create_database(db.engine.url)

# Need to import views.py in order for the routes to get set up.
from . import views

# Need tables to run migrations.
# Should already be imported by `views` above, but just to be safe...
from . import models
