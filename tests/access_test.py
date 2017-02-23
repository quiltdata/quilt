"""
Access tests
"""

import json
import requests

from quilt_server.const import PUBLIC
from quilt_server.utils import hash_contents

from .utils import QuiltTestCase


class AccessTestCase(QuiltTestCase):
    """
    Test access endpoints and access control for
    push/install.
    """
    def setUp(self):
        super(AccessTestCase, self).setUp()

        self.user = "test_user"
        self.pkg = "pkgtoshare"

        contents = {"foo": []}

        self.pkgurl = '/api/package/{usr}/{pkg}/{hash}'.format(
            usr=self.user,
            pkg=self.pkg,
            hash=hash_contents(contents)
        )

        # Push a package.
        resp = self.app.put(
            self.pkgurl,
            data=json.dumps(dict(
                description="",
                contents=contents
            )),
            content_type='application/json',
            headers={
                'Authorization': self.user
            }
        )

        assert resp.status_code == requests.codes.ok

    def _sharePackage(self, other_user):
        return self.app.put(
            '/api/access/{owner}/{pkg}/{usr}'.format(
                owner=self.user, usr=other_user, pkg=self.pkg
            ),
            headers={
                'Authorization': self.user
            }
        )

    def _unsharePackage(self, other_user):
        return self.app.delete(
            '/api/access/{owner}/{pkg}/{usr}'.format(
                owner=self.user, usr=other_user, pkg=self.pkg
            ),
            headers={
                'Authorization': self.user
            }
        )

    def testShareDataset(self):
        """
        Push a package, share it and test that the
        recipient can read it.
        """
        sharewith = "anotheruser"
        resp = self._sharePackage(sharewith)
        assert resp.status_code == requests.codes.ok

        # Test that the receiver can read the package
        resp = self.app.get(
            self.pkgurl,
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.ok

    def testRevokeAccess(self):
        """
        Push a package, grant then revoke access
        and test that the revoked recipient can't
        access it.
        """
        sharewith = "anotheruser"
        resp = self._sharePackage(sharewith)
        assert resp.status_code == requests.codes.ok

        # Revoke access (unshare the package)
        resp = self._unsharePackage(sharewith)
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
        resp = self._unsharePackage(self.user)
        assert resp.status_code == requests.codes.forbidden

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testNoAccess(self):
        """
        Push a package and test that non-sharing users
        can't access it.
        """
        sharewith = "anotheruser"
        resp = self._sharePackage(sharewith)
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
        resp = self._sharePackage(sharewith)
        assert resp.status_code == requests.codes.ok

        newcontents = {"bar": []}
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
            )),
            content_type='application/json',
            headers={
                'Authorization': sharewith
            }
        )

        assert resp.status_code == requests.codes.forbidden

        data = json.loads(resp.data.decode('utf8'))
        assert 'message' in data

    def testNonSharerCantPushToPublicPkg(self):
        """
        Push a package, share it publicly, and test that other users
        can't push new versions.
        """
        otheruser = "anotheruser"
        resp = self._sharePackage(PUBLIC)
        assert resp.status_code == requests.codes.ok

        newcontents = {"bar": []}
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
            )),
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
        resp = self._sharePackage(sharewith)
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

    def testCanListAccessPublicPkg(self):
        """
        Push a package, share it publicly, and test that other users
        can list the access.
        """
        otheruser = "anotheruser"
        resp = self._sharePackage(PUBLIC)
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
