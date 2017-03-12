"""
Unittest setup.
"""

import json
import random
import string
import unittest

import requests
import responses
import sqlalchemy_utils

import quilt_server
from quilt_server.core import encode_node, hash_contents


class QuiltTestCase(unittest.TestCase):
    """
    Base class for unittests.
    - Creates a test client
    - Creates and drops a test database
    - Mocks requests
    """
    def setUp(self):
        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=False)
        self.requests_mock.start()
        self._mock_user()

        random_name = ''.join(random.sample(string.ascii_lowercase, 10))
        self.db_url = 'mysql+pymysql://root@localhost/test_%s' % random_name

        self.app = quilt_server.app.test_client()
        quilt_server.app.config['TESTING'] = True
        quilt_server.app.config['SQLALCHEMY_ECHO'] = False
        quilt_server.app.config['SQLALCHEMY_DATABASE_URI'] = self.db_url

        sqlalchemy_utils.create_database(self.db_url)
        quilt_server.db.create_all()

    def tearDown(self):
        quilt_server.db.session.remove()
        quilt_server.db.drop_all()
        sqlalchemy_utils.drop_database(self.db_url)

        self.requests_mock.stop()

    def _mock_user(self):
        """Mocks the auth API call and just returns the value of the Authorization header"""
        auth_url = '%s/api-root' % quilt_server.app.config['OAUTH']['base_url']

        def cb(request):
            auth = request.headers.get('Authorization')
            if auth is None:
                return (401, {}, "Not logged in")
            else:
                return (200, {}, json.dumps(dict(current_user=auth)))

        self.requests_mock.add_callback(responses.GET, auth_url, callback=cb)

    def put_package(self, owner, package, contents):
        pkgurl = '/api/package/{usr}/{pkg}/{hash}'.format(
            usr=owner,
            pkg=package,
            hash=hash_contents(contents)
        )

        resp = self.app.put(
            pkgurl,
            data=json.dumps(dict(
                description="",
                contents=contents
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': owner
            }
        )

        assert resp.status_code == requests.codes.ok
