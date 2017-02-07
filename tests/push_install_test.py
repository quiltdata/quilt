"""
Test push and install endpoints.
"""

import json
import urllib

import requests

from quilt_server import app

from .utils import QuiltTestCase


class PushInstallTestCase(QuiltTestCase):
    """
    Test push and install endpoints.
    """

    def testSuccessfulPushInstall(self):
        """
        Push a package, then install it.
        """
        # Push a package.
        resp = self.app.put(
            '/api/package/test_user/foo/123',
            data=json.dumps(dict(
                description=""
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        url = urllib.parse.urlparse(data['upload_url'])
        assert url.path == '/%s/test_user/foo/123' % app.config['PACKAGE_BUCKET_NAME']

        # List packages.
        resp = self.app.get(
            '/api/package/test_user/foo/',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        assert data['hashes'] == ['123']

        # Install the package.
        resp = self.app.get(
            '/api/package/test_user/foo/123',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        url = urllib.parse.urlparse(data['url'])
        assert url.path == '/%s/test_user/foo/123' % app.config['PACKAGE_BUCKET_NAME']

    def testNotLoggedIn(self):
        resp = self.app.put(
            '/api/package/test_user/foo/123',
            data=json.dumps(dict(
                description=""
            )),
            content_type='application/json'
        )
        assert resp.status_code == requests.codes.unauthorized

        resp = self.app.get(
            '/api/package/test_user/foo/123'
        )
        assert resp.status_code == requests.codes.unauthorized

    def testCreateWrongUser(self):
        resp = self.app.put(
            '/api/package/test_user/foo/123',
            data=json.dumps(dict(
                description=""
            )),
            content_type='application/json',
            headers={
                'Authorization': 'blah'
            }
        )
        assert resp.status_code == requests.codes.forbidden

    def testInvalidRequest(self):
        resp = self.app.put(
            '/api/package/test_user/foo/123',
            data='hello',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.bad_request

        resp = self.app.put(
            '/api/package/test_user/foo/123',
            data=json.dumps(dict(
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.bad_request

    def testCase(self):
        # Can't create a package if the username has the wrong case.
        resp = self.app.put(
            '/api/package/Test_User/foo/123',
            data=json.dumps(dict(
                description=""
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.forbidden

        # Successfully create a package.
        resp = self.app.put(
            '/api/package/test_user/foo/123',
            data=json.dumps(dict(
                description=""
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        # Can't update with the wrong username case.
        resp = self.app.put(
            '/api/package/Test_User/foo/123',
            data=json.dumps(dict(
                description=""
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.forbidden

        # Can't update with the wrong package name case.
        resp = self.app.put(
            '/api/package/test_user/Foo/123',
            data=json.dumps(dict(
                description=""
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.forbidden

        # Can't install with the wrong case.
        # TODO: Special error for this one.
        resp = self.app.get(
            '/api/package/test_user/Foo/123',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.not_found
