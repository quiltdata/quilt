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

        pkg_obj = store.PackageStore.find_package(None, 'foo', 'bar')
        pkg_hash = pkg_obj.get_hash()
        assert pkg_hash
        contents = pkg_obj.get_contents()

        all_hashes = set(find_object_hashes(contents))
        upload_urls = {
            blob_hash: dict(
                head="https://example.com/head/{owner}/{hash}".format(owner='foo', hash=blob_hash),
                put="https://example.com/put/{owner}/{hash}".format(owner='foo', hash=blob_hash)
            ) for blob_hash in all_hashes
        }

        # We will push the package twice, so we're mocking all responses twice.

        for blob_hash in all_hashes:
            urls = upload_urls[blob_hash]

            # First time the package is pushed, s3 HEAD 404s, and we get a PUT.
            self.requests_mock.add(responses.HEAD, urls['head'], status=404)
            self.requests_mock.add(responses.PUT, urls['put'])

            # Second time, s3 HEAD succeeds, and we're not expecting a PUT.
            self.requests_mock.add(responses.HEAD, urls['head'])

        self._mock_put_package('foo/bar', pkg_hash, upload_urls)
        self._mock_put_tag('foo/bar', 'latest')

        self._mock_put_package('foo/bar', pkg_hash, upload_urls)
        self._mock_put_tag('foo/bar', 'latest')

        # Push a new package.
        command.push('foo/bar')

        # Push it again; this time, we're verifying that there are no s3 uploads.
        command.push('foo/bar')

    def _mock_put_package(self, package, pkg_hash, upload_urls):
        pkg_url = '%s/api/package/%s/%s' % (command.get_registry_url(None), package, pkg_hash)
        # Dry run, then the real thing.
        self.requests_mock.add(responses.PUT, pkg_url, json.dumps(dict(upload_urls=upload_urls)))
        self.requests_mock.add(responses.PUT, pkg_url, json.dumps(dict(package_url='https://example.com/')))

    def _mock_put_tag(self, package, tag):
        tag_url = '%s/api/tag/%s/%s' % (command.get_registry_url(None), package, tag)
        self.requests_mock.add(responses.PUT, tag_url, json.dumps(dict()))
