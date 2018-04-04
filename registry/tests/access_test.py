# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Access tests
"""

import hashlib
import json
import time
from unittest.mock import patch
import urllib

import pytest
import requests

from quilt_server.const import PaymentPlan, PUBLIC, TEAM
from quilt_server.core import encode_node, hash_contents, GroupNode, RootNode, FileNode

from .utils import mock_customer, QuiltTestCase


class AccessTestCase(QuiltTestCase):
    """
    Test access endpoints and access control for
    push/install.
    """
    def setUp(self):
        super(AccessTestCase, self).setUp()

        self.user = "test_user"
        self.pkg = "pkgtoshare"

        contents = RootNode(dict(
            foo=GroupNode(dict())
        ))

        self.pkgurl = self.put_package(self.user, self.pkg, contents)

    def testShareDataset(self):
        """
        Push a package, share it and test that the
        recipient can read it.
        """
        sharewith = "anotheruser"
        resp = self._share_package(self.user, self.pkg, sharewith)
        assert resp.status_code == requests.codes.ok

        # Test that the receiver can read the package
        resp = self.app.get(
            self.pkgurl,
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok

    def testShareDatasetByEmail(self):
        """
        Push a package, share it and test that the
        invitation was created.
        """
        sharewithuser = "Anotheruser"
        sharewithemail = "anotherUser@example.com"  # Different case
        resp = self._share_package(self.user, self.pkg, sharewithemail)
        assert resp.status_code == requests.codes.ok

        # Test that the invitation was created
        resp = self.app.get(
            '/api/invite/{owner}/{pkg}/'.format(owner=self.user, pkg=self.pkg),
            headers={
                'Authorization': self.user
            }
        )

        assert resp.status_code == requests.codes.ok
        invitations = json.loads(resp.data.decode('utf8'))['invitations']
        assert len(invitations) == 1

        # Test that the invitation is viewable to the recipient
        resp = self.app.get(
            '/api/invite/',
            headers={
                'Authorization': sharewithuser
            }
        )

        assert resp.status_code == requests.codes.ok
        invitations = json.loads(resp.data.decode('utf8'))['invitations']
        assert len(invitations) == 1

        # test that receiver cannot read package before claiming invitation
        resp = self.app.get(
            self.pkgurl,
            headers={
                'Authorization': sharewithuser
            }
        )
        assert resp.status_code == requests.codes.not_found

        # Test that the receiver can claim the invitation
        resp = self.app.get(
            '/api/profile'.format(user=sharewithuser),
            headers={
                'Authorization': sharewithuser
            }
        )
        assert resp.status_code == requests.codes.ok

        # Test that after claiming invitation, recipient
        # can read the package.
        resp = self.app.get(
            self.pkgurl,
            headers={
                'Authorization': sharewithuser
            }
        )
        assert resp.status_code == requests.codes.ok

        # Test that the invitation no longer exists after
        # being claimed
        resp = self.app.get(
            '/api/invite/{owner}/{pkg}/'.format(owner=self.user, pkg=self.pkg),
            headers={
                'Authorization': self.user
            }
        )
        data = json.loads(resp.data.decode('utf8'))
        invitations = data['invitations']
        assert len(invitations) == 0

    def testRevokeAccess(self):
        """
        Push a package, grant then revoke access
        and test that the revoked recipient can't
        access it.
        """
        sharewith = "anotheruser"
        resp = self._share_package(self.user, self.pkg, sharewith)
        assert resp.status_code == requests.codes.ok

        # Revoke access (unshare the package)
        resp = self._unshare_package(self.user, self.pkg, sharewith)
        assert resp.status_code == requests.codes.ok

        # Test that the recipient can't read the package
        resp = self.app.get(
            self.pkgurl,
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.not_found

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testOwnerCantDeleteOwnAccess(self):
        """
        Push a package and test that the owner
        can't remove his/her own access.
        """
        # Try to revoke owner's access
        resp = self._unshare_package(self.user, self.pkg, self.user)
        assert resp.status_code == requests.codes.forbidden

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testNoAccess(self):
        """
        Push a package and test that non-sharing users
        can't access it.
        """
        sharewith = "anotheruser"
        resp = self._share_package(self.user, self.pkg, sharewith)
        assert resp.status_code == requests.codes.ok

        # Test that other users can't read the package
        resp = self.app.get(
            self.pkgurl,
            headers={
                'Authorization': "not" + sharewith
            }
        )

        assert resp.status_code == requests.codes.not_found

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testSharerCantPushNewVersion(self):
        """
        Push a package, share it and test that the
        recipient can't add a new version.
        """
        sharewith = "anotheruser"
        resp = self._share_package(self.user, self.pkg, sharewith)
        assert resp.status_code == requests.codes.ok

        newcontents = RootNode(dict(
            bar=GroupNode(dict())
        ))
        newpkgurl = '/api/package/{usr}/{pkg}/{hash}'.format(
            usr=self.user,
            pkg=self.pkg,
            hash=hash_contents(newcontents)
        )

        # Test that the receiver can't create a new version
        # of the package
        resp = self.app.put(
            newpkgurl,
            data=json.dumps(dict(
                description="",
                contents=newcontents
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.forbidden

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testNonSharerCantPushToPublicPkg(self):
        """
        Push a package, share it publicly, and test that other users
        can't push new versions.
        """
        otheruser = "anotheruser"
        resp = self._share_package(self.user, self.pkg, PUBLIC)
        assert resp.status_code == requests.codes.ok

        newcontents = RootNode(dict(
            bar=GroupNode(dict())
        ))
        newpkgurl = '/api/package/{usr}/{pkg}/{hash}'.format(
            usr=self.user,
            pkg=self.pkg,
            hash=hash_contents(newcontents)
        )

        # Test that the receiver can't create a new version
        # of the package
        resp = self.app.put(
            newpkgurl,
            data=json.dumps(dict(
                description="",
                contents=newcontents
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': otheruser
            }
        )

        assert resp.status_code == requests.codes.forbidden

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testListAccess(self):
        """
        Push a package, share it and test that
        both the owner and recipient are included
        in the access list
        """
        sharewith = "anotheruser"
        resp = self._share_package(self.user, self.pkg, sharewith)
        assert resp.status_code == requests.codes.ok

        # List the access for the package
        resp = self.app.get(
            '/api/access/{owner}/{pkg}/'.format(owner=self.user, pkg=self.pkg),
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        can_access = data.get('users')
        assert len(can_access) == 2
        assert self.user in can_access
        assert sharewith in can_access

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testCanListAccessPublicPkg(self):
        """
        Push a package, share it publicly, and test that other users
        can list the access.
        """
        otheruser = "anotheruser"
        resp = self._share_package(self.user, self.pkg, PUBLIC)
        assert resp.status_code == requests.codes.ok

        # List the access for the package
        resp = self.app.get(
            '/api/access/{owner}/{pkg}/'.format(owner=self.user, pkg=self.pkg),
            headers={
                'Authorization': otheruser
            }
        )

        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        can_access = data.get('users')
        assert len(can_access) == 2
        assert self.user in can_access
        assert PUBLIC in can_access
        assert otheruser not in can_access

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testListPackages(self):
        """
        List private, privately-shared, and public packages.
        """
        sharewith = "anotheruser"

        # Other users can't see private packages.
        resp = self.app.get(
            '/api/package/{owner}/'.format(owner=self.user),
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        assert data['packages'] == []

        # Anonymous users can't see private packages.
        resp = self.app.get(
            '/api/package/{owner}/'.format(owner=self.user)
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        assert data['packages'] == []

        # Share with a user.
        resp = self._share_package(self.user, self.pkg, sharewith)
        assert resp.status_code == requests.codes.ok

        # The user can now see the private package.
        resp = self.app.get(
            '/api/package/{owner}/'.format(owner=self.user),
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        assert data['packages'] == [dict(name=self.pkg, is_public=False, is_team=False)]

        # Anonymous users still can't see it.
        resp = self.app.get(
            '/api/package/{owner}/'.format(owner=self.user)
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        assert data['packages'] == []

        # Share publicly.
        resp = self._share_package(self.user, self.pkg, PUBLIC)
        assert resp.status_code == requests.codes.ok

        # The user can still see it.
        resp = self.app.get(
            '/api/package/{owner}/'.format(owner=self.user),
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        assert data['packages'] == [dict(name=self.pkg, is_public=True, is_team=False)]

        # Anonymous users can now see it.
        resp = self.app.get(
            '/api/package/{owner}/'.format(owner=self.user)
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        assert data['packages'] == [dict(name=self.pkg, is_public=True, is_team=False)]

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    @mock_customer()
    def testRemovePublicBasicUser(self, customer):
        public_pkg = "publicpkg"
        self.put_package(self.user, public_pkg, RootNode(children=dict()), is_public=True)

        # Try deleting the PUBLIC user
        resp = self.app.delete(
            '/api/access/{owner}/{pkg}/{user}'.format(owner=self.user, pkg=public_pkg, user=PUBLIC),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.payment_required

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    @mock_customer(plan=PaymentPlan.INDIVIDUAL)
    def testRemovePublicIndividualUser(self, customer):
        public_pkg = "publicpkg"
        self.put_package(self.user, public_pkg, RootNode(children=dict()), is_public=True)

        # Delete the PUBLIC user
        resp = self.app.delete(
            '/api/access/{owner}/{pkg}/{user}'.format(owner=self.user, pkg=public_pkg, user=PUBLIC),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok

        # Verify that the package is now private.
        resp = self.app.get(
            '/api/access/{owner}/{pkg}/'.format(owner=self.user, pkg=self.pkg),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        can_access = data.get('users')
        assert can_access == [self.user]

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testRemovePublicNoPayments(self):
        public_pkg = "publicpkg"
        self.put_package(self.user, public_pkg, RootNode(children=dict()), is_public=True)

        # Delete the PUBLIC user
        resp = self.app.delete(
            '/api/access/{owner}/{pkg}/{user}'.format(owner=self.user, pkg=public_pkg, user=PUBLIC),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok

        # Verify that the package is now private.
        resp = self.app.get(
            '/api/access/{owner}/{pkg}/'.format(owner=self.user, pkg=self.pkg),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok

        data = json.loads(resp.data.decode('utf8'))
        can_access = data.get('users')
        assert can_access == [self.user]

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testShareTeamFails(self):
        resp = self._share_package(self.user, self.pkg, 'team')
        assert resp.status_code == requests.codes.forbidden

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', False)
    @patch('quilt_server.views.ALLOW_TEAM_ACCESS', True)
    def testSharePublicFails(self):
        resp = self._share_package(self.user, self.pkg, 'public')
        assert resp.status_code == requests.codes.forbidden

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testProfile(self):
        """
        List all accessible packages.
        """
        public_pkg = "publicpkg"
        self.put_package(self.user, public_pkg, RootNode(children=dict()), is_public=True)

        # The user can see own packages.
        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': self.user
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == [
            dict(owner=self.user, name=self.pkg, is_public=False, is_team=False),
            dict(owner=self.user, name=public_pkg, is_public=True, is_team=False),
        ]
        assert data['shared'] == []


        # Other users can't see anything.
        sharewith = "anotheruser"

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
        resp = self._share_package(self.user, self.pkg, sharewith)
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
        assert data['shared'] == [dict(owner=self.user, name=self.pkg, is_public=False, is_team=False)]


        # Packages that are both public and shared show up under "shared".
        resp = self._share_package(self.user, self.pkg, PUBLIC)
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
        assert data['shared'] == [dict(owner=self.user, name=self.pkg, is_public=True, is_team=False)]

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', False)
    @patch('quilt_server.views.ALLOW_TEAM_ACCESS', True)
    def testTeamProfile(self):
        """
        Test the profile endpoint but with teams and no public access.
        """
        public_pkg = "publicpkg"
        self.put_package(self.user, public_pkg, RootNode(children=dict()), is_team=True)

        # The user can see own packages.
        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': self.user
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == [
            dict(owner=self.user, name=self.pkg, is_public=False, is_team=False),
            dict(owner=self.user, name=public_pkg, is_public=False, is_team=True),
        ]
        assert data['shared'] == []


        # Other users can't see anything.
        sharewith = "anotheruser"

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
        resp = self._share_package(self.user, self.pkg, sharewith)
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
        assert data['shared'] == [dict(owner=self.user, name=self.pkg, is_public=False, is_team=False)]


        # Packages that are both team and shared show up under "shared".
        resp = self._share_package(self.user, self.pkg, TEAM)
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
        assert data['shared'] == [dict(owner=self.user, name=self.pkg, is_public=False, is_team=True)]

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    @patch('quilt_server.views.ALLOW_TEAM_ACCESS', True)
    def testTeamProfileWithPublic(self):
        """
        Test the profile endpoint but with teams *AND* public packages.
        """
        self.put_package(self.user, 'pkg1', RootNode(children=dict()), is_team=True)
        self.put_package(self.user, 'pkg2', RootNode(children=dict()), is_public=True)
        self.put_package(self.user, 'pkg3', RootNode(children=dict()), is_team=True, is_public=True)

        # The user can see own packages.
        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': self.user
            }
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))['packages']

        assert data['own'] == [
            dict(owner=self.user, name='pkg1', is_public=False, is_team=True),
            dict(owner=self.user, name='pkg2', is_public=True, is_team=False),
            dict(owner=self.user, name='pkg3', is_public=True, is_team=True),
            dict(owner=self.user, name=self.pkg, is_public=False, is_team=False),
        ]
        assert data['shared'] == []


        # Other users can't see anything.
        sharewith = "anotheruser"

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
        resp = self._share_package(self.user, 'pkg1', sharewith)
        assert resp.status_code == requests.codes.ok
        resp = self._share_package(self.user, 'pkg3', sharewith)
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
            dict(owner=self.user, name='pkg1', is_public=False, is_team=True),
            dict(owner=self.user, name='pkg3', is_public=True, is_team=True),
        ]

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testRecentPackages(self):
        # Push two public packages.
        for i in range(2):
            pkg = 'pkg%d' % i
            self.put_package(self.user, pkg, RootNode(children=dict()), is_public=True)

        time.sleep(1)  # This sucks, but package timestamps only have a resolution of 1s.

        # Push two more.
        for i in range(2, 4):
            pkg = 'pkg%d' % i
            self.put_package(self.user, pkg, RootNode(children=dict()), is_public=True)

        # Update pkg0.
        self.put_package(self.user, 'pkg0', RootNode(children=dict()))

        # Push a non-public package.
        self.put_package(self.user, 'private', RootNode(children=dict()))

        # Verify that the three most recently updated ones are what we expect.
        resp = self.app.get('/api/recent_packages/?count=3')
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        names = [pkg['name'] for pkg in data['packages']]
        assert len(names) == 3
        assert set(names) == set(['pkg0', 'pkg2', 'pkg3'])

        # Verify that the private package doesn't show up.
        resp = self.app.get('/api/recent_packages/')
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        names = [pkg['name'] for pkg in data['packages']]
        assert len(names) == 4
        assert set(names) == set(['pkg0', 'pkg1', 'pkg2', 'pkg3'])

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testBasicSearch(self):
        for i in [1, 2]:
            pkg = 'public%d' % i
            self.put_package(self.user, pkg, RootNode(children=dict()), is_public=True, tag_latest=True)

        self.put_package(self.user, 'private', RootNode(children=dict()), tag_latest=True)

        def _test_query(query, headers, expected_results):
            params = dict(q=query)
            resp = self.app.get(
                '/api/search/?%s' % urllib.parse.urlencode(params),
                headers=headers
            )

            assert resp.status_code == requests.codes.ok
            data = json.loads(resp.data.decode('utf8'))

            results = ['%(owner)s/%(name)s' % pkg for pkg in data['packages']]
            assert results == expected_results

        _test_query("test_user/public1", {}, ["test_user/public1"])
        _test_query("Test_User/Public1", {}, ["test_user/public1"])
        _test_query("test_user/private", {}, [])
        _test_query("test_user/", {}, ["test_user/public1", "test_user/public2"])
        _test_query("test_user public1", {}, ["test_user/public1"])
        _test_query("test user 2", {}, ["test_user/public2"])
        _test_query("", {}, ["test_user/public1", "test_user/public2"])
        _test_query("foo", {}, [])

        auth = {'Authorization': self.user}

        _test_query("test_user/public1", auth, ["test_user/public1"])
        _test_query("private", auth, ["test_user/private"])
        _test_query("test", auth, [
            "test_user/private", "test_user/public1", "test_user/public2"
        ])
        _test_query("", auth, [
            "test_user/private", "test_user/public1", "test_user/public2"
        ])

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testBasicSearchOrder(self):
        for pkg in ['a', 'B', 'c', 'D']:
            self.put_package(self.user, pkg, RootNode(children=dict()), is_public=True, tag_latest=True)

        params = dict(q=self.user)
        resp = self.app.get(
            '/api/search/?%s' % urllib.parse.urlencode(params)
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        names = [pkg['name'] for pkg in data['packages']]
        assert names == ['a', 'B', 'c', 'D']

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testSearchReadmeSnippet(self):
        readme_contents = 'foo' * 1000
        blob_hash = '8db466bdfc3265dd1347843b31ed34af0a0c2e6ff0fd4d6a5853755f0e68b8a0'

        contents = RootNode(dict(
            README=FileNode([blob_hash], dict())
        ))

        self._mock_object(self.user, blob_hash, readme_contents.encode())
        self.put_package(self.user, 'pkg', contents, is_public=True, tag_latest=True)

        resp = self.app.get('/api/search/?q=pkg')
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        packages = data['packages']

        assert len(packages) == 1
        assert packages[0]['is_public'] is True
        assert packages[0]['is_team'] is False
        assert packages[0]['readme_preview'] == readme_contents[0:1024]

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testFullTextSearch(self):
        # Packages with READMEs.
        packages = {
            "clinton_email": (
                "On Monday, August 31, the State Department released nearly 7,000 pages of Clinton’s "
                "heavily redacted emails (its biggest release of emails to date)."
            ),
            "wine": (
                "From the UCI Machine Learning Repository: Lichman, M. (2013). UCI Machine Learning Repository. "
                "Irvine, CA: University of California, School of Information and Computer Science."
            ),
            "dogscats": "",
            "nothing": "There are no Clinton's emails or wine data here.",
        }

        for name, readme in packages.items():
            blob_hash = hashlib.sha256(readme.encode()).hexdigest()
            contents = RootNode(dict(
                README=FileNode([blob_hash], dict())
            ))

            self._mock_object(self.user, blob_hash, readme.encode())
            self.put_package(self.user, name, contents, is_public=True, tag_latest=True)

        # Package with no README, but more nodes.
        contents2 = RootNode(dict(
            wine=GroupNode(dict()),
            baz=GroupNode(dict())
        ))
        self.put_package(self.user, "foo", contents2, is_public=True, tag_latest=True)

        def _test_query(query, headers, expected_results):
            params = dict(q=query)
            resp = self.app.get(
                '/api/search/?%s' % urllib.parse.urlencode(params),
                headers=headers
            )

            assert resp.status_code == requests.codes.ok
            data = json.loads(resp.data.decode('utf8'))

            results = ['%(owner)s/%(name)s' % pkg for pkg in data['packages']]
            assert results == expected_results

        # Stemming
        _test_query("redact", {}, ["test_user/clinton_email"])
        _test_query("releasing", {}, ["test_user/clinton_email"])

        # Stemming on package name
        _test_query("no wining", {}, ["test_user/wine", "test_user/foo", "test_user/nothing"])

        # Multiple words
        _test_query("state department's biggest release", {}, ["test_user/clinton_email"])

        # Substring matching still works on package names
        _test_query("dogs cats", {}, ["test_user/dogscats"])

        # Order precedence: package name, metadata, README
        _test_query("clinton", {}, ["test_user/clinton_email", "test_user/nothing"])
        _test_query("wine", {}, ["test_user/wine", "test_user/foo", "test_user/nothing"])
