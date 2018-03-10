# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Admin feature tests
"""

import json
import requests
import responses
import time

import quilt_server
from quilt_server.core import GroupNode, RootNode
from .utils import QuiltTestCase

class AdminTestCase(QuiltTestCase):
    """
    test admin/package_list endpoint
    """

    def setUp(self):
        super(AdminTestCase, self).setUp()

        self.admin = "admin"
        self.user = "user"
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
                'Authorization': 'random_user'
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
                'email': 'user@quiltdata.io',
                'is_staff': False,
                'is_superuser': False,
                'is_active': True,
                'last_login': '2018-01-14T19:33:27.656835Z'
            }]
            }))
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
        assert user['last_seen'] == '2018-01-14T19:33:27.656835Z'

    def testAdminPackageUserUI(self):
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
                'email': 'user@quiltdata.io',
                'is_staff': False,
                'is_superuser': False,
                'is_active': True,
                'last_login': '2018-01-14T19:33:27.656835Z'
            }]
            }))
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
        QUILT_AUTH_URL = quilt_server.app.config['QUILT_AUTH_URL']
        reset_pass_api = "%s/accounts/users/%s/reset_pass/" % (QUILT_AUTH_URL, self.user)
        self.requests_mock.add(responses.POST, reset_pass_api, json.dumps({
            'status': 200
            }))

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
        QUILT_AUTH_URL = quilt_server.app.config['QUILT_AUTH_URL']
        create_user_api = '%s/accounts/users/' % QUILT_AUTH_URL
        self.requests_mock.add(responses.POST, create_user_api, status=201, body=json.dumps({
            'status': 201
            }))

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
        QUILT_AUTH_URL = quilt_server.app.config['QUILT_AUTH_URL']
        create_user_api = '%s/accounts/users/' % QUILT_AUTH_URL

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
        QUILT_AUTH_URL = quilt_server.app.config['QUILT_AUTH_URL']
        disable_user_api = '%s/accounts/users/usertwo/' % QUILT_AUTH_URL
        self.requests_mock.add(responses.PATCH, disable_user_api, status=200, body=json.dumps({
            'status': 200
            }))

        resp = self.app.post(
            '/api/users/disable',
            data=json.dumps({"username":"usertwo"}),
            content_type='application/json',
            headers={
                'Authorization':self.admin
            }
            )

        assert resp.status_code == requests.codes.ok

    def testDisableUserNonAdmin(self):
        QUILT_AUTH_URL = quilt_server.app.config['QUILT_AUTH_URL']
        disable_user_api = '%s/accounts/users/usertwo/' % QUILT_AUTH_URL

        resp = self.app.post(
            '/api/users/disable',
            data=json.dumps({"username":"usertwo"}),
            content_type='application/json',
            headers={
                'Authorization':self.user
            }
            )

        assert resp.status_code == requests.codes.forbidden

    def testEnableUser(self):
        QUILT_AUTH_URL = quilt_server.app.config['QUILT_AUTH_URL']
        enable_user_api = '%s/accounts/users/usertwo/' % QUILT_AUTH_URL
        self.requests_mock.add(responses.PATCH, enable_user_api, status=200, body=json.dumps({
            'status': 200
            }))

        resp = self.app.post(
            '/api/users/enable',
            data=json.dumps({"username":"usertwo"}),
            content_type='application/json',
            headers={
                'Authorization':self.admin
            }
            )

        assert resp.status_code == requests.codes.ok

    def testEnableUserNonAdmin(self):
        QUILT_AUTH_URL = quilt_server.app.config['QUILT_AUTH_URL']
        enable_user_api = '%s/accounts/users/usertwo/' % QUILT_AUTH_URL

        resp = self.app.post(
            '/api/users/enable',
            data=json.dumps({"username":"usertwo"}),
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
