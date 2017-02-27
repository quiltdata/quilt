"""
Test push and install endpoints.
"""

import json
import urllib

import requests

from quilt_server import app
from quilt_server.schemas import hash_contents

from .utils import QuiltTestCase


class PushInstallTestCase(QuiltTestCase):
    """
    Test push and install endpoints.
    """

    HASH1 = 'd146942c9a051553f77d1e00672f2829565c590be972a1330de726a8db223589'
    HASH2 = '4cf37d7f670709346438cf2f2598db630eb34520947308aed55ad5e53f0c1518'

    CONTENTS = {
        "foo": {
            "$type": "TABLE",
            "hashes": [HASH1, HASH2]
        },
        "group1": {
            "$type": "GROUP",
            "empty": {
                "$type": "TABLE",
                "hashes": []
            },
            "group2": {
                "$type": "GROUP",
                "bar": {
                    "$type": "TABLE",
                    "hashes": [HASH1]
                }
            }
        }
    }

    CONTENTS_WITH_METADATA = {
        "foo": {
            "$type": "TABLE",
            "metadata": {
                "important": True
            },
            "hashes": [HASH1, HASH2]
        },
        "group1": {
            "$type": "GROUP",
            "empty": {
                "$type": "TABLE",
                "hashes": [],
                "metadata": {
                    "whatever": "123"
                }
            },
            "group2": {
                "$type": "GROUP",
                "bar": {
                    "$type": "TABLE",
                    "hashes": [HASH1]
                }
            }
        }
    }

    CONTENTS_HASH = 'a163e05b57cbb074ccb6d34adfdf0ffd3c3d320026e3f2c075ef7b14a33a46f0'

    def testContentsHash(self):
        assert hash_contents(self.CONTENTS) == self.CONTENTS_HASH
        assert hash_contents(self.CONTENTS_WITH_METADATA) == self.CONTENTS_HASH

    def testSuccessfulPushInstall(self):
        """
        Push a package, then install it.
        """
        # Push a package.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        urls = data['upload_urls']
        assert len(urls) == 2

        url1 = urllib.parse.urlparse(urls[self.HASH1])
        url2 = urllib.parse.urlparse(urls[self.HASH2])
        assert url1.path == '/%s/test_user/foo/%s' % (app.config['PACKAGE_BUCKET_NAME'], self.HASH1)
        assert url2.path == '/%s/test_user/foo/%s' % (app.config['PACKAGE_BUCKET_NAME'], self.HASH2)

        # List user's packages.
        resp = self.app.get(
            '/api/package/test_user/',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        assert data['packages'] == ['foo']

        # List package instances.
        resp = self.app.get(
            '/api/package/test_user/foo/',
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        assert data['hashes'] == [self.CONTENTS_HASH]

        # Install the package.
        resp = self.app.get(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            headers={
                'Authorization': 'test_user'
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        contents = data['contents']
        assert contents == self.CONTENTS
        urls = data['urls']
        assert len(urls) == 2

        url1 = urllib.parse.urlparse(urls[self.HASH1])
        url2 = urllib.parse.urlparse(urls[self.HASH2])
        assert url1.path == '/%s/test_user/foo/%s' % (app.config['PACKAGE_BUCKET_NAME'], self.HASH1)
        assert url2.path == '/%s/test_user/foo/%s' % (app.config['PACKAGE_BUCKET_NAME'], self.HASH2)

    def testPushNewMetadata(self):
        # Push the original contents.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Push the metadata.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS_WITH_METADATA
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Verify that the metadata got saved.
        resp = self.app.get(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        assert data['contents'] == self.CONTENTS_WITH_METADATA

    def testNotLoggedIn(self):
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            )),
            content_type='application/json'
        )
        assert resp.status_code == requests.codes.unauthorized

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

        resp = self.app.get(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
        )
        assert resp.status_code == requests.codes.not_found

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testCreateWrongUser(self):
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            )),
            content_type='application/json',
            headers={
                'Authorization': 'blah'
            }
        )
        assert resp.status_code == requests.codes.forbidden

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testInvalidRequest(self):
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data='hello',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.bad_request

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.bad_request

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testInvalidHash(self):
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.HASH1,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.bad_request

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testCase(self):
        # Can't create a package if the username has the wrong case.
        resp = self.app.put(
            '/api/package/Test_User/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.forbidden

        # Successfully create a package.
        resp = self.app.put(
            '/api/package/test_user/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.ok

        # Can't update with the wrong username case.
        resp = self.app.put(
            '/api/package/Test_User/foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
            )),
            content_type='application/json',
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.forbidden

        # Can't update with the wrong package name case.
        resp = self.app.put(
            '/api/package/test_user/Foo/%s' % self.CONTENTS_HASH,
            data=json.dumps(dict(
                description="",
                contents=self.CONTENTS
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
            '/api/package/test_user/Foo/%s' % self.CONTENTS_HASH,
            headers={
                'Authorization': 'test_user'
            }
        )
        assert resp.status_code == requests.codes.not_found
