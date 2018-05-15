# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Access tests
"""

import json
import time
from unittest.mock import patch

import requests

from quilt_server.const import PaymentPlan, PUBLIC
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
    def testGetObjects(self):
        hash1 = '1' * 64
        hash2 = '2' * 64
        bad_hash = 'f' * 64

        # hash1 is private; hash2 is both private and public, owned by different users.
        self.put_package('usr1', 'pkg1', RootNode(children=dict(foo=FileNode([hash1], dict()))))
        self.put_package('usr1', 'pkg2', RootNode(children=dict(foo=FileNode([hash2], dict()))))
        self.put_package('usr2', 'public_pkg2', RootNode(children=dict(foo=FileNode([hash2], dict()))), is_public=True)

        def _get_hashes(user, hashes):
            headers = {
                'Authorization': user
            } if user else {}
            resp = self.app.post(
                '/api/get_objects',
                data=json.dumps(hashes),
                content_type='application/json',
                headers=headers
            )
            assert resp.status_code == requests.codes.ok

            data = json.loads(resp.data.decode('utf8'))
            urls = data['urls']
            sizes = data['sizes']
            assert set(urls) == set(sizes)
            assert not set(urls) - set(hashes)
            return set(urls)

        # Anonymous user can only see hash2.
        assert _get_hashes(None, [hash1, hash2]) == {hash2}

        # usr1 can see both.
        assert _get_hashes('usr1', [hash1, hash2]) == {hash1, hash2}

        # usr2 can only see hash2; doesn't matter which user it comes from.
        assert _get_hashes('usr2', [hash1, hash2]) == {hash2}

        # Bogus hashes have no effect.
        assert _get_hashes('usr2', [hash2, bad_hash]) == {hash2}
