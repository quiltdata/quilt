"""
API routes.
"""

from datetime import timedelta
from functools import wraps
import json

import boto3
from flask import abort, redirect, render_template, request, Response
from flask_cors import CORS
from flask_json import as_json, jsonify
from jsonschema import Draft4Validator, ValidationError
from oauthlib.oauth2 import OAuth2Error
import requests
from requests_oauthlib import OAuth2Session
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import undefer

from . import app, db
from .const import PUBLIC
from .core import decode_node, encode_node, find_object_hashes, hash_contents
from .models import Access, Instance, Log, Package, S3Blob, Tag, UTF8_GENERAL_CI, Version
from .schemas import PACKAGE_SCHEMA

QUILT_CDN = 'https://cdn.quiltdata.com/'

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
        return render_template('oauth_fail.html', error=error, QUILT_CDN=QUILT_CDN)

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
        return render_template('oauth_success.html', code=resp['refresh_token'], QUILT_CDN=QUILT_CDN)
    except OAuth2Error as ex:
        return render_template('oauth_fail.html', error=ex.error, QUILT_CDN=QUILT_CDN)

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

# Allow CORS requests to API routes.
# The "*" origin is more secure than specific origins because it blocks cookies.
# Cache the settings for a day to avoid pre-flight requests.
CORS(app, resources={"/api/*": {"origins": "*", "max_age": timedelta(days=1)}})


class ApiException(Exception):
    """
    Base class for API exceptions.
    """
    def __init__(self, status_code, message):
        super().__init__()
        self.status_code = status_code
        self.message = message

class PackageNotFoundException(ApiException):
    """
    API exception for missing packages.
    """
    def __init__(self, owner, package):
        message = "Package %s/%s does not exist" % (owner, package)
        super().__init__(requests.codes.not_found, message)

@app.errorhandler(ApiException)
def handle_api_exception(error):
    """
    Converts an API exception into an error response.
    """
    response = jsonify(dict(
        message=error.message
    ))
    response.status_code = error.status_code
    return response

def api(require_login=True, schema=None):
    """
    Decorator for API requests.
    Handles auth and adds the username as the first argument.
    """
    if schema is not None:
        Draft4Validator.check_schema(schema)
        validator = Draft4Validator(schema)
    else:
        validator = None

    def innerdec(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if validator is not None:
                try:
                    validator.validate(request.get_json(cache=True))
                except ValidationError as ex:
                    raise ApiException(requests.codes.bad_request, ex.message)

            auth = request.headers.get(AUTHORIZATION_HEADER)
            user = PUBLIC

            if auth is None:
                if require_login:
                    raise ApiException(requests.codes.unauthorized, "Not logged in")
            else:
                headers = {
                    AUTHORIZATION_HEADER: auth
                }
                resp = requests.get(OAUTH_BASE_URL + '/api-root', headers=headers)
                if resp.status_code == requests.codes.ok:
                    data = resp.json()
                    user = data['current_user']
                elif resp.status_code == requests.codes.unauthorized:
                    raise ApiException(
                        requests.codes.unauthorized,
                        "Invalid credentials"
                    )
                else:
                    raise ApiException(requests.codes.server_error, "Server error")
            return f(user, *args, **kwargs)
        return wrapper
    return innerdec

def _get_package(auth_user, owner, package_name):
    """
    Helper for looking up a package and checking permissions.
    Only useful for *_list functions; all others should use more efficient queries.
    """
    package = (
        Package.query
        .filter_by(owner=owner, name=package_name)
        .join(Package.access)
        .filter(Access.user.in_([auth_user, PUBLIC]))
        .one_or_none()
    )
    if package is None:
        raise PackageNotFoundException(owner, package_name)
    return package

@app.route('/api/package/<owner>/<package_name>/<package_hash>', methods=['PUT'])
@api(schema=PACKAGE_SCHEMA)
@as_json
def package_put(auth_user, owner, package_name, package_hash):
    # TODO: Write access for collaborators.
    if auth_user != owner:
        raise ApiException(requests.codes.forbidden,
                           "Only the package owner can push packages.")

    # TODO: Description.
    data = json.loads(request.data.decode('utf-8'), object_hook=decode_node)
    contents = data['contents']

    if hash_contents(contents) != package_hash:
        raise ApiException(requests.codes.bad_request, "Wrong contents hash")

    all_hashes = set(find_object_hashes(contents))

    # Insert a package if it doesn't already exist.
    # TODO: Separate endpoint for just creating a package with no versions?
    package = (
        Package.query
        .with_for_update()
        .filter_by(owner=owner, name=package_name)
        .one_or_none()
    )

    if package is None:
        # Check for case-insensitive matches, and reject the push.
        package_ci = (
            Package.query
            .filter(
                sa.and_(
                    sa.sql.collate(Package.owner, UTF8_GENERAL_CI) == owner,
                    sa.sql.collate(Package.name, UTF8_GENERAL_CI) == package_name
                )
            )
            .one_or_none()
        )

        if package_ci is not None:
            raise ApiException(
                requests.codes.forbidden,
                "Package already exists: %s/%s" % (package_ci.owner, package_ci.name)
            )

        package = Package(owner=owner, name=package_name)
        db.session.add(package)

        owner_access = Access(package=package, user=owner)
        db.session.add(owner_access)

    # Insert an instance if it doesn't already exist.
    instance = (
        Instance.query
        .with_for_update()
        .filter_by(package=package, hash=package_hash)
        .one_or_none()
    )

    contents_str = json.dumps(contents, default=encode_node)

    if instance is None:
        instance = Instance(
            package=package,
            contents=contents_str,
            hash=package_hash,
            created_by=auth_user,
            updated_by=auth_user
        )

        # Add all the hashes that don't exist yet.

        blobs = (
            S3Blob.query
            .with_for_update()
            .filter(
                sa.and_(
                    S3Blob.owner == owner,
                    S3Blob.hash.in_(all_hashes)
                )
            )
            .all()
        )

        existing_hashes = {blob.hash for blob in blobs}

        for blob_hash in all_hashes:
            if blob_hash not in existing_hashes:
                instance.blobs.append(S3Blob(owner=owner, hash=blob_hash))
    else:
        # Just update the contents dictionary.
        # Nothing else could've changed without invalidating the hash.
        instance.contents = contents_str
        instance.updated_by = auth_user

    db.session.add(instance)

    # Insert a log.
    log = Log(
        package=package,
        instance=instance,
        author=owner,
    )
    db.session.add(log)

    upload_urls = {}

    for blob_hash in all_hashes:
        upload_urls[blob_hash] = s3_client.generate_presigned_url(
            S3_PUT_OBJECT,
            Params=dict(
                Bucket=PACKAGE_BUCKET_NAME,
                Key='%s/%s/%s' % (owner, package_name, blob_hash)
            ),
            ExpiresIn=PACKAGE_URL_EXPIRATION
        )

    db.session.commit()

    return dict(
        upload_urls=upload_urls
    )

@app.route('/api/package/<owner>/<package_name>/<package_hash>', methods=['GET'])
@api(require_login=False)
@as_json
def package_get(auth_user, owner, package_name, package_hash):
    instance = (
        Instance.query
        .filter_by(hash=package_hash)
        .options(undefer('contents'))  # Contents is deferred by default.
        .join(Instance.package)
        .filter_by(owner=owner, name=package_name)
        .join(Package.access)
        .filter(Access.user.in_([auth_user, PUBLIC]))
        .one_or_none()
    )

    if instance is None:
        raise ApiException(
            requests.codes.not_found,
            "Package hash does not exist"
        )

    contents = json.loads(instance.contents, object_hook=decode_node)

    all_hashes = set(find_object_hashes(contents))

    urls = {}
    for blob_hash in all_hashes:
        urls[blob_hash] = s3_client.generate_presigned_url(
            S3_GET_OBJECT,
            Params=dict(
                Bucket=PACKAGE_BUCKET_NAME,
                Key='%s/%s/%s' % (owner, package_name, blob_hash)
            ),
            ExpiresIn=PACKAGE_URL_EXPIRATION
        )

    return dict(
        contents=contents,
        urls=urls,
        created_by=instance.created_by,
        created_at=instance.created_at,
        updated_by=instance.updated_by,
        updated_at=instance.updated_at,
    )

@app.route('/api/package/<owner>/<package_name>/', methods=['GET'])
@api(require_login=False)
@as_json
def package_list(auth_user, owner, package_name):
    package = _get_package(auth_user, owner, package_name)
    instances = (
        Instance.query
        .filter_by(package=package)
    )

    return dict(
        hashes=[instance.hash for instance in instances]
    )

@app.route('/api/package/<owner>/', methods=['GET'])
@api(require_login=False)
@as_json
def user_packages(auth_user, owner):
    packages = (
        Package.query
        .filter_by(owner=owner)
        .join(Package.access)
        .filter(Access.user.in_([auth_user, PUBLIC]))
        .all()
    )

    return dict(
        packages=[package.name for package in packages]
    )

@app.route('/api/log/<owner>/<package_name>/', methods=['GET'])
@api()
@as_json
def logs_list(auth_user, owner, package_name):
    if auth_user != owner:
        raise ApiException(
            requests.codes.forbidden,
            "Only the package owner can view logs."
        )

    package = _get_package(auth_user, owner, package_name)

    logs = (
        db.session.query(Log, Instance)
        .filter_by(package=package)
        .join(Log.instance)
        # Sort chronologically, but rely on IDs in case of duplicate created times.
        .order_by(Log.created, Log.id)
    )

    return dict(
        logs=[dict(
            hash=instance.hash,
            created=log.created,
            author=log.author
        ) for log, instance in logs]
    )

VERSION_SCHEMA = {
    'type': 'object',
    'properties': {
        'hash': {
            'type': 'string'
        }
    },
    'required': ['hash']
}

def normalize_version(version):
    try:
        version = Version.normalize(version)
    except ValueError:
        raise ApiException(requests.codes.bad_request, "Malformed version")

    return version

@app.route('/api/version/<owner>/<package_name>/<package_version>', methods=['PUT'])
@api(schema=VERSION_SCHEMA)
@as_json
def version_put(auth_user, owner, package_name, package_version):
    # TODO: Write access for collaborators.
    if auth_user != owner:
        raise ApiException(
            requests.codes.forbidden,
            "Only the package owner can create versions"
        )

    user_version = package_version
    package_version = normalize_version(package_version)

    data = request.get_json()
    package_hash = data['hash']

    instance = (
        Instance.query
        .filter_by(hash=package_hash)
        .join(Instance.package)
        .filter_by(owner=owner, name=package_name)
        .one_or_none()
    )

    if instance is None:
        raise ApiException(requests.codes.not_found, "Package hash does not exist")

    version = Version(
        package_id=instance.package_id,
        version=package_version,
        user_version=user_version,
        instance=instance
    )

    try:
        db.session.add(version)
        db.session.commit()
    except IntegrityError:
        raise ApiException(requests.codes.conflict, "Version already exists")

    return dict()

@app.route('/api/version/<owner>/<package_name>/<package_version>', methods=['GET'])
@api(require_login=False)
@as_json
def version_get(auth_user, owner, package_name, package_version):
    package_version = normalize_version(package_version)

    instance = (
        Instance.query
        .join(Instance.versions)
        .filter_by(version=package_version)
        .join(Version.package)
        .filter_by(owner=owner, name=package_name)
        .join(Package.access)
        .filter(Access.user.in_([auth_user, PUBLIC]))
        .one_or_none()
    )

    if instance is None:
        raise ApiException(
            requests.codes.not_found,
            "Package %s/%s version %s does not exist" % (owner, package_name, package_version)
        )

    return dict(
        hash=instance.hash,
        created_by=instance.created_by,
        created_at=instance.created_at,
        updated_by=instance.updated_by,
        updated_at=instance.updated_at,
    )

@app.route('/api/version/<owner>/<package_name>/', methods=['GET'])
@api(require_login=False)
@as_json
def version_list(auth_user, owner, package_name):
    package = _get_package(auth_user, owner, package_name)

    versions = (
        db.session.query(Version, Instance)
        .filter_by(package=package)
        .join(Version.instance)
        .all()
    )

    sorted_versions = sorted(versions, key=lambda row: row[0].sort_key())

    return dict(
        versions=[
            dict(
                version=version.user_version,
                hash=instance.hash
            ) for version, instance in sorted_versions
        ]
    )

TAG_SCHEMA = {
    'type': 'object',
    'properties': {
        'hash': {
            'type': 'string'
        }
    },
    'required': ['hash']
}

@app.route('/api/tag/<owner>/<package_name>/<package_tag>', methods=['PUT'])
@api(schema=TAG_SCHEMA)
@as_json
def tag_put(auth_user, owner, package_name, package_tag):
    # TODO: Write access for collaborators.
    if auth_user != owner:
        raise ApiException(
            requests.codes.forbidden,
            "Only the package owner can modify tags"
        )

    data = request.get_json()
    package_hash = data['hash']

    instance = (
        Instance.query
        .filter_by(hash=package_hash)
        .join(Instance.package)
        .filter_by(owner=owner, name=package_name)
        .one_or_none()
    )

    if instance is None:
        raise ApiException(requests.codes.not_found, "Package hash does not exist")

    # Update an existing tag or create a new one.
    tag = (
        Tag.query
        .with_for_update()
        .filter_by(package_id=instance.package_id, tag=package_tag)
        .one_or_none()
    )
    if tag is None:
        tag = Tag(
            package_id=instance.package_id,
            tag=package_tag,
            instance=instance
        )
        db.session.add(tag)
    else:
        tag.instance = instance

    db.session.commit()

    return dict()

@app.route('/api/tag/<owner>/<package_name>/<package_tag>', methods=['GET'])
@api(require_login=False)
@as_json
def tag_get(auth_user, owner, package_name, package_tag):
    instance = (
        Instance.query
        .join(Instance.tags)
        .filter_by(tag=package_tag)
        .join(Tag.package)
        .filter_by(owner=owner, name=package_name)
        .join(Package.access)
        .filter(Access.user.in_([auth_user, PUBLIC]))
        .one_or_none()
    )

    if instance is None:
        raise ApiException(
            requests.codes.not_found,
            "Package %s/%s tag %r does not exist" % (owner, package_name, package_tag)
        )

    return dict(
        hash=instance.hash,
        created_by=instance.created_by,
        created_at=instance.created_at,
        updated_by=instance.updated_by,
        updated_at=instance.updated_at,
    )

@app.route('/api/tag/<owner>/<package_name>/<package_tag>', methods=['DELETE'])
@api()
@as_json
def tag_delete(auth_user, owner, package_name, package_tag):
    # TODO: Write access for collaborators.
    if auth_user != owner:
        raise ApiException(
            requests.codes.forbidden,
            "Only the package owner can delete tags"
        )

    tag = (
        Tag.query
        .with_for_update()
        .filter_by(tag=package_tag)
        .join(Tag.package)
        .filter_by(owner=owner, name=package_name)
        .one_or_none()
    )
    if tag is None:
        raise ApiException(
            requests.codes.not_found,
            "Package %s/%s tag %r does not exist" % (owner, package_name, package_tag)
        )

    db.session.delete(tag)
    db.session.commit()

    return dict()

@app.route('/api/tag/<owner>/<package_name>/', methods=['GET'])
@api(require_login=False)
@as_json
def tag_list(auth_user, owner, package_name):
    package = _get_package(auth_user, owner, package_name)

    tags = (
        db.session.query(Tag, Instance)
        .filter_by(package=package)
        .order_by(Tag.tag)
        .join(Tag.instance)
        .all()
    )

    return dict(
        tags=[
            dict(
                tag=tag.tag,
                hash=instance.hash
            ) for tag, instance in tags
        ]
    )

@app.route('/api/access/<owner>/<package_name>/<user>', methods=['PUT'])
@api()
@as_json
def access_put(auth_user, owner, package_name, user):
    if not user:
        raise ApiException(requests.codes.bad_request, "A valid user is required")

    if auth_user != owner:
        raise ApiException(
            requests.codes.forbidden,
            "Only the package owner can grant access"
        )

    package = (
        Package.query
        .with_for_update()
        .filter_by(owner=owner, name=package_name)
        .one_or_none()
    )
    if package is None:
        raise PackageNotFoundException(owner, package_name)

    if user != PUBLIC:
        auth = request.headers.get(AUTHORIZATION_HEADER)
        headers = {
            AUTHORIZATION_HEADER: auth
            }
        resp = requests.get(OAUTH_BASE_URL + '/profiles/%s' % user, headers=headers)
        if resp.status_code == requests.codes.not_found:
            raise ApiException(
                requests.codes.not_found,
                "User %s does not exist" % user
                )
        elif response.status_code != requests.codes.ok:
            raise ApiException(
                response.status_code,
                "Unknown error"
                )

    try:
        access = Access(package=package, user=user)
        db.session.add(access)
        db.session.commit()
    except IntegrityError:
        raise ApiException(requests.codes.conflict, "The user already has access")

    return dict()

@app.route('/api/access/<owner>/<package_name>/<user>', methods=['GET'])
@api()
@as_json
def access_get(auth_user, owner, package_name, user):
    if auth_user != owner:
        raise ApiException(
            requests.codes.forbidden,
            "Only the package owner can view access"
        )

    access = (
        db.session.query(Access)
        .filter_by(user=user)
        .join(Access.package)
        .filter_by(owner=owner, name=package_name)
        .one_or_none()
    )
    if access is None:
        raise PackageNotFoundException(owner, package_name)

    return dict()

@app.route('/api/access/<owner>/<package_name>/<user>', methods=['DELETE'])
@api()
@as_json
def access_delete(auth_user, owner, package_name, user):
    if auth_user != owner:
        raise ApiException(
            requests.codes.forbidden,
            "Only the package owner can revoke access"
        )

    if user == owner:
        raise ApiException(
            requests.codes.forbidden,
            "Cannot revoke the owner's access"
        )

    access = (
        Access.query
        .with_for_update()
        .filter_by(user=user)
        .join(Access.package)
        .filter_by(owner=owner, name=package_name)
        .one_or_none()
    )
    if access is None:
        raise PackageNotFoundException(owner, package_name)

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
        raise PackageNotFoundException(owner, package_name)
