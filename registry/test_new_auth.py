import json
import requests
r = requests.post('http://localhost:5000/beans/login', 
        data=json.dumps({'email': 'calvin+beans@quiltdata.io', 
                        'password': 'beans'}),
        headers={'content-type': 'application/json'}
        ).json()
t = r.get('response').get('user').get('authentication_token')
s = requests.get('http://localhost:5000/beans/secret', 
        headers={'Authentication-Token': t})
print(s.json())
