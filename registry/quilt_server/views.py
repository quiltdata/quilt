# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
API routes.
"""

from datetime import timedelta, timezone
from functools import wraps
import json
import time
from urllib.parse import urlencode

import boto3
from flask import abort, g, redirect, render_template, request, Response
from flask_cors import CORS
from flask_json import as_json, jsonify
import httpagentparser
from jsonschema import Draft4Validator, ValidationError
from oauthlib.oauth2 import OAuth2Error
import requests
from requests_oauthlib import OAuth2Session
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import undefer
import stripe

from . import app, db
from .analytics import MIXPANEL_EVENT, mp
from .const import EMAILREGEX, PaymentPlan, PUBLIC
from .core import decode_node, encode_node, find_object_hashes, hash_contents, FileNode, GroupNode
from .models import (Access, Customer, Instance, Invitation, Log, Package,
                     S3Blob, Tag, UTF8_GENERAL_CI, Version)
from .schemas import LOG_SCHEMA, PACKAGE_SCHEMA
from .config import BAN_PUBLIC_USERS

QUILT_CDN = 'https://cdn.quiltdata.com/'

DEPLOYMENT_ID = app.config['DEPLOYMENT_ID']

OAUTH_ACCESS_TOKEN_URL = app.config['OAUTH']['access_token_url']
OAUTH_AUTHORIZE_URL = app.config['OAUTH']['authorize_url']
OAUTH_CLIENT_ID = app.config['OAUTH']['client_id']
OAUTH_CLIENT_SECRET = app.config['OAUTH']['client_secret']
OAUTH_REDIRECT_URL = app.config['OAUTH']['redirect_url']

OAUTH_USER_API = app.config['OAUTH']['user_api']
OAUTH_PROFILE_API = app.config['OAUTH']['profile_api']
OAUTH_HAVE_REFRESH_TOKEN = app.config['OAUTH']['have_refresh_token']

CATALOG_REDIRECT_URLS = app.config['CATALOG_REDIRECT_URLS']

AUTHORIZATION_HEADER = 'Authorization'

INVITE_SEND_URL = app.config['INVITE_SEND_URL']

PACKAGE_BUCKET_NAME = app.config['PACKAGE_BUCKET_NAME']
PACKAGE_URL_EXPIRATION = app.config['PACKAGE_URL_EXPIRATION']

S3_HEAD_OBJECT = 'head_object'
S3_GET_OBJECT = 'get_object'
S3_PUT_OBJECT = 'put_object'

OBJ_DIR = 'objs'

# Limit the JSON metadata to 100MB.
# This is mostly a sanity check; it's already limited by app.config['MAX_CONTENT_LENGTH'].
MAX_METADATA_SIZE = 100 * 1024 * 1024

PREVIEW_MAX_CHILDREN = 10
PREVIEW_MAX_DEPTH = 4

s3_client = boto3.client(
    's3',
    endpoint_url=app.config.get('S3_ENDPOINT'),
    aws_access_key_id=app.config.get('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=app.config.get('AWS_SECRET_ACCESS_KEY')
)

stripe.api_key = app.config['STRIPE_SECRET_KEY']
HAVE_PAYMENTS = stripe.api_key is not None


class QuiltCli(httpagentparser.Browser):
    look_for = 'quilt-cli'
    version_markers = [('/', '')]

httpagentparser.detectorshub.register(QuiltCli())


### Web routes ###

def _create_session(next=''):
    return OAuth2Session(
        client_id=OAUTH_CLIENT_ID,
        redirect_uri=OAUTH_REDIRECT_URL,
        state=json.dumps(dict(next=next))
    )

@app.route('/healthcheck')
def healthcheck():
    """ELB health check; just needs to return a 200 status code."""
    return Response("ok", content_type='text/plain')

ROBOTS_TXT = '''
User-agent: *
Disallow: /
'''.lstrip()

@app.route('/robots.txt')
def robots():
    """Disallow crawlers; there's nothing useful for them here."""
    return Response(ROBOTS_TXT, mimetype='text/plain')

def _valid_catalog_redirect(next):
    return next is None or any(next.startswith(url) for url in CATALOG_REDIRECT_URLS)

@app.route('/login')
def login():
    next = request.args.get('next')

    if not _valid_catalog_redirect(next):
        return render_template('oauth_fail.html', error="Invalid redirect", QUILT_CDN=QUILT_CDN)

    session = _create_session(next=next)
    url, state = session.authorization_url(url=OAUTH_AUTHORIZE_URL)

    return redirect(url)

@app.route('/oauth_callback')
def oauth_callback():
    # TODO: Check `state`? Do we need CSRF protection here?

    try:
        state = json.loads(request.args.get('state', '{}'))
    except ValueError:
        abort(requests.codes.bad_request)

    if not isinstance(state, dict):
        abort(requests.codes.bad_request)

    next = state.get('next')
    if not _valid_catalog_redirect(next):
        abort(requests.codes.bad_request)

    error = request.args.get('error')
    if error is not None:
        return render_template('oauth_fail.html', error=error, QUILT_CDN=QUILT_CDN)

    code = request.args.get('code')
    if code is None:
        abort(requests.codes.bad_request)

    session = _create_session()
    try:
        resp = session.fetch_token(
            token_url=OAUTH_ACCESS_TOKEN_URL,
            code=code,
            client_secret=OAUTH_CLIENT_SECRET
        )
        if next:
            return redirect('%s#%s' % (next, urlencode(resp)))
        else:
            token = resp['refresh_token' if OAUTH_HAVE_REFRESH_TOKEN else 'access_token']
            return render_template('oauth_success.html', code=token, QUILT_CDN=QUILT_CDN)
    except OAuth2Error as ex:
        return render_template('oauth_fail.html', error=ex.error, QUILT_CDN=QUILT_CDN)

@app.route('/api/token', methods=['POST'])
@as_json
def token():
    refresh_token = request.values.get('refresh_token')
    if refresh_token is None:
        abort(requests.codes.bad_request)

    if not OAUTH_HAVE_REFRESH_TOKEN:
        return dict(
            refresh_token='',
            access_token=refresh_token,
            expires_at=float('inf')
        )

    session = _create_session()

    try:
        resp = session.refresh_token(
            token_url=OAUTH_ACCESS_TOKEN_URL,
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


class Auth:
    """
    Info about the user making the API request.
    """
    def __init__(self, user, email):
        self.user = user
        self.email = email


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
            g.auth = Auth(PUBLIC, None)

            user_agent_str = request.headers.get('user-agent', '')
            g.user_agent = httpagentparser.detect(user_agent_str, fill_none=True)

            if validator is not None:
                try:
                    validator.validate(request.get_json(cache=True))
                except ValidationError as ex:
                    raise ApiException(requests.codes.bad_request, ex.message)

            auth = request.headers.get(AUTHORIZATION_HEADER)
            g.auth_header = auth
            if auth is None:
                if require_login:
                    raise ApiException(requests.codes.unauthorized, "Not logged in")
            else:
                headers = {
                    AUTHORIZATION_HEADER: auth
                }
                try:
                    resp = requests.get(OAUTH_USER_API, headers=headers)
                    resp.raise_for_status()

                    data = resp.json()
                    # TODO(dima): Generalize this.
                    user = data.get('current_user', data.get('login'))
                    assert user
                    email = data['email']

                    g.auth = Auth(user, email)
                except requests.HTTPError as ex:
                    if resp.status_code == requests.codes.unauthorized:
                        raise ApiException(
                            requests.codes.unauthorized,
                            "Invalid credentials"
                        )
                    else:
                        raise ApiException(requests.codes.server_error, "Server error")
                except (ConnectionError, requests.RequestException) as ex:
                    raise ApiException(requests.codes.server_error, "Server error")
            return f(*args, **kwargs)
        return wrapper
    return innerdec

def _get_package(auth, owner, package_name):
    """
    Helper for looking up a package and checking permissions.
    Only useful for *_list functions; all others should use more efficient queries.
    """
    package = (
        Package.query
        .filter_by(owner=owner, name=package_name)
        .join(Package.access)
        .filter(Access.user.in_([auth.user, PUBLIC]))
        .one_or_none()
    )
    if package is None:
        raise PackageNotFoundException(owner, package_name, auth.user is not PUBLIC)
    return package

def _get_instance(auth, owner, package_name, package_hash):
    instance = (
        Instance.query
        .filter_by(hash=package_hash)
        .options(undefer('contents'))  # Contents is deferred by default.
        .join(Instance.package)
        .filter_by(owner=owner, name=package_name)
        .join(Package.access)
        .filter(Access.user.in_([auth.user, PUBLIC]))
        .one_or_none()
    )
    if instance is None:
        raise ApiException(
            requests.codes.not_found,
            "Package hash does not exist"
        )
    return instance

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

    # Use the user ID if the user is logged in; otherwise, let MP use the IP address.
    distinct_id = g.auth.user if g.auth.user != PUBLIC else None

    # Try to get the ELB's forwarded IP, and fall back to the actual IP (in dev).
    ip_addr = request.headers.get('x-forwarded-for', request.remote_addr)

    # Set common attributes sent with each event. kwargs cannot override these.
    all_args = dict(
        kwargs,
        time=time.time(),
        ip=ip_addr,
        user=g.auth.user,
        source=source,
        browser_name=g.user_agent['browser']['name'],
        browser_version=g.user_agent['browser']['version'],
        platform_name=g.user_agent['platform']['name'],
        platform_version=g.user_agent['platform']['version'],
        deployment_id=DEPLOYMENT_ID,
    )

    mp.track(distinct_id, MIXPANEL_EVENT, all_args)

def _generate_presigned_url(method, owner, blob_hash):
    return s3_client.generate_presigned_url(
        method,
        Params=dict(
            Bucket=PACKAGE_BUCKET_NAME,
            Key='%s/%s/%s' % (OBJ_DIR, owner, blob_hash)
        ),
        ExpiresIn=PACKAGE_URL_EXPIRATION
    )

def _get_or_create_customer():
    assert HAVE_PAYMENTS, "Payments are not enabled"
    assert g.auth.user != PUBLIC

    db_customer = Customer.query.filter_by(id=g.auth.user).one_or_none()

    if db_customer is None:
        try:
            # Insert a placeholder with no Stripe ID just to lock the row.
            db_customer = Customer(id=g.auth.user)
            db.session.add(db_customer)
            db.session.flush()
        except IntegrityError:
            # Someone else just created it, so look it up.
            db.session.rollback()
            db_customer = Customer.query.filter_by(id=g.auth.user).one()
        else:
            # Create a new customer.
            plan = PaymentPlan.FREE.value
            customer = stripe.Customer.create(
                email=g.auth.email,
                description=g.auth.user,
            )
            stripe.Subscription.create(
                customer=customer.id,
                plan=plan,
            )

            db_customer.stripe_customer_id = customer.id
            db.session.commit()

    customer = stripe.Customer.retrieve(db_customer.stripe_customer_id)
    assert customer.subscriptions.total_count == 1
    return customer

def _get_customer_plan(customer):
    return PaymentPlan(customer.subscriptions.data[0].plan.id)

@app.route('/api/blob/<owner>/<blob_hash>', methods=['GET'])
@api()
@as_json
def blob_get(owner, blob_hash):
    if g.auth.user != owner:
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
def package_put(owner, package_name, package_hash):
    # TODO: Write access for collaborators.
    if g.auth.user != owner:
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

        if HAVE_PAYMENTS and not public:
            customer = _get_or_create_customer()
            plan = _get_customer_plan(customer)
            if plan == PaymentPlan.FREE:
                raise ApiException(
                    requests.codes.payment_required,
                    ("Insufficient permissions. Run `quilt push --public %s/%s` to make " +
                     "this package public, or upgrade your service plan to create " +
                     "private packages: https://quiltdata.com/profile.") %
                    (owner, package_name)
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

    if len(contents_str) > MAX_METADATA_SIZE:
        # Should never actually happen because of nginx limits.
        raise ApiException(
            requests.codes.server_error,
            "Metadata size too large"
        )

    # No more error checking at this point, so return from dry-run early.
    if dry_run:
        db.session.rollback()

        # List of signed URLs is potentially huge, so stream it.

        def _generate():
            yield '{"upload_urls":{'
            for idx, blob_hash in enumerate(all_hashes):
                comma = ('' if idx == 0 else ',')
                value = dict(
                    head=_generate_presigned_url(S3_HEAD_OBJECT, owner, blob_hash),
                    put=_generate_presigned_url(S3_PUT_OBJECT, owner, blob_hash)
                )
                yield '%s%s:%s' % (comma, json.dumps(blob_hash), json.dumps(value))
            yield '}}'

        return Response(_generate(), content_type='application/json')

    if instance is None:
        instance = Instance(
            package=package,
            contents=contents_str,
            hash=package_hash,
            created_by=g.auth.user,
            updated_by=g.auth.user
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
        ) if all_hashes else []

        existing_hashes = {blob.hash for blob in blobs}

        for blob_hash in all_hashes:
            if blob_hash not in existing_hashes:
                instance.blobs.append(S3Blob(owner=owner, hash=blob_hash))
    else:
        # Just update the contents dictionary.
        # Nothing else could've changed without invalidating the hash.
        instance.contents = contents_str
        instance.updated_by = g.auth.user

    db.session.add(instance)

    # Insert a log.
    log = Log(
        package=package,
        instance=instance,
        author=owner,
    )
    db.session.add(log)

    db.session.commit()

    _mp_track(
        type="push",
        package_owner=owner,
        package_name=package_name,
        public=public,
    )

    return dict()

@app.route('/api/package/<owner>/<package_name>/<package_hash>', methods=['GET'])
@api(require_login=BAN_PUBLIC_USERS)
@as_json
def package_get(owner, package_name, package_hash):
    subpath = request.args.get('subpath')

    instance = _get_instance(g.auth, owner, package_name, package_hash)
    contents = json.loads(instance.contents, object_hook=decode_node)

    subnode = contents
    for component in subpath.split('/') if subpath else []:
        try:
            subnode = subnode.children[component]
        except (AttributeError, KeyError):
            raise ApiException(requests.codes.not_found, "Invalid subpath: %r" % component)

    all_hashes = set(find_object_hashes(subnode))

    urls = {
        blob_hash: _generate_presigned_url(S3_GET_OBJECT, owner, blob_hash)
        for blob_hash in all_hashes
    }

    _mp_track(
        type="install",
        package_owner=owner,
        package_name=package_name,
        subpath=subpath,
    )

    return dict(
        contents=contents,
        urls=urls,
        created_by=instance.created_by,
        created_at=_utc_datetime_to_ts(instance.created_at),
        updated_by=instance.updated_by,
        updated_at=_utc_datetime_to_ts(instance.updated_at),
    )

def _generate_preview(node, max_depth=PREVIEW_MAX_DEPTH):
    if isinstance(node, GroupNode):
        max_children = PREVIEW_MAX_CHILDREN if max_depth else 0
        children_preview = [
            (name, _generate_preview(child, max_depth - 1))
            for name, child in sorted(node.children.items())[:max_children]
        ]
        if len(node.children) > max_children:
            children_preview.append(('...', None))
        return children_preview
    else:
        return None

@app.route('/api/package_preview/<owner>/<package_name>/<package_hash>', methods=['GET'])
@api(require_login=BAN_PUBLIC_USERS)
@as_json
def package_preview(owner, package_name, package_hash):
    instance = _get_instance(g.auth, owner, package_name, package_hash)
    contents = json.loads(instance.contents, object_hook=decode_node)

    readme = contents.children.get('README')
    if isinstance(readme, FileNode):
        assert len(readme.hashes) == 1
        readme_url = _generate_presigned_url(S3_GET_OBJECT, owner, readme.hashes[0])
    else:
        readme_url = None

    contents_preview = _generate_preview(contents)

    _mp_track(
        type="preview",
        package_owner=owner,
        package_name=package_name,
    )

    return dict(
        preview=contents_preview,
        readme_url=readme_url,
        created_by=instance.created_by,
        created_at=_utc_datetime_to_ts(instance.created_at),
        updated_by=instance.updated_by,
        updated_at=_utc_datetime_to_ts(instance.updated_at),
    )

@app.route('/api/package/<owner>/<package_name>/', methods=['GET'])
@api(require_login=BAN_PUBLIC_USERS)
@as_json
def package_list(owner, package_name):
    package = _get_package(g.auth, owner, package_name)
    instances = (
        Instance.query
        .filter_by(package=package)
    )

    return dict(
        hashes=[instance.hash for instance in instances]
    )

@app.route('/api/package/<owner>/<package_name>/', methods=['DELETE'])
@api()
@as_json
def package_delete(owner, package_name):
    if g.auth.user != owner:
        raise ApiException(requests.codes.forbidden,
                           "Only the package owner can delete packages.")

    package = _get_package(g.auth, owner, package_name)

    db.session.delete(package)
    db.session.commit()

    return dict()

@app.route('/api/package/<owner>/', methods=['GET'])
@api(require_login=BAN_PUBLIC_USERS)
@as_json
def user_packages(owner):
    packages = (
        db.session.query(Package, sa.func.max(Access.user == PUBLIC))
        .filter_by(owner=owner)
        .join(Package.access)
        .filter(Access.user.in_([g.auth.user, PUBLIC]))
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
@api(require_login=BAN_PUBLIC_USERS)
@as_json
def logs_list(owner, package_name):
    package = _get_package(g.auth, owner, package_name)

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
def version_put(owner, package_name, package_version):
    # TODO: Write access for collaborators.
    if g.auth.user != owner:
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
@api(require_login=BAN_PUBLIC_USERS)
@as_json
def version_get(owner, package_name, package_version):
    package_version = normalize_version(package_version)
    package = _get_package(g.auth, owner, package_name)

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
@api(require_login=BAN_PUBLIC_USERS)
@as_json
def version_list(owner, package_name):
    package = _get_package(g.auth, owner, package_name)

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
def tag_put(owner, package_name, package_tag):
    # TODO: Write access for collaborators.
    if g.auth.user != owner:
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
@api(require_login=BAN_PUBLIC_USERS)
@as_json
def tag_get(owner, package_name, package_tag):
    package = _get_package(g.auth, owner, package_name)

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
def tag_delete(owner, package_name, package_tag):
    # TODO: Write access for collaborators.
    if g.auth.user != owner:
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
@api(require_login=BAN_PUBLIC_USERS)
@as_json
def tag_list(owner, package_name):
    package = _get_package(g.auth, owner, package_name)

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
def access_put(owner, package_name, user):
    # TODO: use re to check for valid username (e.g., not ../, etc.)
    if not user:
        raise ApiException(requests.codes.bad_request, "A valid user is required")

    if g.auth.user != owner:
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

    if EMAILREGEX.match(user):
        email = user
        invitation = Invitation(package=package, email=email)
        db.session.add(invitation)
        db.session.commit()

        # Call to Django to send invitation email
        headers = {
            AUTHORIZATION_HEADER: g.auth_header
            }
        resp = requests.post(INVITE_SEND_URL,
                             headers=headers,
                             data=dict(email=email,
                                       owner=g.auth.user,
                                       package=package.name,
                                       client_id=OAUTH_CLIENT_ID,
                                       client_secret=OAUTH_CLIENT_SECRET,
                                       callback_url=OAUTH_REDIRECT_URL))

        if resp.status_code == requests.codes.unauthorized:
            raise ApiException(
                requests.codes.unauthorized,
                "Invalid credentials"
                )
        elif resp.status_code != requests.codes.ok:
            raise ApiException(requests.codes.server_error, "Server error")
        return dict()

    else:
        if user != PUBLIC:
            resp = requests.get(OAUTH_PROFILE_API % user)
            if resp.status_code == requests.codes.not_found:
                raise ApiException(
                    requests.codes.not_found,
                    "User %s does not exist" % user
                    )
            elif resp.status_code != requests.codes.ok:
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
def access_get(owner, package_name, user):
    if g.auth.user != owner:
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
def access_delete(owner, package_name, user):
    if g.auth.user != owner:
        raise ApiException(
            requests.codes.forbidden,
            "Only the package owner can revoke access"
        )

    if user == owner:
        raise ApiException(
            requests.codes.forbidden,
            "Cannot revoke the owner's access"
        )

    if HAVE_PAYMENTS and user == PUBLIC:
        customer = _get_or_create_customer()
        plan = _get_customer_plan(customer)
        if plan == PaymentPlan.FREE:
            raise ApiException(
                requests.codes.payment_required,
                "Insufficient permissions. " +
                "Upgrade your plan to create private packages: https://quiltdata.com/profile."
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
def access_list(owner, package_name):
    accesses = (
        Access.query
        .join(Access.package)
        .filter_by(owner=owner, name=package_name)
    )

    can_access = [access.user for access in accesses]
    is_collaborator = g.auth.user in can_access
    is_public = PUBLIC in can_access

    if is_public or is_collaborator:
        return dict(users=can_access)
    else:
        raise PackageNotFoundException(owner, package_name)

@app.route('/api/recent_packages/', methods=['GET'])
@api(require_login=BAN_PUBLIC_USERS)
@as_json
def recent_packages():
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
@api(require_login=BAN_PUBLIC_USERS)
@as_json
def search():
    query = request.args.get('q', '')
    keywords = query.split()

    if len(keywords) > 5:
        # Let's not overload the DB with crazy queries.
        raise ApiException(requests.codes.bad_request, "Too many search terms (max is 5)")

    filter_list = [
        sa.func.instr(
            sa.sql.collate(sa.func.concat(Package.owner, '/', Package.name), UTF8_GENERAL_CI),
            keyword
        ) > 0
        for keyword in keywords
    ]

    results = (
        db.session.query(Package, sa.func.max(Access.user == PUBLIC))
        .filter(sa.and_(*filter_list))
        .join(Package.access)
        .filter(Access.user.in_([g.auth.user, PUBLIC]))
        .group_by(Package.id)
        .order_by(
            sa.sql.collate(Package.owner, UTF8_GENERAL_CI),
            sa.sql.collate(Package.name, UTF8_GENERAL_CI)
        )
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

@app.route('/api/profile', methods=['GET'])
@api()
@as_json
def profile():
    if HAVE_PAYMENTS:
        customer = _get_or_create_customer()
        plan = _get_customer_plan(customer).value
        have_cc = customer.sources.total_count > 0
    else:
        plan = None
        have_cc = None

    public_access = sa.orm.aliased(Access)

    # Check for outstanding package sharing invitations
    invitations = (
        db.session.query(Invitation, Package)
        .filter_by(email=g.auth.email)
        .join(Invitation.package)
        )
    for invitation, package in invitations:
        access = Access(package=package, user=g.auth.user)
        db.session.add(access)
        db.session.delete(invitation)

    if invitations:
        db.session.commit()

    packages = (
        db.session.query(Package, public_access.user.isnot(None))
        .join(Package.access)
        .filter(Access.user == g.auth.user)
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
                for package, is_public in packages if package.owner == g.auth.user
            ],
            shared=[
                dict(
                    owner=package.owner,
                    name=package.name,
                    is_public=bool(is_public)
                )
                for package, is_public in packages if package.owner != g.auth.user
            ],
        ),
        plan=plan,
        have_credit_card=have_cc,
    )

@app.route('/api/payments/update_plan', methods=['POST'])
@api()
@as_json
def payments_update_plan():
    if not HAVE_PAYMENTS:
        raise ApiException(requests.codes.not_found, "Payments not enabled")

    plan = request.values.get('plan')
    try:
        plan = PaymentPlan(plan)
    except ValueError:
        raise ApiException(requests.codes.bad_request, "Invalid plan: %r" % plan)

    if plan not in (PaymentPlan.FREE, PaymentPlan.INDIVIDUAL, PaymentPlan.BUSINESS_ADMIN):
        # Cannot switch to the BUSINESS_MEMBER plan manually.
        raise ApiException(requests.codes.forbidden, "Not allowed to switch to plan: %r" % plan)

    stripe_token = request.values.get('token')

    customer = _get_or_create_customer()

    if _get_customer_plan(customer) == PaymentPlan.BUSINESS_MEMBER:
        raise ApiException(
            requests.codes.forbidden,
            "Not allowed to leave Business plan; contact your admin."
        )

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
def payments_update_payment():
    if not HAVE_PAYMENTS:
        raise ApiException(requests.codes.not_found, "Payments not enabled")

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

@app.route('/api/invite/', methods=['GET'])
@api(require_login=BAN_PUBLIC_USERS)
@as_json
def invitation_user_list():
    invitations = (
        db.session.query(Invitation, Package)
        .filter_by(email=g.auth.email)
        .join(Invitation.package)
        .all()
    )
    return dict(invitations=[dict(invitation_id=invite.id,
                                  owner=package.owner,
                                  package=package.name,
                                  email=invite.email,
                                  invited_at=invite.invited_at)
                             for invite, package in invitations])

@app.route('/api/invite/<owner>/<package_name>/', methods=['GET'])
@api()
@as_json
def invitation_package_list(owner, package_name):
    package = _get_package(g.auth, owner, package_name)
    invitations = (
        Invitation.query
        .filter_by(package_id=package.id)
    )

    return dict(invitations=[dict(invitation_id=invite.id,
                                  owner=package.owner,
                                  package=package.name,
                                  email=invite.email,
                                  invited_at=invite.invited_at)
                             for invite in invitations])

@app.route('/api/log', methods=['POST'])
@api(require_login=BAN_PUBLIC_USERS, schema=LOG_SCHEMA)
@as_json
def client_log():
    data = request.get_json()
    for event in data:
        _mp_track(**event)

    return dict()
