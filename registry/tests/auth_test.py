import itsdangerous
import json
import jwt
import time
import requests
import unittest
from .utils import QuiltTestCase
from quilt_server.models import Code
from quilt_server.auth import (_create_user, _delete_user, _list_users, get_user, 
        issue_token, encode_code, decode_code, generate_uuid, verify_token_string,
        generate_activation_link, generate_reset_link, verify_activation_link, verify_reset_link
        )

class AuthTestCase(QuiltTestCase):
    """
    unit tests for Flask-based auth
    """
    TEST_USER = 'test_user'
    TEST_PASSWORD = 'beans'
    OTHER_USER = 'edwin'

    def setUp(self):
        super(AuthTestCase, self).setUp()
        _create_user(self.TEST_USER, password=self.TEST_PASSWORD, force=True, requires_activation=False)
        self.TEST_USER_ID = get_user(self.TEST_USER).id
        self.token_verify_mock.stop() # disable auth mock

    def getToken(self):
        response = self.app.post('/login', 
                data=json.dumps({'username': self.TEST_USER, 'password': self.TEST_PASSWORD}))
        try:
            token = json.loads(response.data.decode('utf8')).get('token')
        except Exception as e:
            raise Exception(response.data.decode('utf8'))
        return token

    def decodeToken(self, token):
        return jwt.decode(token, verify=False)

    def testCodeRoundtrips(self):
        code = {'id': generate_uuid(), 'code': generate_uuid()}
        assert code == decode_code(encode_code(code))

    def testIssueToken(self):
        issue_token(self.TEST_USER)

    def testDeleteUser(self):
        _create_user(self.OTHER_USER, force=True, requires_activation=False)
        assert get_user(self.OTHER_USER)
        _delete_user(self.OTHER_USER)
        assert not get_user(self.OTHER_USER)

    def testCreateNewUser(self):
        _create_user(self.OTHER_USER, force=True, requires_activation=False)
        assert get_user(self.OTHER_USER)

    def testUserExists(self):
        assert get_user(self.TEST_USER)

    def testDuplicateUserFails(self):
        try:
            _create_user(self.TEST_USER, requires_activation=False)
        except:
            return True
        raise Exception('Creating duplicate user failed to raise')

    def testListUsers(self):
        _list_users()

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
            '/api-root',
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
        pass

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


    # password reset emails
    # account creation flow
    # one-time codes
    # compiler login flow
    # refresh
    # anti-forgery, expiration, etc
    # user CRUD
    # test logout revokes code + tokens
    # test disabling a user revokes code + tokens
