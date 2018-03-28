import json
import jwt
import requests
import sys
import time

flask_url = 'http://localhost:5000/'

def make():
    r = requests.get('%sbeans/get_token' % flask_url).json().get('token')
    # print(jwt.decode(r, verify=False))
    # print(type(r))
    bad_token = jwt.encode({'bad': 'actor'}, 'bad_secret', 
            algorithm='HS256')
    # print(type(bad_token.decode('utf-8')))
    # print(jwt.decode(bad_token, 'bad_secret'))
    s = requests.post('%sbeans/token_printer' % flask_url, 
            data=json.dumps({'token': r}))
    return
    time.sleep(2)
    s = requests.post('%sbeans/secret' % flask_url, 
            data=json.dumps({'token': r}))
    try:
        s = s.json()
        print('Bad token accepted?')
        sys.exit(1)
    except json.decoder.JSONDecodeError as e:
        print('Bad token rejected')
        pass

    return
    b = requests.post('%sbeans/secret' % flask_url, 
            data=json.dumps({'token': bad_token.decode('utf-8')})).json()
    print(type(b))
    print(b)

def test_expired():
    r = requests.get('%sbeans/expired' % flask_url).json().get('token')
    time.sleep(2)
    s = requests.post('%sbeans/token_printer' % flask_url, 
            data=json.dumps({'token': r}))
    try:
        s = s.json()
        raise Exception('Bad token accepted!')
    except json.decoder.JSONDecodeError as e:
        print('Bad token rejected')
        pass


make()
def put_data(data):
    r = requests.post('%sbeans/secret' % flask_url, data=data)
    return

def test_revoke():
    r = requests.get('%sbeans/get_token' % flask_url).json().get('token')
    s = requests.post('%sbeans/token_printer' % flask_url, 
            data=json.dumps({'token': r}))
    revoke = requests.post('%sbeans/revoke' % flask_url,
                data=json.dumps({'token': r}))
    try:
        s = requests.post('%sbeans/token_printer' % flask_url, 
                data=json.dumps({'token': r})).json()
        print('Token should be invalid!')
    except:
        pass
test_revoke()
