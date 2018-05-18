# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Search tests
"""

import hashlib
import json
from unittest.mock import patch
import urllib

import requests

from quilt_server.core import GroupNode, RootNode, FileNode

from .utils import QuiltTestCase


class SearchTestCase(QuiltTestCase):
    """
    Test full-text search
    """
    def _test_query(self, query, headers, expected_results):
        params = dict(q=query)
        resp = self.app.get(
            '/api/search/?%s' % urllib.parse.urlencode(params),
            headers=headers
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        results = ['%(owner)s/%(name)s' % pkg for pkg in data['packages']]
        assert results == expected_results

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testBasicSearch(self):
        user = "test_user"

        for i in [1, 2]:
            pkg = 'public%d' % i
            self.put_package(user, pkg, RootNode(children=dict()), is_public=True, tag_latest=True)

        self.put_package(user, 'private', RootNode(children=dict()), tag_latest=True)

        self._test_query("test_user/public1", {}, ["test_user/public1"])
        self._test_query("Test_User/Public1", {}, ["test_user/public1"])
        self._test_query("test_user/private", {}, [])
        self._test_query("test_user/", {}, ["test_user/public1", "test_user/public2"])
        self._test_query("test_user public1", {}, ["test_user/public1"])
        self._test_query("", {}, ["test_user/public1", "test_user/public2"])
        self._test_query("foo", {}, [])

        auth = {'Authorization': user}

        self._test_query("test_user/public1", auth, ["test_user/public1"])
        self._test_query("private", auth, ["test_user/private"])
        self._test_query("test", auth, [
            "test_user/private", "test_user/public1", "test_user/public2"
        ])
        self._test_query("", auth, [
            "test_user/private", "test_user/public1", "test_user/public2"
        ])

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testBasicSearchOrder(self):
        user = "test_user"

        for pkg in ['a', 'B', 'c', 'D']:
            self.put_package(user, pkg, RootNode(children=dict()), is_public=True, tag_latest=True)

        params = dict(q=user)
        resp = self.app.get(
            '/api/search/?%s' % urllib.parse.urlencode(params)
        )

        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        names = [pkg['name'] for pkg in data['packages']]
        assert names == ['a', 'B', 'c', 'D']

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testSearchReadmeSnippet(self):
        user = "test_user"

        readme_contents = 'foo' * 1000
        blob_hash = '8db466bdfc3265dd1347843b31ed34af0a0c2e6ff0fd4d6a5853755f0e68b8a0'

        contents = RootNode(dict(
            README=FileNode([blob_hash], dict())
        ))

        self._mock_object(user, blob_hash, readme_contents.encode())
        self.put_package(user, 'pkg', contents, is_public=True, tag_latest=True)

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
        user = "test_user"

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

            self._mock_object(user, blob_hash, readme.encode())
            self.put_package(user, name, contents, is_public=True, tag_latest=True)

        # Package with no README, but more nodes.
        contents2 = RootNode(dict(
            wine=GroupNode(dict()),
            baz=GroupNode(dict())
        ))
        self.put_package(user, "foo", contents2, is_public=True, tag_latest=True)

        # Stemming
        self._test_query("redact", {}, ["test_user/clinton_email"])
        self._test_query("releasing", {}, ["test_user/clinton_email"])

        # Stemming on package name
        self._test_query("no wining", {}, ["test_user/wine", "test_user/foo", "test_user/nothing"])

        # Multiple words
        self._test_query("state department's biggest release", {}, ["test_user/clinton_email"])

        # Keywords in package name
        self._test_query("users dog cat", {}, ["test_user/dogscats"])

        # Order precedence: package name, metadata, README
        self._test_query("clinton", {}, ["test_user/clinton_email", "test_user/nothing"])
        self._test_query("wine", {}, ["test_user/wine", "test_user/foo", "test_user/nothing"])

        # Different keywords match different sources: package name and README.
        self._test_query("nothing wine", {}, ["test_user/nothing"])
