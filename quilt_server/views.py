"""
API routes.
"""

from functools import wraps

import boto3
from flask import abort, redirect, render_template, request, Response
from flask_json import as_json
from jsonschema import validate, ValidationError
from oauthlib.oauth2 import OAuth2Error
import requests
from requests_oauthlib import OAuth2Session
from sqlalchemy.exc import IntegrityError

from . import app, db
from .models import Package, Tag, Version, Access
from .const import PUBLIC

OAUTH_BASE_URL = app.config['OAUTH']['base_url']
OAUTH_CLIENT_ID = app.config['OAUTH']['client_id']
OAUTH_CLIENT_SECRET = app.config['OAUTH']['client_secret']
OAUTH_REDIRECT_URI = app.config['OAUTH']['redirect_uri']

ACCESS_TOKEN_URL = '/o/token/'
AUTHORIZE_URL = '/o/authorize/'

AUTHORIZATION_HEADER = 'Authorization'

PACKAGE_BUCKET_NAME = app.config['PACKAGE_BUCKET_NAME']
PACKAGE_URL_EXPIRATION = app.config['PACKAGE_URL_EXPIRATION']

S3_GET_OBJECT = 'get_object'
S3_PUT_OBJECT = 'put_object'

s3_client = boto3.client('s3', endpoint_url=app.config.get('S3_ENDPOINT'))


### Web routes ###

def _create_session():
    return OAuth2Session(
        client_id=OAUTH_CLIENT_ID,
        redirect_uri=OAUTH_REDIRECT_URI
    )

@app.route('/healthcheck')
def healthcheck():
    """ELB health check; just needs to return a 200 status code."""
    return Response("ok", content_type='text/plain')

@app.route('/login')
def login():
    session = _create_session()
    url, state = session.authorization_url(url=OAUTH_BASE_URL + AUTHORIZE_URL)

    return redirect(url)

@app.route('/oauth_callback')
def oauth_callback():
    # TODO: Check `state`? Do we need CSRF protection here?

    error = request.args.get('error')
    if error is not None:
        return render_template('oauth_fail.html', error=error)

    code = request.args.get('code')
    if code is None:
        abort(requests.codes.bad_request)

    session = _create_session()
    try:
        resp = session.fetch_token(
            token_url=OAUTH_BASE_URL + ACCESS_TOKEN_URL,
            code=code,
            client_secret=OAUTH_CLIENT_SECRET
        )
        return render_template('oauth_success.html', code=resp['refresh_token'])
    except OAuth2Error as ex:
        return render_template('oauth_fail.html', error=ex.error)

@app.route('/api/token', methods=['POST'])
@as_json
def token():
    refresh_token = request.values.get('refresh_token')
    if refresh_token is None:
        abort(requests.codes.bad_request)

    session = _create_session()

    try:
        resp = session.refresh_token(
            token_url=OAUTH_BASE_URL + ACCESS_TOKEN_URL,
            client_id=OAUTH_CLIENT_ID,  # Why??? The session object already has it!
            client_secret=OAUTH_CLIENT_SECRET,
            refresh_token=refresh_token
        )
    except OAuth2Error as ex:
        return dict(error=ex.error)

    return dict(
        refresh_token=resp['refresh_token'],
        access_token=resp['access_token'],
        expires_at=resp['expires_at']
    )


### API routes ###

def api(require_login=True, schema=None):
    """
    Decorator for API requests.
    Handles auth and adds the username as the first argument.
    """
    def innerdec(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if schema is not None:
                try:
                    validate(request.get_json(), schema)
                except ValidationError as ex:
                    abort(400, ex.message)

            auth = request.headers.get(AUTHORIZATION_HEADER)
            user = None

            if auth is None:
                if require_login:
                    abort(requests.codes.unauthorized)
            else:
                headers = {
                    AUTHORIZATION_HEADER: auth
                }
                resp = requests.get(OAUTH_BASE_URL + '/api-root', headers=headers)
                if resp.status_code == requests.codes.ok:
                    data = resp.json()
                    user = data['current_user']
                elif resp.status_code == requests.codes.unauthorized:
                    abort(requests.codes.unauthorized)
                else:
                    abort(requests.codes.server_error)
            return f(user, *args, **kwargs)
        return wrapper
    return innerdec

PACKAGE_SCHEMA = {
    'type': 'object',
    'properties': {
        'hash': {
            'type': 'string'
        },
        'description': {
            'type': 'string'
        }
    },
    'required': ['hash', 'description']
}

@app.route('/api/package/<owner>/<package_name>', methods=['PUT'])
@api(schema=PACKAGE_SCHEMA)
@as_json
def package_put(auth_user, owner, package_name):
    data = request.get_json()
    package_hash = data['hash']

    # Insert a package if it doesn't already exist.
    # TODO: Separate endpoint for just creating a package with no versions?
    package = (
        Package.query
        .with_for_update()
        .filter_by(owner=owner, name=package_name)
        .one_or_none()
    )

    if package is None:
        if auth_user != owner:
            abort(requests.codes.forbidden, "Only the owner can create a package.")

        package = Package(owner=owner, name=package_name)
        db.session.add(package)

        owner_access = Access(package=package, user=owner)
        db.session.add(owner_access)
    else:
        # Check if the user has access to this package
        access = (Access.query
                    .filter_by(package=package, user=auth_user)
                    .one_or_none())
        if access is None:
            abort(requests.codes.forbidden)

    # Insert the version.
    version = Version(
        package=package,
        author=owner,
        hash=package_hash,
    )
    db.session.add(version)

    # Look up an existing "latest" tag.
    # Update it if it exists, otherwise create a new one.
    # TODO: Do something clever with `merge`?
    tag = (
        Tag.query
        .with_for_update()
        .filter_by(package=package, tag=Tag.LATEST)
        .one_or_none()
    )
    if tag is None:
        tag = Tag(
            package=package,
            tag=Tag.LATEST,
            version=version
        )
        db.session.add(tag)
    else:
        tag.version = version

    upload_url = s3_client.generate_presigned_url(
        S3_PUT_OBJECT,
        Params=dict(
            Bucket=PACKAGE_BUCKET_NAME,
            Key='%s/%s/%s' % (owner, package_name, package_hash)
        ),
        ExpiresIn=PACKAGE_URL_EXPIRATION
    )

    db.session.commit()

    return dict(
        upload_url=upload_url
    )

@app.route('/api/package/<owner>/<package_name>', methods=['GET'])
@api()
@as_json
def package_get(auth_user, owner, package_name):
    version = (
        db.session.query(Version)
        .join(Version.package)
        .filter_by(owner=owner, name=package_name)
        .join(Access, Version.package_id == Access.package_id)
        .filter(Access.user.in_([auth_user, PUBLIC]))
        .join(Version.tag)
        .filter_by(tag=Tag.LATEST)
        .one_or_none()
    )

    if version is None:
        abort(requests.codes.not_found)

    url = s3_client.generate_presigned_url(
        S3_GET_OBJECT,
        Params=dict(
            Bucket=PACKAGE_BUCKET_NAME,
            Key='%s/%s/%s' % (owner, package_name, version.hash)
        ),
        ExpiresIn=PACKAGE_URL_EXPIRATION
    )

    return dict(
        url=url,
        hash=version.hash
    )

@app.route('/api/access/<owner>/<package_name>/<user>', methods=['PUT'])
@api()
@as_json
def access_put(auth_user, owner, package_name, user):
    if not user:
        abort(requests.codes.bad_request, "A valid user is required.")

    if auth_user != owner:
        abort(requests.codes.forbidden,
              "Only the package owner can grant access.")

    package = (
        Package.query
        .with_for_update()
        .filter_by(owner=owner, name=package_name)
        .one_or_none()
    )
    if package is None:
        abort(requests.codes.not_found)

    try:
        access = Access(package=package, user=user)
        db.session.add(access)
        db.session.commit()
    except IntegrityError:
        abort(requests.codes.conflict, "The user already has access")

    return dict()

@app.route('/api/access/<owner>/<package_name>/<user>', methods=['GET'])
@api()
@as_json
def access_get(auth_user, owner, package_name, user):
    if auth_user != owner:
        abort(requests.codes.forbidden,
              "Only the package owner can view access.")

    access = (
        db.session.query(Access)
        .filter_by(user=user)
        .join(Access.package)
        .filter_by(owner=owner, name=package_name)
        .one_or_none()
    )
    if access is None:
        abort(request.codes.not_found)

    return dict()

@app.route('/api/access/<owner>/<package_name>/<user>', methods=['DELETE'])
@api()
@as_json
def access_delete(auth_user, owner, package_name, user):
    if auth_user != owner:
        abort(requests.codes.forbidden,
              "Only the package owner can revoke access.")

    if user == owner:
        abort(requests.codes.forbidden)

    access = (
        Access.query
        .with_for_update()
        .filter_by(user=user)
        .join(Access.package)
        .filter_by(owner=owner, name=package_name)
        .one_or_none()
    )
    if access is None:
        abort(requests.codes.not_found)

    db.session.delete(access)
    db.session.commit()
    return dict()

@app.route('/api/access/<owner>/<package_name>/', methods=['GET'])
@api()
@as_json
def access_list(auth_user, owner, package_name):
    accesses = (
        Access.query
        .join(Access.package)
        .filter_by(owner=owner, name=package_name)
    )

    can_access = [access.user for access in accesses]
    is_collaborator = auth_user in can_access
    is_public = PUBLIC in can_access

    if is_public or is_collaborator:
        return dict(users=can_access)
    else:
        abort(requests.codes.not_found)
