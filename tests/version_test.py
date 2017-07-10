"""
Version tests
"""

import json
import requests

from quilt_server.core import encode_node, hash_contents, GroupNode, RootNode
from .utils import QuiltTestCase


class VersionTestCase(QuiltTestCase):
    """
    Test version endpoints.
    """
    def setUp(self):
        super(VersionTestCase, self).setUp()

        self.user = "test_user"
        self.pkg = "pkg"
        self.contents_list = [
            RootNode(dict(
                foo=GroupNode(dict())
            )),
            RootNode(dict(
                bar=GroupNode(dict())
            )),
            RootNode(dict(
                baz=GroupNode(dict())
            ))
        ]
        self.hashes = [hash_contents(contents) for contents in self.contents_list]

        # Upload three package instances.
        for contents in self.contents_list:
            self.put_package(self.user, self.pkg, contents, public=True)

    def _add_version(self, version, pkghash):
        return self.app.put(
            '/api/version/{usr}/{pkg}/{version}'.format(
                usr=self.user,
                pkg=self.pkg,
                version=version
            ),
            data=json.dumps(dict(
                hash=pkghash
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': self.user
            }
        )

    def testGetVersion(self):
        resp = self._add_version('1', self.hashes[0])
        assert resp.status_code == requests.codes.ok

        # Access the same version.
        resp = self.app.get(
            '/api/version/{usr}/{pkg}/{version}'.format(
                usr=self.user,
                pkg=self.pkg,
                version='1'
            ),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        assert data['hash'] == self.hashes[0]

        # Access the same version, but with whitespace.
        resp = self.app.get(
            '/api/version/{usr}/{pkg}/{version}'.format(
                usr=self.user,
                pkg=self.pkg,
                version='  1\t'
            ),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        assert data['hash'] == self.hashes[0]
        assert data['created_by'] == data['updated_by'] == self.user
        assert data['created_at'] == data['updated_at']

    def testListVersions(self):
        # Add a few versions in a random order, with random whitespace.

        resp = self._add_version('2.0.1+foo123', self.hashes[2])
        assert resp.status_code == requests.codes.ok

        resp = self._add_version('  2.0  ', self.hashes[1])
        assert resp.status_code == requests.codes.ok

        resp = self._add_version('1.0', self.hashes[0])
        assert resp.status_code == requests.codes.ok

        resp = self._add_version('2.0pre1', self.hashes[1])
        assert resp.status_code == requests.codes.ok

        # List versions.

        resp = self.app.get(
            '/api/version/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            ),
            headers={
                'Authorization': self.user
            }
        )

        assert resp.status_code == requests.codes.ok

        # Verify that the response is sorted by version,
        # but preserves the original formatting - whitespace, etc.

        data = json.loads(resp.data.decode('utf8'))
        versions = data['versions']
        assert versions == [
            dict(
                version='1.0',
                hash=self.hashes[0]
            ),
            dict(
                version='2.0pre1',
                hash=self.hashes[1]
            ),
            dict(
                version='  2.0  ',
                hash=self.hashes[1]
            ),
            dict(
                version='2.0.1+foo123',
                hash=self.hashes[2]
            )
        ]

    def testInvalidVersion(self):
        resp = self._add_version('foo', self.hashes[0])
        assert resp.status_code == requests.codes.bad_request

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

        resp = self._add_version('1x', self.hashes[0])
        assert resp.status_code == requests.codes.bad_request

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

        resp = self._add_version('1. 0', self.hashes[0])
        assert resp.status_code == requests.codes.bad_request

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testInvalidHash(self):
        resp = self._add_version('1.0', '000')
        assert resp.status_code == requests.codes.not_found

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testDuplicateVersion(self):
        resp = self._add_version('1.0', self.hashes[0])
        assert resp.status_code == requests.codes.ok

        # Same hash
        resp = self._add_version('1.0 ', self.hashes[0])
        assert resp.status_code == requests.codes.conflict

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

        # Different hash
        resp = self._add_version(' 1.0 ', self.hashes[1])
        assert resp.status_code == requests.codes.conflict

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testDelete(self):
        resp = self._add_version('1.0', self.hashes[0])
        assert resp.status_code == requests.codes.ok

        resp = self.app.delete(
            '/api/version/{usr}/{pkg}/{version}'.format(
                usr=self.user,
                pkg=self.pkg,
                version='1.0'
            ),
            headers={
                'Authorization': self.user
            }
        )

        assert resp.status_code == requests.codes.method_not_allowed

    def testAccess(self):
        resp = self._add_version('1.0', self.hashes[0])
        assert resp.status_code == requests.codes.ok

        sharewith = "share_with"
        resp = self._share_package(self.user, self.pkg, sharewith)
        assert resp.status_code == requests.codes.ok

        # Can view
        resp = self.app.get(
            '/api/version/{usr}/{pkg}/{version}'.format(
                usr=self.user,
                pkg=self.pkg,
                version='1.0'
            ),
            headers={
                'Authorization': sharewith
            }
        )
        assert resp.status_code == requests.codes.ok

        # Can't modify
        resp = self.app.put(
            '/api/version/{usr}/{pkg}/{version}'.format(
                usr=self.user,
                pkg=self.pkg,
                version='1.0'
            ),
            data=json.dumps(dict(
                hash=self.hashes[1]
            )),
            content_type='application/json',
            headers={
                'Authorization': sharewith
            }
        )
        assert resp.status_code == requests.codes.forbidden

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data
