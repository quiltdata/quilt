"""
Tests for the install command.
"""

import hashlib
import json
import os

import responses
from six import assertRaisesRegex
from six.moves import urllib

from ..tools import command
from ..tools.const import HASH_TYPE
from ..tools.core import (
    decode_node,
    encode_node,
    hash_contents,
    FileNode,
    GroupNode,
    PackageFormat,
    TableNode,
    RootNode,
)

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

        contents = GroupNode(dict(
            foo=GroupNode(dict(
                bar=TableNode([table_hash]),
                blah=FileNode([file_hash])
            ))
        ))
        contents_hash = hash_contents(contents)

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, '', contents, [table_hash, file_hash])
        self._mock_s3(table_hash, table_data)
        self._mock_s3(file_hash, file_data)

        command.install('foo/bar')

        with open('quilt_packages/foo/bar.json') as fd:
            file_contents = json.load(fd, object_hook=decode_node)
            assert file_contents == contents

        with open('quilt_packages/objs/{hash}'.format(hash=table_hash)) as fd:
            contents = fd.read()
            assert contents == table_data

        with open('quilt_packages/objs/{hash}'.format(hash=file_hash)) as fd:
            contents = fd.read()
            assert contents == file_data

    def test_install_subpackage(self):
        """
        Install a part of a package.
        """
        table_data = "table" * 10
        h = hashlib.new(HASH_TYPE)
        h.update(table_data.encode('utf-8'))
        table_hash = h.hexdigest()

        contents = RootNode(dict(
            group=GroupNode(dict(
                table=TableNode([table_hash]),
                file=FileNode(['unused'])
            ))
        ))
        contents_hash = hash_contents(contents)

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, 'group/table', contents, [table_hash])
        self._mock_s3(table_hash, table_data)

        command.install('foo/bar/group/table')

        with open('quilt_packages/foo/bar.json') as fd:
            file_contents = json.load(fd, object_hook=decode_node)
            assert file_contents == contents

        with open('quilt_packages/objs/{hash}'.format(hash=table_hash)) as fd:
            contents = fd.read()
            assert contents == table_data

    def test_bad_contents_hash(self):
        """
        Test that a package with a bad contents hash fails installation.
        """
        tabledata = 'Bad package'
        h = hashlib.new(HASH_TYPE)
        h.update(tabledata.encode('utf-8'))
        obj_hash = h.hexdigest()
        contents = GroupNode(dict(
            foo=GroupNode(dict(
                bar=TableNode([obj_hash])
            ))
        ))
        contents_hash = 'e867010701edc0b1c8be177e02a93aa3cb1342bb1123046e1f6b40e428c6048e'

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, '', contents, [obj_hash])

        with assertRaisesRegex(self, command.CommandException, "Mismatched hash"):
            command.install('foo/bar')

        assert not os.path.exists('quilt_packages/foo/bar.json')

    def test_bad_object_hash(self):
        """
        Test that a package with a file hash mismatch fails installation.
        """
        tabledata = 'Bad package'
        h = hashlib.new(HASH_TYPE)
        h.update(tabledata.encode('utf-8'))
        obj_hash = 'e867010701edc0b1c8be177e02a93aa3cb1342bb1123046e1f6b40e428c6048e'
        contents = GroupNode(dict(
            foo=GroupNode(dict(
                bar=TableNode([obj_hash])
            ))
        ))
        contents_hash = hash_contents(contents)

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, '', contents, [obj_hash])
        self._mock_s3(obj_hash, tabledata)

        with assertRaisesRegex(self, command.CommandException, "hashes do not match"):
            command.install('foo/bar')

        assert not os.path.exists('quilt_packages/foo/bar.json')

    def test_resume_download(self):
        """
        Test that existing objects don't get re-downloaded - unless their hash is wrong.
        """
        file_data_list = []
        file_hash_list = []
        for i in range(3):
            file_data = "file%d" % i
            h = hashlib.new(HASH_TYPE)
            h.update(file_data.encode('utf-8'))
            file_data_list.append(file_data)
            file_hash_list.append(h.hexdigest())

        contents = RootNode(dict(
            file0=FileNode([file_hash_list[0]]),
            file1=FileNode([file_hash_list[1]]),
            file2=FileNode([file_hash_list[2]]),
        ), format=PackageFormat.HDF5)
        contents_hash = hash_contents(contents)

        os.makedirs('quilt_packages/objs')

        # file0 already exists.
        with open('quilt_packages/objs/{hash}'.format(hash=file_hash_list[0]), 'w') as fd:
            fd.write(file_data_list[0])

        # file1 exists, but has the wrong contents.
        with open('quilt_packages/objs/{hash}'.format(hash=file_hash_list[1]), 'w') as fd:
            fd.write("Garbage")

        # file2 does not exist.

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, '', contents, file_hash_list)
        # Don't mock file0, since it's not supposed to be downloaded.
        self._mock_s3(file_hash_list[1], file_data_list[1])
        self._mock_s3(file_hash_list[2], file_data_list[2])

        command.install('foo/bar')

        # Verify that file1 got redownloaded.
        with open('quilt_packages/objs/{hash}'.format(hash=file_hash_list[1])) as fd:
            contents = fd.read()
            assert contents == file_data_list[1]

    def _mock_tag(self, package, tag, pkg_hash):
        tag_url = '%s/api/tag/%s/%s' % (command.get_registry_url(), package, tag)

        self.requests_mock.add(responses.GET, tag_url, json.dumps(dict(
            hash=pkg_hash
        )))

    def _mock_package(self, package, pkg_hash, subpath, contents, hashes):
        pkg_url = '%s/api/package/%s/%s?%s' % (
            command.get_registry_url(), package, pkg_hash, urllib.parse.urlencode(dict(subpath=subpath))
        )
        self.requests_mock.add(responses.GET, pkg_url, json.dumps(dict(
            contents=contents,
            urls={h: 'https://example.com/%s' % h for h in hashes}
        ), default=encode_node), match_querystring=True)

    def _mock_s3(self, pkg_hash, contents):
        s3_url = 'https://example.com/%s' % pkg_hash
        self.requests_mock.add(responses.GET, s3_url, contents)
