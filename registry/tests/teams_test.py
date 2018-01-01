# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Tests for all teams-specific features.
"""

import json

import requests

from quilt_server import db
from quilt_server.const import PUBLIC, TEAM
from quilt_server.core import encode_node, hash_contents, GroupNode, RootNode
from quilt_server.models import Team, UserTeam

from .utils import QuiltTestCase


class TeamsTestCase(QuiltTestCase):
    """
    Test access control for all teams features.
    """
    def setUp(self):
        super(TeamsTestCase, self).setUp()

        self.team_a = 'team_a'
        self.team_b = 'team_b'
        self.user_a1 = "user_a1"
        self.user_a2 = "user_a2"
        self.user_b1 = "user_b1"
        self.user = "user"
        self.pkg = "pkg"

        contents1 = RootNode(dict(
            foo=GroupNode(dict())
        ))
        contents2 = RootNode(dict(
            bar=GroupNode(dict())
        ))
        contents3 = RootNode(dict(
            baz=GroupNode(dict())
        ))

        self.pkgurl = self.put_package(self.user, self.pkg, contents1)

        # A non-team package owned by a user that will soon become a team member.
        self.non_team_pkgurl = self.put_package(self.user_a1, self.pkg, contents2)

        # Manually create teams and team users.
        team_a = Team(name=self.team_a)
        team_b = Team(name=self.team_b)
        db.session.add(team_a)
        db.session.add(team_b)
        db.session.add(UserTeam(user=self.user_a1, team=team_a, is_admin=False))
        db.session.add(UserTeam(user=self.user_a2, team=team_a, is_admin=False))
        db.session.add(UserTeam(user=self.user_b1, team=team_b, is_admin=False))
        db.session.commit()

        # A "real" team package, with the same owner and name as a non-team package.
        self.team_pkgurl = self.put_package(self.user_a1, self.pkg, contents3, team=self.team_a)

    def testPackageList(self):
        # UserA owns two packages with the same name - team and non-team.
        resp = self.app.get(
            '/api/package/{owner}/'.format(
                owner=self.user_a1,
            ),
            headers={
                'Authorization': self.user_a1
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        packages = data['packages']

        assert len(packages) == 2
        assert packages[0]['name'] == packages[1]['name'] == self.pkg

        # List the non-team package.
        resp = self.app.get(
            '/api/package/{team}/{owner}/{pkg}/'.format(
                team=PUBLIC,
                owner=self.user_a1,
                pkg=self.pkg,
            ),
            headers={
                'Authorization': self.user_a1
            }
        )
        assert resp.status_code == requests.codes.ok

        # List the team package.
        resp = self.app.get(
            '/api/package/{team}/{owner}/{pkg}/'.format(
                team=self.team_a,
                owner=self.user_a1,
                pkg=self.pkg,
            ),
            headers={
                'Authorization': self.user_a1
            }
        )
        assert resp.status_code == requests.codes.ok

        # Different user on the same team cannot see the package.
        resp = self.app.get(
            '/api/package/{team}/{owner}/{pkg}/'.format(
                team=self.team_a,
                owner=self.user_a1,
                pkg=self.pkg,
            ),
            headers={
                'Authorization': self.user_a2
            }
        )
        assert resp.status_code == requests.codes.not_found

        # Other users cannot see the team.
        for user in [self.user_b1, self.user, None]:
            resp = self.app.get(
                '/api/package/{team}/{owner}/{pkg}/'.format(
                    team=self.team_a,
                    owner=self.user_a1,
                    pkg=self.pkg,
                ),
                headers={
                    'Authorization': user
                }
            )
            assert resp.status_code == requests.codes.forbidden

        # Non-existent team.
        resp = self.app.get(
            '/api/package/{team}/{owner}/{pkg}/'.format(
                team='foo',
                owner=self.user_a1,
                pkg=self.pkg,
            ),
            headers={
                'Authorization': self.user_a1
            }
        )
        assert resp.status_code == requests.codes.forbidden

    def testInstall(self):
        # User can install own non-team package.
        resp = self.app.get(
            self.non_team_pkgurl,
            headers={
                'Authorization': self.user_a1
            }
        )
        assert resp.status_code == requests.codes.ok

        # User can install own team package.
        resp = self.app.get(
            self.team_pkgurl,
            headers={
                'Authorization': self.user_a1
            }
        )
        assert resp.status_code == requests.codes.ok

        # Different member of the same team cannot install the package.
        resp = self.app.get(
            self.team_pkgurl,
            headers={
                'Authorization': self.user_a2
            }
        )
        assert resp.status_code == requests.codes.not_found

        # Other users cannot access the team.
        for user in [self.user_b1, self.user, None]:
            resp = self.app.get(
                self.team_pkgurl,
                headers={
                    'Authorization': user
                }
            )
            assert resp.status_code == requests.codes.forbidden

    def testPush(self):
        contents = RootNode(dict())

        # User cannot push own non-team package.
        pkgurl = '/api/package/{team}/{usr}/{pkg}/{hash}'.format(
            team=PUBLIC,
            usr=self.user_a1,
            pkg=self.pkg,
            hash=hash_contents(contents)
        )
        resp = self.app.put(
            pkgurl,
            data=json.dumps(dict(
                description="",
                contents=contents,
                public=False,
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': self.user_a1
            }
        )
        assert resp.status_code == requests.codes.forbidden

        # Team users can push a team package.
        self.put_package(self.user_a1, self.pkg, contents, team=self.team_a)
        self.put_package(self.user_a2, self.pkg, contents, team=self.team_a)

        # Team users cannot push a public package.
        pkgurl = '/api/package/{team}/{usr}/{pkg}/{hash}'.format(
            team=self.team_a,
            usr=self.user_a1,
            pkg=self.pkg,
            hash=hash_contents(contents),
        )
        resp = self.app.put(
            pkgurl,
            data=json.dumps(dict(
                description="",
                contents=contents,
                public=True,
            ), default=encode_node),
            content_type='application/json',
            headers={
                'Authorization': self.user_a1
            }
        )
        assert resp.status_code == requests.codes.forbidden

        # Non-members of the team cannot push a team package.
        for user in [self.user_b1, self.user, None]:
            pkgurl = '/api/package/{team}/{usr}/{pkg}/{hash}'.format(
                team=self.team_a,
                usr=user,
                pkg=self.pkg,
                hash=hash_contents(contents)
            )
            resp = self.app.put(
                pkgurl,
                data=json.dumps(dict(
                    description="",
                    contents=contents,
                    public=False,
                ), default=encode_node),
                content_type='application/json',
                headers={
                    'Authorization': user
                }
            )
            assert resp.status_code == requests.codes.forbidden

    def testAccessAdd(self):
        # A team user can give another team member access to a team package.
        resp = self._share_package(self.user_a1, self.pkg, self.user_a2, self.team_a)
        assert resp.status_code == requests.codes.ok
        resp = self.app.get(
            self.team_pkgurl,
            headers={
                'Authorization': self.user_a2
            }
        )
        assert resp.status_code == requests.codes.ok
        self._unshare_package(self.user_a1, self.pkg, self.user_a2, self.team_a)
        assert resp.status_code == requests.codes.ok

        # Cannot share a non-team package with a team user.
        resp = self._share_package(self.user, self.pkg, self.user_a1)
        assert resp.status_code == requests.codes.forbidden

        # Cannot share a team package with a non-team user or a different team's member.
        resp = self._share_package(self.user_a1, self.pkg, self.user_b1, self.team_a)
        assert resp.status_code == requests.codes.forbidden
        resp = self._share_package(self.user_a1, self.pkg, self.user, self.team_a)
        assert resp.status_code == requests.codes.forbidden

        # Cannot share a team package with "public"
        resp = self._share_package(self.user_a1, self.pkg, PUBLIC, self.team_a)
        assert resp.status_code == requests.codes.forbidden

        # Cannot share a public package with a team user.
        resp = self._share_package(self.user, self.pkg, self.user_a1)
        assert resp.status_code == requests.codes.forbidden

        # A team user cannot share own non-team package with anyone - team or not.
        resp = self._share_package(self.user_a1, self.pkg, self.user)
        assert resp.status_code == requests.codes.forbidden
        resp = self._share_package(self.user_a1, self.pkg, self.user_a2)
        assert resp.status_code == requests.codes.forbidden
        resp = self._share_package(self.user_a1, self.pkg, self.user_b1)
        assert resp.status_code == requests.codes.forbidden

        # Invites not allowed for teams.
        resp = self._share_package(self.user_a1, self.pkg, 'foo@example.com', self.team_a)
        assert resp.status_code == requests.codes.forbidden

        # Cannot share a non-team package with "team".
        resp = self._share_package(self.user, self.pkg, TEAM)
        assert resp.status_code == requests.codes.forbidden

        # Can share a team package with "team".
        resp = self._share_package(self.user_a1, self.pkg, TEAM, self.team_a)
        assert resp.status_code == requests.codes.ok
        resp = self.app.get(
            self.team_pkgurl,
            headers={
                'Authorization': self.user_a2
            }
        )
        assert resp.status_code == requests.codes.ok

        # Team-shared packages still can't be accessed by non-members.
        resp = self.app.get(
            self.team_pkgurl,
            headers={
                'Authorization': self.user_b1
            }
        )
        assert resp.status_code == requests.codes.forbidden
        resp = self.app.get(
            self.team_pkgurl,
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.forbidden

        # Removing "team" access works as expected.
        resp = self._unshare_package(self.user_a1, self.pkg, TEAM, self.team_a)
        assert resp.status_code == requests.codes.ok
        resp = self.app.get(
            self.team_pkgurl,
            headers={
                'Authorization': self.user_a2
            }
        )
        assert resp.status_code == requests.codes.not_found

    # TODO(dima): Check that tags, versions, logs, etc. respect teams.
