"""
Tests for the install command.
"""

import hashlib
import json
import os
import time
import pytest

import requests
import responses
from requests.exceptions import SSLError, ConnectionError
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
from ..tools.package import Package
from ..tools.store import PackageStore, StoreException
from ..tools.util import gzip_compress

from .utils import QuiltTestCase, patch

class InstallTest(QuiltTestCase):
    """
    Unit tests for quilt install.
    """
    @classmethod
    def make_table_data(cls, string="table"):
        table_data = (string * 10).encode('utf-8')
        h = hashlib.new(HASH_TYPE)
        h.update(table_data)
        table_hash = h.hexdigest()
        return table_data, table_hash

    @classmethod
    def make_file_data(cls, string="file"):
        file_data = (string * 10).encode('utf-8')
        h = hashlib.new(HASH_TYPE)
        h.update(file_data)
        file_hash = h.hexdigest()
        return file_data, file_hash

    @classmethod
    def make_contents(cls, **args):
        contents = RootNode(dict(
            group=GroupNode(dict([
                (key, TableNode([val], PackageFormat.default.value)
                 if 'table' in key
                 else FileNode([val], metadata={'q_path': key}))
                for key, val in args.items()]
            ))
        ))
        return contents, hash_contents(contents)

    def test_metdata_hash(self):
        pkg1 = RootNode(dict(
            data=FileNode(['123'])
        ))

        pkg2 = RootNode(dict(
            data=FileNode(['123'], metadata={'q_path': 'blah'})
        ))

        pkg3 = RootNode(dict(
            data=FileNode(['123'], metadata_hash='blah')
        ))

        # System metadata DOES NOT affect the package hash.
        assert hash_contents(pkg1) == hash_contents(pkg2)

        # User metadata DOES affect the package hash.
        assert hash_contents(pkg1) != hash_contents(pkg3)

    def test_install_latest(self):
        """
        Install the latest update of a package.
        """
        table_data, table_hash = self.make_table_data()
        file_data, file_hash = self.make_file_data()
        contents, contents_hash = self.make_contents(table=table_hash, file=file_hash)

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, '', contents, [table_hash, file_hash])
        # Test compressed and uncompressed fragments.
        self._mock_s3(table_hash, table_data, gzip=True)
        self._mock_s3(file_hash, file_data, gzip=False)

        command.install('foo/bar')
        self.validate_file('foo', 'bar', contents_hash, contents, table_hash, table_data)

    def test_install_team_latest(self):
        """
        Install the latest team update of a package.
        """
        table_data, table_hash = self.make_table_data()
        file_data, file_hash = self.make_file_data()
        contents, contents_hash = self.make_contents(table=table_hash, file=file_hash)

        self._mock_tag('foo/bar', 'latest', contents_hash, team='qux')
        self._mock_package('foo/bar', contents_hash, '', contents, [table_hash, file_hash], team='qux')
        self._mock_s3(table_hash, table_data)
        self._mock_s3(file_hash, file_data)

        command.install('qux:foo/bar')
        self.validate_file('foo', 'bar', contents_hash, contents, table_hash, table_data, team='qux')

    def test_short_hashes(self):
        """
        Test various functions that use short hashes
        """
        table_data, table_hash = self.make_table_data()
        file_data, file_hash = self.make_file_data()
        contents, contents_hash = self.make_contents(table=table_hash, file=file_hash)

        self._mock_log('foo/bar', contents_hash)
        self._mock_tag('foo/bar', 'mytag', contents_hash[0:6], cmd=responses.PUT)
        command.tag_add('foo/bar', 'mytag', contents_hash[0:6])

        self._mock_version('foo/bar', '1.0', contents_hash[0:6], cmd=responses.PUT)
        command.version_add('foo/bar', '1.0', contents_hash[0:6], force=True)

    def test_team_short_hashes(self):
        """
        Test various functions that use short hashes for team
        """
        table_data, table_hash = self.make_table_data()
        file_data, file_hash = self.make_file_data()
        contents, contents_hash = self.make_contents(table=table_hash, file=file_hash)

        self._mock_log('foo/bar', contents_hash, team='qux')
        self._mock_tag('foo/bar', 'mytag', contents_hash[0:6], cmd=responses.PUT, team='qux')
        command.tag_add('qux:foo/bar', 'mytag', contents_hash[0:6])

        self._mock_version('foo/bar', '1.0', contents_hash[0:6], cmd=responses.PUT, team='qux')
        command.version_add('qux:foo/bar', '1.0', contents_hash[0:6], force=True)

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
        self.validate_file('foo', 'bar', contents_hash, contents, table_hash, table_data)

    def test_install_team_subpackage(self):
        """
        Install a part of a package.
        """
        table_data, table_hash = self.make_table_data()
        contents, contents_hash = self.make_contents(table=table_hash)
        self._mock_tag('foo/bar', 'latest', contents_hash, team='qux')
        self._mock_package('foo/bar', contents_hash, 'group/table', contents, [table_hash], team='qux')
        self._mock_s3(table_hash, table_data)
        command.install('qux:foo/bar/group/table')
        self.validate_file('foo', 'bar', contents_hash, contents, table_hash, table_data, team='qux')

    def validate_file(self, user, package, contents_hash, contents, table_hash, table_data, team=None):
        teststore = PackageStore(self._store_dir)

        with open(os.path.join(teststore.package_path(team, user, package), Package.CONTENTS_DIR,
                               contents_hash), 'r') as fd:
            file_contents = json.load(fd, object_hook=decode_node)
            assert file_contents == contents

        with open(teststore.object_path(objhash=table_hash), 'rb') as fd:
            file_contents = fd.read()
            assert file_contents == table_data

    def getmtime(self, user, package, contents_hash, team=None):
        teststore = PackageStore(self._store_dir)

        return os.path.getmtime(os.path.join(teststore.package_path(team, user, package),
                                             Package.CONTENTS_DIR,
                                             contents_hash))

    def test_install_dependencies(self):
        """
        Install multiple packages via requirements file
        """
        table_data1, table_hash1 = self.make_table_data('table1')
        contents1, contents_hash1 = self.make_contents(table1=table_hash1)
        self._mock_tag('foo/bar', 'latest', contents_hash1)
        self._mock_package('foo/bar', contents_hash1, '', contents1, [table_hash1])
        self._mock_s3(table_hash1, table_data1)

        table_data2, table_hash2 = self.make_table_data('table2')
        contents2, contents_hash2 = self.make_contents(table2=table_hash2)
        self._mock_tag('baz/bat', 'nexttag', contents_hash2)
        self._mock_package('baz/bat', contents_hash2, '', contents2, [table_hash2])
        self._mock_s3(table_hash2, table_data2)

        table_data3, table_hash3 = self.make_table_data('table3')
        contents3, contents_hash3 = self.make_contents(table3=table_hash3)
        self._mock_version('usr1/pkga', 'v1', contents_hash3)
        self._mock_package('usr1/pkga', contents_hash3, '', contents3, [table_hash3])
        self._mock_s3(table_hash3, table_data3)

        table_data4, table_hash4 = self.make_table_data('table4')
        contents4, contents_hash4 = self.make_contents(table4=table_hash4)
        self._mock_tag('usr2/pkgb', 'latest', contents_hash4)
        self._mock_package('usr2/pkgb', contents_hash4, '', contents4, [table_hash4])
        self._mock_s3(table_hash4, table_data4)

        table_data5, table_hash5 = self.make_table_data('table5')
        contents5, contents_hash5 = self.make_contents(table5=table_hash5)
        self._mock_log('usr3/pkgc', contents_hash5)
        self._mock_package('usr3/pkgc', contents_hash5, '', contents5, [table_hash5])
        self._mock_s3(table_hash5, table_data5)

        table_data6, table_hash6 = self.make_table_data('table6')
        contents6, contents_hash6 = self.make_contents(table6=table_hash6)
        self._mock_tag('danWebster/sgRNAs', 'latest', contents_hash6)
        self._mock_package('danWebster/sgRNAs', contents_hash6, 'libraries/brunello', contents6, [table_hash6])
        self._mock_s3(table_hash6, table_data6)

        table_data7, table_hash7 = self.make_table_data('table7')
        contents7, contents_hash7 = self.make_contents(table7=table_hash7)
        self._mock_tag('usr/pkga', 'latest', contents_hash7, team='team')
        self._mock_package('usr/pkga', contents_hash7, '', contents7, [table_hash7], team='team')
        self._mock_s3(table_hash7, table_data7)

        table_data8, table_hash8 = self.make_table_data('table8')
        contents8, contents_hash8 = self.make_contents(table8=table_hash8)
        self._mock_tag('usr/pkgb', 'tag', contents_hash8, team='team')
        self._mock_package('usr/pkgb', contents_hash8, 'path', contents8, [table_hash8], team='team')
        self._mock_s3(table_hash8, table_data8)

        # inline test of quilt.yml
        command.install('''
packages:
- foo/bar:t:latest   # comment
- baz/bat:t:nexttag
- usr1/pkga:version:v1
- usr2/pkgb
- usr3/pkgc:h:SHORTHASH5
- danWebster/sgRNAs/libraries/brunello  # subpath
- team:usr/pkga
- team:usr/pkgb/path:t:tag
        '''.replace('SHORTHASH5', contents_hash5[0:8]))  # short hash

        self.validate_file('foo', 'bar', contents_hash1, contents1, table_hash1, table_data1)
        self.validate_file('baz','bat', contents_hash2, contents2, table_hash2, table_data2)
        self.validate_file('usr1','pkga', contents_hash3, contents3, table_hash3, table_data3)
        self.validate_file('usr2','pkgb', contents_hash4, contents4, table_hash4, table_data4)
        self.validate_file('usr3','pkgc', contents_hash5, contents5, table_hash5, table_data5)
        self.validate_file('danWebster', 'sgRNAs', contents_hash6, contents6, table_hash6, table_data6)
        self.validate_file('usr', 'pkga', contents_hash7, contents7, table_hash7, table_data7, team='team')
        self.validate_file('usr', 'pkgb', contents_hash8, contents8, table_hash8, table_data8, team='team')

        # check that installation happens in the order listed in quilt.yml
        assert (self.getmtime('foo','bar', contents_hash1) <=
                self.getmtime('baz','bat', contents_hash2) <=
                self.getmtime('usr1','pkga', contents_hash3) <=
                self.getmtime('usr2','pkgb', contents_hash4) <=
                self.getmtime('usr3','pkgc', contents_hash5) <=
                self.getmtime('danWebster', 'sgRNAs', contents_hash6) <=
                self.getmtime('usr','pkga', contents_hash7, team='team') <=
                self.getmtime('usr','pkgb', contents_hash8, team='team'))

    def test_install_dependencies_from_file(self):
        table_data, table_hash = self.make_table_data('table')
        contents, contents_hash = self.make_contents(table7=table_hash)
        self._mock_tag('usr4/pkgd', 'latest', contents_hash)
        self._mock_package('usr4/pkgd', contents_hash, '', contents, [table_hash])
        self._mock_s3(table_hash, table_data)
        with open('tmp_quilt.yml', 'w') as fd:
            fd.write("packages:\n- usr4/pkgd")
        command.install('@tmp_quilt.yml')

    def test_install_dependencies_from_invalid_file(self):
        with open('invalid_quilt.yml', 'w') as fd:
            fd.write("invalid_node:\n- usr5/pkgd")
        with assertRaisesRegex(self, command.CommandException, 'Error in invalid_quilt.yml'):
            command.install('@invalid_quilt.yml')

    def test_bad_install_dependencies(self):
        """
        Install multiple packages via requirements file
        """
        table_data1, table_hash1 = self.make_table_data('table1')
        contents1, contents_hash1 = self.make_contents(table1=table_hash1)

        # missing/malformed requests
        with assertRaisesRegex(self, command.CommandException, "package name is empty"):
            command.install(" ")
        with assertRaisesRegex(self, command.CommandException, "file not found: quilt.yml"):
            command.install("@quilt.yml")
        with assertRaisesRegex(self, command.CommandException, "Specify package as"):
            command.install("packages:\n")
        with assertRaisesRegex(self, command.CommandException, "Specify package as"):
            command.install("packages:\n- foo")
        with assertRaisesRegex(self, command.CommandException, "Specify package as"):
            command.install("packages:\n- foo/bar:xxx:bar")
        with assertRaisesRegex(self, Exception, "No such file or directory"):
            self.validate_file('foo', 'bar', contents_hash1, contents1, table_hash1, table_data1)

    def test_quilt_yml_unknown_hash(self):
        table_data1, table_hash1 = self.make_table_data('table1')
        contents1, contents_hash1 = self.make_contents(table1=table_hash1)
        self._mock_log('akarve/sales', contents_hash1)
        with assertRaisesRegex(self, command.CommandException, "Invalid hash"):
            command.install("packages:\n- akarve/sales:h:123456")

    def test_quilt_yml_unknown_tag(self):
        table_data1, table_hash1 = self.make_table_data('table1')
        contents1, contents_hash1 = self.make_contents(table1=table_hash1)
        self._mock_tag('akarve/sales', 'unknown', contents_hash1,
                       status=404, message='Tag unknown does not exist')
        with assertRaisesRegex(self, command.CommandException, "Tag unknown does not exist"):
            command.install("packages:\n- akarve/sales:t:unknown")

    def test_quilt_yml_unknown_version(self):
        table_data1, table_hash1 = self.make_table_data('table1')
        contents1, contents_hash1 = self.make_contents(table1=table_hash1)
        self._mock_version('akarve/sales', '99.99', contents_hash1,
                           status=404, message='Version 99.99 does not exist')
        with assertRaisesRegex(self, command.CommandException, "Version 99.99 does not exist"):
            command.install("packages:\n- akarve/sales:v:99.99")

    def test_quilt_yml_unknown_team(self):
        # TODO(dima): This is not a particularly useful test -
        # but it simulates the current behavior in production (an SSL certificate error).
        url = command.get_registry_url('unknown')
        responses.add(responses.GET, url, body=SSLError())
        with pytest.raises(ConnectionError):
            command.install("packages:\n- unknown:baz/bat")

    def test_quilt_yml_unknown_subpath(self):
        table_data1, table_hash1 = self.make_table_data('table1')
        contents1, contents_hash1 = self.make_contents(table1=table_hash1)
        self._mock_tag('baz/bat', 'latest', contents_hash1)
        self._mock_package('baz/bat', contents_hash1, 'badsubpath', contents1, [table_hash1],
                           status=404, message='Invalid subpath')
        with assertRaisesRegex(self, command.CommandException, "Invalid subpath"):
            command.install("packages:\n- baz/bat/badsubpath")

    def test_bad_contents_hash(self):
        """
        Test that a package with a bad contents hash fails installation.
        """
        tabledata = b'Bad package'
        h = hashlib.new(HASH_TYPE)
        h.update(tabledata)
        obj_hash = h.hexdigest()
        contents = GroupNode(dict(
            foo=GroupNode(dict(
                bar=TableNode([obj_hash], PackageFormat.default.value)
            ))
        ))
        contents_hash = 'e867010701edc0b1c8be177e02a93aa3cb1342bb1123046e1f6b40e428c6048e'

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, '', contents, [obj_hash])

        with assertRaisesRegex(self, command.CommandException, "Mismatched hash"):
            command.install('foo/bar')

        assert not os.path.exists(os.path.join(self._store_dir, 'foo/bar.json'))

    def test_bad_object_hash(self):
        """
        Test that a package with a file hash mismatch fails installation.
        """
        tabledata = b'Bad package'
        h = hashlib.new(HASH_TYPE)
        h.update(tabledata)
        obj_hash = 'e867010701edc0b1c8be177e02a93aa3cb1342bb1123046e1f6b40e428c6048e'
        contents = GroupNode(dict(
            foo=GroupNode(dict(
                bar=TableNode([obj_hash], PackageFormat.default.value)
            ))
        ))
        contents_hash = hash_contents(contents)

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, '', contents, [obj_hash])
        self._mock_s3(obj_hash, tabledata)

        with self.assertRaises(command.CommandException):
            command.install('foo/bar')

        assert not os.path.exists(os.path.join(self._store_dir, 'foo/bar.json'))

    def test_resume_download(self):
        """
        Test that existing objects don't get re-downloaded - unless their hash is wrong.
        """
        file_data_list = []
        file_hash_list = []
        for i in range(2):
            file_data, file_hash = self.make_file_data('file%d' % i)
            file_data_list.append(file_data)
            file_hash_list.append(file_hash)

        contents = RootNode(dict(
            file0=FileNode([file_hash_list[0]], metadata={'q_path': 'file0'}),
            file1=FileNode([file_hash_list[1]], metadata={'q_path': 'file1'}),
        ))
        contents_hash = hash_contents(contents)

        # Create a package store object to use its path helpers
        teststore = PackageStore(self._store_dir)

        # file0 already exists.
        teststore.create_dirs()
        with open(teststore.object_path(objhash=file_hash_list[0]), 'wb') as fd:
            fd.write(file_data_list[0])

        # file1 does not exist.

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, '', contents, file_hash_list)
        # Don't mock file0, since it's not supposed to be downloaded.
        self._mock_s3(file_hash_list[1], file_data_list[1])

        command.install('foo/bar')


    def test_download_retry(self):
        table_data, table_hash = self.make_table_data()
        contents, contents_hash = self.make_contents(table=table_hash)

        s3_url = 'https://example.com/%s' % table_hash
        error = requests.exceptions.ConnectionError("Timeout")

        # Fail to install after 3 timeouts.
        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, 'group/table', contents, [table_hash])
        self.requests_mock.add(responses.GET, s3_url, body=error)
        self.requests_mock.add(responses.GET, s3_url, body=error)
        self.requests_mock.add(responses.GET, s3_url, body=error)
        self._mock_s3(table_hash, table_data)  # We won't actually get to this one.

        with self.assertRaises(command.CommandException):
            command.install('foo/bar/group/table')

        self.requests_mock.reset()

        # Succeed after 2 timeouts and a successful response.
        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, 'group/table', contents, [table_hash])
        self.requests_mock.add(responses.GET, s3_url, body=error)
        self.requests_mock.add(responses.GET, s3_url, body=error)
        self._mock_s3(table_hash, table_data)

        command.install('foo/bar/group/table')

    @patch('quilt.tools.data_transfer.get_free_space')
    def test_out_of_space(self, get_disk_space):
        get_disk_space.return_value = 5

        _, table_hash = self.make_table_data()
        _, file_hash = self.make_file_data()
        contents, contents_hash = self.make_contents(table=table_hash, file=file_hash)

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, '', contents, [table_hash, file_hash])

        with self.assertRaises(command.CommandException):
            command.install('foo/bar')

    def test_meta_only_and_materialize(self):
        file_data, file_hash = self.make_file_data()
        contents, contents_hash = self.make_contents(file=file_hash)

        self._mock_tag('foo/bar', 'latest', contents_hash)
        self._mock_package('foo/bar', contents_hash, '', contents, [], meta_only=True)

        # Install just the metadata. Don't mock S3.
        command.install('foo/bar', meta_only=True)

        pkg = command.load('foo/bar')

        # Fragments not actually there.
        with self.assertRaises(StoreException):
            pkg.group.file()

        self._mock_get_objects([file_hash])
        self._mock_s3(file_hash, file_data)

        # Materialize the package.
        command.install(pkg)

        assert pkg.group.file().endswith(file_hash)

    def _mock_log(self, package, pkg_hash, team=None):
        log_url = '%s/api/log/%s/' % (command.get_registry_url(team), package)
        self.requests_mock.add(responses.GET, log_url, json.dumps({'logs': [
            {'created': int(time.time()), 'hash': pkg_hash, 'author': 'author'}
        ]}))

    def _mock_tag(self, package, tag, pkg_hash, cmd=responses.GET,
                      status=200, message=None, team=None):
        tag_url = '%s/api/tag/%s/%s' % (command.get_registry_url(team), package, tag)
        self.requests_mock.add(cmd, tag_url, json.dumps(
            dict(message=message) if message else dict(hash=pkg_hash)
        ), status=status)

    def _mock_version(self, package, version, pkg_hash, cmd=responses.GET,
                      status=200, message=None, team=None):
        version_url = '%s/api/version/%s/%s' % (command.get_registry_url(team), package, version)
        self.requests_mock.add(cmd, version_url, json.dumps(
            dict(message=message) if message else dict(hash=pkg_hash)
        ), status=status)

    def _mock_package(self, package, pkg_hash, subpath, contents, hashes,
                      status=200, message=None, team=None, meta_only=False):
        pkg_url = '%s/api/package/%s/%s?%s' % (
            command.get_registry_url(team), package, pkg_hash, urllib.parse.urlencode(dict(
                subpath=subpath,
                meta_only='true' if meta_only else ''
            ))
        )
        self.requests_mock.add(responses.GET, pkg_url, body=json.dumps(
            dict(message=message) if message else
            dict(
                contents=contents,
                sizes={h: 100 for h in hashes},
                urls={h: 'https://example.com/%s' % h for h in hashes}
            )
        , default=encode_node), match_querystring=True, status=status)

    def _mock_s3(self, pkg_hash, contents, gzip=True):
        s3_url = 'https://example.com/%s' % pkg_hash
        headers = {}
        if gzip:
            contents = gzip_compress(contents)
            headers['Content-Encoding'] = 'gzip'
        headers['Content-Range'] = 'bytes 0-%d/%d' % (len(contents) - 1, len(contents))
        self.requests_mock.add(responses.GET, s3_url, contents, headers=headers, stream=True)

    def _mock_get_objects(self, hashes, team=None):
        url = '%s/api/get_objects' % command.get_registry_url(team)
        self.requests_mock.add(responses.POST, url, body=json.dumps(
            dict(
                sizes={h: 100 for h in hashes},
                urls={h: 'https://example.com/%s' % h for h in hashes}
            )
        ), match_querystring=True)
