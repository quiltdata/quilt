import base64
from datetime import datetime, timedelta
import json
import uuid

from flask import redirect, request
import itsdangerous
import jwt
from passlib.context import CryptContext
from sqlalchemy import func

from . import app, db
from .const import (ACTIVATE_SALT, BAD_NAMES, CODE_TTL_DEFAULT,
                    MAX_LINK_AGE, PASSWORD_RESET_SALT, TOKEN_TTL_DEFAULT,
                    VALID_EMAIL_RE, VALID_USERNAME_RE)
from .mail import (send_activation_email, send_reset_email, send_new_user_email,
                   send_welcome_email)
from .models import ActivationToken, Code, PasswordResetToken, Token, User

CATALOG_URL = app.config['CATALOG_URL']

pwd_context = CryptContext(
    schemes=['pbkdf2_sha512', 'django_pbkdf2_sha256'],
    pbkdf2_sha512__default_rounds=500000
    )
# Each round should take about half a second,
# 500000 rounds experimentally determined

class AuthException(Exception):
    """
    Base class for Auth exceptions.
    """
    def __init__(self, msg):
        super().__init__()
        self.message = msg


class ValidationException(AuthException):
    """
    Represents a failure to deserialize a signed link,
    a password that is too short, etc.
    """
    pass


class ConflictException(AuthException):
    """
    Represents an exception involving an attempt to register a
    username that already exists, etc.
    """
    pass


class NotFoundException(AuthException):
    """
    Represents an exception involving an attempted operation on an entity
    that could not be located.
    """
    pass


class CredentialException(AuthException):
    """
    Represents an exception involving things like an incorrect token,
    an incorrect password, etc.
    """
    pass


def generate_uuid():
    return str(uuid.uuid4())

def hash_password(password):
    return pwd_context.hash(password)

def get_admins():
    return [user.email for user in User.query.filter_by(is_admin=True).all()]

def activate_response(link):
    payload = verify_activation_link(link)
    if payload:
        _activate_user(User.query.filter_by(id=payload['id']).with_for_update().one_or_none())
        db.session.commit()
        return redirect("{CATALOG_URL}/signin".format(CATALOG_URL=CATALOG_URL), code=302)

    return redirect("{CATALOG_URL}/activation_error".format(CATALOG_URL=CATALOG_URL), code=302)

def validate_password(password):
    if len(password) < 8:
        raise ValidationException("Password must be at least 8 characters long.")

def reset_password_from_email(email):
    user = User.query.filter_by(email=email).with_for_update().one_or_none()
    if user:
        reset_password(user)

def change_password(raw_password, link):
    validate_password(raw_password)
    payload = verify_reset_link(link)
    if not payload:
        raise CredentialException("Reset token invalid")
    user_id = payload['id']
    user = User.query.filter_by(id=user_id).with_for_update().one_or_none()
    if not user:
        raise NotFoundException("User not found")
    user.password = hash_password(raw_password)
    revoke_user_code_tokens(user)
    db.session.add(user)

def _create_user(username, password='', email=None, is_admin=False,
                 requires_activation=True, requires_reset=False):
    def check_conflicts(username, email):
        if not VALID_USERNAME_RE.match(username):
            raise ValidationException("Invalid username.")
        if username in BAD_NAMES:
            raise ValidationException("Invalid username.")
        if email is None:
            raise ValidationException("Must provide email.")
        if not VALID_EMAIL_RE.match(email):
            raise ValidationException("Invalid email.")
        if User.query.filter_by(name=username).one_or_none():
            raise ConflictException("Username already taken.")
        if User.query.filter_by(email=email).one_or_none():
            raise ConflictException("Email already taken.")

    check_conflicts(username, email)

    if requires_reset:
        new_password = ""
    else:
        validate_password(password)
        new_password = hash_password(password)

    if requires_activation:
        is_active = False
    else:
        is_active = True

    user = User(
        id=generate_uuid(),
        name=username,
        password=new_password,
        email=email,
        is_active=is_active,
        is_admin=is_admin
        )

    db.session.add(user)

    if requires_activation:
        db.session.flush() # necessary due to link token foreign key relationship with User
        send_activation_email(user, generate_activation_link(user.id))

    if requires_reset:
        db.session.flush() # necessary due to link token foreign key relationship with User
        send_welcome_email(user, user.email, generate_reset_link(user.id))

def _update_user(username, password=None, email=None, is_admin=None, is_active=None):
    existing_user = User.query.filter_by(name=username).with_for_update().one_or_none()
    if not existing_user:
        raise NotFoundException("User to update not found")
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

def _activate_user(user):
    if user is None:
        raise NotFoundException("User not found")
    user.is_active = True
    db.session.add(user)
    admins = get_admins()
    if admins:
        send_new_user_email(user.name, user.email, admins)

def update_last_login(user):
    user.last_login = func.now()
    db.session.add(user)

def _delete_user(user):
    if user:
        revoke_user_code_tokens(user)
        db.session.delete(user)
    else:
        raise NotFoundException("User to delete not found")
    return user

def _enable_user(user):
    if user:
        user.is_active = True
        db.session.add(user)
    else:
        raise NotFoundException("User to enable not found")

def _disable_user(user):
    if user:
        revoke_user_code_tokens(user)
        user.is_active = False
        db.session.add(user)
    else:
        raise NotFoundException("User to disable not found")

def issue_code(user):
    user_id = user.id
    expires = datetime.utcnow() + timedelta(**CODE_TTL_DEFAULT)
    code = Code(user_id=user_id, code=generate_uuid(), expires=expires)
    db.session.add(code)
    return encode_code({'id': user_id, 'code': code.code})

def encode_code(code_dict):
    return base64.b64encode(bytes(json.dumps(code_dict), 'utf-8')).decode('utf8')

def decode_code(code_str):
    try:
        return json.loads(base64.b64decode(code_str).decode('utf8'))
    except Exception:
        raise ValidationException("Decoding code failed")

def decode_token(token_str):
    try:
        return jwt.decode(token_str, app.secret_key, algorithm='HS256')
    except jwt.exceptions.InvalidTokenError:
        raise ValidationException("Token could not be deserialized")

def check_token(user_id, token):
    return Token.query.filter_by(user_id=user_id, token=token).one_or_none() is not None

def _verify(payload):
    user_id = payload['id']
    uuid = payload['uuid']
    user = User.query.filter_by(id=user_id).one_or_none()
    if user is None:
        raise CredentialException('User ID invalid')

    if not check_token(user_id, uuid):
        raise CredentialException('Token invalid')
    return user

def verify_token_string(token_string):
    token = decode_token(token_string)
    user = _verify(token)
    return user

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

def revoke_tokens(user):
    Token.query.filter_by(user_id=user.id).delete()

def revoke_user_code_tokens(user):
    Code.query.filter_by(user_id=user.id).delete()
    revoke_tokens(user)

def calculate_exp(**kwargs):
    kw = kwargs or TOKEN_TTL_DEFAULT
    delta = timedelta(**kw)
    return datetime.utcnow() + delta

def issue_token(user):
    uuid = generate_uuid()
    token = Token(user_id=user.id, token=uuid)
    db.session.add(token)

    exp = calculate_exp()
    payload = {'id': user.id, 'uuid': uuid, 'exp': exp}
    token = jwt.encode(payload, app.secret_key, algorithm='HS256')
    return token.decode('utf-8')

def consume_code_string(code_str):
    code = decode_code(code_str)
    return consume_code(code['id'], code['code'])

def consume_code(user_id, code):
    found = Code.query.filter_by(user_id=user_id, code=code).with_for_update().one_or_none()
    if found is None:
        raise ValidationException("Code not found")
    if found.expires.timetuple() < datetime.utcnow().timetuple():
        db.session.delete(found)
        raise CredentialException("Code expired")
    db.session.delete(found)
    return User.query.filter_by(id=user_id).one_or_none()

def verify_hash(password, pw_hash):
    try:
        if not pwd_context.verify(password, pw_hash):
            raise CredentialException('Password verification failed')
    except ValueError:
        raise CredentialException('Password verification failed')

def try_login(user, password):
    if not user.is_active:
        return False

    try:
        verify_hash(password, user.password)
    except CredentialException:
        return False
    update_last_login(user)
    return True

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

def generate_activation_token(user_id):
    new_token = ActivationToken(user_id=user_id, token=generate_uuid())
    db.session.add(new_token)
    return new_token.token

def consume_activation_token(user_id, token):
    found = (
        ActivationToken.query
        .filter_by(user_id=user_id, token=token)
        .with_for_update()
        .one_or_none()
    )
    if not found:
        return False
    db.session.delete(found)
    return True

def generate_reset_token(user_id):
    reset_token = generate_uuid()
    PasswordResetToken.upsert(user_id, reset_token)
    return reset_token

def consume_reset_token(user_id, token):
    found = (
        PasswordResetToken
        .query
        .filter_by(user_id=user_id, token=token)
        .with_for_update()
        .one_or_none()
    )
    if not found:
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
        revoke_user_code_tokens(user)
        db.session.add(user)

    link = generate_reset_link(user.id)
    send_reset_email(user, link)
