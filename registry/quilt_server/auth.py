import base64
from datetime import datetime, timedelta
import json
import uuid

from flask import redirect, request
from flask_json import as_json, jsonify
import itsdangerous
import jwt
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError

from . import ApiException, app, db
from .const import VALID_EMAIL_RE, VALID_NAME_RE
from .mail import (send_activation_email, send_reset_email, send_new_user_email,
                   send_welcome_email)
from .models import ActivationToken, Code, PasswordResetToken, Token, User
from .name_filter import blacklisted_name

CATALOG_URL = app.config['CATALOG_URL']

pwd_context = CryptContext(
    schemes=['pbkdf2_sha512', 'django_pbkdf2_sha256'],
    pbkdf2_sha512__default_rounds=500000
    )
# Each round should take about half a second,
# 500000 rounds experimentally determined

def generate_uuid():
    return str(uuid.uuid4())

def hash_password(password):
    return pwd_context.hash(password)

def get_admins():
    return [user.email for user in User.query.filter_by(is_admin=True).all()]

def activate_response(link):
    payload = verify_activation_link(link)
    if payload:
        _activate_user(User.get_by_id(payload['id']))
        db.session.commit()
        return redirect("{CATALOG_URL}/signin".format(CATALOG_URL=CATALOG_URL), code=302)

    return redirect("{CATALOG_URL}/activation_error".format(CATALOG_URL=CATALOG_URL), code=302)

def validate_password(password):
    if len(password) < 8:
        raise ApiException(400, "Password must be at least 8 characters long.")
    return True

def reset_password_response():
    data = request.get_json()
    if 'email' in data:
        user = User.get_by_email(data['email'])
        if not user:
            return {}
        reset_password(user)
        db.session.commit()
        return {}
    # try reset request
    raw_password = data['password']
    validate_password(raw_password)
    link = data['link']
    payload = verify_reset_link(link)
    if not payload:
        return {'error': 'Reset token invalid.'}, 401
    user_id = payload['id']
    user = User.get_by_id(user_id)
    if not user:
        return {'error': 'User not found.'}, 404
    user.password = hash_password(raw_password)
    db.session.add(user)
    db.session.commit()
    return {}

def _create_user(username, password='', email=None, is_admin=False,
                 first_name=None, last_name=None,
                 requires_activation=True, requires_reset=False):
    def check_conflicts(username, email):
        if not VALID_NAME_RE.match(username):
            raise ApiException(400, "Unacceptable username.")
        if blacklisted_name(username):
            raise ApiException(400, "Unacceptable username.")
        if email is None:
            raise ApiException(400, "Must provide email.")
        if not VALID_EMAIL_RE.match(email):
            raise ApiException(400, "Unacceptable email.")
        if User.get_by_name(username):
            raise ApiException(409, "Username already taken.")
        if User.get_by_email(email):
            raise ApiException(409, "Email already taken.")

    check_conflicts(username, email)
    validate_password(password)

    new_password = "" if requires_reset else hash_password(password)

    if requires_activation:
        is_active = False
    else:
        is_active = True

    user = User(
        id=generate_uuid(),
        name=username,
        password=new_password,
        email=email,
        first_name=first_name,
        last_name=last_name,
        is_active=is_active,
        is_admin=is_admin
        )

    db.session.add(user)

    if requires_activation:
        send_activation_email(user, generate_activation_link(user.id))

    if requires_reset:
        send_welcome_email(user, user.email, generate_reset_link(user.id))

def _update_user(username, password=None, email=None, is_admin=None, is_active=None):
    existing_user = User.get_by_name(username)
    if not existing_user:
        raise ApiException(404, "User to update not found")
    if password is not None:
        new_password = hash_password(password)
        existing_user.password = new_password
    if email is not None:
        existing_user.email = email
    if is_admin is not None:
        existing_user.is_admin = is_admin
    if is_active is not None:
        existing_user.is_active = is_active

    db.session.add(existing_user)

def _create_or_update_user(username, password=None, email=None, is_admin=None, is_active=True):
    existing_user = User.get_by_name(username)
    if not existing_user:
        _create_user(username=username, password=password if password else '',
                     email=email, is_admin=is_admin,
                     requires_activation=False)
        if not is_active:
            _disable_user(User.get_by_name(username))
    else:
        _update_user(username=username, password=password if password else '', email=email,
                     is_admin=is_admin, is_active=is_active)

def _activate_user(user):
    if user is None:
        raise ApiException(404, "User not found")
    user.is_active = True
    db.session.add(user)
    admins = get_admins()
    if admins:
        send_new_user_email(user.name, user.email, admins)

def update_last_login(user, timestamp=None):
    timestamp = timestamp or datetime.utcnow()
    user.last_login = timestamp
    db.session.add(user)

def _delete_user(user):
    if user:
        db.session.delete(user)
    else:
        raise ApiException(404, "User to delete not found")
    revoke_user_code_tokens(user.id)
    return user

def _enable_user(user):
    if user:
        user.is_active = True
        db.session.add(user)
    else:
        raise ApiException(404, "User to enable not found")

def _disable_user(user):
    if user:
        user.is_active = False
        db.session.add(user)
        revoke_user_code_tokens(user.id)
    else:
        raise ApiException(404, "User to disable not found")

def issue_code(user):
    user_id = user.id
    code = Code.get(user_id)
    if code:
        code.code = generate_uuid()
    else:
        code = Code(user_id=user_id, code=generate_uuid())
    db.session.add(code)
    return encode_code({'id': user_id, 'code': code.code})

def encode_code(code_dict):
    return base64.b64encode(bytes(json.dumps(code_dict), 'utf-8')).decode('utf8')

def decode_code(code_str):
    return json.loads(base64.b64decode(code_str).decode('utf8'))

def try_as_code(code_str):
    try:
        code = decode_code(code_str)
    except (TypeError, ValueError):
        return None
    found = Code.get(code['id'])
    if not found or found.code != code['code']:
        return None
    return User.get_by_id(code['id'])

def decode_token(token_str):
    return jwt.decode(token_str, app.secret_key, algorithm='HS256')

def check_token(user_id, token):
    return Token.get(user_id, token) is not None

def _verify(payload):
    user_id = payload['id']
    uuid = payload['uuid']
    user = User.get_by_id(user_id)
    if user is None:
        raise ApiException(400, 'User ID invalid')

    if not check_token(user_id, uuid):
        raise ApiException(400, 'Token invalid')
    return user

def verify_token_string(token_string):
    try:
        token = decode_token(token_string)
        user = _verify(token)
        return user
    except (jwt.exceptions.InvalidTokenError, ApiException):
        return None

def exp_from_token(token):
    token = decode_token(token)
    return token['exp']

def revoke_token_string(token_str):
    token = decode_token(token_str)
    user_id = token['id']
    uuid = token['uuid']
    return revoke_token(user_id, uuid)

def revoke_token(user_id, token):
    found = Token.query.filter_by(user_id=user_id, token=token).with_for_update().one_or_none()
    if found is None:
        return False
    db.session.delete(found)
    return True

def revoke_tokens(user_id):
    tokens = Token.query.filter_by(user_id=user_id).with_for_update().all()
    for token in tokens:
        db.session.delete(token)

def revoke_user_code_tokens(user_id):
    code = Code.query.filter_by(user_id=user_id).with_for_update().one_or_none()
    if code:
        db.session.delete(code)
    revoke_tokens(user_id)

def get_exp(mins=30):
    return datetime.utcnow() + timedelta(minutes=mins)

def issue_token(username, exp=None):
    user_id = User.get_by_name(username).id
    return issue_token_by_id(user_id, exp)

def issue_token_by_id(user_id, exp=None):
    uuid = generate_uuid()
    token = Token(user_id=user_id, token=uuid)
    db.session.add(token)

    exp = exp or get_exp()
    payload = {'id': user_id, 'uuid': uuid, 'exp': exp}
    token = jwt.encode(payload, app.secret_key, algorithm='HS256')
    return token.decode('utf-8')

def consume_code_string(code_str):
    code = decode_code(code_str)
    return consume_code(code['id'], code['code'])

def consume_code(user_id, code):
    found = Code.query.filter_by(user_id=user_id, code=code).with_for_update().one_or_none()
    if found is None:
        return None
    db.session.delete(code)
    return user_id

def verify_hash(password, pw_hash):
    try:
        if not pwd_context.verify(password, pw_hash):
            raise ApiException(401, 'Password verification failed')
    except ValueError:
        raise ApiException(401, 'Password verification failed')

def try_login(username, password):
    user = User.get_by_name(username)
    if not user:
        return False

    if not user.is_active:
        return False

    try:
        verify_hash(password, user.password)
    except ApiException:
        return False
    update_last_login(user)
    return True

def create_admin():
    # Only runs in dev -- only dev_config reads in the environment variables
    try:
        admin_username = app.config['DEV_USERNAME']
        admin_password = app.config['DEV_PASSWORD']
        admin_email = app.config['DEV_EMAIL']
    except KeyError:
        return
    if not admin_username or not admin_password or not admin_email:
        return
    _create_or_update_user(admin_username, password=admin_password, email=admin_email,
                 is_admin=True, is_active=True)
    db.session.commit()

app.before_first_request(create_admin)


linkgenerator = itsdangerous.URLSafeTimedSerializer(
    app.secret_key,
    salt='quilt'
    )

def dump_link(payload, salt=None):
    link = linkgenerator.dumps(payload, salt=salt)
    return link.replace('.', '~')

def load_link(link, max_age, salt=None):
    payload = link.replace('~', '.')
    return linkgenerator.loads(payload, max_age=max_age, salt=salt)

ACTIVATE_SALT = 'activate'
PASSWORD_RESET_SALT = 'reset'
MAX_LINK_AGE = 60 * 60 * 24 # 24 hours

def generate_activation_token(user_id):
    existing_token = ActivationToken.get(user_id)
    new_token = existing_token or ActivationToken(user_id=user_id, token=generate_uuid())
    db.session.add(new_token)
    return new_token.token

def consume_activation_token(user_id, token):
    found = ActivationToken.get(user_id)
    if not found:
        return False
    if found.token != token:
        return False
    db.session.delete(found)
    return True

def generate_reset_token(user_id):
    existing_token = PasswordResetToken.get(user_id)
    reset_token = existing_token or PasswordResetToken(user_id=user_id, token=generate_uuid())
    db.session.add(reset_token)
    return reset_token.token

def consume_reset_token(user_id, token):
    found = PasswordResetToken.get(user_id)
    if not found:
        return False
    if found.token != token:
        return False
    db.session.delete(found)
    return True

def generate_activation_link(user_id):
    token = generate_activation_token(user_id)
    payload = {'id': user_id, 'token': token}
    return dump_link(payload, ACTIVATE_SALT)

def generate_reset_link(user_id):
    token = generate_reset_token(user_id)
    payload = {'id': user_id, 'token': token}
    return dump_link(payload, PASSWORD_RESET_SALT)

def verify_activation_link(link, max_age=None):
    max_age = max_age if max_age is not None else MAX_LINK_AGE
    try:
        payload = load_link(link, max_age=max_age, salt=ACTIVATE_SALT)
        if not consume_activation_token(payload['id'], payload['token']):
            return None
        return payload
    except (TypeError, KeyError, ValueError, itsdangerous.BadData):
        return None

def verify_reset_link(link, max_age=None):
    max_age = max_age if max_age is not None else MAX_LINK_AGE
    try:
        payload = load_link(link, max_age=max_age, salt=PASSWORD_RESET_SALT)
        if not consume_reset_token(payload['id'], payload['token']):
            return None
        return payload
    except (TypeError, KeyError, ValueError, itsdangerous.BadData):
        return None

def reset_password(user, set_unusable=False):
    if set_unusable:
        user.password = ''
        db.session.add(user)

    link = generate_reset_link(user.id)
    send_reset_email(user, link)
