# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
API routes.

NOTE: By default, SQLAlchemy expires all objects when the transaction is committed:
http://docs.sqlalchemy.org/en/latest/orm/session_api.html#sqlalchemy.orm.session.Session.commit

We disable this behavior because it can cause unexpected queries with
major performance implications. See `expire_on_commit=False` in `__init__.py`.
"""

import calendar
from collections import defaultdict
from datetime import datetime, timedelta
from functools import wraps
import gzip
import json
import pathlib
import time

import boto3
from botocore.exceptions import ClientError
from flask import abort, g, redirect, request, Response
from flask_cors import CORS
from flask_json import as_json, jsonify
import httpagentparser
from jsonschema import Draft4Validator, ValidationError
import requests
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import undefer
import stripe

from . import app, db
from .analytics import MIXPANEL_EVENT, mp
from .auth import (AuthException, ConflictException, CredentialException,
    NotFoundException, ValidationException, _create_user, _delete_user,
    _disable_user, _enable_user, activate_response, change_password,
    consume_code_string, exp_from_token, generate_uuid, issue_code, issue_token,
    reset_password, reset_password_from_email, revoke_token_string,
    try_login, verify_token_string)
from .const import (AWS_TOKEN_DURATION, FTS_LANGUAGE, PaymentPlan, PUBLIC,
                    TEAM, VALID_NAME_RE, VALID_EMAIL_RE, VALID_USERNAME_RE)
from .core import (decode_node, find_object_hashes, hash_contents,
                   FileNode, GroupNode, RootNode, TableNode, LATEST_TAG, README)
from .mail import send_comment_email, send_invitation_email
from .models import (Access, Comment, Customer, Event, Instance,
                     InstanceBlobAssoc, Invitation, Log, Package,
                     Role, S3Blob, Tag, User, Version)
from .schemas import (GET_OBJECTS_SCHEMA, LOG_SCHEMA, PACKAGE_SCHEMA,
                      PASSWORD_RESET_SCHEMA, USERNAME_EMAIL_SCHEMA, EMAIL_SCHEMA,
                      USERNAME_PASSWORD_SCHEMA, USERNAME_SCHEMA,
                      USERNAME_PASSWORD_EMAIL_SCHEMA, USERNAME_ROLE_SCHEMA,
                      ROLE_DETAILS_SCHEMA)
from .search import keywords_tsvector, tsvector_concat

QUILT_CDN = 'https://cdn.quiltdata.com/'

DEPLOYMENT_ID = app.config['DEPLOYMENT_ID']

CATALOG_URL = app.config['CATALOG_URL']
CATALOG_REDIRECT_URL = '%s/oauth_callback' % CATALOG_URL

AUTHORIZATION_HEADER = 'Authorization'

PACKAGE_BUCKET_NAME = app.config['PACKAGE_BUCKET_NAME']
PACKAGE_URL_EXPIRATION = app.config['PACKAGE_URL_EXPIRATION']

TEAM_ID = app.config['TEAM_ID']
ALLOW_ANONYMOUS_ACCESS = app.config['ALLOW_ANONYMOUS_ACCESS']
ALLOW_TEAM_ACCESS = app.config['ALLOW_TEAM_ACCESS']

ENABLE_USER_ENDPOINTS = app.config['ENABLE_USER_ENDPOINTS']

S3_HEAD_OBJECT = 'head_object'
S3_GET_OBJECT = 'get_object'
S3_PUT_OBJECT = 'put_object'

OBJ_DIR = 'objs'

PREVIEW_MAX_CHILDREN = 10
PREVIEW_MAX_DEPTH = 4

MAX_PREVIEW_SIZE = 640 * 1024  # 640KB ought to be enough for anybody...

s3_client = boto3.client(
    's3',
    endpoint_url=app.config.get('S3_ENDPOINT'),
    aws_access_key_id=app.config.get('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=app.config.get('AWS_SECRET_ACCESS_KEY')
)

sts_client = boto3.client(
    'sts',
    region_name='us-east-1',
    aws_access_key_id=app.config.get('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=app.config.get('AWS_SECRET_ACCESS_KEY')
)

stripe.api_key = app.config['STRIPE_SECRET_KEY']
HAVE_PAYMENTS = bool(stripe.api_key)


class QuiltCli(httpagentparser.Browser):
    look_for = 'quilt-cli'
    version_markers = [('/', '')]

httpagentparser.detectorshub.register(QuiltCli())

class PythonPlatform(httpagentparser.DetectorBase):
    def __init__(self, name):
        super().__init__()
        self.name = name
        self.look_for = name

    info_type = 'python_platform'
    version_markers = [('/', '')]

for python_name in ['CPython', 'Jython', 'PyPy']:
    httpagentparser.detectorshub.register(PythonPlatform(python_name))

class ApiException(Exception):
    """
    Base class for API exceptions.
    """
    def __init__(self, status_code, message):
        super().__init__()
        self.status_code = status_code
        self.message = message


### Web routes ###

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
    return next is None or next.startswith(CATALOG_REDIRECT_URL)

def _validate_username(username):
    if not VALID_USERNAME_RE.fullmatch(username):
        raise ApiException(
            requests.codes.bad,
            """
            Username is not valid. Usernames must start with a letter or underscore, and
            contain only alphanumeric characters and underscores thereafter.
            """)

@app.route('/login')
def login():
    return redirect('{CATALOG_URL}/code'.format(CATALOG_URL=CATALOG_URL), code=302)

### API routes ###

# Allow CORS requests to API routes.
# The "*" origin is more secure than specific origins because it blocks cookies.
# Cache the settings for a day to avoid pre-flight requests.
CORS(app, resources={"/api/*": {"origins": "*", "max_age": timedelta(days=1)}})


class Auth:
    """
    Info about the user making the API request.
    """
    def __init__(self, user, email, is_logged_in, is_admin, is_active=True):
        self.user = user
        self.email = email
        self.is_logged_in = is_logged_in
        self.is_admin = is_admin
        self.is_active = is_active


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

def api(require_login=True, schema=None, enabled=True,
        require_admin=False, require_anonymous=False):
    """
    Decorator for API requests.
    Handles auth and adds the username as the first argument.
    """
    if require_admin:
        require_login = True

    if schema is not None:
        Draft4Validator.check_schema(schema)
        validator = Draft4Validator(schema)
    else:
        validator = None

    assert not (require_login and require_anonymous), (
            "Can't both require login and require anonymous access.")

    def innerdec(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            g.auth = Auth(user=None, email=None, is_logged_in=False, is_admin=False, is_active=True)

            user_agent_str = request.headers.get('user-agent', '')
            g.user_agent = httpagentparser.detect(user_agent_str, fill_none=True)

            if not enabled:
                raise ApiException(
                    requests.codes.bad_request,
                    "This endpoint is not enabled."
                    )

            if validator is not None:
                try:
                    validator.validate(request.get_json(cache=True))
                except ValidationError as ex:
                    raise ApiException(requests.codes.bad_request, ex.message)

            auth = request.headers.get(AUTHORIZATION_HEADER)
            g.auth_header = auth
            if auth is None:
                if not require_anonymous:
                    if require_login or not ALLOW_ANONYMOUS_ACCESS:
                        raise ApiException(requests.codes.unauthorized, "Not logged in")
            else:
                # try to validate new auth
                token = auth
                # for compatibility with old clients
                if token.startswith("Bearer "):
                    token = token[7:]

                try:
                    user = verify_token_string(token)
                except AuthException:
                    raise ApiException(requests.codes.unauthorized, "Token invalid.")

                g.user = user
                g.auth = Auth(user=user.name,
                              email=user.email,
                              is_logged_in=True,
                              is_admin=user.is_admin,
                              is_active=user.is_active)

                g.auth_token = token

                if not g.auth.is_active:
                    raise ApiException(
                        requests.codes.forbidden,
                        "Account is inactive. Must have an active account."
                        )

            if require_admin and not g.auth.is_admin:
                raise ApiException(
                    requests.codes.forbidden,
                    "Must be authenticated as an admin to use this endpoint."
                    )

            return f(*args, **kwargs)
        return wrapper
    return innerdec

@app.route('/api/token', methods=['POST'])
@api(require_login=False, require_anonymous=True)
@as_json
def token():
    def token_success(user):
        new_token = issue_token(user)
        exp = exp_from_token(new_token)
        db.session.commit()
        return dict(
            refresh_token=new_token,
            access_token=new_token,
            expires_at=exp
        )

    refresh_token = request.values.get('refresh_token')
    if refresh_token is None:
        abort(requests.codes.bad_request)

    # check if one-time code, then if token
    try:
        user = consume_code_string(refresh_token)
        return token_success(user)
    except ValidationException:
        pass
    except AuthException:
        raise ApiException(requests.codes.unauthorized, 'Code invalid')

    try:
        user = verify_token_string(refresh_token)
        if not user:
            raise ApiException(requests.codes.unauthorized, 'Token invalid')

        return token_success(user)
    except AuthException as ex:
        raise ApiException(requests.codes.unauthorized, ex.message)

@app.route('/api/login', methods=['POST'])
@api(require_anonymous=True, require_login=False, schema=USERNAME_PASSWORD_SCHEMA)
@as_json
def login_post():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    user = User.query.filter_by(name=username).with_for_update().one_or_none()
    if not user:
        raise ApiException(requests.codes.unauthorized, 'Login attempt failed')

    if try_login(user, password):
        token = issue_token(user)
        db.session.commit()
        return {'token': token}

    raise ApiException(requests.codes.unauthorized, 'Login attempt failed')

@app.route('/activate/<link>')
def activate_endpoint(link):
    return activate_response(link)

@app.route('/api/reset_password', methods=['POST'])
@api(require_anonymous=True, require_login=False, schema=EMAIL_SCHEMA)
@as_json
def reset_password_start():
    data = request.get_json()
    email = data['email']
    reset_password_from_email(email)
    db.session.commit()
    return {}

@app.route('/api/change_password', methods=['POST'])
@api(require_anonymous=True, require_login=False, schema=PASSWORD_RESET_SCHEMA)
@as_json
def change_password_endpoint():
    data = request.get_json()
    raw_password = data['password']
    link = data['link']
    try:
        change_password(raw_password, link)
        db.session.commit()
        return {}
    except ValidationException as ex:
        raise ApiException(requests.codes.bad, ex.message)
    except CredentialException as ex:
        raise ApiException(requests.codes.unauthorized, ex.message)
    except AuthException as ex:
        raise ApiException(requests.codes.internal_server_error, ex.message)

@app.route('/api/me')
@api()
@as_json
def apiroot():
    return {'is_staff': g.auth.is_admin, 'is_active': g.auth.is_active,
            'email': g.auth.email, 'current_user': g.auth.user}

@app.route('/api/register', methods=['POST'])
@api(require_anonymous=True, require_login=False, schema=USERNAME_PASSWORD_EMAIL_SCHEMA)
@as_json
def register_endpoint():
    data = request.get_json()
    if app.config['DISABLE_SIGNUP']:
        raise ApiException(requests.codes.not_implemented, "Signup is disabled.")
    username = data['username']
    password = data['password']
    email = data['email']
    try:
        _create_user(username, password=password, email=email)
        db.session.commit()
        return {}
    except ValidationException as ex:
        raise ApiException(requests.codes.bad, ex.message)
    except ConflictException as ex:
        raise ApiException(requests.codes.conflict, ex.message)

@app.route('/api/refresh', methods=['POST'])
@api()
@as_json
def refresh():
    if revoke_token_string(g.auth_token):
        token = issue_token(g.user)
        db.session.commit()
        return {'token': token}
    # token is valid from @api so should always succeed
    raise ApiException(requests.codes.internal_server_error, 'Internal server error')

@app.route('/api/logout', methods=['POST'])
@api()
@as_json
def logout():
    if revoke_token_string(g.auth_token):
        db.session.commit()
        return {}
    # token is valid from @api so should always succeed
    raise ApiException(requests.codes.internal_server_error, 'Logout failed')

@app.route('/api/code')
@api()
@as_json
def get_code():
    user = User.query.filter_by(name=g.user.name).one_or_none()
    code = issue_code(user)
    db.session.commit()
    return {'code': code}

def _access_filter(auth):
    query = []
    if ALLOW_ANONYMOUS_ACCESS:
        query.append(PUBLIC)

    if auth.is_logged_in:
        assert auth.user not in [None, PUBLIC, TEAM]  # Sanity check
        query.append(auth.user)

        if ALLOW_TEAM_ACCESS:
            query.append(TEAM)

    return Access.user.in_(query)

def _get_package(auth, owner, package_name):
    """
    Helper for looking up a package and checking permissions.
    Only useful for *_list functions; all others should use more efficient queries.
    """
    package = (
        Package.query
        .filter_by(owner=owner, name=package_name)
        .join(Package.access)
        .filter(_access_filter(auth))
        .one_or_none()
    )
    if package is None:
        raise PackageNotFoundException(owner, package_name, auth.is_logged_in)
    return package

def _get_instance(auth, owner, package_name, package_hash):
    instance = (
        Instance.query
        .filter_by(hash=package_hash)
        .options(undefer('contents'))  # Contents is deferred by default.
        .join(Instance.package)
        .filter_by(owner=owner, name=package_name)
        .join(Package.access)
        .filter(_access_filter(auth))
        .one_or_none()
    )
    if instance is None:
        raise ApiException(
            requests.codes.not_found,
            "Package hash does not exist"
        )
    return instance

def _mp_track(**kwargs):
    if g.user_agent['browser']['name'] == 'QuiltCli':
        source = 'cli'
    else:
        source = 'web'

    # Use the user ID if the user is logged in; otherwise, let MP use the IP address.
    distinct_id = g.auth.user

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
        python_name=g.user_agent.get('python_platform', {}).get('name'),
        python_version=g.user_agent.get('python_platform', {}).get('version'),
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
    assert g.auth.user

    if TEAM_ID:
        # In teams instances, we only create one Stripe customer for the whole team.
        db_customer_id = ''
    else:
        db_customer_id = g.auth.user

    db_customer = Customer.query.filter_by(id=db_customer_id).one_or_none()

    if db_customer is None:
        try:
            # Insert a placeholder with no Stripe ID just to lock the row.
            db_customer = Customer(id=db_customer_id)
            db.session.add(db_customer)
            db.session.flush()
        except IntegrityError:
            # Someone else just created it, so look it up.
            db.session.rollback()
            db_customer = Customer.query.filter_by(id=db_customer_id).one()
        else:
            # Create a new customer.
            if TEAM_ID:
                plan = PaymentPlan.TEAM_UNPAID.value
                email = None  # TODO: Use an admin email?
                description = 'Team %s' % TEAM_ID
            else:
                plan = PaymentPlan.FREE.value
                email = g.auth.email
                description = g.auth.user
            customer = stripe.Customer.create(
                email=email,
                description=description
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

def _private_packages_allowed():
    """
    Checks if the current user is allowed to create private packages.

    In the public cloud, the user needs to be on a paid plan.
    There are no restrictions in other deployments.
    """
    if not HAVE_PAYMENTS or TEAM_ID:
        return True

    customer = _get_or_create_customer()
    plan = _get_customer_plan(customer)
    return plan != PaymentPlan.FREE

@app.route('/api/get_objects', methods=['POST'])
@api(require_login=False, schema=GET_OBJECTS_SCHEMA)
@as_json
def get_objects():
    obj_hashes = request.get_json()

    results = (
        S3Blob.query
        .filter(S3Blob.hash.in_(obj_hashes))
        .join(S3Blob.instances)
        .join(Instance.package)
        .join(Package.access)
        .filter(_access_filter(g.auth))
    ).all()

    return dict(
        urls={
            blob.hash: _generate_presigned_url(S3_GET_OBJECT, blob.owner, blob.hash)
            for blob in results
        },
        sizes={
            blob.hash: blob.size for blob in results
        }
    )


class PreviewException(Exception):
    """The object is malformed (not gzipped correctly or has the wrong Content-Encoding header)"""


def download_object_preview_impl(owner, obj_hash):
    try:
        resp = s3_client.get_object(
            Bucket=PACKAGE_BUCKET_NAME,
            Key='%s/%s/%s' % (OBJ_DIR, owner, obj_hash),
            Range='bytes=-%d' % MAX_PREVIEW_SIZE  # Limit the size of the gzip'ed content.
        )
    except ClientError as ex:
        if ex.response['ResponseMetadata']['HTTPStatusCode'] == requests.codes.not_found:
            raise PreviewException("File does not exist")
        else:
            raise

    body = resp['Body']
    encoding = resp.get('ContentEncoding')
    if encoding == 'gzip':
        try:
            with gzip.GzipFile(fileobj=body, mode='rb') as fd:
                data = fd.read(MAX_PREVIEW_SIZE)
        except OSError as ex:
            if 'gzipped' in str(ex):
                raise PreviewException("Failed to ungzip: %s" % ex)
            else:
                raise
    elif encoding is None:
        data = body.read(MAX_PREVIEW_SIZE)
    else:
        raise PreviewException("Unexpected encoding: %r" % encoding)

    return data.decode(errors='ignore')  # Data may be truncated in the middle of a UTF-8 character.

def download_object_preview(owner, obj_hash):
    try:
        return download_object_preview_impl(owner, obj_hash)
    except PreviewException as ex:
        _mp_track(
            type="download_exception",
            obj_owner=owner,
            obj_hash=obj_hash,
            error=str(ex),
        )
        raise ApiException(
            requests.codes.forbidden,
            "Failed to download the README: %s" % ex
        )

def _merge_contents(base_contents, package_path, contents):
    base_subnode = base_contents
    package_path_list = package_path.split('/')
    for component in package_path_list[:-1]:
        try:
            base_subnode = base_subnode.children.setdefault(component, GroupNode(dict()))
        except AttributeError:
            raise ApiException(requests.codes.not_found, "Target subpath is not a group node: %r" % component)
    try:
        base_subnode.children[package_path_list[-1]] = contents
    except AttributeError:
        raise ApiException(requests.codes.not_found, "Target subpath is not a group node: %r" % package_path_list[-1])

    return base_contents

@app.route('/api/package/<owner>/<package_name>/<package_hash>', methods=['PUT'])
@app.route('/api/package_update/<owner>/<package_name>/<path:package_path>', methods=['POST'])
@api(schema=PACKAGE_SCHEMA)
@as_json
def package_put(owner, package_name, package_hash=None, package_path=None):
    # This function handles two endpoints: a normal push and subpackage push.
    # Make sure exactly one of these arguments is set.
    assert (package_hash is None) != (package_path is None)

    # TODO: Write access for collaborators.
    if g.auth.user != owner:
        raise ApiException(requests.codes.forbidden,
                           "Only the package owner can push packages.")

    if not VALID_NAME_RE.match(package_name):
        raise ApiException(requests.codes.bad_request, "Invalid package name")

    # TODO: Description.
    data = json.loads(request.data.decode('utf-8'), object_hook=decode_node)
    dry_run = data.get('dry_run', False)
    public = data.get('is_public', data.get('public', False))
    team = data.get('is_team', False)
    contents = data['contents']
    sizes = data['sizes']

    if (package_path is None) != isinstance(contents, RootNode):
        raise ApiException(requests.codes.bad_request, "Unexpected node type")

    if public and not ALLOW_ANONYMOUS_ACCESS:
        raise ApiException(requests.codes.forbidden, "Public access not allowed")
    if team and not ALLOW_TEAM_ACCESS:
        raise ApiException(requests.codes.forbidden, "Team access not allowed")

    if package_hash is not None and hash_contents(contents) != package_hash:
        raise ApiException(requests.codes.bad_request, "Wrong contents hash")

    all_hashes = set(find_object_hashes(contents))

    if not dry_run and set(sizes) != all_hashes:
        raise ApiException(requests.codes.bad_request, "Sizes don't match the hashes")

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
                    sa.func.lower(Package.owner) == sa.func.lower(owner),
                    sa.func.lower(Package.name) == sa.func.lower(package_name)
                )
            )
            .one_or_none()
        )

        if package_ci is not None:
            raise ApiException(
                requests.codes.forbidden,
                "Package already exists: %s/%s" % (package_ci.owner, package_ci.name)
            )

        if not public and not _private_packages_allowed():
            raise ApiException(
                requests.codes.payment_required,
                (
                    "Insufficient permissions. Run `quilt push --public %s/%s` to make " +
                    "this package public, or upgrade your service plan to create " +
                    "private packages: https://quiltdata.com/profile."
                ) % (owner, package_name)
            )

        package = Package(owner=owner, name=package_name)
        db.session.add(package)

        owner_access = Access(package=package, user=owner)
        db.session.add(owner_access)

        if public:
            public_access = Access(package=package, user=PUBLIC)
            db.session.add(public_access)

        if team:
            team_access = Access(package=package, user=TEAM)
            db.session.add(team_access)
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
        if team:
            team_access = (
                Access.query
                .filter(sa.and_(
                    Access.package == package,
                    Access.user == TEAM
                ))
                .one_or_none()
            )
            if team_access is None:
                raise ApiException(
                    requests.codes.forbidden,
                    ("%(team)s:%(user)s/%(pkg)s is private. To share it with the team, " +
                     "run `quilt access add %(team)s:%(user)s/%(pkg)s team`.") %
                    dict(team=app.config['TEAM_ID'], user=owner, pkg=package_name)
                )

    if package_path is not None:
        # We're doing a subpackage push - so look up the existing contents.
        result = (
            db.session.query(Instance, Tag)
            .filter_by(package=package)
            .options(undefer('contents'))  # Contents is deferred by default.
            .join(Instance.tags)
            .filter_by(tag=LATEST_TAG)
            .with_for_update()
            .one_or_none()
        )
        if result is not None:
            base_instance, tag = result
            base_contents = base_instance.contents
            # Make sure we don't commit any changes to the original instance!
            db.session.expunge(base_instance)
        else:
            base_contents = RootNode({})
            tag = None

        contents = _merge_contents(base_contents, package_path, contents)
        package_hash = hash_contents(contents)

    # Insert an instance if it doesn't already exist.
    instance = (
        Instance.query
        .with_for_update()
        .filter_by(package=package, hash=package_hash)
        .one_or_none()
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

    keywords_tsv = keywords_tsvector(owner, package_name, contents)

    if instance is None:
        readme_hash = None
        readme_preview = None

        readme = contents.children.get(README)
        if isinstance(readme, FileNode):
            assert len(readme.hashes) == 1
            readme_hash = readme.hashes[0]

            # Download the README if necessary. We want to do this early, before we call
            # with_for_update() on S3Blob, since it's potentially expensive.
            have_readme = (
                db.session.query(sa.func.count(S3Blob.id))
                .filter_by(owner=owner, hash=readme_hash)
                .filter(S3Blob.preview.isnot(None))
            ).one()[0] == 1

            if not have_readme:
                readme_preview = download_object_preview(owner, readme_hash)

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

        # Create the instance after querying the blobs - otherwise, SQLAlchemy
        # will issue an INSERT followed by UPDATE instead of a single INSERT.
        instance = Instance(
            package=package,
            contents=contents,
            hash=package_hash,
            created_by=g.auth.user,
            updated_by=g.auth.user,
            keywords_tsv=keywords_tsv,
        )

        blob_by_hash = {blob.hash: blob for blob in blobs}

        for blob_hash in all_hashes:
            blob_size = sizes[blob_hash]
            blob = blob_by_hash.get(blob_hash)
            if blob is None:
                blob = S3Blob(owner=owner, hash=blob_hash, size=blob_size)
            if blob_hash == readme_hash:
                if readme_preview is not None:
                    # If we've just downloaded the README, save it in the blob.
                    # Otherwise, it was already set.
                    blob.preview = readme_preview
                    blob_preview_expr = readme_preview
                else:
                    # README already exists in the DB; use a subquery to avoid fetching it
                    # only to insert it into the instance.
                    blob_preview_expr = sa.select([S3Blob.preview]).where(S3Blob.id == blob.id)
                instance.readme_blob = blob
                instance.blobs_tsv = sa.func.to_tsvector(FTS_LANGUAGE, blob_preview_expr)
            instance.blobs.append(blob)

        db.session.add(instance)

    else:
        # Just update the contents dictionary.
        # Nothing else could've changed without invalidating the hash.
        instance.contents = contents
        instance.updated_at = sa.func.now()
        instance.updated_by = g.auth.user
        instance.keywords_tsv = keywords_tsv

    # Pushing a subpackage automatically updates the "latest" tag.
    if package_path is not None:
        if tag is None:
            tag = Tag(package=package, tag=LATEST_TAG)
        tag.instance = instance

    # Insert a log.
    log = Log(
        package=package,
        instance=instance,
        author=owner,
    )
    db.session.add(log)

    # Insert an event.
    event = Event(
        user=g.auth.user,
        type=Event.Type.PUSH,
        package_owner=owner,
        package_name=package_name,
        package_hash=package_hash,
        extra=dict(
            public=public
        )
    )
    db.session.add(event)

    db.session.commit()

    _mp_track(
        type="push",
        package_owner=owner,
        package_name=package_name,
        public=public,
    )

    return dict(
        package_url='%s/package/%s/%s' % (CATALOG_URL, owner, package_name),
        package_hash=package_hash
    )

@app.route('/api/package/<owner>/<package_name>/<package_hash>', methods=['GET'])
@api(require_login=False)
@as_json
def package_get(owner, package_name, package_hash):
    subpath = request.args.get('subpath')
    meta_only = bool(request.args.get('meta_only', ''))

    instance = _get_instance(g.auth, owner, package_name, package_hash)

    assert isinstance(instance.contents, RootNode)

    subnode = instance.contents
    for component in subpath.split('/') if subpath else []:
        try:
            subnode = subnode.children[component]
        except (AttributeError, KeyError):
            raise ApiException(requests.codes.not_found, "Invalid subpath: %r" % component)

    all_hashes = set(find_object_hashes(subnode, meta_only=meta_only))

    blobs = (
        S3Blob.query
        .filter(
            sa.and_(
                S3Blob.owner == owner,
                S3Blob.hash.in_(all_hashes)
            )
        )
        .all()
    ) if all_hashes else []

    urls = {
        blob_hash: _generate_presigned_url(S3_GET_OBJECT, owner, blob_hash)
        for blob_hash in all_hashes
    }

    # Insert an event.
    event = Event(
        user=g.auth.user,
        type=Event.Type.INSTALL,
        package_owner=owner,
        package_name=package_name,
        package_hash=package_hash,
        extra=dict(
            subpath=subpath
        )
    )
    db.session.add(event)

    db.session.commit()

    _mp_track(
        type="install",
        package_owner=owner,
        package_name=package_name,
        subpath=subpath,
    )

    return dict(
        contents=instance.contents,
        urls=urls,
        sizes={blob.hash: blob.size for blob in blobs},
        created_by=instance.created_by,
        created_at=instance.created_at.timestamp(),
        updated_by=instance.updated_by,
        updated_at=instance.updated_at.timestamp(),
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

def _iterate_data_nodes(node):
    # TODO: Merge into core.py
    if isinstance(node, (TableNode, FileNode)):
        yield node
    elif isinstance(node, GroupNode):
        for child in node.children.values():
            yield from _iterate_data_nodes(child)


def get_event_timeseries(owner, package_name, event_type, max_weeks_old=52):
    now = datetime.utcnow()
    last_monday = (now - timedelta(days=now.weekday())).date()
    next_monday = last_monday + timedelta(weeks=1)

    weeks_ago = sa.func.trunc(sa.func.date_part('day', next_monday - Event.created) / 7)
    result = (
        db.session.query(
            sa.func.count(Event.id),
            weeks_ago.label('weeks_ago')
        )
        .filter(Event.package_owner == owner)
        .filter(Event.package_name == package_name)
        .filter(Event.type == event_type)
        .filter(weeks_ago < max_weeks_old)
        .group_by(weeks_ago)
        .all()
    )

    total = (
        db.session.query(
            sa.func.count(Event.id)
        )
        .filter(Event.package_owner == owner)
        .filter(Event.package_name == package_name)
        .filter(Event.type == event_type)
        .scalar()
    )

    result = [(int(count), int(weeks_ago)) for count, weeks_ago in result]
    # result contains (count, weeks_ago) pairs
    last = next_monday
    first = next_monday - timedelta(weeks=max_weeks_old)
    counts = [0] * (max_weeks_old) # list of zeroes
    for count, weeks_ago in result:
        counts[weeks_ago] = count

    return {
        'startDate': calendar.timegm(first.timetuple()),
        'endDate': calendar.timegm(last.timetuple()),
        'frequency': 'week',
        'timeSeries': reversed(counts), # 0 weeks ago needs to be at end of timeseries
        'total': total
    }

@app.route('/api/package_timeseries/<owner>/<package_name>/<event_type>',
           methods=['GET'])
@api(require_login=False)
@as_json
def package_timeseries(owner, package_name, event_type):
    try:
        event_enum = Event.Type[event_type.upper()]
    except KeyError:
        raise ApiException(requests.codes.bad_request, "Event type incorrectly specified.")

    result = (
        db.session.query(
            Package,
            sa.func.bool_or(Access.user == PUBLIC).label('is_public'),
            sa.func.bool_or(Access.user == TEAM).label('is_team')
        )
        .filter_by(owner=owner, name=package_name)
        .join(Package.access)
        .filter(_access_filter(g.auth))
        .group_by(Package.id)
        .one_or_none()
    )
    if not result:
        raise ApiException(requests.codes.not_found, "Package does not exist.")

    return get_event_timeseries(owner, package_name, event_enum)

@app.route('/api/package_preview/<owner>/<package_name>/<package_hash>', methods=['GET'])
@api(require_login=False)
@as_json
def package_preview(owner, package_name, package_hash):
    result = (
        db.session.query(
            Instance,
            sa.func.bool_or(Access.user == PUBLIC).label('is_public'),
            sa.func.bool_or(Access.user == TEAM).label('is_team')
        )
        .filter_by(hash=package_hash)
        .join(Instance.package)
        .filter_by(owner=owner, name=package_name)
        .join(Package.access)
        .filter(_access_filter(g.auth))
        .group_by(Package.id, Instance.id)
        .one_or_none()
    )

    if result is None:
        raise ApiException(
            requests.codes.not_found,
            "Package hash does not exist"
        )

    (instance, is_public, is_team) = result
    assert isinstance(instance.contents, RootNode)

    log_count = (
        db.session.query(
            sa.func.count(Log.package_id)
        )
        .filter(Log.package_id == instance.package_id)
    ).one()

    readme = instance.contents.children.get(README)
    if isinstance(readme, FileNode):
        assert len(readme.hashes) == 1
        readme_hash = readme.hashes[0]
        readme_url = _generate_presigned_url(S3_GET_OBJECT, owner, readme_hash)
        readme_blob = (
            S3Blob.query
            .filter_by(owner=owner, hash=readme_hash)
            .options(undefer('preview'))
            .one_or_none()  # Should be one() once READMEs are backfilled.
        )
        readme_preview = readme_blob.preview if readme_blob is not None else None
    else:
        readme_url = None
        readme_preview = None

    contents_preview = _generate_preview(instance.contents)

    total_size = int((
        db.session.query(sa.func.coalesce(sa.func.sum(S3Blob.size), 0))
        # We could do a join on S3Blob.instances - but that results in two joins instead of one.
        # So do a completely manual join to make it efficient.
        .join(InstanceBlobAssoc, sa.and_(
            InstanceBlobAssoc.c.blob_id == S3Blob.id,
            InstanceBlobAssoc.c.instance_id == instance.id
        ))
    ).one()[0])

    file_types = defaultdict(int)
    for node in _iterate_data_nodes(instance.contents):
        path = node.metadata.get('q_path')
        if not isinstance(path, str):
            path = ''
        # We don't know if it's a UNIX or a Windows path, so let's treat both \ and / as separators.
        # PureWindowsPath will do that for us, since / is legal on Windows.
        ext = pathlib.PureWindowsPath(path).suffix.lower()
        file_types[ext] += 1

    # Insert an event.
    event = Event(
        type=Event.Type.PREVIEW,
        user=g.auth.user,
        package_owner=owner,
        package_name=package_name,
        package_hash=package_hash,
    )
    db.session.add(event)

    db.session.commit()

    _mp_track(
        type="preview",
        package_owner=owner,
        package_name=package_name,
    )

    return dict(
        preview=contents_preview,
        readme_url=readme_url,
        readme_preview=readme_preview,
        created_by=instance.created_by,
        created_at=instance.created_at.timestamp(),
        updated_by=instance.updated_by,
        updated_at=instance.updated_at.timestamp(),
        is_public=is_public,
        is_team=is_team,
        total_size_uncompressed=total_size,
        file_types=file_types,
        log_count=log_count,
    )

@app.route('/api/package/<owner>/<package_name>/', methods=['GET'])
@api(require_login=False)
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

    # Insert an event.
    event = Event(
        user=g.auth.user,
        type=Event.Type.DELETE,
        package_owner=owner,
        package_name=package_name,
    )
    db.session.add(event)

    db.session.commit()

    return dict()

@app.route('/api/package/<owner>/', methods=['GET'])
@api(require_login=False)
@as_json
def user_packages(owner):
    packages = (
        db.session.query(
            Package,
            sa.func.bool_or(Access.user == PUBLIC),
            sa.func.bool_or(Access.user == TEAM)
        )
        .filter_by(owner=owner)
        .join(Package.access)
        .filter(_access_filter(g.auth))
        .group_by(Package.id)
        .order_by(Package.name)
        .all()
    )

    return dict(
        packages=[
            dict(
                name=package.name,
                is_public=is_public,
                is_team=is_team,
            )
            for package, is_public, is_team in packages
        ]
    )

@app.route('/api/admin/package_list/<owner>/', methods=['GET'])
@api(require_login=True, require_admin=True)
@as_json
def list_user_packages(owner):
    packages = (
        db.session.query(
            Package,
            sa.func.bool_or(Access.user == PUBLIC),
            sa.func.bool_or(Access.user == TEAM)
        )
        .filter_by(owner=owner)
        .join(Package.access)
        .group_by(Package.id)
        .order_by(Package.name)
        .all()
    )

    return dict(
        packages=[
            dict(
                name=package.name,
                is_public=is_public,
                is_team=is_team,
            )
            for package, is_public, is_team in packages
        ]
    )

@app.route('/api/log/<owner>/<package_name>/', methods=['GET'])
@api(require_login=False)
@as_json
def logs_list(owner, package_name):
    package = _get_package(g.auth, owner, package_name)

    tags = (
        db.session.query(
            Tag.instance_id,
            sa.func.array_agg(Tag.tag).label('tag_list')
        )
        .group_by(Tag.instance_id)
        .subquery('tags')
    )
    versions = (
        db.session.query(
            Version.instance_id,
            sa.func.array_agg(Version.version).label('version_list')
        )
        .group_by(Version.instance_id)
        .subquery('versions')
    )
    logs = (
        db.session.query(
            Log,
            Instance,
            tags.c.tag_list,
            versions.c.version_list
        )
        .filter_by(package=package)
        .join(Log.instance)
        .outerjoin(tags, Log.instance_id == tags.c.instance_id)
        .outerjoin(versions, Log.instance_id == versions.c.instance_id)
        # Sort chronologically, but rely on IDs in case of duplicate created times.
        .order_by(Log.created, Log.id)
    )

    results = [dict(
        hash=instance.hash,
        created=log.created.timestamp(),
        author=log.author,
        tags=tag_list,
        versions=version_list
    ) for log, instance, tag_list, version_list in logs]


    return {'logs' : results}

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
@api(require_login=False)
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
        created_at=instance.created_at.timestamp(),
        updated_by=instance.updated_by,
        updated_at=instance.updated_at.timestamp(),
    )

@app.route('/api/version/<owner>/<package_name>/', methods=['GET'])
@api(require_login=False)
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
@api(require_login=False)
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

    users = [access.user for access in package.access]
    is_public = 'public' in users
    is_team = 'team' in users

    return dict(
        hash=instance.hash,
        created_by=instance.created_by,
        created_at=instance.created_at.timestamp(),
        updated_by=instance.updated_by,
        updated_at=instance.updated_at.timestamp(),
        is_public=is_public,
        is_team=is_team,
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
@api(require_login=False)
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

    if VALID_EMAIL_RE.match(user):
        email = user.lower()
        invitation = Invitation(package=package, email=email)
        db.session.add(invitation)
        db.session.commit()
        send_invitation_email(email, owner, package_name)
        return {}

    else:
        _validate_username(user)
        if user == PUBLIC:
            if not ALLOW_ANONYMOUS_ACCESS:
                raise ApiException(requests.codes.forbidden, "Public access not allowed")
        elif user == TEAM:
            if not ALLOW_TEAM_ACCESS:
                raise ApiException(requests.codes.forbidden, "Team access not allowed")
        elif not User.query.filter_by(name=user).one_or_none():
            raise ApiException(
                requests.codes.not_found,
                "User %s does not exist" % user
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
    _validate_username(user)
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
    _validate_username(user)
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

    if user == PUBLIC and not _private_packages_allowed():
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
    is_public = ALLOW_ANONYMOUS_ACCESS and (PUBLIC in can_access)
    is_team = ALLOW_TEAM_ACCESS and (TEAM in can_access)

    if is_public or is_team or is_collaborator:
        return dict(users=can_access)
    else:
        raise PackageNotFoundException(owner, package_name)

@app.route('/api/recent_packages/', methods=['GET'])
@api(require_login=False)
@as_json
def recent_packages():
    try:
        count = int(request.args.get('count', ''))
    except ValueError:
        count = 10

    if ALLOW_ANONYMOUS_ACCESS:
        max_visibility = PUBLIC
    elif ALLOW_TEAM_ACCESS:
        max_visibility = TEAM
    else:
        # Shouldn't really happen, but let's handle this case.
        raise ApiException(requests.codes.forbidden, "Not allowed")

    results = (
        db.session.query(Package, sa.func.max(Instance.updated_at))
        .join(Package.access)
        .filter_by(user=max_visibility)
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
def search():
    query = request.args.get('q', '')

    # Get the list of visible packages and their permissions.

    instances = (
        db.session.query(
            Instance.id,
            # We have an index on (keywords_tsv || blobs_tsv)
            tsvector_concat(
                Instance.keywords_tsv,
                Instance.blobs_tsv
            ).label('tsv'),
            Package.owner,
            Package.name,
            sa.func.bool_or(Access.user == PUBLIC).label('is_public'),
            sa.func.bool_or(Access.user == TEAM).label('is_team'),
            sa.func.plainto_tsquery(FTS_LANGUAGE, query).label('query')  # Just save the query as a variable
        )
        .join(Instance.package)
        .join(Package.access)
        .filter(_access_filter(g.auth))
        .join(Instance.tags)
        .filter(Tag.tag == LATEST_TAG)
        .group_by(Package.id, Instance.id)  # Redundant, but we need Instance.id and Package.*
        .subquery('i')
    )

    # Get the README contents and full-text search index.

    README_SNIPPET_LEN = 1024
    readmes = (
        db.session.query(
            Instance.id,
            sa.func.substr(S3Blob.preview, 1, README_SNIPPET_LEN).label('readme'),
        )
        .join(Instance.readme_blob)
        .subquery('r')
    )

    # Filter and sort the results.

    # Use the "rank / (rank + 1)" normalization; makes it look sort of like percentage.
    RANK_NORMALIZATION = 32

    results = (
        db.session.query(
            instances.c.owner,
            instances.c.name,
            instances.c.is_public,
            instances.c.is_team,
            readmes.c.readme,
            sa.func.ts_rank_cd(
                instances.c.tsv,
                instances.c.query,
                RANK_NORMALIZATION
            ).label('rank')
        )
        .outerjoin(readmes, instances.c.id == readmes.c.id)
        .filter(
            instances.c.tsv.op('@@')(instances.c.query)
            if query else True   # Disable the filter if there was no query string.
        )
        .order_by(sa.desc('rank'), instances.c.owner, instances.c.name)
    )

    return dict(
        packages=[
            dict(
                owner=owner,
                name=name,
                is_public=is_public,
                is_team=is_team,
                readme_preview=readme,
                rank=rank,
            ) for owner, name, is_public, is_team, readme, rank in results
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

    # Check for outstanding package sharing invitations
    invitations = (
        db.session.query(Invitation, Package)
        .filter_by(email=g.auth.email.lower())
        .join(Invitation.package)
        )
    for invitation, package in invitations:
        access = Access(package=package, user=g.auth.user)
        db.session.add(access)
        db.session.delete(invitation)

    if invitations:
        db.session.commit()

    # We want to show only the packages owned by or explicitly shared with the user -
    # but also show whether they're public, in case a package is both public and shared with the user.
    # So do a "GROUP BY" to get the public info, then "HAVING" to filter out packages that aren't shared.
    packages = (
        db.session.query(
            Package,
            sa.func.bool_or(Access.user == PUBLIC),
            sa.func.bool_or(Access.user == TEAM)
        )
        .join(Package.access)
        .filter(_access_filter(g.auth))
        .group_by(Package.id)
        .order_by(
            sa.func.lower(Package.owner),
            sa.func.lower(Package.name)
        )
        .having(sa.func.bool_or(Access.user == g.auth.user))
        .all()
    )

    return dict(
        packages=dict(
            own=[
                dict(
                    owner=package.owner,
                    name=package.name,
                    is_public=is_public,
                    is_team=is_team,
                )
                for package, is_public, is_team in packages if package.owner == g.auth.user
            ],
            shared=[
                dict(
                    owner=package.owner,
                    name=package.name,
                    is_public=is_public,
                    is_team=is_team,
                )
                for package, is_public, is_team in packages if package.owner != g.auth.user
            ],
        ),
        plan=plan,
        have_credit_card=have_cc,
        is_admin=g.auth.is_admin,
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

    if TEAM_ID:
        if not g.auth.is_admin:
            raise ApiException(requests.codes.forbidden, "Only the admin can update plans")
        # Can only switch to TEAM (from TEAM_UNPAID)
        # if plan != PaymentPlan.TEAM:
        if plan not in (PaymentPlan.TEAM, PaymentPlan.TEAM_UNPAID):
            raise ApiException(requests.codes.forbidden, "Can only switch between team plans")
    else:
        if plan not in (PaymentPlan.FREE, PaymentPlan.INDIVIDUAL):
            # Cannot switch to the BUSINESS_MEMBER plan manually.
            raise ApiException(requests.codes.forbidden, "Not allowed to switch to plan: %r" % plan)

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
def payments_update_payment():
    if not HAVE_PAYMENTS:
        raise ApiException(requests.codes.not_found, "Payments not enabled")

    stripe_token = request.values.get('token')
    if not stripe_token:
        raise ApiException(requests.codes.bad_request, "Missing token")

    if TEAM_ID and not g.auth.is_admin:
        raise ApiException(requests.codes.forbidden, "Only the admin can update payment info")

    customer = _get_or_create_customer()
    customer.source = stripe_token

    try:
        customer.save()
    except stripe.InvalidRequestError as ex:
        raise ApiException(requests.codes.bad_request, str(ex))

    return dict()

@app.route('/api/invite/', methods=['GET'])
@api(require_login=False)
@as_json
def invitation_user_list():
    invitations = (
        db.session.query(Invitation, Package)
        .filter_by(email=g.auth.email.lower())
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
@api(require_login=False, schema=LOG_SCHEMA)
@as_json
def client_log():
    data = request.get_json()
    for event in data:
        _mp_track(**event)

    return dict()

@app.route('/api/users/list', methods=['GET'])
@api(enabled=ENABLE_USER_ENDPOINTS, require_admin=True)
@as_json
def list_users():
    users = User.query.all()
    results = [{
        'username': user.name,
        'email': user.email,
        'date_joined': user.date_joined,
        'last_login': user.last_login,
        'is_superuser': user.is_admin,
        'is_active': user.is_active
    } for user in users]
    return {
        'results': results
    }

@app.route('/api/users/list_detailed', methods=['GET'])
@api(enabled=ENABLE_USER_ENDPOINTS, require_admin=True)
@as_json
def list_users_detailed():
    package_counts_query = (
        db.session.query(Package.owner, sa.func.count(Package.owner))
        .group_by(Package.owner)
        )
    package_counts = dict(package_counts_query)

    events = (
        db.session.query(Event.user, Event.type, sa.func.count(Event.type))
        .group_by(Event.user, Event.type)
        )

    event_results = defaultdict(int)
    for event_user, event_type, event_count in events:
        event_results[(event_user, event_type)] = event_count

    users = User.query.all()

    results = {
        user.name : {
            'packages' : package_counts.get(user.name, 0),
            'installs' : event_results[(user.name, Event.Type.INSTALL)],
            'previews' : event_results[(user.name, Event.Type.PREVIEW)],
            'pushes' : event_results[(user.name, Event.Type.PUSH)],
            'deletes' : event_results[(user.name, Event.Type.DELETE)],
            'status' : 'active' if user.is_active else 'disabled',
            'last_seen' : user.last_login,
            'is_admin' : user.is_admin
            }
        for user in users
    }

    return {'users' : results}


@app.route('/api/users/create', methods=['POST'])
@api(enabled=ENABLE_USER_ENDPOINTS, require_admin=True, schema=USERNAME_EMAIL_SCHEMA)
@as_json
def create_user():
    try:
        data = request.get_json()
        username = data['username']
        _validate_username(username)
        email = data['email']
        _create_user(username=username, email=email, requires_reset=True, requires_activation=False)
        db.session.commit()
        return {}
    except ValidationException as ex:
        raise ApiException(requests.codes.bad, ex.message)
    except ConflictException as ex:
        raise ApiException(requests.codes.conflict, ex.message)

@app.route('/api/users/disable', methods=['POST'])
@api(enabled=ENABLE_USER_ENDPOINTS, require_admin=True, schema=USERNAME_SCHEMA)
@as_json
def disable_user():
    try:
        data = request.get_json()
        username = data['username']
        if g.auth.user == username:
            raise ApiException(requests.codes.forbidden, "Can't disable yourself")

        user = User.query.filter_by(name=username).with_for_update().one_or_none()
        _disable_user(user)
        db.session.commit()
        return {}
    except NotFoundException as ex:
        raise ApiException(requests.codes.not_found, ex.message)

@app.route('/api/users/enable', methods=['POST'])
@api(enabled=ENABLE_USER_ENDPOINTS, require_admin=True, schema=USERNAME_SCHEMA)
@as_json
def enable_user():
    try:
        data = request.get_json()
        username = data['username']
        user = User.query.filter_by(name=username).with_for_update().one_or_none()
        _enable_user(user)
        db.session.commit()
        return {}
    except NotFoundException as ex:
        raise ApiException(requests.codes.not_found, ex.message)

# This endpoint is disabled pending a rework of authentication
@app.route('/api/users/delete', methods=['POST'])
@api(enabled=False, require_admin=True, schema=USERNAME_SCHEMA)
@as_json
def delete_user():
    try:
        data = request.get_json()
        username = data['username']
        user = User.query.filter_by(name=username).with_for_update().one_or_none()
        _delete_user(user)
        db.session.commit()
        return {}
    except NotFoundException as ex:
        raise ApiException(requests.codes.not_found, ex.message)

@app.route('/api/audit/<owner>/<package_name>/')
@api(require_admin=True)
@as_json
def audit_package(owner, package_name):
    events = (
        Event.query
        .filter_by(package_owner=owner, package_name=package_name)
    )

    return dict(
        events=[dict(
            created=event.created.timestamp(),
            user=event.user,
            type=Event.Type(event.type).name,
            package_owner=event.package_owner,
            package_name=event.package_name,
            package_hash=event.package_hash,
            extra=event.extra,
        ) for event in events]
    )

@app.route('/api/audit/<user>/')
@api(require_admin=True)
@as_json
def audit_user(user):
    events = (
        Event.query
        .filter_by(user=user)
    )

    return dict(
        events=[dict(
            created=event.created.timestamp(),
            user=event.user,
            type=Event.Type(event.type).name,
            package_owner=event.package_owner,
            package_name=event.package_name,
            package_hash=event.package_hash,
            extra=event.extra,
        ) for event in events]
    )

@app.route('/api/admin/package_summary')
@api(require_admin=True)
@as_json
def package_summary():
    events = (
        db.session.query(Event.package_owner, Event.package_name, Event.type,
                         sa.func.count(Event.type), sa.func.max(Event.created))
        .group_by(Event.package_owner, Event.package_name, Event.type)
        )

    event_results = defaultdict(lambda: {'count':0})
    packages = set()
    for event_owner, event_package, event_type, event_count, latest in events:
        package = "{owner}/{pkg}".format(owner=event_owner, pkg=event_package)
        event_results[(package, event_type)] = {'latest':latest.timestamp(), 'count':event_count}
        packages.add(package)

    results = {
        package : {
            'installs' : event_results[(package, Event.Type.INSTALL)],
            'previews' : event_results[(package, Event.Type.PREVIEW)],
            'pushes' : event_results[(package, Event.Type.PUSH)],
            'deletes' : event_results[(package, Event.Type.DELETE)]
        } for package in packages
    }

    return {'packages' : results}

@app.route('/api/users/reset_password', methods=['POST'])
@api(enabled=ENABLE_USER_ENDPOINTS, require_admin=True, schema=USERNAME_SCHEMA)
@as_json
def admin_reset_password():
    data = request.get_json()
    username = data['username']
    user = User.query.filter_by(name=username).with_for_update().one_or_none()
    if not user:
        raise ApiException(requests.codes.not_found, "User not found.")

    reset_password(user, set_unusable=True)
    db.session.commit()
    return {}

def _comment_dict(comment):
    # JSON/JavaScript is not very good with large integers, so let's use strings to be safe.
    str_id = '%016x' % comment.id

    return dict(
        id=str_id,
        author=comment.author,
        created=comment.created.timestamp(),
        contents=comment.contents
    )

@app.route('/api/users/attach_role', methods=['POST'])
@api(enabled=ENABLE_USER_ENDPOINTS, require_admin=True, schema=USERNAME_ROLE_SCHEMA)
@as_json
def attach_role():
    """
    Manages the role attached to a user.

    The request should contain a JSON object with two keys:
        username(string): username of user to edit
        role_name(string): name of role to attach to user

    A user can only have one role at a time.
    To remove a role from a user, set role_name to the empty string.
    """
    data = request.get_json()
    username = data['username']
    role_name = data['role']
    user = User.query.filter_by(name=username).one_or_none()
    if user is None:
        raise ApiException(requests.codes.bad_request,
                           "No user exists by the provided name.")
    if role_name is '':
        # delete role from user
        user.role_id = None
    else:
        role = Role.query.filter_by(name=role_name).one_or_none()
        if role is None:
            raise ApiException(requests.codes.bad_request,
                               "No role exists by the provided name.")
        user.role_id = role.id

    db.session.add(user)
    db.session.commit()
    return {}

@app.route('/api/roles/edit', methods=['POST'])
@api(enabled=ENABLE_USER_ENDPOINTS, require_admin=True, schema=ROLE_DETAILS_SCHEMA)
@as_json
def edit_role():
    """
    Edits a role.

    The body of the request should contain a JSON object.
    There is one required parameter:
        role_name(string): name of the role to operate on

    There are two optional paramters:
        arn(string): ARN of the IAM role associated with the Quilt role.
        new_name(string): new name to attach to the role.

    To create a role, you must provide an unused name and an arn.
    To change the name of a role, provide the current name along with
        the new name you want to use.
    To change the ARN attached to a role, provide the current name along with
        the new ARN you want to use.
    To delete a role, make role_name the name of the role you want to delete
        and leave out the optional parameters.
    """
    data = request.get_json()
    role_name = data['name']
    arn = data.get('arn', None)
    new_name = data.get('new_name', None)
    role = Role.query.filter_by(name=role_name).one_or_none()
    if role is None:
        if arn is None:
            raise ApiException(
                    requests.codes.bad_request,
                    "Creating a role requires a role ARN"
                    )
        if new_name is not None:
            raise ApiException(
                    requests.codes.bad_request,
                    "Cannot specify a new name for a role that does not exist yet."
                    )
        if not VALID_NAME_RE.match(role_name):
            raise ApiException(
                    requests.codes.bad_request,
                    "Invalid name for role"
                    )
        role = Role(
            id=generate_uuid(),
            name=role_name,
            arn=arn
            )
        db.session.add(role)
    elif arn is None and new_name is None:
        # delete role
        # must remove role from all users with that role due to foreign key constraint
        users = User.query.filter_by(role_id=role.id).all()
        for user in users:
            user.role_id = None
            db.session.add(user)
        db.session.delete(role)
    else:
        # edit existing role
        if new_name:
            if not VALID_NAME_RE.match(new_name):
                raise ApiException(
                        requests.codes.bad_request,
                        "Invalid name for role"
                        )
            role.name = new_name
        if arn:
            role.arn = arn
        db.session.add(role)
    db.session.commit()
    return {}

@app.route('/api/roles/list')
@api(enabled=ENABLE_USER_ENDPOINTS, require_admin=True)
@as_json
def list_roles():
    """
    Lists the roles the registry knows about.

    Returns a JSON object with the top-level key 'results', with a value
        that is a list of dicts of the form {'name': role_name, 'arn': role_arn}
    """
    roles_list = []
    roles = Role.query.all()
    for role in roles:
        role_dict = {
            'name': role.name,
            'arn': role.arn
        }
        roles_list.append(role_dict)
    return {'results': roles_list}

@app.route('/api/comments/<owner>/<package_name>/', methods=['POST'])
@api()
@as_json
def comments_post(owner, package_name):
    package = _get_package(g.auth, owner, package_name)

    contents = request.get_json()['contents']

    comment = Comment(package=package, author=g.auth.user, contents=contents)

    db.session.add(comment)
    db.session.commit()

    # We disable automatic object expiration on commit, so refresh it manually.
    db.session.refresh(comment)

    owner_email = User.query.filter_by(name=owner).one_or_none().email
    send_comment_email(owner_email, owner, package_name, g.auth.user)

    return dict(comment=_comment_dict(comment))

@app.route('/api/comments/<owner>/<package_name>/', methods=['GET'])
@api(require_login=False)
@as_json
def comments_list(owner, package_name):
    package = _get_package(g.auth, owner, package_name)

    comments = Comment.query.filter_by(package=package).order_by(Comment.created)

    return dict(comments=map(_comment_dict, comments))

@app.route('/api/auth/get_credentials', methods=['GET'])
@api(require_login=True)
@as_json
def get_credentials():
    """
    Obtains credentials corresponding to your role.

    Returns a JSON object with three keys:
        AccessKeyId(string): access key ID
        SecretKey(string): secret key
        SessionToken(string): session token
    """
    role_id = g.user.role_id
    if not role_id:
        raise ApiException(requests.codes.bad_request,
                           "You have no attached role to assume")
    role = Role.query.filter_by(id=role_id).one_or_none()
    if not role:
        raise ApiException(requests.codes.bad_request,
                           "Cannot find role")
    params = {
        'RoleArn': role.arn,
        'RoleSessionName': g.auth.user,
        'DurationSeconds': AWS_TOKEN_DURATION
    }
    try:
        creds = sts_client.assume_role(**params)
    except ClientError:
        raise ApiException(requests.codes.server_error,
                           "Failed to get credentials for your role.")
    return creds['Credentials']
