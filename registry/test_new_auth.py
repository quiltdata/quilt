import json
import requests

def make(token):
    return requests.get('http://localhost:5000/beans/supersecret', 
            headers={'Authentication-Token': token})

r = requests.post('http://localhost:5000/beans/login', 
        data=json.dumps({'email': 'calvin+beans@quiltdata.io', 
                        'password': 'beans'}),
        headers={'content-type': 'application/json'}
        ).json()
t = r.get('response').get('user').get('authentication_token')
s = make(t)
print(s.json())
