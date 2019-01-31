import itsdangerous
import json
import jwt
import time
import requests
import unittest
from unittest import mock
from unittest.mock import patch
from .utils import QuiltTestCase
from quilt_server import app, db
from quilt_server.models import Code, User
from quilt_server.auth import (_create_user, _delete_user, issue_token,
        encode_code, decode_code, generate_uuid, verify_token_string,
        generate_activation_link, generate_reset_link, verify_activation_link,
        verify_reset_link, verify_hash
        )

CATALOG_URL = app.config['CATALOG_URL']

class AuthTestCase(QuiltTestCase):
    """
    unit tests for Flask-based auth
    """
    ADMIN_USERNAME = 'test_admin'
    ADMIN_PASSWORD = 'test_admin'

    def setUp(self):
        super(AuthTestCase, self).setUp()
        self.TEST_USER_ID = User.query.filter_by(name=self.TEST_USER).one_or_none().id
        self.token_verify_mock.stop() # disable auth mock

    def createAdmin(self):
        _create_user(self.ADMIN_USERNAME, password=self.ADMIN_PASSWORD, is_admin=True,
                email='test_admin@example.com', requires_activation=False)

    def getToken(self, username=None, password=None):
        username = username or self.TEST_USER
        password = password or self.TEST_USER_PASSWORD
        response = self.app.post(
                '/api/login',
                headers={'content-type': 'application/json'},
                data=json.dumps({'username': username, 'password': password})
                )
        try:
            token = json.loads(response.data.decode('utf8')).get('token')
        except Exception as e:
            raise Exception(response.data.decode('utf8'))
        return token

    def useToken(self, token):
        return self.app.get(
            '/api/me',
            headers={
                'content-type': 'application/json',
                'Authorization': token
            }
            )

    def decodeToken(self, token):
        return jwt.decode(token, verify=False)

    def testCodeRoundtrips(self):
        code = {'id': generate_uuid(), 'code': generate_uuid()}
        assert code == decode_code(encode_code(code))

    def testIssueToken(self):
        assert issue_token(User.query.filter_by(name=self.TEST_USER).one_or_none())

    def testDeleteUser(self):
        assert User.query.filter_by(name=self.OTHER_USER).one_or_none()
        _delete_user(User.query.filter_by(name=self.OTHER_USER).one_or_none())
        db.session.commit()
        assert not User.query.filter_by(name=self.OTHER_USER).one_or_none()

    def testUserExists(self):
        assert User.query.filter_by(name=self.TEST_USER).one_or_none()

    def testDuplicateUserFails(self):
        try:
            _create_user(self.TEST_USER, pasword=self.TEST_PASSWORD,
                    email=self.TEST_USER_EMAIL, requires_activation=False)
        except:
            return True
        raise Exception('Creating duplicate user failed to raise')

    def testLoginUserPass(self):
        token = self.getToken()
        assert token

    def testVerifyTokenAsString(self):
        token = self.getToken()
        assert verify_token_string(token)

    def testRefreshToken(self):
        # try to exchange a token for a new one that expires later
        token = self.getToken()
        t = self.decodeToken(token)
        exp = t.get('exp')

        auth_headers = {
            'Authorization': token,
            'content-type': 'application/json'
        }
        api_root_request = self.app.get(
            '/api/me',
            headers=auth_headers
        )
        assert api_root_request.status_code == 200

        time.sleep(2)
        auth_headers = {
            'Authorization': token,
            'content-type': 'application/json'
        }
        new_token_request = self.app.post(
                '/api/refresh',
                headers=auth_headers
            )

        new_token = json.loads(new_token_request.data.decode('utf8')).get('token')
        new_exp = self.decodeToken(new_token).get('exp')
        assert new_exp > exp

        # test re-creating user doesn't invalidate tokens
        try:
            _create_user(self.TEST_USER, password=self.TEST_PASSWORD,
                    email='{user}{suf}'.format(user=self.TEST_USER, suf=self.email_suffix),
                    requires_activation=False)
        except:
            pass

        auth_headers = {
            'Authorization': new_token,
            'content-type': 'application/json'
        }
        api_root_request = self.app.get(
            '/api/me',
            headers=auth_headers
        )
        assert api_root_request.status_code == 200

    def testActivationLink(self):
        link = generate_activation_link(self.TEST_USER_ID)
        assert verify_activation_link(link)

    def testResetLink(self):
        link = generate_reset_link(self.TEST_USER_ID)
        payload = verify_reset_link(link)
        assert payload
        assert payload['id']

    def testLinksExpire(self):
        activate_link = generate_activation_link(self.TEST_USER_ID)
        reset_link = generate_reset_link(self.TEST_USER_ID)
        time.sleep(1)
        assert not verify_activation_link(activate_link, 0)
        assert not verify_reset_link(reset_link, 0)

    def testWrongLinksShouldFail(self):
        activate_link = generate_activation_link(self.TEST_USER_ID)
        reset_link = generate_reset_link(self.TEST_USER_ID)
        assert not verify_reset_link(activate_link)
        assert not verify_activation_link(reset_link)

    @patch('quilt_server.auth.send_activation_email')
    def testRegister(self, send_activation_email):
        user = 'new_user'
        email = 'new_user@example.com'
        password = 'example_password'
        response = self.app.post(
            '/api/register',
            headers={'content-type': 'application/json'},
            data=json.dumps(
                {'username': user,
                 'email': email,
                 'password': password}
            )
        )
        assert response.status_code == 200
        assert send_activation_email.called
        user = send_activation_email.call_args[0][0]
        link = send_activation_email.call_args[0][1]

        activate_response = self.app.get(
            '/activate/{link}'.format(link=link)
        )
        assert activate_response.status_code == 302
        assert activate_response.location[-6:] == 'signin'

    def testLoginRedirectsToCode(self):
        response = self.app.get(
            '/login'
        )
        assert response.status_code == 302
        assert response.location == '{CATALOG_URL}/code'.format(CATALOG_URL=CATALOG_URL)

    @patch('quilt_server.auth.send_reset_email')
    def testReset(self, send_reset_email):
        user = self.TEST_USER
        email = '{user}{suf}'.format(user=user, suf=self.email_suffix)
        new_password = 'new_password'
        bad_password = 'bad'
        response = self.app.post(
            '/api/reset_password',
            headers={'content-type': 'application/json'},
            data=json.dumps({'email': 'user-that-definitely-does-not-exist{suf}'
                .format(suf=self.email_suffix)})
        )
        assert response.status_code == 200
        assert not send_reset_email.called
        token = self.getToken()
        assert token
        assert self.useToken(token).status_code == 200

        response = self.app.post(
            '/api/reset_password',
            headers={'content-type': 'application/json'},
            data=json.dumps({'email': email})
        )

        assert response.status_code == 200
        assert send_reset_email.called
        assert self.getToken() # old password still works

        called_user = send_reset_email.call_args[0][0]
        assert called_user.name == user
        assert called_user.email == email
        reset_link = send_reset_email.call_args[0][1]

        reset_response = self.app.post(
            '/api/change_password',
            headers={'content-type': 'application/json'},
            data=json.dumps({'link': reset_link, 'password': new_password})
        )
        assert reset_response.status_code == 200
        assert not self.getToken()
        assert self.useToken(token).status_code == 401

        new_password_request = self.app.post(
                '/api/login',
                headers={'content-type': 'application/json'},
                data=json.dumps({'username': self.TEST_USER, 'password': new_password})
                )
        assert new_password_request.status_code == 200
        assert json.loads(new_password_request.data.decode('utf8')).get('token')

        # test link doesn't work twice
        new_reset_response = self.app.post(
            '/api/change_password',
            headers={'content-type': 'application/json'},
            data=json.dumps({'link': reset_link, 'password': bad_password})
        )
        assert new_reset_response.status_code != 200
        assert not self.getToken(user, bad_password)


    @patch('quilt_server.auth.send_activation_email')
    def testActivate(self, send_activation_email):
        payload = {
            'username' : 'new_user',
            'password' : 'password',
            'email' : 'new_user@quiltdata.io'
        }

        new_user_request = self.app.post(
            '/api/register',
            headers={'content-type': 'application/json'},
            data=json.dumps(payload)
        )
        assert new_user_request.status_code == 200
        assert send_activation_email.called

        assert not self.getToken(payload['username'], payload['password'])

        called_user = send_activation_email.call_args[0][0]
        activate_link = send_activation_email.call_args[0][1]

        activate_request = self.app.get(
            '/activate/{link}'.format(link=activate_link)
        )

        assert activate_request.status_code == 302
        assert activate_request.location[-6:] == 'signin'
        assert self.getToken(payload['username'], payload['password'])

    def testGetCode(self):
        token = self.getToken()
        code_request = self.app.get(
            '/api/code',
            headers={
                'Authorization': token,
                'content-type': 'application/json'
            }
        )
        assert code_request.status_code == 200


    def testCompilerLogin(self):
        # get initial token
        token = self.getToken()
        # request code
        code_request = self.app.get(
            '/api/code',
            headers={
                'Authorization': token,
                'content-type': 'application/json'
            }
        )
        assert code_request.status_code == 200
        code = json.loads(code_request.data.decode('utf8')).get('code')

        # exchange code for token
        token_request = self.app.post(
            '/api/token',
            data={'refresh_token': code}
        )
        assert token_request.status_code == 200

        # check code doesn't work twice
        token_request2 = self.app.post(
            '/api/token',
            data={'refresh_token': code}
        )
        assert token_request2.status_code == 401

        payload = json.loads(token_request.data.decode('utf8'))
        assert payload['access_token'] == payload['refresh_token']
        assert 'expires_at' in payload
        old_exp = payload['expires_at']
        new_token = payload['refresh_token']

        # refresh token
        refresh_request = self.app.post(
            '/api/token',
            data={'refresh_token': new_token}
        )
        assert refresh_request.status_code == 200
        refreshed_token_payload = json.loads(refresh_request.data.decode('utf8'))
        assert 'expires_at' in refreshed_token_payload
        assert refreshed_token_payload['access_token'] == refreshed_token_payload['refresh_token']

    def testDisabledandDeletedUsersCodesAndTokensAreRevoked(self):
        admin_token_request = self.app.post(
            '/api/login',
            data=json.dumps(
                {'username': self.TEST_ADMIN,
                 'password': self.TEST_ADMIN_PASSWORD}),
            headers={'content-type': 'application/json'}
        )
        assert admin_token_request.status_code == 200
        admin_token = json.loads(admin_token_request.data.decode('utf8'))['token']

        def disable_user(username):
            request = self.app.post(
                '/api/users/disable',
                data=json.dumps({'username': username}),
                headers={
                    'content-type': 'application/json',
                    'Authorization': admin_token
                }
            )
            assert request.status_code == 200

        def enable_user(username):
            request = self.app.post(
                '/api/users/enable',
                data=json.dumps({'username': username}),
                headers={
                    'content-type': 'application/json',
                    'Authorization': admin_token
                }
            )
            assert request.status_code == 200

        def api_root(token):
            request = self.app.get(
                '/api/me',
                headers={
                    'content-type': 'application/json',
                    'Authorization': token
                }
            )
            return request

        def logout(token):
            request = self.app.post(
                '/api/logout',
                headers={
                    'content-type': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            )
            return request

        first_token = self.getToken('user1', 'user1')
        assert api_root(first_token).status_code == 200
        disable_user('user1')
        assert not self.getToken('user1', 'user1')
        assert api_root(first_token).status_code == 401
        enable_user('user1')
        new_token = self.getToken('user1', 'user1')
        assert api_root(new_token).status_code == 200
        assert logout(new_token).status_code == 200
        assert api_root(new_token).status_code == 401

    def testMigratePasswordsWillWork(self):
        old_pw = 'quilt'
        old_pw_hash = 'pbkdf2_sha256$20000$PEZ6yGDDm4LK$Jx9/lOYmgbELXywYYrySjTkc1yBcpZM4fUjRtI8ajRA='
        verify_hash(old_pw, old_pw_hash)

    def testBadLoginAttempt(self):
        username = 'asdf'
        password = 'jkl;asdf'
        response = self.app.post(
                '/api/login',
                # headers={'content-type': 'application/json'},
                data=json.dumps({'username': username, 'password': password})
                )
        assert response.status_code == 400

    def testMultipleCodes(self):
        token = self.getToken()
        def code_request():
            code_request = self.app.get(
                '/api/code',
                headers={
                    'Authorization': token,
                    'content-type': 'application/json'
                }
            )
            return code_request

        def exchange_code_for_token(code):
            token_request = self.app.post(
                '/api/token',
                data={'refresh_token': code}
            )
            return token_request

        def api_root(token_request):
            token = json.loads(token_request.data.decode('utf8')).get('access_token')
            request = self.app.get(
                '/api/me',
                headers={
                    'content-type': 'application/json',
                    'Authorization': token
                }
            )
            return request

        code1 = code_request()
        code1unpacked = json.loads(code1.data.decode('utf8')).get('code')
        code2 = code_request()
        code2unpacked = json.loads(code2.data.decode('utf8')).get('code')
        token1 = exchange_code_for_token(code1unpacked)
        assert token1.status_code == 200
        token2 = exchange_code_for_token(code2unpacked)
        assert token2.status_code == 200
        assert api_root(token1).status_code == 200
        assert api_root(token2).status_code == 200

    def testCodeExpires(self):
        with mock.patch('quilt_server.auth.CODE_TTL_DEFAULT', {'minutes': 0}):
            token = self.getToken()
            code_request = self.app.get(
                '/api/code',
                headers={
                    'Authorization': token,
                    'content-type': 'application/json'
                }
            )
            assert code_request.status_code == 200
        time.sleep(1)
        code = json.loads(code_request.data.decode('utf8')).get('code')
        token_request = self.app.post(
            '/api/token',
            data={'refresh_token': code}
        )
        assert token_request.status_code == 401

    def testRoles(self):
        with mock.patch('quilt_server.views.sts_client') as client:
            def f(**params):
                return {'Credentials': {
                            'AccessKeyId': 'asdf',
                            'SecretAccessKey': 'asdf',
                            'SessionToken': 'asdf'
                        }}
            client.assume_role = f

            self.createAdmin()
            token = self.getToken(self.ADMIN_USERNAME, self.ADMIN_PASSWORD)

            headers = {
                'Authorization': token,
                'content-type': 'application/json'
            }

            # create role
            params = {
                'name': 'test_role',
                'arn': 'asdf123'
            }
            role_request = self.app.post(
                    '/api/roles/edit',
                    data=json.dumps(params),
                    headers=headers
                )
            assert role_request.status_code == 200

            # attach role to user
            params = {
                'username': self.ADMIN_USERNAME,
                'role': 'test_role'
            }
            attach_request = self.app.post(
                    '/api/users/attach_role',
                    data=json.dumps(params),
                    headers=headers
                )
            assert attach_request.status_code == 200

            # get credentials for role
            creds_request = self.app.get(
                    '/api/auth/get_credentials',
                    headers=headers
                )
            assert creds_request.status_code == 200

            # verify role appears in list
            list_request = self.app.get(
                    '/api/roles/list',
                    headers=headers
                )
            assert list_request.status_code == 200
            results = json.loads(list_request.data.decode('utf-8'))['results']
            assert len(results) == 1
            assert results[0] == {'arn': 'asdf123', 'name': 'test_role'}

            # change the arn
            params = {
                'name': 'test_role',
                'arn': 'qwer456'
            }
            edit_role_request = self.app.post(
                    '/api/roles/edit',
                    data=json.dumps(params),
                    headers=headers
                )
            assert edit_role_request.status_code == 200

            list_request = self.app.get(
                    '/api/roles/list',
                    headers=headers
                )
            assert list_request.status_code == 200
            results = json.loads(list_request.data.decode('utf-8'))['results']
            assert len(results) == 1
            assert results[0] == {'arn': 'qwer456', 'name': 'test_role'}

            # change the name
            params = {
                'name': 'test_role',
                'new_name': 'new_test_role'
            }
            edit_role_request = self.app.post(
                    '/api/roles/edit',
                    data=json.dumps(params),
                    headers=headers
                )
            assert edit_role_request.status_code == 200

            list_request = self.app.get(
                    '/api/roles/list',
                    headers=headers
                )
            assert list_request.status_code == 200
            results = json.loads(list_request.data.decode('utf-8'))['results']
            assert len(results) == 1
            assert results[0] == {'arn': 'qwer456', 'name': 'new_test_role'}

            # ensure default user cannot access credentials
            creds_request = self.app.get(
                    '/api/auth/get_credentials',
                    headers={
                        'Authorization': self.getToken(),
                        'content-type': 'application/json'
                    }
                )
            assert creds_request.status_code == 400

            # add default user to role
            params = {
                'username': self.TEST_USER,
                'role': 'new_test_role'
            }
            attach_request = self.app.post(
                    '/api/users/attach_role',
                    data=json.dumps(params),
                    headers=headers
                )
            assert attach_request.status_code == 200

            # ensure default user can access credentials
            creds_request = self.app.get(
                    '/api/auth/get_credentials',
                    headers={
                        'Authorization': self.getToken(),
                        'content-type': 'application/json'
                    }
                )
            assert creds_request.status_code == 200

            # remove default user from role
            params = {
                'username': self.TEST_USER,
                'role': ''
            }
            attach_request = self.app.post(
                    '/api/users/attach_role',
                    data=json.dumps(params),
                    headers=headers
                )
            assert attach_request.status_code == 200

            # ensure default user cannot access credentials
            creds_request = self.app.get(
                    '/api/auth/get_credentials',
                    headers={
                        'Authorization': self.getToken(),
                        'content-type': 'application/json'
                    }
                )
            assert creds_request.status_code == 400

            # delete the role
            params = {
                'name': 'new_test_role',
            }
            delete_role_request = self.app.post(
                    '/api/roles/edit',
                    data=json.dumps(params),
                    headers=headers
                )
            assert delete_role_request.status_code == 200

            list_request = self.app.get(
                    '/api/roles/list',
                    headers=headers
                )
            assert list_request.status_code == 200
            results = json.loads(list_request.data.decode('utf-8'))['results']
            assert len(results) == 0

            # ensure we cannot get credentials for deleted role
            creds_request = self.app.get(
                    '/api/auth/get_credentials',
                    headers=headers
                )
            assert creds_request.status_code == 400


            # create role
            params = {
                'name': 'test_role',
                'arn': 'asdf123'
            }
            role_request = self.app.post(
                    '/api/roles/edit',
                    data=json.dumps(params),
                    headers=headers
                )
            assert role_request.status_code == 200

            # non-admin tests

            headers = {
                'Authorization': self.getToken(),
                'content-type': 'application/json'
            }

            # change the name
            params = {
                'name': 'test_role',
                'new_name': 'new_test_role'
            }
            edit_role_request = self.app.post(
                    '/api/roles/edit',
                    data=json.dumps(params),
                    headers=headers
                )
            assert edit_role_request.status_code == 403

            # change the arn
            params = {
                'name': 'test_role',
                'arn': 'arn456'
            }
            edit_role_request = self.app.post(
                    '/api/roles/edit',
                    data=json.dumps(params),
                    headers=headers
                )
            assert edit_role_request.status_code == 403

            # delete the role
            params = {
                'name': 'test_role'
            }
            edit_role_request = self.app.post(
                    '/api/roles/edit',
                    data=json.dumps(params),
                    headers=headers
                )
            assert edit_role_request.status_code == 403

            # attach role to user
            params = {
                'username': self.TEST_USER,
                'role': 'test_role'
            }
            attach_request = self.app.post(
                    '/api/users/attach_role',
                    data=json.dumps(params),
                    headers=headers
                )
            assert attach_request.status_code == 403

            # remove role from user
            params = {
                'username': self.TEST_USER
            }
            attach_request = self.app.post(
                    '/api/users/attach_role',
                    data=json.dumps(params),
                    headers=headers
                )
            assert attach_request.status_code == 403

            # list roles
            list_request = self.app.get(
                    '/api/roles/list',
                    headers=headers
                )
            assert list_request.status_code == 403

            # get credentials without a role
            creds_request = self.app.get(
                    '/api/auth/get_credentials',
                    headers=headers
                )
            assert creds_request.status_code == 400
