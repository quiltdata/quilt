"""
Log tests
"""

import json
import requests

from quilt_server.schemas import hash_contents
from .utils import QuiltTestCase


class LogTestCase(QuiltTestCase):
    """
    Test log endpoint.
    """
    def setUp(self):
        super(LogTestCase, self).setUp()

        self.user = "test_user"
        self.pkg = "pkg"
        self.contents_list = [
            {'foo': {'$type' : 'GROUP'}},
            {'bar': {'$type' : 'GROUP'}},
            {'baz': {'$type' : 'GROUP'}},
        ]

        # Upload three package instances.
        for contents in self.contents_list:
            self.put_package(self.user, self.pkg, contents)

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

        for log, contents in zip(logs, self.contents_list):
            assert log['author'] == self.user
            assert log['hash'] == hash_contents(contents)

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
