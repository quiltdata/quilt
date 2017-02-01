"""
Test push and install endpoints.
"""

import json
import urllib

import requests

from quilt_server import app

from .utils import QuiltTestCase

MOCK_AUTH_HEADERS = {
    'Authorization': 'blah'
}

class AccessTestCase(QuiltTestCase):
    """
    Test access endpoints and access control for
    push/install.
    """

    def testShareDataset(self):
        """
        Push a package, share it and test that the
        recipient can read it.
        """
        user = "test_user"
        sharewith = "anotheruser"
        pkg = "pkgtoshare"
        pkghash = '123'
        bucket = app.config['PACKAGE_BUCKET_NAME']
        pkgurl = '/api/package/{usr}/{pkg}/'.format(usr=user, pkg=pkg)
        
        # Push a package.
        resp = self.app.put(
            pkgurl,
            data=json.dumps(dict(
                hash=pkghash
            )),
            content_type='application/json',
            headers={
                'Authorization': user
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        url = urllib.parse.urlparse(data['upload_url'])
        expected = '/{bucket}/{usr}/{pkg}/{hash}'.format(usr=user,
                                                         pkg=pkg,
                                                         hash=pkghash,
                                                         bucket=bucket)
        assert url.path == expected, "Got: %s\nExpected: %s" % (url.path, expected)

        # Share the package.
        resp = self.app.put(
            '/api/access/{owner}/{pkg}/{usr}'.format(owner=user, usr=sharewith, pkg=pkg),
            data=json.dumps(dict(user=sharewith)),
            content_type='application/json',
            headers={
                'Authorization': user
            }
        )

        assert resp.status_code == requests.codes.ok

        # Test that the receiver can read the package
        resp = self.app.get(
            pkgurl,
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok

    def testNoAccess(self):
        """
        Push a package and test that non-sharing users
        can't access it.
        """
        user = "test_user"
        sharewith = "anotheruser"
        pkg = "pkgtoshare"
        pkghash = '123'
        bucket = app.config['PACKAGE_BUCKET_NAME']
        pkgurl = '/api/package/{usr}/{pkg}/'.format(usr=user, pkg=pkg)
        
        # Push a package.
        resp = self.app.put(
            pkgurl,
            data=json.dumps(dict(
                hash=pkghash
            )),
            content_type='application/json',
            headers={
                'Authorization': user
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        url = urllib.parse.urlparse(data['upload_url'])
        expected = '/{bucket}/{usr}/{pkg}/{hash}'.format(usr=user,
                                                         pkg=pkg,
                                                         hash=pkghash,
                                                         bucket=bucket)
        assert url.path == expected, "Got: %s\nExpected: %s" % (url.path, expected)

        # Share the package.
        resp = self.app.put(
            '/api/access/{owner}/{pkg}/{usr}'.format(owner=user, usr=sharewith, pkg=pkg),
            data=json.dumps(dict(
                user=sharewith
            )),
            content_type='application/json',
            headers={
                'Authorization': user
            }
        )

        assert resp.status_code == requests.codes.ok

        # Test that other users can't read the package
        resp = self.app.get(
            pkgurl,
            headers={
                'Authorization': "not" + sharewith
            }
        )

        assert resp.status_code == requests.codes.not_found

    def testSharerCanPushNewVersion(self):
        """
        Push a package, share it and test that the
        recipient can add a new version.
        """
        user = "test_user"
        sharewith = "anotheruser"
        pkg = "pkgtoshare"
        pkghash = '123'
        newhash = '234'
        bucket = app.config['PACKAGE_BUCKET_NAME']
        pkgurl = '/api/package/{usr}/{pkg}/'.format(usr=user, pkg=pkg)
        
        # Push a package.
        resp = self.app.put(
            pkgurl,
            data=json.dumps(dict(
                hash=pkghash
            )),
            content_type='application/json',
            headers={
                'Authorization': user
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        url = urllib.parse.urlparse(data['upload_url'])
        expected = '/{bucket}/{usr}/{pkg}/{hash}'.format(usr=user,
                                                         pkg=pkg,
                                                         hash=pkghash,
                                                         bucket=bucket)
        assert url.path == expected, "Got: %s\nExpected: %s" % (url.path, expected)

        # Share the package.
        resp = self.app.put(
            '/api/access/{owner}/{pkg}/{usr}'.format(owner=user, usr=sharewith, pkg=pkg),
            data=json.dumps(dict(
                user=sharewith
            )),
            content_type='application/json',
            headers={
                'Authorization': user
            }
        )

        assert resp.status_code == requests.codes.ok

        # Test that the receiver can create a new version
        # of the package
        resp = self.app.put(
            pkgurl,
            data=json.dumps(dict(
                hash=newhash
            )),
            content_type='application/json',
            headers={
                'Authorization': sharewith
            }
            )

        assert resp.status_code == requests.codes.ok
