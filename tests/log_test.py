"""
Log tests
"""

import json
import requests

from .utils import QuiltTestCase


class LogTestCase(QuiltTestCase):
    """
    Test log endpoint.
    """
    def setUp(self):
        super(LogTestCase, self).setUp()

        self.user = "test_user"
        self.pkg = "pkg"
        self.hashes = ['123', '456', '789']

        # Upload three package hashes.
        for h in self.hashes:
            pkgurl = '/api/package/{usr}/{pkg}/{hash}'.format(
                usr=self.user,
                pkg=self.pkg,
                hash=h
            )

            resp = self.app.put(
                pkgurl,
                data=json.dumps(dict(
                    description=""
                )),
                content_type='application/json',
                headers={
                    'Authorization': self.user
                }
            )

            assert resp.status_code == requests.codes.ok

    def testLog(self):
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
        logs = data['logs']

        assert len(logs) == 3

        for log, pkghash in zip(logs, self.hashes):
            assert log['author'] == self.user
            assert log['hash'] == pkghash

    def testAccess(self):
        sharewith = "share_with"

        resp = self.app.put(
            '/api/access/{owner}/{pkg}/{usr}'.format(
                owner=self.user, usr=sharewith, pkg=self.pkg
            ),
            headers={
                'Authorization': self.user
            }
        )
        assert resp.status_code == requests.codes.ok

        # Can't view
        resp = self.app.get(
            '/api/log/{usr}/{pkg}/'.format(
                usr=self.user,
                pkg=self.pkg
            ),
            headers={
                'Authorization': sharewith
            }
        )
        assert resp.status_code == requests.codes.forbidden
