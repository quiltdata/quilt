# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Admin feature tests
"""

import json
import requests
import responses

import quilt_server
from quilt_server.core import GroupNode, RootNode
from .utils import QuiltTestCase

class AdminTestCase(QuiltTestCase):
    """
    test admin/package_list endpoint
    """

    def setUp(self):
        super(AdminTestCase, self).setUp()

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
            self.put_package(self.user, self.pkg, contents)

    def testListPackage(self):
        self._mock_admin()
        resp = self.app.get(
            '/api/admin/package_list/{usr}/'.format(
                usr=self.user
            ),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok

    def testListPackagesNotAdmin(self):
        resp = self.app.get(
            '/api/admin/package_list/{usr}/'.format(
                usr=self.user
            ),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.forbidden

    def testAuditUser(self):
        # actions as user test_user
        self._mock_admin()
        resp = self.app.get(
            '/api/audit/{usr}/'.format(
                usr=self.user
            ),
            headers={
                'Authorization': self.user
            }
        )
        data = json.loads(resp.get_data()).get('events')
        assert len(data) == 3
        for event in data:
            assert event['type'] == 'PUSH'
            assert event['package_owner'] == self.user
            assert event['user'] == self.user

        self.put_package(self.user, self.pkg, self.contents_list[0])
        resp = self.app.get(
            '/api/audit/{usr}/'.format(
                usr=self.user
            ),
            headers={
                'Authorization': self.user
            }
        )
        data = json.loads(resp.get_data()).get('events')
        assert len(data) == 4
        pass

    def testAuditPackage(self):
        self._mock_admin()
        resp = self.app.get(
            '/api/audit/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            ),
            headers={
                'Authorization': self.user
            }
        )
        data = json.loads(resp.get_data()).get('events')
        assert len(data) == 3
        for event in data:
            assert event.get('type') == 'PUSH'
            assert event.get('package_owner') == self.user
            assert event.get('user') == self.user

        self.put_package(self.user, self.pkg, self.contents_list[0])
        resp = self.app.get(
            '/api/audit/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            ),
            headers={
                'Authorization': self.user
            }
        )
        data = json.loads(resp.get_data()).get('events')
        assert len(data) == 4

        self.put_package(self.user, self.pkg + '2', self.contents_list[0])
        resp = self.app.get(
            '/api/audit/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            ),
            headers={
                'Authorization': self.user
            }
        )
        data = json.loads(resp.get_data()).get('events')
        assert len(data) == 4
        pass

    def testAdminListUserUI(self):
        self._mock_admin()
        QUILT_AUTH_URL = quilt_server.app.config['QUILT_AUTH_URL']
        user_list_api = "%s/accounts/users" % QUILT_AUTH_URL
        self.requests_mock.add(responses.GET, user_list_api, json.dumps({
            'status': 200,
            'count': 1,
            'next': None,
            'previous': None,
            'results': [{
                'username': self.user,
                'id': 1,
                'date_joined': '2018-01-14T19:33:27.656835Z',
                'email': 'admin@quiltdata.io',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
                'last_login': '2018-01-14T19:33:27.656835Z'
            }]
            }))
        resp = self.app.get(
            '/api/users/list_detailed',
            headers={
                'Authorization': self.user
            }
        )
        data = json.loads(resp.get_data())
        assert data['status'] == 200
        user = data[self.user]
        assert user['installs'] == 0
        assert user['pushes'] == 3
        assert user['packages'] == 1
        assert user['status'] == 'active'
        assert user['last_seen'] == '2018-01-14T19:33:27.656835Z'
        pass
