# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Tag tests
"""

import json
import requests

from quilt_server.core import hash_contents, GroupNode, RootNode
from .utils import QuiltTestCase


class TagTestCase(QuiltTestCase):
    """
    Test tag endpoints.
    """
    def setUp(self):
        super(TagTestCase, self).setUp()

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
            self.put_package(self.user, self.pkg, contents, is_public=True)

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
        assert data['created_by'] == data['updated_by'] == self.user
        assert data['created_at'] == data['updated_at']

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

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

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
        resp = self._share_package(self.user, self.pkg, sharewith)
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

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data
