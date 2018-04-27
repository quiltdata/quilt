import json
import time
import requests
import unittest
from .utils import QuiltTestCase
from quilt_server.auth import _create_user, _delete_user, _list_users, get_user, issue_token

class AuthTestCase(QuiltTestCase):
    """
    unit tests for Flask-based auth
    """
    TEST_USER = 'quilt'
    TEST_PASSWORD = 'beans'
    OTHER_USER = 'edwin'

    def setUp(self):
        super(AuthTestCase, self).setUp()
        _create_user(self.TEST_USER, password=self.TEST_PASSWORD, force=True)

    def getToken(self, username, password):
        response = self.app.post('/login', 
                data=json.dumps({'username': self.TEST_USER, 'password': self.TEST_PASSWORD}))
        try:
            token = json.loads(response.get_data()).get('token')
        except Exception as e:
            raise Exception(response.get_data())
        return token

    def testIssueToken(self):
        issue_token(self.TEST_USER)

    def testDeleteUser(self):
        _create_user(self.OTHER_USER, force=True)
        assert get_user(self.OTHER_USER)
        _delete_user(self.OTHER_USER)
        assert not get_user(self.OTHER_USER)

    def testCreateNewUser(self):
        _create_user(self.OTHER_USER, force=True)
        assert get_user(self.OTHER_USER)

    def testUserExists(self):
        assert get_user(self.TEST_USER)

    def testDuplicateUserFails(self):
        try:
            _create_user(self.TEST_USER)
        except:
            return True
        raise Exception('Creating duplicate user failed to raise')

    def testListUsers(self):
        _list_users()

    def testLoginUserPass(self):
        token = self.getToken(self.TEST_USER, self.TEST_PASSWORD)
        pass

    def testRefreshToken(self):
        # try to exchange a token for a new one that expires later
        token = self.getToken(self.TEST_USER, self.TEST_PASSWORD)

        time.sleep(1)
        pass

    # password reset emails
    # account creation flow
    # one-time codes
    # compiler login flow
    # refresh
    # anti-forgery, expiration, etc
    # user CRUD
