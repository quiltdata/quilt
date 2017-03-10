"""
Tests for the push command.
"""

import json
import os

import requests
import responses

from quilt.tools import command, store

from .utils import QuiltTestCase

class PushTest(QuiltTestCase):
    """
    Unit tests for quilt push.
    """
    def test_push(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        pkg_hash = store.get_store('foo', 'bar').get_hash()

        self._mock_put_package('foo/bar', pkg_hash)
        self._mock_put_tag('foo/bar', 'latest', pkg_hash)

        session = requests.Session()
        command.push(session, 'foo/bar')

    def _mock_put_package(self, package, pkg_hash):
        pkg_url = '%s/api/package/%s/%s' % (command.QUILT_PKG_URL, package, pkg_hash)
        self.requests_mock.add(responses.PUT, pkg_url, json.dumps(dict(
            upload_urls={}
        )))

    def _mock_put_tag(self, package, tag, pkg_hash):
        tag_url = '%s/api/tag/%s/%s' % (command.QUILT_PKG_URL, package, tag)

        self.requests_mock.add(responses.PUT, tag_url, json.dumps(dict()))
