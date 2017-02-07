"""
Version tests
"""

import json
import requests

from .utils import QuiltTestCase


class VersionTestCase(QuiltTestCase):
    """
    Test version endpoints.
    """
    def setUp(self):
        super(VersionTestCase, self).setUp()

        self.user = "test_user"
        self.pkg = "pkg"
        self.hashes = ['123', '456', '789']

        # Upload three package hashes.
        for h in self.hashes:
            pkgurl = '/api/package/{usr}/{pkg}/{hash}'.format(
                usr=self.user,
                pkg=self.pkg,
                hash=h
            )

            resp = self.app.put(
                pkgurl,
                data=json.dumps(dict(
                    description=""
                )),
                content_type='application/json',
                headers={
                    'Authorization': self.user
                }
            )

            assert resp.status_code == requests.codes.ok

    def _add_version(self, version, pkghash):
        return self.app.put(
            '/api/version/{usr}/{pkg}/{version}'.format(
                usr=self.user,
                pkg=self.pkg,
                version=version
            ),
            data=json.dumps(dict(
                hash=pkghash
            )),
            content_type='application/json',
            headers={
                'Authorization': self.user
            }
        )

    def testGetVersion(self):
        resp = self._add_version('1', self.hashes[0])
        assert resp.status_code == requests.codes.ok

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

    def testMultipleVersions(self):
        resp = self._add_version('1.0', self.hashes[0])
        assert resp.status_code == requests.codes.ok

        resp = self._add_version('2.0b1', self.hashes[1])
        assert resp.status_code == requests.codes.ok

        resp = self._add_version('2.0', self.hashes[1])
        assert resp.status_code == requests.codes.ok

        resp = self._add_version('2.0.1', self.hashes[2])
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

        data = json.loads(resp.data.decode('utf8'))
        versions = data['versions']
        # Sorted by version.
        assert versions == [
            dict(
                version='1.0',
                hash=self.hashes[0]
            ),
            dict(
                version='2.0b1',
                hash=self.hashes[1]
            ),
            dict(
                version='2.0',
                hash=self.hashes[1]
            ),
            dict(
                version='2.0.1',
                hash=self.hashes[2]
            )
        ]

    def testInvalidVersion(self):
        resp = self._add_version('foo', self.hashes[0])
        assert resp.status_code == requests.codes.bad_request

        resp = self._add_version('1x', self.hashes[0])
        assert resp.status_code == requests.codes.bad_request

    def testInvalidHash(self):
        resp = self._add_version('1.0', '000')
        assert resp.status_code == requests.codes.not_found

    def testDuplicateVersion(self):
        resp = self._add_version('1.0', self.hashes[0])
        assert resp.status_code == requests.codes.ok

        # Same hash
        resp = self._add_version('1.0', self.hashes[0])
        assert resp.status_code == requests.codes.conflict

        # Different hash
        resp = self._add_version('1.0', self.hashes[1])
        assert resp.status_code == requests.codes.conflict

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
        sharewith = "share_with"

        resp = self.app.put(
            '/api/access/{owner}/{pkg}/{usr}'.format(
                owner=self.user, usr=sharewith, pkg=self.pkg
            ),
            headers={
                'Authorization': self.user
            }
        )

        assert resp.status_code == requests.codes.ok

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

        assert resp.status_code == requests.codes.ok
