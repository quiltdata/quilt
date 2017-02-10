"""
Tag tests
"""

import json
import requests

from .utils import QuiltTestCase


class TagTestCase(QuiltTestCase):
    """
    Test tag endpoints.
    """
    def setUp(self):
        super(TagTestCase, self).setUp()

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

    def _add_tag(self, tag, pkghash):
        return self.app.put(
            '/api/tag/{usr}/{pkg}/{tag}'.format(
                usr=self.user,
                pkg=self.pkg,
                tag=tag
            ),
            data=json.dumps(dict(
                hash=pkghash
            )),
            content_type='application/json',
            headers={
                'Authorization': self.user
            }
        )

    def _list_tags(self):
        return self.app.get(
            '/api/tag/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            ),
            headers={
                'Authorization': self.user
            }
        )

    def testGetTag(self):
        resp = self._add_tag('foo', self.hashes[0])
        assert resp.status_code == requests.codes.ok

        resp = self.app.get(
            '/api/tag/{usr}/{pkg}/{tag}'.format(
                usr=self.user,
                pkg=self.pkg,
                tag='foo'
            ),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        assert data['hash'] == self.hashes[0]

    def testMultipleTags(self):
        # Add a few tags.
        resp = self._add_tag('old', self.hashes[0])
        assert resp.status_code == requests.codes.ok

        resp = self._add_tag('latest', self.hashes[1])
        assert resp.status_code == requests.codes.ok

        resp = self._add_tag('also_latest', self.hashes[1])
        assert resp.status_code == requests.codes.ok

        # List tags.
        resp = self._list_tags()
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        # Verify that they're sorted by tag.
        assert data['tags'] == [
            dict(
                tag='also_latest',
                hash=self.hashes[1]
            ),
            dict(
                tag='latest',
                hash=self.hashes[1]
            ),
            dict(
                tag='old',
                hash=self.hashes[0]
            )
        ]

    def testInvalidHash(self):
        resp = self._add_tag('latest', '000')
        assert resp.status_code == requests.codes.not_found

    def testUpdateTag(self):
        resp = self._add_tag('latest', self.hashes[0])
        assert resp.status_code == requests.codes.ok

        resp = self._add_tag('latest', self.hashes[1])
        assert resp.status_code == requests.codes.ok

        resp = self._list_tags()
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        assert data['tags'] == [
            dict(
                tag='latest',
                hash=self.hashes[1]
            )
        ]

    def testDelete(self):
        resp = self._add_tag('foo', self.hashes[0])
        assert resp.status_code == requests.codes.ok

        resp = self.app.delete(
            '/api/tag/{usr}/{pkg}/{tag}'.format(
                usr=self.user,
                pkg=self.pkg,
                tag='foo'
            ),
            headers={
                'Authorization': self.user
            }
        )

        assert resp.status_code == requests.codes.ok

        resp = self._list_tags()
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        assert data['tags'] == []

    def testAccess(self):
        resp = self._add_tag('foo', self.hashes[0])
        assert resp.status_code == requests.codes.ok

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

        # Can view
        resp = self.app.get(
            '/api/tag/{usr}/{pkg}/{tag}'.format(
                usr=self.user,
                pkg=self.pkg,
                tag='foo'
            ),
            headers={
                'Authorization': sharewith
            }
        )
        assert resp.status_code == requests.codes.ok

        # Can't modify
        resp = self.app.put(
            '/api/tag/{usr}/{pkg}/{tag}'.format(
                usr=self.user,
                pkg=self.pkg,
                tag='foo'
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
