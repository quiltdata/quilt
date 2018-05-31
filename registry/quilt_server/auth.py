import base64
from datetime import datetime, timedelta
import uuid

from flask import jsonify, redirect, request
from flask_cors import CORS
from flask_json import as_json, jsonify
import itsdangerous
import json
import jwt
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError

from . import ApiException, app, db
from .mail import send_activation_email, send_reset_email
from .models import ActivationToken, Code, PasswordResetToken, Token, User
from .name_filter import blacklisted_name
from .schemas import EMAIL_SCHEMA

CATALOG_URL = app.config['CATALOG_URL']

pwd_context = CryptContext(schemes=['pbkdf2_sha512'],
        pbkdf2_sha512__default_rounds=500000)
# Each round should take about half a second, 
# 500000 rounds experimentally determined

def generate_uuid():
    return str(uuid.uuid4())

def get_user(username):
    return (
            db.session.query(
                User
            ).filter(User.name == username)
            .one_or_none()
        )

def get_user_by_id(user_id):
    user = (
        db.session.query(
            User
        )
        .filter(User.id == user_id)
        .one_or_none()
    )
    return user

def get_user_by_email(email):
    user = (
        db.session.query(
            User
        )
        .filter(User.email == email)
        .one_or_none()
    )
    return user

def set_unusable_password(username):
    user = get_user(username)
    user.password = ''
    db.session.add(user)
    db.session.commit()
    return True

def hash_password(password):
    return pwd_context.hash(password)

@app.route('/activate/<link>')
def activate_endpoint(link):
    payload = verify_activation_link(link)
    if payload:
        _activate_user(payload['id'])
        return redirect("{CATALOG_URL}/signin".format(CATALOG_URL=CATALOG_URL), code=302)
    else:
        response = jsonify({error: "Account activation failed."})
        response.status_code = 400
        return response

CORS(app, resources={"/activate/*": {"origins": "*", "max_age": timedelta(days=1)}})

@app.route('/reset_password', methods=['POST'])
@as_json
def reset_password_endpoint():
    data = request.get_json()
    if 'email' in data:
        return reset_password_from_email(data['email'])
    # try reset request
    raw_password = data['password']
    link = data['link']
    payload = verify_reset_link(link)
    if not payload:
        return {'error': 'Reset token invalid.'}, 401
    user_id = payload['id']
    try:
        user = get_user_by_id(user_id)
    except:
        return {'error': 'User not found.'}, 404
    user.password = hash_password(raw_password)
    db.session.add(user)
    db.session.commit()
    return {}

CORS(app, resources={"/reset_password": {"origins": "*", "max_age": timedelta(days=1)}})

def reset_password_from_email(email):
    user = get_user_by_email(email)
    if not user:
        # User not found. Return 200 anyway to avoid allowing people to enumerate emails
        return {}
    return reset_password(user)

@app.route('/register', methods=['POST'])
@as_json
def register_endpoint():
    data = request.get_json()
    username = data['username']
    password = data['password']
    email = data['email']
    try:
        _create_user(username, password=password, email=email)
        return {}
    except ApiException as e:
        return {'error': e.message}, e.status_code # 409 Conflict

CORS(app, resources={"/register": {"origins": "*", "max_age": timedelta(days=1)}})

def _create_user(username, password='', email=None, is_admin=False,
        first_name=None, last_name=None, force=False, requires_activation=True):
    def check_conflicts(username, email):
        if email is None:
            raise ApiException(400, "Must provide email.")
        # TODO: check email is valid
        if blacklisted_name(username):
            raise ApiException(400, "Unacceptable username.")
        existing_user = get_user(username)
        if existing_user and not force:
            raise ApiException(409, "Username already taken.")
        existing_user_email = get_user_by_email(email)
        if existing_user_email and not force:
            raise ApiException(409, "Email already taken.")

    check_conflicts(username, email)

    existing_user = get_user(username)

    if requires_activation:
        is_active = False
    else:
        is_active = True
    if existing_user:
        user = existing_user
        user.name = username
        user.password = hash_password(password)
        user.email = email
        user.first_name = first_name
        user.last_name = last_name
        user.is_active = is_active
        user.is_admin = is_admin
    else:
        user = User(
                id=generate_uuid(),
                name=username,
                password=hash_password(password),
                email=email,
                first_name=first_name,
                last_name=last_name,
                is_active=is_active,
                is_admin=is_admin)

    try:
        db.session.add(user)
        db.session.commit()
    except IntegrityError:
        if not check_conflicts(username, email):
            raise ApiException(500, "Internal server error.")

    if requires_activation:
        send_activation_email(user, generate_activation_link(user.id))

def _activate_user(user_id):
    user = get_user_by_id(user_id)
    if user is None:
        raise Exception("User not found")
    user.is_active = True
    db.session.add(user)
    db.session.commit()

def get_code(user_id):
    code = (
        db.session.query(
            Code
        )
        .filter(Code.user_id == user_id)
        .one_or_none()
    )
    return code

def get_tokens(user_id):
    tokens = (
        db.session.query(
            Token
        )
        .filter(Token.user_id == user_id)
        .all()
    )
    return tokens

def update_last_login(user_id, timestamp=datetime.utcnow()):
    user = (
        db.session.query(
            User
        )
        .filter(User.id==user_id)
        .one_or_none()
    )
    if not user:
        raise Exception("User not found")

    user.last_login = timestamp
    db.session.add(user)
    db.session.commit()

def revoke_user_code_tokens(user_id):
    code = get_code(user_id)
    if code:
        db.session.delete(code)
    tokens = get_tokens(user_id)
    for token in tokens:
        db.session.delete(token)

def _delete_user(username):
    user = get_user(username)
    if user:
        db.session.delete(user)
    else:
        raise Exception("User to delete not found")
    revoke_user_code_tokens(user.id)
    db.session.commit()
    return user

def _enable_user(username):
    user = get_user(username)
    if user:
        user.is_active = True
        db.session.add(user)
        db.session.commit()
        return True
    else:
        raise Exception("User to enable not found")

def _disable_user(username):
    user = get_user(username)
    if user:
        user.is_active = False
        db.session.add(user)
        revoke_user_code_tokens(user.id)
        db.session.commit()
        return True
    else:
        raise Exception("User to disable not found")

def _list_users():
    users = db.session.query(User).all()
    return users

def issue_code(username):
    user_id = get_user(username).id
    code = (
        db.session.query(
            Code
        ).filter(Code.user_id==user_id)
        .one_or_none()
    )
    if code:
        code.code = generate_uuid()
    else:
        code = Code(user_id=user_id, code=generate_uuid())
    db.session.add(code)
    db.session.commit()
    return encode_code({'id': user_id, 'code': code.code})

def encode_code(code_dict):
    return base64.b64encode(bytes(json.dumps(code_dict), 'utf-8')).decode('utf8')

def decode_code(code_str):
    return json.loads(base64.b64decode(code_str).decode('utf8'))

def try_as_code(code_str):
    try:
        code = decode_code(code_str)
    except:
        return False
    found = (
        db.session.query(
            Code
        ).filter(Code.user_id == code['id'])
        .filter(Code.code == code['code'])
        .one_or_none()
    )
    if found:
        return get_user_by_id(code['id'])
    else:
        return False

def decode_token(token_str):
    token = jwt.decode(token_str, app.secret_key, algorithm='HS256')
    return token

def check_token(user_id, token_id):
    token = (
        db.session.query(
            Token
        )
        .filter(Token.user_id==user_id)
        .filter(Token.token==token_id)
        .one_or_none()
    )
    return token is not None

def _verify(payload):
    user_id = payload['id']
    uuid = payload['uuid']
    user = get_user_by_id(user_id)
    if user is None:
        raise Exception('User ID invalid')

    if not check_token(user_id, uuid):
        raise Exception('Token invalid')
    return user

def verify_token_string(s):
    try:
        token = decode_token(s)
        user = _verify(token)
        return user
    except:
        return False

def exp_from_token(s):
    token = decode_token(s)
    return token['exp']

def revoke_token_string(token_str):
    token = decode_token(token_str)
    user_id = token['id']
    uuid = token['uuid']
    return revoke_token(user_id, uuid)

def revoke_token(user_id, token):
    t = (
        db.session.query(
            Token
        )
        .filter(Token.user_id==user_id)
        .filter(Token.token==token)
        .one_or_none()
    )
    if t is None:
        return False
    db.session.delete(t)
    db.session.commit()
    return True

def revoke_tokens(user_id):
    tokens = (
        db.session.query(
            Token
        ).filter(Token.user_id==user_id)
        .all()
    )
    for token in tokens:
        db.session.delete(token)
    db.session.commit()

def get_exp(mins=30):
    return datetime.utcnow() + timedelta(minutes=mins)

def issue_token(username, exp=None):
    user_id = get_user(username).id
    return issue_token_by_id(user_id, exp)

def issue_token_by_id(user_id, exp=None):
    uuid = generate_uuid()
    token = Token(user_id=user_id, token=uuid)
    db.session.add(token)
    db.session.commit()

    exp = exp or get_exp()
    payload = {'id': user_id, 'uuid': uuid, 'exp': exp}
    token = jwt.encode(payload, app.secret_key, algorithm='HS256')
    return token.decode('utf-8')

def consume_code_string(code_str):
    code = decode_code(code_str)
    return consume_code(code['id'], code['code'])

def consume_code(user_id, code):
    code = (
        db.session.query(
            Code
        )
        .filter(Code.user_id==user_id)
        .filter(Code.code==code)
        .one_or_none()
    )
    if code is None:
        return False

    db.session.delete(code)
    db.session.commit()
    return user_id

def verify_hash(password, pw_hash):
    try:
        if not pwd_context.verify(password, pw_hash):
            raise Exception('Password verification failed')
    except ValueError:
        raise Exception('Password verification failed')
    return True

def try_login(username, password):
    result = (
        db.session.query(
            User.name,
            User.password,
            User.is_active
        ).filter(User.name==username)
        .one_or_none()
    )
    if not result:
        return False

    if not result.is_active:
        return False

    try:
        verify_hash(password, result.password)
    except Exception as e:
        return False
    return True

def create_admin():
    # Only runs in dev
    try:
        admin_username = app.config['DEV_USERNAME']
        admin_password = app.config['DEV_PASSWORD']
        admin_email = app.config['DEV_EMAIL']
    except:
        return
    if not admin_username or not admin_password or not admin_email:
        return
    _create_user(admin_username, password=admin_password, email=admin_email,
            is_admin=True, requires_activation=False, force=True)
    user = get_user(admin_username)
    _activate_user(user.id)

app.before_first_request(create_admin)


linkgenerator = itsdangerous.URLSafeTimedSerializer(
    app.secret_key,
    salt='quilt'
    )

ACTIVATE_SALT = 'activate'
PASSWORD_RESET_SALT = 'reset'
MAX_LINK_AGE = 60 * 60 * 24 # 24 hours

def generate_activation_token(user_id):
    existing_token = (
        db.session.query(
            ActivationToken
        ).filter(ActivationToken.user_id == user_id)
        .one_or_none()
    )
    at = existing_token or ActivationToken(user_id=user_id, token=generate_uuid())
    db.session.add(at)
    db.session.commit()
    return at.token

def consume_activation_token(user_id, token):
    token = (
        db.session.query(
            ActivationToken
        ).filter(ActivationToken.user_id == user_id)
        .filter(ActivationToken.token == token)
        .one_or_none()
    )
    if not token:
        return False
    db.session.delete(token)
    db.session.commit()
    return True

def generate_reset_token(user_id):
    existing_token = (
        db.session.query(
            PasswordResetToken
        ).filter(PasswordResetToken.user_id == user_id)
        .one_or_none()
    )
    rt = existing_token or PasswordResetToken(user_id=user_id, token=generate_uuid())
    db.session.add(rt)
    db.session.commit()
    return rt.token

def consume_reset_token(user_id, token):
    token = (
        db.session.query(
            PasswordResetToken
        ).filter(PasswordResetToken.user_id == user_id)
        .filter(PasswordResetToken.token == token)
        .one_or_none()
    )
    if not token:
        return False
    db.session.delete(token)
    db.session.commit()
    return True


def generate_activation_link(user_id):
    token = generate_activation_token(user_id)
    payload = {'id': user_id, 'token': token}
    return linkgenerator.dumps(payload, salt=ACTIVATE_SALT)

def generate_reset_link(user_id):
    token = generate_reset_token(user_id)
    payload = {'id': user_id, 'token': token}
    return linkgenerator.dumps(payload, salt=PASSWORD_RESET_SALT)

def verify_activation_link(link, max_age=None):
    max_age = max_age if max_age is not None else MAX_LINK_AGE
    try:
        payload = linkgenerator.loads(link, max_age=max_age, salt=ACTIVATE_SALT)
        if not consume_activation_token(payload['id'], payload['token']):
            return False
        return payload
    except:
        return False

def verify_reset_link(link, max_age=None):
    max_age = max_age if max_age is not None else MAX_LINK_AGE
    try:
        payload = linkgenerator.loads(link, max_age=max_age, salt=PASSWORD_RESET_SALT)
        if not consume_reset_token(payload['id'], payload['token']):
            return False
        return payload
    except:
        return False

def reset_password(user):
    if not user:
        return False
    # set_unusable_password(user.name) # is this necessary?
    link = generate_reset_link(user.id)
    send_reset_email(user, link)
    return True
