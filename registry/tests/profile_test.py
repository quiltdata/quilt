# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Profile tests
"""

import json
from unittest.mock import patch

import requests

from quilt_server.const import PUBLIC, TEAM
from quilt_server.core import RootNode

from .utils import QuiltTestCase


class ProfileTestCase(QuiltTestCase):
    """
    Test the profile endpoint
    """
    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testProfile(self):
        """
        List all accessible packages.
        """
        user = "test_user"
        pkg = "pkg"
        public_pkg = "publicpkg"
        self.put_package(user, pkg, RootNode(children=dict()))
        self.put_package(user, public_pkg, RootNode(children=dict()), is_public=True)

        # The user can see own packages.
        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': user
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == [
            dict(owner=user, name=pkg, is_public=False, is_team=False),
            dict(owner=user, name=public_pkg, is_public=True, is_team=False),
        ]
        assert data['shared'] == []


        # Other users can't see anything.
        sharewith = "share_with"

        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == []
        assert data['shared'] == []


        # Users can see shared packages.
        resp = self._share_package(user, pkg, sharewith)
        assert resp.status_code == requests.codes.ok

        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == []
        assert data['shared'] == [dict(owner=user, name=pkg, is_public=False, is_team=False)]


        # Packages that are both public and shared show up under "shared".
        resp = self._share_package(user, pkg, PUBLIC)
        assert resp.status_code == requests.codes.ok

        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == []
        assert data['shared'] == [dict(owner=user, name=pkg, is_public=True, is_team=False)]

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', False)
    @patch('quilt_server.views.ALLOW_TEAM_ACCESS', True)
    def testTeamProfile(self):
        """
        Test the profile endpoint but with teams and no public access.
        """
        user = "test_user"
        pkg = "pkg"
        team_pkg = "teampkg"
        self.put_package(user, pkg, RootNode(children=dict()))
        self.put_package(user, team_pkg, RootNode(children=dict()), is_team=True)

        # The user can see own packages.
        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': user
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == [
            dict(owner=user, name=pkg, is_public=False, is_team=False),
            dict(owner=user, name=team_pkg, is_public=False, is_team=True),
        ]
        assert data['shared'] == []


        # Other users can't see anything.
        sharewith = "share_with"

        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == []
        assert data['shared'] == []

        # Users can see shared packages.
        resp = self._share_package(user, pkg, sharewith)
        assert resp.status_code == requests.codes.ok

        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == []
        assert data['shared'] == [dict(owner=user, name=pkg, is_public=False, is_team=False)]


        # Packages that are both team and shared show up under "shared".
        resp = self._share_package(user, pkg, TEAM)
        assert resp.status_code == requests.codes.ok

        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == []
        assert data['shared'] == [dict(owner=user, name=pkg, is_public=False, is_team=True)]

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    @patch('quilt_server.views.ALLOW_TEAM_ACCESS', True)
    def testTeamProfileWithPublic(self):
        """
        Test the profile endpoint but with teams *AND* public packages.
        """
        user = "test_user"
        self.put_package(user, 'pkg0', RootNode(children=dict()))
        self.put_package(user, 'pkg1', RootNode(children=dict()), is_team=True)
        self.put_package(user, 'pkg2', RootNode(children=dict()), is_public=True)
        self.put_package(user, 'pkg3', RootNode(children=dict()), is_team=True, is_public=True)

        # The user can see own packages.
        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': user
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == [
            dict(owner=user, name='pkg0', is_public=False, is_team=False),
            dict(owner=user, name='pkg1', is_public=False, is_team=True),
            dict(owner=user, name='pkg2', is_public=True, is_team=False),
            dict(owner=user, name='pkg3', is_public=True, is_team=True),
        ]
        assert data['shared'] == []


        # Other users can't see anything.
        sharewith = "share_with"

        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == []
        assert data['shared'] == []

        # Packages that are both team and shared show up under "shared".
        resp = self._share_package(user, 'pkg1', sharewith)
        assert resp.status_code == requests.codes.ok
        resp = self._share_package(user, 'pkg3', sharewith)
        assert resp.status_code == requests.codes.ok

        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == []
        assert data['shared'] == [
            dict(owner=user, name='pkg1', is_public=False, is_team=True),
            dict(owner=user, name='pkg3', is_public=True, is_team=True),
        ]
