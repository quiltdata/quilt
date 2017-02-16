"""
Tests for commands.
"""

import json
import os

import requests
import responses

from quilt.tools import command
from .utils import QuiltTestCase

class InstallTest(QuiltTestCase):
    # Note: we're using the deprecated `assertRaisesRegexp` method because
    # the new one, `assertRaisesRegex`, is not present in Python2.

    def test_install_latest(self):
        contents = 'HDF5 package'
        contents_hash = 'e867010701edc0b1c8be177e02a93aa3cb1342bb1123046e1f6b40e428c6048e'

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash)
        self._mock_s3(contents_hash, contents)

        session = requests.Session()
        command.install(session, 'foo/bar')

        with open('quilt_packages/foo/bar.h5') as fd:
            file_contents = fd.read()
            assert file_contents == contents

    def test_bad_hash(self):
        contents = 'Bad package'
        contents_hash = 'e867010701edc0b1c8be177e02a93aa3cb1342bb1123046e1f6b40e428c6048e'

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash)
        self._mock_s3(contents_hash, contents)

        session = requests.Session()
        with self.assertRaisesRegexp(command.CommandException, "Mismatched hash"):
            command.install(session, 'foo/bar')

        assert not os.path.exists('quilt_packages/foo/bar.h5')

    def _mock_tag(self, package, tag, pkg_hash):
        tag_url = '%s/api/tag/%s/%s' % (command.QUILT_PKG_URL, package, tag)

        self.requests_mock.add(responses.GET, tag_url, json.dumps(dict(
            hash=pkg_hash
        )))

    def _mock_package(self, package, pkg_hash):
        pkg_url = '%s/api/package/foo/bar/%s' % (command.QUILT_PKG_URL, pkg_hash)
        s3_url = 'https://example.com/%s' % pkg_hash

        self.requests_mock.add(responses.GET, pkg_url, json.dumps(dict(
            url=s3_url,
            hash=pkg_hash
        )))

    def _mock_s3(self, pkg_hash, contents):
        s3_url = 'https://example.com/%s' % pkg_hash
        self.requests_mock.add(responses.GET, s3_url, contents)
