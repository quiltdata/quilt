"""
Tests for the push command.
"""

import json
import os

import responses

from quilt.tools import command, store
from quilt.tools.core import find_object_hashes

from .utils import QuiltTestCase


class PushTest(QuiltTestCase):
    """
    Unit tests for quilt push.
    """
    def test_push(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        pkg_obj = store.PackageStore.find_package('foo', 'bar')
        pkg_hash = pkg_obj.get_hash()
        assert pkg_hash
        contents = pkg_obj.get_contents()

        # We will push the package twice, so we're mocking all responses twice.

        all_hashes = set(find_object_hashes(contents))
        for blob_hash in all_hashes:
            head_url = "https://example.com/head/{owner}/{hash}".format(
                owner='foo', hash=blob_hash)
            put_url = "https://example.com/put/{owner}/{hash}".format(
                owner='foo', hash=blob_hash)

            # First time the package is pushed, s3 HEAD 404s, and we get a PUT.
            self._mock_get_blob('foo', blob_hash, head_url, put_url)
            self.requests_mock.add(responses.HEAD, head_url, status=404)
            self.requests_mock.add(responses.PUT, put_url)

            # Second time, s3 HEAD succeeds, and we're not expecting a PUT.
            self._mock_get_blob('foo', blob_hash, head_url, put_url)
            self.requests_mock.add(responses.HEAD, head_url)

        self._mock_put_package('foo/bar', pkg_hash)
        self._mock_put_tag('foo/bar', 'latest')

        self._mock_put_package('foo/bar', pkg_hash)
        self._mock_put_tag('foo/bar', 'latest')

        # Push a new package.
        command.push('foo/bar')

        # Push it again; this time, we're verifying that there are no s3 uploads.
        command.push('foo/bar')

    def _mock_get_blob(self, user, blob_hash, s3_head, s3_put):
        blob_url = '%s/api/blob/%s/%s' % (command.QUILT_PKG_URL, user, blob_hash)
        self.requests_mock.add(responses.GET, blob_url, json.dumps(dict(
            head=s3_head,
            get='',
            put=s3_put,
        )))

    def _mock_put_package(self, package, pkg_hash):
        pkg_url = '%s/api/package/%s/%s' % (command.QUILT_PKG_URL, package, pkg_hash)
        self.requests_mock.add(responses.PUT, pkg_url, json.dumps(dict()))

    def _mock_put_tag(self, package, tag):
        tag_url = '%s/api/tag/%s/%s' % (command.QUILT_PKG_URL, package, tag)
        self.requests_mock.add(responses.PUT, tag_url, json.dumps(dict()))
