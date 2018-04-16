import json
import jwt
import requests
import sys
import time

import quilt

flask_url = 'http://localhost:5000/'

def decode_token(token):
    return jwt.decode(token, verify=False)

def test_forged_token():
    r = requests.get('%sbeans/get_token' % flask_url).json().get('token')
    # make a new token with the same data, but different signature
    bad_token = jwt.encode(jwt.decode(r, verify=False), 'bad_secret', 
            algorithm='HS256')
    s = requests.post('%sbeans/secret' % flask_url, 
            data=json.dumps({'token': bad_token.decode('utf-8')}))
    if s.ok:
        raise Exception('FAIL - Forged token accepted')
    else:
        print('PASS - Forged token rejected')

def test_expired():
    # endpoint that returns a token that expires at datetime.utcnow()
    r = requests.get('%sbeans/expired' % flask_url).json().get('token')
    time.sleep(2) # let the token expire
    s = requests.post('%sbeans/secret' % flask_url, 
            data=json.dumps({'token': r}))
    if s.ok:
        raise Exception('FAIL - Expired token accepted!')
    else:
        print('PASS - Expired token rejected')

def test_revoke():
    r = requests.get('%sbeans/get_token' % flask_url).json().get('token')
    s = requests.post('%sbeans/secret' % flask_url, 
            data=json.dumps({'token': r}))
    revoke = requests.post('%sbeans/revoke' % flask_url,
                data=json.dumps({'token': r}))
    s = requests.post('%sbeans/secret' % flask_url, 
            data=json.dumps({'token': r}))
    if s.ok:
        raise Exception('FAIL - Revoked token accepted!')
    else:
        print('PASS - Revoked token correctly rejected')

"""
test_forged_token()
test_expired()
test_revoke()
"""
def test_create_user():
    t = requests.post('%sbeans/login' % flask_url, 
            json={'username': 'calvin', 'password': 'beans'})
    # print(t.text)
    token = t.json()['token']
    print(decode_token(token))
    s = requests.post('%sbeans/create_user' % flask_url, json={'token': token})
    print(s.text)

def test_admin():
    t = requests.post('%sbeans/login' % flask_url, 
            json={'username': 'calvin', 'password': 'beans'})
    # print(t.text)
    token = t.json()['token']
    print(decode_token(token))
    r = requests.post('%sbeans/add_role' % flask_url,
            json={'token': token, 'username': 'calvin', 'role': 'admin'})
    s = requests.get('%sbeans/list_roles' % flask_url, 
            json={'token': token, 'username': 'calvin'})
    print(s.text)


test_admin()
# test_create_user()
"""
quilt.tools.command.login_user_pass('calvin', 'beans')
quilt.push('calvin/ex')
"""
