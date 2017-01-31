"""
Test push and install endpoints.
"""

import json
import urllib

from quilt_server import app

from .utils import QuiltTestCase

MOCK_AUTH_HEADERS = {
    'Authorization': 'blah'
}

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
            '/api/package/test_user/foo/',
            data=json.dumps(dict(
                hash='123'
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == 200

        data = json.loads(resp.data.decode('utf8'))
        url = urllib.parse.urlparse(data['upload_url'])
        assert url.path == '/%s/test_user/foo/123' % app.config['PACKAGE_BUCKET_NAME']

        # Install the package.
        resp = self.app.get(
            '/api/package/test_user/foo/',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == 200

        data = json.loads(resp.data.decode('utf8'))
        url = urllib.parse.urlparse(data['url'])
        assert url.path == '/%s/test_user/foo/123' % app.config['PACKAGE_BUCKET_NAME']

    def testNotLoggedIn(self):
        resp = self.app.put(
            '/api/package/test_user/foo/',
            data=json.dumps(dict(
                hash='123'
            )),
            content_type='application/json'
        )
        assert resp.status_code == 401

        resp = self.app.get(
            '/api/package/test_user/foo/'
        )
        assert resp.status_code == 401

    def testWrongUser(self):
        resp = self.app.put(
            '/api/package/test_user/foo/',
            data=json.dumps(dict(
                hash='123'
            )),
            content_type='application/json',
            headers={
                'Authorization': 'blah'
            }
        )
        assert resp.status_code == 403

        resp = self.app.get(
            '/api/package/test_user/foo/',
            headers={
                'Authorization': 'blah'
            }
        )
        assert resp.status_code == 403

    def testInvalidRequest(self):
        resp = self.app.put(
            '/api/package/test_user/foo/',
            data='hello',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == 400

        resp = self.app.put(
            '/api/package/test_user/foo/',
            data=json.dumps(dict(
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == 400
