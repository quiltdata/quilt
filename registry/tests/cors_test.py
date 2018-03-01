# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
CORS tests
"""

import requests
from unittest.mock import patch

from .utils import QuiltTestCase


class TagTestCase(QuiltTestCase):
    """
    Test that API requests return the correct CORS headers.
    """
    ORIGIN = 'http://www.example.com'

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testSuccessfulApi(self):
        resp = self.app.get(
            '/api/package/random_user/',
            headers={
                'Origin': self.ORIGIN
            }
        )
        assert resp.status_code == requests.codes.ok
        assert resp.headers['Access-Control-Allow-Origin'] == self.ORIGIN

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testFailedApi(self):
        resp = self.app.get(
            '/api/package/random_user/no_such_package/',
            headers={
                'Origin': self.ORIGIN
            }
        )
        assert resp.status_code == requests.codes.not_found
        assert resp.headers['Access-Control-Allow-Origin'] == self.ORIGIN

    @patch('quilt_server.views.ALLOW_ANONYMOUS_ACCESS', True)
    def testNonApi(self):
        resp = self.app.get(
            '/login',
            headers={
                'Origin': self.ORIGIN
            }
        )
        assert resp.status_code == requests.codes.found
        assert 'Access-Control-Allow-Origin' not in resp.headers
