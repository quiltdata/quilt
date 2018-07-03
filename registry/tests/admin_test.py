# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Admin feature tests
"""

import json
import time
import requests

from quilt_server.core import GroupNode, RootNode
from .utils import QuiltTestCase

class AdminTestCase(QuiltTestCase):
    """
    test admin/package_list endpoint
    """

    def setUp(self):
        super(AdminTestCase, self).setUp()

        self.admin = "admin"
        self.user = "test_user"
        self.pkg = "pkg"
        self.nonexistent_user = "idonotexist"
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
        resp = self.app.get(
            '/api/admin/package_list/{usr}/'.format(
                usr=self.user
            ),
            headers={
                'Authorization': self.admin
            }
        )
        assert resp.status_code == requests.codes.ok

    def testListPackagesNotAdmin(self):
        resp = self.app.get(
            '/api/admin/package_list/{usr}/'.format(
                usr=self.user
            ),
            headers={
                'Authorization': 'bad_user'
            }
        )
        assert resp.status_code == requests.codes.forbidden

    def testAuditUser(self):
        # actions as user test_user
        resp = self.app.get(
            '/api/audit/{usr}/'.format(
                usr=self.user
            ),
            headers={
                'Authorization': self.admin
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8')).get('events')
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
                'Authorization': self.admin
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8')).get('events')
        assert len(data) == 4

    def testAuditPackage(self):
        resp = self.app.get(
            '/api/audit/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            ),
            headers={
                'Authorization': self.admin
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8')).get('events')
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
                'Authorization': self.admin
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8')).get('events')
        assert len(data) == 4

        self.put_package(self.user, self.pkg + '2', self.contents_list[0])
        resp = self.app.get(
            '/api/audit/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            ),
            headers={
                'Authorization': self.admin
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8')).get('events')
        assert len(data) == 4

    def testAdminListUserUI(self):
        resp = self.app.get(
            '/api/users/list_detailed',
            headers={
                'Authorization': self.admin
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        user = data['users'][self.user]
        assert user['installs'] == 0
        assert user['pushes'] == 3
        assert user['packages'] == 1
        assert user['status'] == 'active'
        assert user['last_seen']

    def testAdminPackageUserUI(self):
        resp = self.app.get(
            '/api/admin/package_summary',
            headers={
                'Authorization': self.admin
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        package = data['packages']['{user}/{pkg}'.format(user=self.user, pkg=self.pkg)]
        now = time.time()
        last_push = package['pushes']['latest']
        delta = now - last_push
        ACCEPTABLE = 5 * 60 # 5 minutes
        assert ACCEPTABLE > delta >= 0
        for key in ['deletes', 'installs', 'previews']:
            assert package[key]['count'] == 0
            assert 'latest' not in package[key]

    def testPasswordReset(self):
        resp = self.app.post(
            '/api/users/reset_password',
            data=json.dumps({"username":self.user}),
            content_type='application/json',
            headers={
                'Authorization':self.admin
            }
        )
        assert resp.status_code == requests.codes.ok

    def testCreateUser(self):
        resp = self.app.post(
            '/api/users/create',
            data=json.dumps({"username":"usertwo", "email":"user2@quiltdata.io"}),
            content_type='application/json',
            headers={
                'Authorization':self.admin
            }
            )

        assert resp.status_code == requests.codes.ok

    def testCreateUserNonAdmin(self):
        resp = self.app.post(
            '/api/users/create',
            data=json.dumps({"username":"usertwo", "email":"user2@quiltdata.io"}),
            content_type='application/json',
            headers={
                'Authorization':self.user
            }
            )

        assert resp.status_code == requests.codes.forbidden

    def testDisableUser(self):
        resp = self.app.post(
            '/api/users/disable',
            data=json.dumps({"username":"test_user"}),
            content_type='application/json',
            headers={
                'Authorization':self.admin
            }
            )

        assert resp.status_code == requests.codes.ok

    def testDisableNonexistentUser(self):
        resp = self.app.post(
            '/api/users/disable',
            data=json.dumps({"username":self.nonexistent_user}),
            content_type='application/json',
            headers={
                'Authorization':self.admin
            }
            )

        assert resp.status_code == requests.codes.not_found

    def testDisableUserNonAdmin(self):
        resp = self.app.post(
            '/api/users/disable',
            data=json.dumps({"username":"test_user"}),
            content_type='application/json',
            headers={
                'Authorization':self.user
            }
            )

        assert resp.status_code == requests.codes.forbidden

    def testDisableSelfShouldFail(self):
        resp = self.app.post(
            '/api/users/disable',
            data=json.dumps({"username":self.admin}),
            content_type='application/json',
            headers={
                'Authorization':self.admin
            }
            )

        assert resp.status_code == requests.codes.forbidden

    def testEnableUser(self):
        resp = self.app.post(
            '/api/users/enable',
            data=json.dumps({"username":"test_user"}),
            content_type='application/json',
            headers={
                'Authorization':self.admin
            }
            )

        assert resp.status_code == requests.codes.ok

    def testEnableNonexistentUser(self):
        resp = self.app.post(
            '/api/users/enable',
            data=json.dumps({"username":self.nonexistent_user}),
            content_type='application/json',
            headers={
                'Authorization':self.admin
            }
            )

        assert resp.status_code == requests.codes.not_found

    def testEnableUserNonAdmin(self):
        resp = self.app.post(
            '/api/users/enable',
            data=json.dumps({"username":"share_with"}),
            content_type='application/json',
            headers={
                'Authorization':self.user
            }
            )

        assert resp.status_code == requests.codes.forbidden

    def testAuditUserNonAdmin(self):
        resp = self.app.get(
            '/api/audit/%s/' % self.user,
            headers={
                'Authorization':self.user
            }
            )

        assert resp.status_code == requests.codes.forbidden

    def testAuditPackageNonAdmin(self):
        resp = self.app.get(
            '/api/audit/%s/%s/' % (self.user, self.pkg),
            headers={
                'Authorization':self.user
            }
            )

        assert resp.status_code == requests.codes.forbidden

    def testApiRoot(self):
        auth_headers = {
            'Authorization': 'admin',
            'content_type': 'application/json'
        }
        resp = self.app.get(
            '/api-root',
            headers=auth_headers
        )
        assert resp.status_code == 200
        data = json.loads(resp.data.decode('utf8'))
        assert data['is_staff'] is True
        assert data['current_user'] == 'admin'
        assert data['email'] == 'admin@example.com'
        assert data['is_active'] is True

        auth_headers = {
            'Authorization': 'test_user',
            'content_type': 'application/json'
        }
        resp = self.app.get(
            '/api-root',
            headers=auth_headers
        )
        assert resp.status_code == 200
        data = json.loads(resp.data.decode('utf8'))
        assert data['is_staff'] is False
        assert data['current_user'] == 'test_user'
        assert data['email'] == 'test_user@example.com'
        assert data['is_active'] is True

        auth_headers = {
            'Authorization': 'nonexistent_user',
            'content_type': 'application/json'
        }
        resp = self.app.get(
            '/api-root',
            headers=auth_headers
        )
        assert resp.status_code == 401
