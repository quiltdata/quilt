from datetime import datetime, timedelta
import uuid

from flask_json import as_json, jsonify
import json
import jwt
from passlib.context import CryptContext

from . import app, db
from .models import Code, Token, User

# TODO : change rounds based on perf test
pwd_context = CryptContext(schemes=['pbkdf2_sha512'])

def generate_uuid():
    return str(uuid.uuid4())

def get_user(username):
    return (
            db.session.query(
                User
            ).filter(User.name==username)
            .one_or_none()
        )

def get_user_by_id(user_id):
    user = (
        db.session.query(
            User
        )
        .filter(User.id==user_id)
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

def _create_user(username, password='', email=None, first_name=None, last_name=None, force=False):
    existing_user = get_user(username)
    if existing_user:
        if not force:
            raise Exception('User already exists')
        else:
            user = existing_user
            user.name = username
            user.password = hash_password(password)
            user.email = email
            user.first_name = first_name
            user.last_name = last_name
    else:
        user = User(
                id=generate_uuid(),
                name=username,
                password=hash_password(password),
                email=email,
                first_name=first_name,
                last_name=last_name)

    db.session.add(user)
    db.session.commit()

def _delete_user(username):
    # TODO: revoke all tokens + code
    user = get_user(username)
    if user:
        db.session.delete(user)
        db.session.commit()
    else:
        raise Exception("User to delete not found")
    return user

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

def check_token(user_id, token_id):
    token = (
        db.session.query(
            Token
        )
        .filter(Token.user_id==user_id)
        .filter(Token.token==token_id)
        .one_or_none()
    )
    return not token is None

def verify(payload):
    name = payload['username']
    uuid = payload['uuid']
    user = get_user(name)
    if user is None:
        raise Exception('Username invalid -- how did you get this token?')

    if not check_token(user.id, uuid):
        raise Exception('Token invalid')
    return True

def verify_token_string(s):
    try:
        token = jwt.decode(s, app.secret_key, algorithm='HS256')
        verify(token)
        return True
    except:
        return False

# TODO: fix
def revoke_tokens(username):
    users[username] = generate_uuid()

def get_exp(mins=30):
    return datetime.utcnow() + timedelta(minutes=mins)

def issue_token(username, exp=None):
    user_id = get_user(username).id
    uuid = generate_uuid()

    token = Token(user_id=user_id, token=uuid)
    db.session.add(token)
    db.session.commit()
    # TODO: store expiration time in database?

    exp = exp or get_exp()
    payload = {'id': user_id, 'uuid': uuid, 'exp': exp}
    token = jwt.encode(payload, app.secret_key, algorithm='HS256')
    return token.decode('utf-8')

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
            User.password
        ).filter(User.name==username)
        .one_or_none()
    )
    if not result:
        return False

    try:
        verify_hash(password, result.password)
    except Exception as e:
        return False
    return True

# TODO: better way to set secret key
app.secret_key = b'thirty two bytes for glory&honor'

def create_admin():
    # TODO: make sure this doesn't run in prod
    _create_user('calvin', password='beans', force=True)

# app.before_first_request(create_admin)
# TODO: figure out why this sometimes doesn't work


# TODO: put lots of this stuff in another file
# TODO: lots of user management stuff
# TODO: purge references to 'users' dictionary
# TODO: test for code exchange (maybe add polymorphism to endpoint in the vein of /login)
# TODO: see if team approves of endpoint polymorphism
# TODO: build + test account creation
    # document how it currently works
    # make sure it's extensible to stuff like github auth
    # think about design for tables for third-party auth
# TODO: change tokens to user id

@app.route('/beans/test')
@as_json
def beans_test():
    auth_test()
    return {}

# TODO: signed URLs for account activation + password resets
import itsdangerous
linkgenerator = itsdangerous.URLSafeTimedSerializer(
        'borpgoestheweasel',
        salt='quilt'
        )

ACTIVATE_SALT = 'activate'
PASSWORD_RESET_SALT = 'reset'
MAX_LINK_AGE = 60 * 60 # 1 hour

def generate_activation_link(user_id):
    payload = {'id': user_id}
    return linkgenerator.dumps(payload, salt=ACTIVATE_SALT)

def generate_reset_link(user_id):
    payload = {'id': user_id}
    return linkgenerator.dumps(payload, salt=PASSWORD_RESET_SALT)

def verify_activation_link(link):
    try:
        return linkgenerator.loads(link, max_age=MAX_LINK_AGE, salt=ACTIVATE_SALT)
    except:
        return False

def verify_reset_link(link):
    try:
        return linkgenerator.loads(link, max_age=MAX_LINK_AGE, salt=PASSWORD_RESET_SALT)
    except:
        return False
