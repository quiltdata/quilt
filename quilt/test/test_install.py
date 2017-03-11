"""
Tests for the install command.
"""

import hashlib
import json
import os

import requests
import responses
from six import assertRaisesRegex

from quilt.tools import command
from quilt.tools.const import HASH_TYPE
from quilt.tools.core import hash_contents, NodeType

from .utils import QuiltTestCase

class InstallTest(QuiltTestCase):
    """
    Unit tests for quilt install.
    """
    def test_install_latest(self):
        """
        Install the latest update of a package.
        """
        table_data = "table" * 10
        h = hashlib.new(HASH_TYPE)
        h.update(table_data.encode('utf-8'))
        table_hash = h.hexdigest()

        file_data = "file" * 10
        h = hashlib.new(HASH_TYPE)
        h.update(file_data.encode('utf-8'))
        file_hash = h.hexdigest()

        contents = dict(
            type=NodeType.GROUP.value,
            children=dict(
                foo=dict(
                    type=NodeType.GROUP.value,
                    children=dict(
                        bar=dict(
                            type=NodeType.TABLE.value,
                            hashes=[table_hash]
                        ),
                        blah=dict(
                            type=NodeType.FILE.value,
                            hashes=[file_hash]
                        )
                    )
                )
            )
        )
        contents_hash = hash_contents(contents)

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, contents, [table_hash, file_hash])
        self._mock_s3(table_hash, table_data)
        self._mock_s3(file_hash, file_data)

        session = requests.Session()
        command.install(session, 'foo/bar')

        with open('quilt_packages/foo/bar.json') as fd:
            file_contents = json.load(fd)
            assert file_contents == contents

        with open('quilt_packages/objs/{hash}'.format(hash=table_hash)) as fd:
            contents = fd.read()
            assert contents == table_data

        with open('quilt_packages/objs/{hash}'.format(hash=file_hash)) as fd:
            contents = fd.read()
            assert contents == file_data

    def test_bad_contents_hash(self):
        """
        Test that a package with a bad contents hash fails installation.
        """
        tabledata = 'Bad package'
        h = hashlib.new(HASH_TYPE)
        h.update(tabledata.encode('utf-8'))
        obj_hash = h.hexdigest()
        contents = dict(
            type=NodeType.GROUP.value,
            children=dict(
                foo=dict(
                    type=NodeType.GROUP.value,
                    children=dict(
                        bar=dict(
                            type=NodeType.TABLE.value,
                            hashes=[obj_hash]
                        )
                    )
                )
            )
        )
        contents_hash = 'e867010701edc0b1c8be177e02a93aa3cb1342bb1123046e1f6b40e428c6048e'

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, contents, [obj_hash])
        self._mock_s3(obj_hash, tabledata)

        session = requests.Session()
        with assertRaisesRegex(self, command.CommandException, "Mismatched hash"):
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
        contents = dict(
            type=NodeType.GROUP.value,
            children=dict(
                foo=dict(
                    type=NodeType.GROUP.value,
                    children=dict(
                        bar=dict(
                            type=NodeType.TABLE.value,
                            hashes=[obj_hash]
                        )
                    )
                )
            )
        )
        contents_hash = hash_contents(contents)

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, contents, [obj_hash])
        self._mock_s3(obj_hash, tabledata)

        session = requests.Session()
        with assertRaisesRegex(self, command.CommandException, "Mismatched hash"):
            command.install(session, 'foo/bar')

        assert not os.path.exists('quilt_packages/foo/bar.json')

    def _mock_tag(self, package, tag, pkg_hash):
        tag_url = '%s/api/tag/%s/%s' % (command.QUILT_PKG_URL, package, tag)

        self.requests_mock.add(responses.GET, tag_url, json.dumps(dict(
            hash=pkg_hash
        )))

    def _mock_package(self, package, pkg_hash, contents, hashes):
        pkg_url = '%s/api/package/%s/%s' % (command.QUILT_PKG_URL, package, pkg_hash)
        self.requests_mock.add(responses.GET, pkg_url, json.dumps(dict(
            contents=contents,
            urls={h: 'https://example.com/%s' % h for h in hashes}
        )))

    def _mock_s3(self, pkg_hash, contents):
        s3_url = 'https://example.com/%s' % pkg_hash
        self.requests_mock.add(responses.GET, s3_url, contents)
