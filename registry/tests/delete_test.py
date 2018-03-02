# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Delete tests
"""

import json
import requests
from unittest.mock import patch

from quilt_server.core import encode_node, hash_contents, GroupNode, RootNode
from quilt_server.models import Event
from .utils import QuiltTestCase


class DeleteTestCase(QuiltTestCase):
    """
    Test log endpoint.
    """
    def setUp(self):
        super(DeleteTestCase, self).setUp()

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

        # Upload three package instances.
        for contents in self.contents_list:
            self.put_package(self.user, self.pkg, contents, True)

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testSimpleDelete(self):
        resp = self.app.delete(
            '/api/package/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            ),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok

        # Try deleting it again.
        resp = self.app.delete(
            '/api/package/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            ),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.not_found

        events = Event.query.all()
        event = events[-1]
        assert event.user == self.user
        assert event.type == Event.Type.DELETE
        assert event.package_owner == self.user
        assert event.package_name == self.pkg

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testDeleteAccessTagVersionLog(self):
        hashes = [hash_contents(contents) for contents in self.contents_list]

        sharewith = "anotheruser"
        tag = 'tag1'
        version = '1.0'

        def _has_access():
            resp = self.app.get(
                '/api/access/{owner}/{pkg}/'.format(owner=self.user, pkg=self.pkg),
                headers={
                    'Authorization': self.user
                }
            )
            assert resp.status_code == requests.codes.ok
            data = json.loads(resp.data.decode('utf8'))
            return sharewith in data['users']

        def _has_tag():
            resp = self.app.get(
                '/api/tag/{usr}/{pkg}/{tag}'.format(
                    usr=self.user,
                    pkg=self.pkg,
                    tag=tag
                ),
                headers={
                    'Authorization': self.user
                }
            )
            return resp.status_code == requests.codes.ok

        def _has_version():
            resp = self.app.get(
                '/api/version/{usr}/{pkg}/{version}'.format(
                    usr=self.user,
                    pkg=self.pkg,
                    version=version
                ),
                headers={
                    'Authorization': self.user
                }
            )
            return resp.status_code == requests.codes.ok

        def _has_log():
            resp = self.app.get(
                '/api/log/{usr}/{pkg}/'.format(
                    usr=self.user,
                    pkg=self.pkg
                ),
                headers={
                    'Authorization': self.user
                }
            )
            assert resp.status_code == requests.codes.ok
            data = json.loads(resp.data.decode('utf8'))
            return len(data['logs']) > 1

        # Add a user
        resp = self._share_package(self.user, self.pkg, sharewith)
        assert resp.status_code == requests.codes.ok

        # Add a tag
        resp = self.app.put(
            '/api/tag/{usr}/{pkg}/{tag}'.format(
                usr=self.user,
                pkg=self.pkg,
                tag=tag
            ),
            data=json.dumps(dict(
                hash=hashes[0]
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok

        # Add a version
        resp = self.app.put(
            '/api/version/{usr}/{pkg}/{version}'.format(
                usr=self.user,
                pkg=self.pkg,
                version=version
            ),
            data=json.dumps(dict(
                hash=hashes[1]
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok

        # Verify that everything looks as expected before deleting the package
        assert _has_access()
        assert _has_tag()
        assert _has_version()
        assert _has_log()

        # Delete the package
        resp = self.app.delete(
            '/api/package/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            ),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok

        # Create a new package with the same name
        self.put_package(self.user, self.pkg, self.contents_list[0], True)

        # Verify that users, tags, and versions didn't survive
        assert not _has_access()
        assert not _has_tag()
        assert not _has_version()
        assert not _has_log()

    def testNoPackage(self):
        resp = self.app.delete(
            '/api/package/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg='bad_package'
            ),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.not_found

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testNoAccess(self):
        # Wrong user
        resp = self.app.delete(
            '/api/package/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            ),
            headers={
                'Authorization': 'foo'
            }
        )
        assert resp.status_code == requests.codes.forbidden

        # No user
        resp = self.app.delete(
            '/api/package/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            )
        )
        assert resp.status_code == requests.codes.unauthorized
