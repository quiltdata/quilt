import os
import sqlalchemy as sa
import uuid

import requests

# AUTH_URI = os.getenv('AUTH_URI')
AUTH_URI = 'postgresql://postgres@localhost/auth'
FLASK_URI = 'http://localhost:5000/'

flask_user = 'calvin'
flask_password = 'beans'

r = requests.post('%slogin' % FLASK_URI, json={'username': flask_user, 'password': flask_password})
print(r.text)
flask_token = r.json().get('token')
print(flask_token)

AUTH_CONNECTION = sa.create_engine(AUTH_URI)

auth_users = AUTH_CONNECTION.execute('select * from auth_user').fetchall()
# columns:
# id: int
# pass: varchar
# last_login: timestamp w/ tz
# is_superuser: bool
# username: varchar
# first_name: varchar
# last_name: varchar
# email: varchar
# is_staff: bool
# is_active: bool
# date_joined: timestamp w/ tz


# import into packages
for user in auth_users:
    (old_id, password, last_login, is_superuser, username, 
        first_name, last_name, email, is_staff, is_active, date_joined) = user
    new_id = uuid.uuid4()


