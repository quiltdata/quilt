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
    @staticmethod
    def make_table_data(string="table"):
        table_data = string * 10
        h = hashlib.new(HASH_TYPE)
        h.update(table_data.encode('utf-8'))
        table_hash = h.hexdigest()
        return table_data, table_hash

    @staticmethod
    def make_file_data(string="file"):
        file_data = string * 10
        h = hashlib.new(HASH_TYPE)
        h.update(file_data.encode('utf-8'))
        file_hash = h.hexdigest()
        return file_data, file_hash
    
    @staticmethod
    def make_contents(**args):
        contents = RootNode(dict(
            group=GroupNode(dict([
                (key, TableNode([val]) if 'table' in key else FileNode([val]))
                for key, val in args.items()]
            ))
        ))
        return contents, hash_contents(contents)
        
    """
    Unit tests for quilt install.
    """
    def test_install_latest(self):
        """
        Install the latest update of a package.
        """
        table_data, table_hash = self.make_table_data()
        file_data, file_hash = self.make_file_data()
        contents, contents_hash = self.make_contents(table=table_hash, file=file_hash)

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
        table_data, table_hash = self.make_table_data()
        contents, contents_hash = self.make_contents(table=table_hash)

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

    @staticmethod
    def validate_file(filename, contents, table_hash, table_data):
        with open('quilt_packages/'+filename) as fd:
            file_contents = json.load(fd, object_hook=decode_node)
            assert file_contents == contents
        with open('quilt_packages/objs/{hash}'.format(hash=table_hash)) as fd:
            contents = fd.read()
            assert contents == table_data

    def test_install_dependencies(self):
        """
        Install multiple packages via requirements file
        """
        table_data1, table_hash1 = self.make_table_data('table1')
        contents1, contents_hash1 = self.make_contents(table1=table_hash1)
        self._mock_tag('foo/bar', 'latest', contents_hash1)
        self._mock_package('foo/bar', contents_hash1, 'group/table', contents1, [table_hash1])
        self._mock_s3(table_hash1, table_data1)

        table_data2, table_hash2 = self.make_table_data('table2')
        contents2, contents_hash2 = self.make_contents(table2=table_hash2)
        self._mock_tag('baz/bat', 'nexttag', contents_hash2)
        self._mock_package('baz/bat', contents_hash2, 'group/table', contents2, [table_hash2])
        self._mock_s3(table_hash2, table_data2)

        table_data3, table_hash3 = self.make_table_data('table3')
        contents3, contents_hash3 = self.make_contents(table3=table_hash3)
        self._mock_version('usr1/pkga', 'v1', contents_hash3)
        self._mock_package('usr1/pkga', contents_hash3, 'group/table', contents3, [table_hash3])
        self._mock_s3(table_hash3, table_data3)

        table_data4, table_hash4 = self.make_table_data('table4')
        contents4, contents_hash4 = self.make_contents(table4=table_hash4)
        self._mock_tag('usr2/pkgb', 'latest', contents_hash4)
        self._mock_package('usr2/pkgb', contents_hash4, 'group/table', contents4, [table_hash4])
        self._mock_s3(table_hash4, table_data4)

        command.install('''
packages:
- foo/bar:t:latest   # comment
- baz/bat:t:nexttag
- usr1/pkga:version:v1
- usr2/pkgb
        ''')
        self.validate_file('foo/bar.json', contents1, table_hash1, table_data1)
        self.validate_file('baz/bat.json', contents2, table_hash2, table_data2)
        self.validate_file('usr1/pkga.json', contents3, table_hash3, table_data3)
        self.validate_file('usr2/pkgb.json', contents4, table_hash4, table_data4)

        table_data5, table_hash5 = self.make_table_data('table5')
        contents5, contents_hash5 = self.make_contents(table5=table_hash5)
        self._mock_tag('usr3/pkgc', 'latest', contents_hash5)
        self._mock_package('usr3/pkgc', contents_hash5, 'group/table', contents5, [table_hash5])
        self._mock_s3(table_hash5, table_data5)

        # test reading from file
        with open('tmp_quilt.yml', 'w') as fd:
            fd.write("packages:\n- usr3/pkgc")
            fd.close()
        command.install('@tmp_quilt.yml')
            

    def test_bad_install_dependencies(self):
        """
        Install multiple packages via requirements file
        """
        table_data1, table_hash1 = self.make_table_data('table1')
        contents1, contents_hash1 = self.make_contents(table1=table_hash1)

        with assertRaisesRegex(self, command.CommandException, "package name is empty"):
            command.install(" ")
        with assertRaisesRegex(self, command.CommandException, "Specify package as"):
            command.install("packages:\n")
        with assertRaisesRegex(self, command.CommandException, "Specify package as"):
            command.install("packages:\n- foo")
        with assertRaisesRegex(self, command.CommandException, "invalid versioninfo"):
            command.install("packages:\n- foo/bar:xxx:bar")
        with assertRaisesRegex(self, Exception, "No such file or directory"):
            self.validate_file('foo/bar.json', contents1, table_hash1, table_data1)

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
        tag_url = '%s/api/tag/%s/%s' % (command.QUILT_PKG_URL, package, tag)

        self.requests_mock.add(responses.GET, tag_url, json.dumps(dict(
            hash=pkg_hash
        )))

    def _mock_version(self, package, version, pkg_hash):
        tag_url = '%s/api/version/%s/%s' % (command.QUILT_PKG_URL, package, version)

        self.requests_mock.add(responses.GET, tag_url, json.dumps(dict(
            hash=pkg_hash
        )))

    def _mock_package(self, package, pkg_hash, subpath, contents, hashes):
        pkg_url = '%s/api/package/%s/%s?%s' % (
            command.QUILT_PKG_URL, package, pkg_hash, urllib.parse.urlencode(dict(subpath=subpath))
        )
        self.requests_mock.add(responses.GET, pkg_url, json.dumps(dict(
            contents=contents,
            urls={h: 'https://example.com/%s' % h for h in hashes}
        ), default=encode_node), match_querystring=True)

    def _mock_s3(self, pkg_hash, contents):
        s3_url = 'https://example.com/%s' % pkg_hash
        self.requests_mock.add(responses.GET, s3_url, contents)
