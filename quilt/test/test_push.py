"""
Tests for the push command.
"""

import json
import os

import requests
import responses

from quilt.tools import command, store
from quilt.tools.core import find_object_hashes

from .utils import QuiltTestCase

def upload_urls(contents):
    all_hashes = set(find_object_hashes(contents))

    urls = {}
    for blob_hash in all_hashes:
        template = "https://example.com/{owner}/{pkg}/{hash}"
        urls[blob_hash] = template.format(owner='foo',
                                          pkg='bar',
                                          hash=blob_hash)
    return urls


class PushTest(QuiltTestCase):
    """
    Unit tests for quilt push.
    """
    def test_push(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/bar', build_path)

        pkg_obj = store.get_store('foo', 'bar')
        assert pkg_obj.exists(), "Failed build?"
        pkg_hash = pkg_obj.get_hash()
        assert pkg_hash
        contents = pkg_obj.get_contents()
        urls = upload_urls(contents)
        for blob_hash, url in urls.items():
            self._mock_s3(url)

        self._mock_put_package('foo/bar', pkg_hash, contents)
        self._mock_put_tag('foo/bar', 'latest')

        session = requests.Session()
        command.push(session, 'foo/bar')

    def _mock_put_package(self, package, pkg_hash, contents):
        pkg_url = '%s/api/package/%s/%s' % (command.QUILT_PKG_URL, package, pkg_hash)
        self.requests_mock.add(responses.PUT, pkg_url, json.dumps(dict(
            upload_urls=upload_urls(contents)
        )))

    def _mock_put_tag(self, package, tag):
        tag_url = '%s/api/tag/%s/%s' % (command.QUILT_PKG_URL, package, tag)
        self.requests_mock.add(responses.PUT, tag_url, json.dumps(dict()))

    def _mock_s3(self, s3_url):
        self.requests_mock.add(responses.PUT, s3_url)
