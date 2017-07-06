"""
API routes.
"""

from datetime import timedelta, timezone
from functools import wraps
import json
import time

import boto3
from flask import abort, g, redirect, render_template, request, Response
from flask_cors import CORS
from flask_json import as_json, jsonify
import httpagentparser
from jsonschema import Draft4Validator, ValidationError
from oauthlib.oauth2 import OAuth2Error
from packaging.version import Version as PackagingVersion
import requests
from requests_oauthlib import OAuth2Session
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import undefer
import stripe

from . import app, db
from .analytics import MIXPANEL_EVENT, mp
from .const import PaymentPlan, PUBLIC
from .core import decode_node, encode_node, find_object_hashes, hash_contents, RootNode
from .models import Access, Customer, Instance, Log, Package, S3Blob, Tag, UTF8_GENERAL_CI, Version
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

S3_HEAD_OBJECT = 'head_object'
S3_GET_OBJECT = 'get_object'
S3_PUT_OBJECT = 'put_object'

OBJ_DIR = 'objs'

s3_client = boto3.client('s3', endpoint_url=app.config.get('S3_ENDPOINT'))

stripe.api_key = app.config['STRIPE_SECRET_KEY']


class QuiltCli(httpagentparser.Browser):
    look_for = 'quilt-cli'
    version_markers = [('/', '')]

httpagentparser.detectorshub.register(QuiltCli())


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
        return render_template('oauth_success.html',
                               code=resp['refresh_token'],
                               QUILT_CDN=QUILT_CDN)
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
    def __init__(self, owner, package, logged_in=True):
        message = "Package %s/%s does not exist" % (owner, package)
        if not logged_in:
            message = "%s (do you need to log in?)" % message
        super().__init__(requests.codes.not_found, message)

@app.errorhandler(ApiException)
def handle_api_exception(error):
    """
    Converts an API exception into an error response.
    """
    _mp_track(
        type="exception",
        status_code=error.status_code,
        message=error.message,
    )

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
            g.user = PUBLIC
            user_agent_str = request.headers.get('user-agent', '')
            g.user_agent = httpagentparser.detect(user_agent_str, fill_none=True)

            if validator is not None:
                try:
                    validator.validate(request.get_json(cache=True))
                except ValidationError as ex:
                    raise ApiException(requests.codes.bad_request, ex.message)

            auth = request.headers.get(AUTHORIZATION_HEADER)

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
                    g.user = data['current_user']
                    g.email = data['email']
                elif resp.status_code == requests.codes.unauthorized:
                    raise ApiException(
                        requests.codes.unauthorized,
                        "Invalid credentials"
                    )
                else:
                    raise ApiException(requests.codes.server_error, "Server error")
            return f(g.user, *args, **kwargs)
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
        raise PackageNotFoundException(owner, package_name, auth_user is not PUBLIC)
    return package

def _utc_datetime_to_ts(dt):
    """
    Convert a UTC datetime object to a UNIX timestamp.
    """
    return dt.replace(tzinfo=timezone.utc).timestamp()

def _mp_track(**kwargs):
    if g.user_agent['browser']['name'] == 'QuiltCli':
        source = 'cli'
    else:
        source = 'web'

    # Try to get the ELB's forwarded IP, and fall back to the actual IP (in dev).
    ip_addr = request.headers.get('x-forwarded-for', request.remote_addr)

    # Set common attributes sent with each event. They can be overridden by `args`.
    all_args = dict(
        time=time.time(),
        ip=ip_addr,
        user=g.user,
        source=source,
        browser_name=g.user_agent['browser']['name'],
        browser_version=g.user_agent['browser']['version'],
        platform_name=g.user_agent['platform']['name'],
        platform_version=g.user_agent['platform']['version'],
    )
    all_args.update(kwargs)

    mp.track(g.user, MIXPANEL_EVENT, all_args)

def _generate_presigned_url(method, owner, blob_hash):
    return s3_client.generate_presigned_url(
        method,
        Params=dict(
            Bucket=PACKAGE_BUCKET_NAME,
            Key='%s/%s/%s' % (OBJ_DIR, owner, blob_hash)
        ),
        ExpiresIn=PACKAGE_URL_EXPIRATION
    )

@app.route('/api/blob/<owner>/<blob_hash>', methods=['GET'])
@api()
@as_json
def blob_get(auth_user, owner, blob_hash):
    if auth_user != owner:
        raise ApiException(requests.codes.forbidden,
                           "Only the owner can upload objects.")
    return dict(
        head=_generate_presigned_url(S3_HEAD_OBJECT, owner, blob_hash),
        get=_generate_presigned_url(S3_GET_OBJECT, owner, blob_hash),
        put=_generate_presigned_url(S3_PUT_OBJECT, owner, blob_hash),
    )

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
    dry_run = data.get('dry_run', False)
    public = data.get('public', False)
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

        if public:
            public_access = Access(package=package, user=PUBLIC)
            db.session.add(public_access)
    else:
        if public:
            public_access = (
                Access.query
                .filter(sa.and_(
                    Access.package == package,
                    Access.user == PUBLIC
                ))
                .one_or_none()
            )
            if public_access is None:
                raise ApiException(
                    requests.codes.forbidden,
                    ("%(user)s/%(pkg)s is private. To make it public, " +
                     "run `quilt access add %(user)s/%(pkg)s public`.") %
                    dict(user=owner, pkg=package_name)
                )

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

    # TODO: Stop returning upload URLs once all clients are upgraded to 2.4.2.
    upload_urls = {
        blob_hash: _generate_presigned_url(S3_PUT_OBJECT, owner, blob_hash)
        for blob_hash in all_hashes
    }

    if not dry_run:
        db.session.commit()

    _mp_track(
        type="push",
        package_owner=owner,
        package_name=package_name,
        public=public,
        dry_run=dry_run,
    )

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

    try:
        browser = g.user_agent['browser']
        if (isinstance(contents, RootNode) and contents.format is None
                and browser['name'] == 'QuiltCli' and
                PackagingVersion(browser['version']) <= PackagingVersion('2.4.1')):
            # New package format that requires Quilt CLI newer than 2.4.1.
            raise ApiException(
                requests.codes.server_error,
                "Run 'pip install quilt --upgrade' to install this package."
            )
    except ValueError:
        # Invalid version number? Ignore it.
        pass

    all_hashes = set(find_object_hashes(contents))

    urls = {
        blob_hash: _generate_presigned_url(S3_GET_OBJECT, owner, blob_hash)
        for blob_hash in all_hashes
    }

    _mp_track(
        type="install",
        package_owner=owner,
        package_name=package_name,
    )

    return dict(
        contents=contents,
        urls=urls,
        created_by=instance.created_by,
        created_at=_utc_datetime_to_ts(instance.created_at),
        updated_by=instance.updated_by,
        updated_at=_utc_datetime_to_ts(instance.updated_at),
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
        db.session.query(Package, sa.func.max(Access.user == PUBLIC))
        .filter_by(owner=owner)
        .join(Package.access)
        .filter(Access.user.in_([auth_user, PUBLIC]))
        .group_by(Package.id)
        .order_by(Package.name)
        .all()
    )

    return dict(
        packages=[
            dict(
                name=package.name,
                is_public=is_public
            )
            for package, is_public in packages
        ]
    )

@app.route('/api/log/<owner>/<package_name>/', methods=['GET'])
@api(require_login=False)
@as_json
def logs_list(auth_user, owner, package_name):
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
            created=_utc_datetime_to_ts(log.created),
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
    package = _get_package(auth_user, owner, package_name)

    instance = (
        Instance.query
        .join(Instance.versions)
        .filter_by(package=package, version=package_version)
        .one_or_none()
    )

    if instance is None:
        raise ApiException(
            requests.codes.not_found,
            "Version %s does not exist" % package_version
        )

    _mp_track(
        type="get_hash",
        package_owner=owner,
        package_name=package_name,
        package_version=package_version,
    )

    return dict(
        hash=instance.hash,
        created_by=instance.created_by,
        created_at=_utc_datetime_to_ts(instance.created_at),
        updated_by=instance.updated_by,
        updated_at=_utc_datetime_to_ts(instance.updated_at),
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

    sorted_versions = sorted(versions, key=lambda row: row.Version.sort_key())

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
    package = _get_package(auth_user, owner, package_name)

    instance = (
        Instance.query
        .join(Instance.tags)
        .filter_by(package=package, tag=package_tag)
        .one_or_none()
    )

    if instance is None:
        raise ApiException(
            requests.codes.not_found,
            "Tag %r does not exist" % package_tag
        )

    _mp_track(
        type="get_hash",
        package_owner=owner,
        package_name=package_name,
        package_tag=package_tag,
    )

    return dict(
        hash=instance.hash,
        created_by=instance.created_by,
        created_at=_utc_datetime_to_ts(instance.created_at),
        updated_by=instance.updated_by,
        updated_at=_utc_datetime_to_ts(instance.updated_at),
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
    # TODO: use re to check for valid username (e.g., not ../, etc.)
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
        resp = requests.get(OAUTH_BASE_URL + '/profiles/%s' % user)
        if resp.status_code == requests.codes.not_found:
            raise ApiException(
                requests.codes.not_found,
                "User %s does not exist" % user
                )
        elif resp.status_code != requests.codes.ok:
            print("{code}: {reason}".format(code=resp.status_code, reason=resp.reason))
            raise ApiException(
                requests.codes.server_error,
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

@app.route('/api/all_packages/', methods=['GET'])
@api(require_login=False)
@as_json
def all_packages(auth_user):
    """DEPRECATED; use /api/profile"""
    results = (
        db.session.query(Package, Access)
        .join(Package.access)
        .filter(Access.user.in_([auth_user, PUBLIC]))
        .all()
    )

    # Use sets to dedupe own+public and shared+public.

    own_packages = set()
    shared_packages = set()
    public_packages = set()

    for package, access in results:
        if package.owner == auth_user:
            own_packages.add(package)

        if access.user == auth_user:
            shared_packages.add(package)
        elif access.user == PUBLIC:
            public_packages.add(package)
        else:
            assert False

    def _to_json(packages):
        return [
            dict(
                owner=package.owner,
                name=package.name,
                is_public=package in public_packages
            ) for package in sorted(packages, key=Package.sort_key)
        ]

    return dict(
        own=_to_json(own_packages),
        shared=_to_json(shared_packages - own_packages),
        public=_to_json(public_packages - shared_packages - own_packages),
    )

@app.route('/api/recent_packages/', methods=['GET'])
@api(require_login=False)
@as_json
def recent_packages(auth_user):
    try:
        count = int(request.args.get('count', ''))
    except ValueError:
        count = 10

    results = (
        db.session.query(Package, sa.func.max(Instance.updated_at))
        .join(Package.access)
        .filter_by(user=PUBLIC)
        .join(Package.instances)
        .group_by(Package.id)
        .order_by(sa.func.max(Instance.updated_at).desc())
        .limit(count)
        .all()
    )

    return dict(
        packages=[
            dict(
                owner=package.owner,
                name=package.name,
                updated_at=updated_at
            ) for package, updated_at in results
        ]
    )

@app.route('/api/search/', methods=['GET'])
@api(require_login=False)
@as_json
def search(auth_user):
    query = request.args.get('q', '')
    keywords = query.split()

    if len(keywords) > 5:
        # Let's not overload the DB with crazy queries.
        raise ApiException(requests.codes.bad_request, "Too many search terms (max is 5)")

    filter_list = [
        sa.func.instr(sa.func.concat(Package.owner, '/', Package.name), keyword) > 0
        for keyword in keywords
    ]

    results = (
        db.session.query(Package, sa.func.max(Access.user == PUBLIC))
        .filter(sa.and_(*filter_list))
        .join(Package.access)
        .filter(Access.user.in_([auth_user, PUBLIC]))
        .group_by(Package.id)
        .order_by(Package.owner, Package.name)
        .all()
    )

    return dict(
        packages=[
            dict(
                owner=package.owner,
                name=package.name,
                is_public=is_public,
            ) for package, is_public in results
        ]
    )

def _get_or_create_customer():
    db_customer = Customer.query.filter_by(id=g.user).one_or_none()

    if db_customer is None:
        plan = PaymentPlan.FREE.value
        customer = stripe.Customer.create(
            email=g.email,
            description=g.user,
        )
        stripe.Subscription.create(
            customer=customer.id,
            plan=plan,
        )
        db_customer = Customer(
            id=g.user,
            stripe_customer_id=customer.id,
        )
        db.session.add(db_customer)
        db.session.commit()

    customer = stripe.Customer.retrieve(db_customer.stripe_customer_id)
    assert customer.subscriptions.total_count == 1
    return customer

@app.route('/api/profile', methods=['GET'])
@api()
@as_json
def profile(auth_user):
    customer = _get_or_create_customer()
    subscription = customer.subscriptions.data[0]

    public_access = sa.orm.aliased(Access)

    packages = (
        db.session.query(Package, public_access.user.isnot(None))
        .join(Package.access)
        .filter(Access.user == auth_user)
        .outerjoin(public_access, sa.and_(
            Package.id == public_access.package_id, public_access.user == PUBLIC))
        .order_by(Package.owner, Package.name)
        .all()
    )

    return dict(
        packages=dict(
            own=[
                dict(
                    owner=package.owner,
                    name=package.name,
                    is_public=bool(is_public)
                )
                for package, is_public in packages if package.owner == auth_user
            ],
            shared=[
                dict(
                    owner=package.owner,
                    name=package.name,
                    is_public=bool(is_public)
                )
                for package, is_public in packages if package.owner != auth_user
            ],
        ),
        plan=subscription.plan.id,
        have_credit_card=customer.sources.total_count > 0,
    )

@app.route('/api/payments/update_plan', methods=['POST'])
@api()
@as_json
def payments_update_plan(auth_user):
    plan = request.values.get('plan')
    try:
        plan = PaymentPlan(plan)
    except ValueError:
        raise ApiException(requests.codes.bad_request, "Invalid plan: %r" % plan)

    stripe_token = request.values.get('token')

    customer = _get_or_create_customer()

    if stripe_token is not None:
        customer.source = stripe_token

        try:
            customer.save()
        except stripe.InvalidRequestError as ex:
            raise ApiException(requests.codes.bad_request, str(ex))

        assert customer.sources.total_count

    if plan != PaymentPlan.FREE and not customer.sources.total_count:
        # No payment info.
        raise ApiException(
            requests.codes.payment_required,
            "Payment information required to upgrade to %r" % plan.value
        )

    subscription = customer.subscriptions.data[0]

    subscription.plan = plan.value
    try:
        subscription.save()
    except stripe.InvalidRequestError as ex:
        raise ApiException(requests.codes.server_error, str(ex))

    return dict(
        plan=plan.value
    )

@app.route('/api/payments/update_payment', methods=['POST'])
@api()
@as_json
def payments_update_payment(auth_user):
    stripe_token = request.values.get('token')
    if not stripe_token:
        raise ApiException(requests.codes.bad_request, "Missing token")

    customer = _get_or_create_customer()
    customer.source = stripe_token

    try:
        customer.save()
    except stripe.InvalidRequestError as ex:
        raise ApiException(requests.codes.bad_request, str(ex))

    return dict()
