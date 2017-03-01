"""
Tests for commands.
"""

import hashlib
import json
import os

import requests
import responses

from quilt.tools import command
from quilt.tools.const import HASH_TYPE, TYPE_KEY, NodeType
from quilt.tools.hashing import hash_contents

from .utils import QuiltTestCase

class InstallTest(QuiltTestCase):
    """
    Unit tests for quilt install.
    """
    # Note: we're using the deprecated `assertRaisesRegexp` method because
    # the new one, `assertRaisesRegex`, is not present in Python2.

    def test_install_latest(self):
        """
        Install the latest update of a package.
        """
        tabledata = "table"*10
        h = hashlib.new(HASH_TYPE)
        h.update(tabledata.encode('utf-8'))
        obj_hash = h.hexdigest()
        contents = dict(foo={TYPE_KEY: NodeType.GROUP.value,
                             'bar' : {TYPE_KEY : NodeType.TABLE.value,
                                      'hashes': [obj_hash]}
                            })
        contents_hash = hash_contents(contents)

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, contents, [obj_hash])
        self._mock_s3(obj_hash, tabledata)

        session = requests.Session()
        command.install(session, 'foo/bar')

        with open('quilt_packages/foo/bar.json') as fd:
            file_contents = json.load(fd)
            assert file_contents == contents

        with open('quilt_packages/objs/{hash}'.format(hash=obj_hash)) as fd:
            file_contents = fd.read()
            assert file_contents == tabledata

    def test_bad_contents_hash(self):
        """
        Test that a package with a bad contents hash fails installation.
        """
        tabledata = 'Bad package'
        h = hashlib.new(HASH_TYPE)
        h.update(tabledata.encode('utf-8'))
        obj_hash = h.hexdigest()
        contents = {'foo': {TYPE_KEY: NodeType.GROUP.value,
                            'bar' : {TYPE_KEY: NodeType.TABLE.value,
                                     'hashes': [obj_hash]}
                           }
                   }
        contents_hash = 'e867010701edc0b1c8be177e02a93aa3cb1342bb1123046e1f6b40e428c6048e'

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, contents, [obj_hash])
        self._mock_s3(obj_hash, tabledata)

        session = requests.Session()
        with self.assertRaisesRegexp(command.CommandException, "Mismatched hash"):
            command.install(session, 'foo/bar')

        assert not os.path.exists('quilt_packages/foo/bar.json')

    def test_bad_object_hash(self):
        """
        Test that a package with a file hash mismatch fails installation.
        """
        tabledata = 'Bad package'
        h = hashlib.new(HASH_TYPE)
        h.update(tabledata.encode('utf-8'))
        obj_hash = 'e867010701edc0b1c8be177e02a93aa3cb1342bb1123046e1f6b40e428c6048e'
        contents = dict(foo={TYPE_KEY: NodeType.GROUP.value,
                             'bar' : {TYPE_KEY: NodeType.TABLE.value,
                                      'hashes': [obj_hash]}
                            })
        contents_hash = hash_contents(contents)

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, contents, [obj_hash])
        self._mock_s3(obj_hash, tabledata)

        session = requests.Session()
        with self.assertRaisesRegexp(command.CommandException, "Mismatched hash"):
            command.install(session, 'foo/bar')

        assert not os.path.exists('quilt_packages/foo/bar.json')

    def _mock_tag(self, package, tag, pkg_hash):
        tag_url = '%s/api/tag/%s/%s' % (command.QUILT_PKG_URL, package, tag)

        self.requests_mock.add(responses.GET, tag_url, json.dumps(dict(
            hash=pkg_hash
        )))

    def _mock_package(self, package, pkg_hash, contents, hashes):
        pkg_url = '%s/api/package/foo/bar/%s' % (command.QUILT_PKG_URL, pkg_hash)
        self.requests_mock.add(responses.GET, pkg_url, json.dumps(dict(
            contents=contents,
            urls={h: 'https://example.com/%s' % h for h in hashes}
        )))

    def _mock_s3(self, pkg_hash, contents):
        s3_url = 'https://example.com/%s' % pkg_hash
        self.requests_mock.add(responses.GET, s3_url, contents)
