""" Integration tests for Quilt Packages. """
from io import BytesIO
import os
import pathlib
from pathlib import Path
import shutil

import jsonlines
from unittest.mock import patch, call, ANY
import pytest

import quilt3
from quilt3 import Package
from quilt3.util import QuiltException, validate_package_name, parse_file_url, fix_url

from ..utils import QuiltTestCase


DATA_DIR = Path(__file__).parent / 'data'
LOCAL_MANIFEST = DATA_DIR / 'local_manifest.jsonl'
REMOTE_MANIFEST = DATA_DIR / 'quilt_manifest.jsonl'

LOCAL_REGISTRY = Path('local_registry')  # Set by QuiltTestCase


def mock_make_api_call(self, operation_name, kwarg):
    """ Mock boto3's AWS API Calls for testing. """
    if operation_name == 'GetObject':
        parsed_response = {'Body': BytesIO(b'foo')}
        return parsed_response
    if operation_name == 'ListObjectsV2':
        parsed_response = {'CommonPrefixes': ['foo']}
        return parsed_response
    if operation_name == 'HeadObject':
        # TODO: mock this somehow
        parsed_response = {
            'Metadata': {},
            'ContentLength': 0
        }
        return parsed_response
    raise NotImplementedError(operation_name)


class PackageTest(QuiltTestCase):
    def test_build(self):
        """Verify that build dumps the manifest to appdirs directory."""
        new_pkg = Package()

        # Create a dummy file to add to the package.
        test_file_name = 'bar'
        with open(test_file_name, "w") as fd:
            fd.write('test_file_content_string')
            test_file = Path(fd.name)

        # Build a new package into the local registry.
        new_pkg = new_pkg.set('foo', test_file_name)
        top_hash = new_pkg.build("Quilt/Test").top_hash

        # Verify manifest is registered by hash.
        out_path = LOCAL_REGISTRY / ".quilt/packages" / top_hash
        with open(out_path) as fd:
            pkg = Package.load(fd)
            assert test_file.resolve().as_uri() == pkg['foo'].physical_keys[0]

        # Verify latest points to the new location.
        named_pointer_path = LOCAL_REGISTRY / ".quilt/named_packages/Quilt/Test/latest"
        with open(named_pointer_path) as fd:
            assert fd.read().replace('\n', '') == top_hash

        # Test unnamed packages.
        new_pkg = Package()
        new_pkg = new_pkg.set('bar', test_file_name)
        top_hash = new_pkg.build().top_hash
        out_path = LOCAL_REGISTRY / ".quilt/packages" / top_hash
        with open(out_path) as fd:
            pkg = Package.load(fd)
            assert test_file.resolve().as_uri() == pkg['bar'].physical_keys[0]

    def test_default_registry(self):
        new_pkg = Package()

        # Create a dummy file to add to the package.
        test_file_name = 'bar'
        with open(test_file_name, "w") as fd:
            fd.write('test_file_content_string')
            test_file = Path(fd.name)

        # Build a new package into the local registry.
        new_pkg = new_pkg.set('foo', test_file_name)
        top_hash = new_pkg.build("Quilt/Test").top_hash

        # Verify manifest is registered by hash.
        out_path = LOCAL_REGISTRY / ".quilt/packages" / top_hash
        with open(out_path) as fd:
            pkg = Package.load(fd)
            assert test_file.resolve().as_uri() == pkg['foo'].physical_keys[0]

        # Verify latest points to the new location.
        named_pointer_path = LOCAL_REGISTRY / ".quilt/named_packages/Quilt/Test/latest"
        with open(named_pointer_path) as fd:
            assert fd.read().replace('\n', '') == top_hash

        # Test unnamed packages.
        new_pkg = Package()
        new_pkg = new_pkg.set('bar', test_file_name)
        top_hash = new_pkg.build().top_hash
        out_path = LOCAL_REGISTRY / ".quilt/packages" / top_hash
        with open(out_path) as fd:
            pkg = Package.load(fd)
            assert test_file.resolve().as_uri() == pkg['bar'].physical_keys[0]

    @patch('quilt3.Package.browse', lambda name, registry, top_hash: Package())
    def test_default_install_location(self):
        """Verify that pushes to the default local install location work as expected"""
        with patch('quilt3.Package.push') as push_mock:
            Package.install('Quilt/nice-name', registry='s3://my-test-bucket')
            push_mock.assert_called_once_with(
                dest=quilt3.util.get_install_location(),
                name='Quilt/nice-name',
                registry=ANY
            )

    def test_read_manifest(self):
        """ Verify reading serialized manifest from disk. """
        with open(LOCAL_MANIFEST) as fd:
            pkg = Package.load(fd)

        out_path = 'new_manifest.jsonl'
        with open(out_path, 'w') as fd:
            pkg.dump(fd)

        # Insepct the jsonl to verify everything is maintained, i.e.
        # that load/dump results in an equivalent set.
        # todo: Use load/dump once __eq__ implemented.
        with open(LOCAL_MANIFEST) as fd:
            original_set = list(jsonlines.Reader(fd))
        with open(out_path) as fd:
            written_set = list(jsonlines.Reader(fd))
        assert len(original_set) == len(written_set)
        assert sorted(original_set, key=lambda k: k.get('logical_key','manifest')) \
            == sorted(written_set, key=lambda k: k.get('logical_key','manifest'))

    def test_browse_package_from_registry(self):
        """ Verify loading manifest locally and from s3 """
        with patch('quilt3.Package._from_path') as pkgmock:
            registry = LOCAL_REGISTRY.resolve().as_uri()
            pkg = Package()
            pkgmock.return_value = pkg
            top_hash = pkg.top_hash

            # local registry load
            pkg = Package.browse(registry='local', top_hash=top_hash)
            assert '{}/.quilt/packages/{}'.format(registry, top_hash) \
                    in [x[0][0] for x in pkgmock.call_args_list]

            pkgmock.reset_mock()

            pkg = Package.browse('Quilt/nice-name', registry='local', top_hash=top_hash)
            assert '{}/.quilt/packages/{}'.format(registry, top_hash) \
                    in [x[0][0] for x in pkgmock.call_args_list]

            pkgmock.reset_mock()

            with patch('quilt3.packages.get_bytes') as dl_mock:
                dl_mock.return_value = (top_hash.encode('utf-8'), None)
                pkg = Package.browse('Quilt/nice-name', registry='local')
                assert registry + '/.quilt/named_packages/Quilt/nice-name/latest' \
                        == dl_mock.call_args_list[0][0][0]

            assert '{}/.quilt/packages/{}'.format(registry, top_hash) \
                    in [x[0][0] for x in pkgmock.call_args_list]
            pkgmock.reset_mock()

            remote_registry = 's3://asdf/foo'
            # remote load
            pkg = Package.browse('Quilt/nice-name', registry=remote_registry, top_hash=top_hash)
            assert '{}/.quilt/packages/{}'.format(remote_registry, top_hash) \
                    in [x[0][0] for x in pkgmock.call_args_list]
            pkgmock.reset_mock()
            pkg = Package.browse(top_hash=top_hash, registry=remote_registry)
            assert '{}/.quilt/packages/{}'.format(remote_registry, top_hash) \
                    in [x[0][0] for x in pkgmock.call_args_list]

            pkgmock.reset_mock()
            with patch('quilt3.packages.get_bytes') as dl_mock:
                dl_mock.return_value = (top_hash.encode('utf-8'), None)
                pkg = Package.browse('Quilt/nice-name', registry=remote_registry)
            assert '{}/.quilt/packages/{}'.format(remote_registry, top_hash) \
                    in [x[0][0] for x in pkgmock.call_args_list]

            # default remote registry failure case
            quilt3.config(default_remote_registry=None)
            with pytest.raises(QuiltException):
                Package.browse('Quilt/nice-name')

    def test_local_install(self):
        """Verify that installing from a local package works as expected."""
        local_registry = Path('.').resolve().as_uri()
        quilt3.config(default_local_registry=local_registry)
        with patch('quilt3.Package.push') as push_mock:
            pkg = Package()
            pkg.build('Quilt/nice-name')

            quilt3.Package.install('Quilt/nice-name', registry='local', dest='./')
            push_mock.assert_called_once_with(dest='./', name='Quilt/nice-name', registry=local_registry)

    def test_remote_install(self):
        """Verify that installing from a local package works as expected."""
        remote_registry = Path('.').resolve().as_uri()
        quilt3.config(
            default_local_registry=remote_registry,
            default_remote_registry=remote_registry
        )
        with patch('quilt3.Package.push') as push_mock:
            pkg = Package()
            pkg.build('Quilt/nice-name')

            quilt3.Package.install('Quilt/nice-name', dest='./')
            push_mock.assert_called_once_with(dest='./', name='Quilt/nice-name', registry=remote_registry)

    def test_package_fetch(self):
        """ Package.fetch() on nested, relative keys """
        package_ = Package().set_dir('/', DATA_DIR / 'nested')

        out_dir = 'output'
        new_package_ = package_.fetch(out_dir)

        expected = {'one.txt': '1', 'two.txt': '2', 'three.txt': '3'}
        file_count = 0
        for dirpath, _, files in os.walk(out_dir):
            for name in files:
                file_count += 1
                with open(os.path.join(dirpath, name)) as file_:
                    assert name in expected, 'unexpected file: {}'.format(name)
                    contents = file_.read().strip()
                    assert contents == expected[name], \
                        'unexpected contents in {}: {}'.format(name, contents)
        assert file_count == len(expected), \
            'fetch wrote {} files; expected: {}'.format(file_count, expected)

        # test that package re-rooting works as expected
        out_dir_abs_path = pathlib.Path(out_dir).resolve().as_uri()
        assert all(
            entry.physical_keys[0].startswith(out_dir_abs_path) for _, entry in new_package_.walk()
        )

    def test_package_fetch_default_dest(self):
        """Verify fetching a package to the default local destination."""
        Package().set_dir('/', DATA_DIR / 'nested').fetch()
        assert pathlib.Path('one.txt').exists()
        assert pathlib.Path('sub/two.txt').exists()
        assert pathlib.Path('sub/three.txt').exists()

    def test_fetch(self):
        """ Verify fetching a package entry. """
        pkg = (
            Package()
            .set('foo', DATA_DIR / 'foo.txt', {'user_meta': 'blah'})
            .set('bar', DATA_DIR / 'foo.txt', {'user_meta': 'blah'})
        )
        pkg['foo'].meta['target'] = 'unicode'
        pkg['bar'].meta['target'] = 'unicode'

        with open(DATA_DIR / 'foo.txt') as fd:
            assert fd.read().replace('\n', '') == '123'
        # Copy foo.text to bar.txt
        pkg['foo'].fetch('data/bar.txt')
        with open('data/bar.txt') as fd:
            assert fd.read().replace('\n', '') == '123'

        # Raise an error if you copy to yourself.
        with pytest.raises(shutil.SameFileError):
            pkg.set('foo', DATA_DIR / 'foo.txt')['foo'].fetch(DATA_DIR / 'foo.txt')

        # The key gets re-rooted correctly.
        pkg = quilt3.Package().set('foo', DATA_DIR / 'foo.txt')
        new_pkg_entry = pkg['foo'].fetch('bar.txt')
        out_abs_path = pathlib.Path("bar.txt").resolve().as_uri()
        assert new_pkg_entry.physical_keys[0] == out_abs_path

    def test_fetch_default_dest(tmpdir):
        """Verify fetching a package entry to a default destination."""
        with patch('quilt3.packages.copy_file') as copy_mock:
            (Package()
             .set('foo', os.path.join(os.path.dirname(__file__), 'data', 'foo.txt'))['foo']
             .fetch())
            filepath = fix_url(os.path.join(os.path.dirname(__file__), 'data', 'foo.txt'))
            copy_mock.assert_called_once_with(filepath, ANY, ANY)

    def test_load_into_quilt(self):
        """ Verify loading local manifest and data into S3. """
        top_hash = '5333a204bbc6e21607c2bc842f4a77d2e21aa6147cf2bf493dbf6282188d01ca'

        self.s3_stubber.add_response(
            method='put_object',
            service_response={
                'VersionId': 'v1'
            },
            expected_params={
                'Body': ANY,
                'Bucket': 'my_test_bucket',
                'Key': 'Quilt/package/foo',
                'Metadata': {'helium': '{}'}
            }
        )

        self.s3_stubber.add_response(
            method='put_object',
            service_response={
                'VersionId': 'v2'
            },
            expected_params={
                'Body': ANY,
                'Bucket': 'my_test_bucket',
                'Key': '.quilt/packages/' + top_hash,
                'Metadata': {'helium': 'null'}
            }
        )

        self.s3_stubber.add_response(
            method='put_object',
            service_response={
                'VersionId': 'v3'
            },
            expected_params={
                'Body': top_hash.encode(),
                'Bucket': 'my_test_bucket',
                'Key': '.quilt/named_packages/Quilt/package/1234567890',
                'Metadata': {'helium': 'null'}
            }
        )

        self.s3_stubber.add_response(
            method='put_object',
            service_response={
                'VersionId': 'v4'
            },
            expected_params={
                'Body': top_hash.encode(),
                'Bucket': 'my_test_bucket',
                'Key': '.quilt/named_packages/Quilt/package/latest',
                'Metadata': {'helium': 'null'}
            }
        )

        new_pkg = Package()
        # Create a dummy file to add to the package.
        contents = 'blah'
        test_file = Path('bar')
        test_file.write_text(contents)
        new_pkg = new_pkg.set('foo', test_file)

        with patch('time.time', return_value=1234567890):
            new_pkg.push('Quilt/package', 's3://my_test_bucket/')

    def test_local_push(self):
        """ Verify loading local manifest and data into a local dir. """
        top_hash = '5333a204bbc6e21607c2bc842f4a77d2e21aa6147cf2bf493dbf6282188d01ca'

        new_pkg = Package()
        contents = 'blah'
        test_file = Path('bar')
        test_file.write_text(contents)
        new_pkg = new_pkg.set('foo', test_file)
        new_pkg.push('Quilt/package', 'package_contents')

        push_dir = Path('package_contents')

        assert (push_dir / '.quilt/named_packages/Quilt/package/latest').read_text() == top_hash
        assert (push_dir / ('.quilt/packages/' + top_hash)).exists()
        assert (push_dir / 'Quilt/package/foo').read_text() == contents


    def test_package_deserialize(self):
        """ Verify loading data from a local file. """
        pkg = (
            Package()
            .set('foo', DATA_DIR / 'foo.txt', {'user_meta_foo': 'blah'})
            .set('bar', DATA_DIR / 'foo.unrecognized.ext')
            .set('baz', DATA_DIR / 'foo.txt')
        )
        pkg.build()

        pkg['foo'].meta['target'] = 'unicode'
        assert pkg['foo'].deserialize() == '123\n'
        assert pkg['baz'].deserialize() == '123\n'

        with pytest.raises(QuiltException):
            pkg['bar'].deserialize()

    def test_local_set_dir(self):
        """ Verify building a package from a local directory. """
        pkg = Package()

        # Create some nested example files that contain their names.
        foodir = pathlib.Path("foo_dir")
        bazdir = pathlib.Path(foodir, "baz_dir")
        bazdir.mkdir(parents=True, exist_ok=True)
        with open('bar', 'w') as fd:
            fd.write(fd.name)
        with open('foo', 'w') as fd:
            fd.write(fd.name)
        with open(bazdir / 'baz', 'w') as fd:
            fd.write(fd.name)
        with open(foodir / 'bar', 'w') as fd:
            fd.write(fd.name)

        pkg = pkg.set_dir("/", ".", meta="test_meta")

        assert pathlib.Path('foo').resolve().as_uri() == pkg['foo'].physical_keys[0]
        assert pathlib.Path('bar').resolve().as_uri() == pkg['bar'].physical_keys[0]
        assert (bazdir / 'baz').resolve().as_uri() == pkg['foo_dir/baz_dir/baz'].physical_keys[0]
        assert (foodir / 'bar').resolve().as_uri() == pkg['foo_dir/bar'].physical_keys[0]
        assert pkg.meta == "test_meta"

        pkg = Package()
        pkg = pkg.set_dir('/','foo_dir/baz_dir/')
        # todo nested at set_dir site or relative to set_dir path.
        assert (bazdir / 'baz').resolve().as_uri() == pkg['baz'].physical_keys[0]

        pkg = Package()
        pkg = pkg.set_dir('my_keys', 'foo_dir/baz_dir/')
        # todo nested at set_dir site or relative to set_dir path.
        assert (bazdir / 'baz').resolve().as_uri() == pkg['my_keys/baz'].physical_keys[0]

        # Verify ignoring files in the presence of a dot-quiltignore
        with open('.quiltignore', 'w') as fd:
            fd.write('foo\n')
            fd.write('bar')

        pkg = Package()
        pkg = pkg.set_dir("/", ".")
        assert 'foo_dir' in pkg.keys()
        assert 'foo' not in pkg.keys() and 'bar' not in pkg.keys()

        with open('.quiltignore', 'w') as fd:
            fd.write('foo_dir')

        pkg = Package()
        pkg = pkg.set_dir("/", ".")
        assert 'foo_dir' not in pkg.keys()

        with open('.quiltignore', 'w') as fd:
            fd.write('foo_dir\n')
            fd.write('foo_dir/baz_dir')

        pkg = Package()
        pkg = pkg.set_dir("/", ".")
        assert 'foo_dir/baz_dir' not in pkg.keys() and 'foo_dir' not in pkg.keys()

        pkg = pkg.set_dir("new_dir", ".", meta="new_test_meta")

        assert pathlib.Path('foo').resolve().as_uri() == pkg['new_dir/foo'].physical_keys[0]
        assert pathlib.Path('bar').resolve().as_uri() == pkg['new_dir/bar'].physical_keys[0]
        assert pkg['new_dir'].meta == "new_test_meta"

        # verify set_dir logical key shortcut
        pkg = Package()
        pkg.set_dir("/")
        assert pathlib.Path('foo').resolve().as_uri() == pkg['foo'].physical_keys[0]
        assert pathlib.Path('bar').resolve().as_uri() == pkg['bar'].physical_keys[0]


    def test_s3_set_dir(self):
        """ Verify building a package from an S3 directory. """
        with patch('quilt3.packages.list_object_versions') as list_object_versions_mock:
            pkg = Package()

            list_object_versions_mock.return_value = ([
                dict(Key='foo/a.txt', VersionId='xyz', IsLatest=True, Size=10),
                dict(Key='foo/x/y.txt', VersionId='null', IsLatest=True, Size=10),
                dict(Key='foo/z.txt', VersionId='123', IsLatest=False, Size=10),
            ], [])

            pkg.set_dir('', 's3://bucket/foo/', meta='test_meta')

            assert pkg['a.txt'].physical_keys[0] == 's3://bucket/foo/a.txt?versionId=xyz'
            assert pkg['x']['y.txt'].physical_keys[0] == 's3://bucket/foo/x/y.txt'
            assert pkg.meta == "test_meta"
            assert pkg['x']['y.txt'].size == 10  # GH368

            list_object_versions_mock.assert_called_with('bucket', 'foo/')

            list_object_versions_mock.reset_mock()

            pkg.set_dir('bar', 's3://bucket/foo')

            assert pkg['bar']['a.txt'].physical_keys[0] == 's3://bucket/foo/a.txt?versionId=xyz'
            assert pkg['bar']['x']['y.txt'].physical_keys[0] == 's3://bucket/foo/x/y.txt'
            assert pkg['bar']['a.txt'].size == 10 # GH368

            list_object_versions_mock.assert_called_with('bucket', 'foo/')


    def test_package_entry_meta(self):
        pkg = (
            Package()
            .set('foo', DATA_DIR / 'foo.txt', {'value': 'blah'})
            .set('bar', DATA_DIR / 'foo.txt', {'value': 'blah2'})
        )
        pkg['foo']._meta['target'] = 'unicode'
        pkg['bar']._meta['target'] = 'unicode'

        assert pkg['foo'].meta == {'value': 'blah'}
        assert pkg['bar'].meta == {'value': 'blah2'}

        assert pkg['foo']._meta == {'target': 'unicode', 'user_meta': {'value': 'blah'}}
        assert pkg['bar']._meta == {'target': 'unicode', 'user_meta': {'value': 'blah2'}}

        pkg['foo'].set_meta({'value': 'other value'})
        assert pkg['foo'].meta == {'value': 'other value'}
        assert pkg['foo']._meta == {'target': 'unicode', 'user_meta': {'value': 'other value'}}


    def test_list_local_packages(self):
        """Verify that list returns packages in the appdirs directory."""
        temp_local_registry = Path('.').resolve().as_uri() + '/test_registry/.quilt'
        with patch('quilt3.packages.get_package_registry', lambda path: temp_local_registry), \
            patch('quilt3.api.get_package_registry', lambda path: temp_local_registry):

            # Build a new package into the local registry.
            Package().build("Quilt/Foo")
            Package().build("Quilt/Bar")
            Package().build("Quilt/Test")

            # Verify packages are returned.
            pkgs = quilt3.list_packages()
            assert len(pkgs) == 3
            assert "Quilt/Foo" in pkgs
            assert "Quilt/Bar" in pkgs

            # Verify 'local' keyword works as expected.
            assert list(pkgs) == list(quilt3.list_packages('local'))

            # Verify specifying a local path explicitly works as expected.
            assert list(pkgs) == list(quilt3.list_packages(
                pathlib.Path(temp_local_registry).parent.as_posix()
            ))

            # Verify package repr is as expected.
            pkgs_repr = str(pkgs)
            assert 'Quilt/Test:latest' in pkgs_repr
            assert 'Quilt/Foo:latest' in pkgs_repr
            assert 'Quilt/Bar:latest' in pkgs_repr

            # Test unnamed packages are not added.
            Package().build()
            pkgs = quilt3.list_packages()
            assert len(pkgs) == 3

            # Verify manifest is registered by hash when local path given
            pkgs = quilt3.list_packages("/")
            assert "Quilt/Foo" in pkgs
            assert "Quilt/Bar" in pkgs

    def test_set_package_entry(self):
        """ Set the physical key for a PackageEntry"""
        pkg = (
            Package()
            .set('foo', DATA_DIR / 'foo.txt', {'user_meta': 'blah'})
            .set('bar', DATA_DIR / 'foo.txt', {'user_meta': 'blah'})
        )
        pkg['foo'].meta['target'] = 'unicode'
        pkg['bar'].meta['target'] = 'unicode'

        # Build a dummy file to add to the map.
        with open('bar.txt', "w") as fd:
            fd.write('test_file_content_string')
            test_file = Path(fd.name)
        pkg['bar'].set('bar.txt')

        assert test_file.resolve().as_uri() == pkg['bar'].physical_keys[0]

        # Test shortcut codepath
        pkg = Package().set('bar.txt')
        assert test_file.resolve().as_uri() == pkg['bar.txt'].physical_keys[0]

    def test_tophash_changes(self):
        test_file = Path('test.txt')
        test_file.write_text('asdf', 'utf-8')

        pkg = Package()
        th1 = pkg.top_hash
        pkg.set('asdf', test_file)
        pkg.build()
        th2 = pkg.top_hash
        assert th1 != th2

        test_file.write_text('jkl', 'utf-8')
        pkg.set('jkl', test_file)
        pkg.build()
        th3 = pkg.top_hash
        assert th1 != th3
        assert th2 != th3

        pkg.delete('jkl')
        th4 = pkg.top_hash
        assert th2 == th4

    def test_keys(self):
        pkg = Package()
        assert not pkg.keys()

        pkg.set('asdf', LOCAL_MANIFEST)
        assert set(pkg.keys()) == {'asdf'}

        pkg.set('jkl;', REMOTE_MANIFEST)
        assert set(pkg.keys()) == {'asdf', 'jkl;'}

        pkg.delete('asdf')
        assert set(pkg.keys()) == {'jkl;'}


    def test_iter(self):
        pkg = Package()
        assert not pkg

        pkg.set('asdf', LOCAL_MANIFEST)
        assert list(pkg) == ['asdf']

        pkg.set('jkl;', REMOTE_MANIFEST)
        assert set(pkg) == {'asdf', 'jkl;'}

    def test_invalid_set_key(self):
        """Verify an exception when setting a key with a path object."""
        pkg = Package()
        with pytest.raises(TypeError):
            pkg.set('asdf/jkl', 123)

    def test_brackets(self):
        pkg = Package()
        pkg.set('asdf/jkl', LOCAL_MANIFEST)
        pkg.set('asdf/qwer', LOCAL_MANIFEST)
        pkg.set('qwer/asdf', LOCAL_MANIFEST)
        assert set(pkg.keys()) == {'asdf', 'qwer'}

        pkg2 = pkg['asdf']
        assert set(pkg2.keys()) == {'jkl', 'qwer'}

        assert pkg['asdf']['qwer'].get() == LOCAL_MANIFEST.as_uri()

        assert pkg['asdf']['qwer'] == pkg['asdf/qwer'] == pkg[('asdf', 'qwer')]
        assert pkg[[]] == pkg

        pkg = (
            Package()
            .set('foo', DATA_DIR / 'foo.txt', {'foo': 'blah'})
        )
        pkg['foo'].meta['target'] = 'unicode'

        pkg.build()

        assert pkg['foo'].deserialize() == '123\n'
        assert pkg['foo']() == '123\n'

        with pytest.raises(KeyError):
            pkg['baz']

        with pytest.raises(TypeError):
            pkg[b'asdf']

        with pytest.raises(TypeError):
            pkg[0]

    def test_list_remote_packages(self):
        """Verify that listing remote packages works as expected."""
        def pseudo_list_objects(bucket, prefix, recursive):
            if prefix == '.quilt/named_packages/':
                return ([{'Prefix': '.quilt/named_packages/foo/'}], [])
            elif prefix == '.quilt/named_packages/foo/':
                return ([{'Prefix': '.quilt/named_packages/foo/bar/'}], [])
            elif prefix == '.quilt/named_packages/foo/bar/':
                import datetime
                return (
                    [], [
                        {'Key': '.quilt/named_packages/foo/bar/1549931300',
                         'LastModified': datetime.datetime.now() - datetime.timedelta(seconds=30)},
                        {'Key': '.quilt/named_packages/foo/bar/1549931634',
                         'LastModified': datetime.datetime.now()},
                        {'Key': '.quilt/named_packages/foo/bar/latest',
                         'LastModified': datetime.datetime.now()}]
                )
            else:
                raise ValueError

        def pseudo_get_bytes(src):
            if src.endswith('foo/bar/latest') or src.endswith('foo/bar/1549931634'):
                return (b'100', None)
            elif src.endswith('foo/bar/1549931300'):
                return (b'90', None)
            else:
                raise ValueError

        with patch('quilt3.api.list_objects', side_effect=pseudo_list_objects), \
            patch('quilt3.api.get_bytes', side_effect=pseudo_get_bytes), \
            patch('quilt3.Package.browse', return_value=Package()):
            pkgs = quilt3.list_packages('s3://my_test_bucket/')

            assert len(pkgs) == 1
            assert list(pkgs) == ['foo/bar']

            expected = (
                'PACKAGE                    \tTOP HASH    \tCREATED     \tSIZE        \t\n'
                'foo/bar:latest             \t100            \tnow            \t0 Bytes\t\n'
                'foo/bar                    \t90             \t30 seconds ago \t0 Bytes\t\n'
            )
            assert str(pkgs) == expected


    def test_validate_package_name(self):
        validate_package_name("a/b")
        validate_package_name("21312/bes")
        with pytest.raises(QuiltException):
            validate_package_name("b")
        with pytest.raises(QuiltException):
            validate_package_name("a/b/")
        with pytest.raises(QuiltException):
            validate_package_name("a\\/b")
        with pytest.raises(QuiltException):
            validate_package_name("a/b/c")
        with pytest.raises(QuiltException):
            validate_package_name("a/")
        with pytest.raises(QuiltException):
            validate_package_name("/b")
        with pytest.raises(QuiltException):
            validate_package_name("b")

    def test_diff(self):
        new_pkg = Package()

        # Create a dummy file to add to the package.
        test_file_name = 'bar'
        with open(test_file_name, "w") as fd:
            fd.write('test_file_content_string')
            test_file = Path(fd.name)

        # Build a new package into the local registry.
        new_pkg = new_pkg.set('foo', test_file_name)
        top_hash = new_pkg.build("Quilt/Test")

        p1 = Package.browse('Quilt/Test', registry='local')
        p2 = Package.browse('Quilt/Test', registry='local')
        assert p1.diff(p2) == ([], [], [])


    def test_dir_meta(self):
        test_meta = {'test': 'meta'}
        pkg = Package()
        pkg.set('asdf/jkl', LOCAL_MANIFEST)
        pkg.set('asdf/qwer', LOCAL_MANIFEST)
        pkg.set('qwer/asdf', LOCAL_MANIFEST)
        pkg.set('qwer/as/df', LOCAL_MANIFEST)
        pkg.build()
        assert pkg['asdf'].meta == {}
        assert pkg.meta == {}
        assert pkg['qwer']['as'].meta == {}
        pkg['asdf'].set_meta(test_meta)
        assert pkg['asdf'].meta == test_meta
        pkg['qwer']['as'].set_meta(test_meta)
        assert pkg['qwer']['as'].meta == test_meta
        pkg.set_meta(test_meta)
        assert pkg.meta == test_meta
        dump_path = 'test_meta'
        with open(dump_path, 'w') as f:
            pkg.dump(f)
        with open(dump_path) as f:
            pkg2 = Package.load(f)
        assert pkg2['asdf'].meta == test_meta
        assert pkg2['qwer']['as'].meta == test_meta
        assert pkg2.meta == test_meta

    def test_top_hash_stable(self):
        """Ensure that top_hash() never changes for a given manifest"""

        registry = DATA_DIR
        top_hash = '20de5433549a4db332a11d8d64b934a82bdea8f144b4aecd901e7d4134f8e733'

        pkg = Package.browse(registry=registry, top_hash=top_hash)

        assert pkg.top_hash == top_hash, \
            "Unexpected top_hash for {}/.quilt/packages/{}".format(registry, top_hash)


    def test_local_package_delete(self):
        """Verify local package delete works."""
        top_hash = Package().build("Quilt/Test").top_hash

        assert 'Quilt/Test' in quilt3.list_packages()
        assert top_hash in [p.name for p in (LOCAL_REGISTRY / '.quilt/packages').iterdir()]

        quilt3.delete_package('Quilt/Test')

        assert 'Quilt/Test' not in quilt3.list_packages()
        assert top_hash not in [p.name for p in (LOCAL_REGISTRY / '.quilt/packages').iterdir()]


    def test_local_package_delete_overlapping(self):
        """
        Verify local package delete works when multiple packages reference the
        same tophash.
        """
        top_hash = Package().build("Quilt/Test1").top_hash
        top_hash = Package().build("Quilt/Test2").top_hash

        assert 'Quilt/Test1' in quilt3.list_packages()
        assert top_hash in [p.name for p in (LOCAL_REGISTRY / '.quilt/packages').iterdir()]

        quilt3.delete_package('Quilt/Test1')

        assert 'Quilt/Test1' not in quilt3.list_packages()
        assert top_hash in [p.name for p in (LOCAL_REGISTRY / '.quilt/packages').iterdir()]

        quilt3.delete_package('Quilt/Test2')
        assert 'Quilt/Test2' not in quilt3.list_packages()
        assert top_hash not in [p.name for p in (LOCAL_REGISTRY / '.quilt/packages').iterdir()]


    def test_remote_package_delete(self):
        """Verify remote package delete works."""
        def list_packages_mock(*args, **kwargs): return ['Quilt/Test']

        def _tophashes_with_packages_mock(*args, **kwargs): return {'101': {'Quilt/Test'}}

        def list_objects_mock(*args): return [
            {'Key': '.quilt/named_packages/Quilt/Test/0'},
            {'Key': '.quilt/named_packages/Quilt/Test/latest'}
        ]

        def get_bytes_mock(*args): return b'101', None

        with patch('quilt3.api.list_packages', new=list_packages_mock), \
                patch('quilt3.api._tophashes_with_packages', new=_tophashes_with_packages_mock), \
                patch('quilt3.api.list_objects', new=list_objects_mock), \
                patch('quilt3.api.get_bytes', new=get_bytes_mock), \
                patch('quilt3.api.delete_object') as delete_mock:
            quilt3.delete_package('Quilt/Test', registry='s3://test-bucket')

            delete_mock.assert_any_call('test-bucket', '.quilt/packages/101')
            delete_mock.assert_any_call('test-bucket', '.quilt/named_packages/Quilt/Test/0')
            delete_mock.assert_any_call('test-bucket', '.quilt/named_packages/Quilt/Test/latest')


    def test_remote_package_delete_overlapping(self):
        """
        Verify remote package delete works when multiple packages reference the
        same tophash.
        """
        def list_packages_mock(*args, **kwargs): return ['Quilt/Test1', 'Quilt/Test2']

        def _tophashes_with_packages_mock(*args, **kwargs): return {'101': {'Quilt/Test1', 'Quilt/Test2'}}

        def list_objects_mock(*args): return [
            {'Key': '.quilt/named_packages/Quilt/Test1/0'},
            {'Key': '.quilt/named_packages/Quilt/Test1/latest'},
            {'Key': '.quilt/named_packages/Quilt/Test2/0'},
            {'Key': '.quilt/named_packages/Quilt/Test2/latest'}
        ]

        def get_bytes_mock(*args): return b'101', None

        with patch('quilt3.api.list_packages', new=list_packages_mock), \
                patch('quilt3.api._tophashes_with_packages', new=_tophashes_with_packages_mock), \
                patch('quilt3.api.list_objects', new=list_objects_mock), \
                patch('quilt3.api.get_bytes', new=get_bytes_mock), \
                patch('quilt3.api.delete_object') as delete_mock:
            quilt3.delete_package('Quilt/Test1', registry='s3://test-bucket')

            # the reference count for the tophash 101 is still one, so it should still exist
            assert call('test-bucket', '.quilt/packages/101') not in delete_mock.call_args_list
            delete_mock.assert_any_call('test-bucket', '.quilt/named_packages/Quilt/Test1/0')
            delete_mock.assert_any_call('test-bucket', '.quilt/named_packages/Quilt/Test1/latest')


    def test_commit_message_on_push(self):
        """ Verify commit messages populate correctly on push."""
        with patch('botocore.client.BaseClient._make_api_call', new=mock_make_api_call):
            with open(REMOTE_MANIFEST) as fd:
                pkg = Package.load(fd)
            pkg.push('Quilt/test_pkg_name', 'pkg', message='test_message')
            assert pkg._meta['message'] == 'test_message'

            # ensure messages are strings
            with pytest.raises(ValueError):
                pkg.push('Quilt/test_pkg_name', 'pkg', message={})

    def test_overwrite_dir_fails(self):
        with pytest.raises(QuiltException):
            pkg = Package()
            pkg.set('asdf/jkl', LOCAL_MANIFEST)
            pkg.set('asdf', LOCAL_MANIFEST)

    def test_overwrite_entry_fails(self):
        with pytest.raises(QuiltException):
            pkg = Package()
            pkg.set('asdf', LOCAL_MANIFEST)
            pkg.set('asdf/jkl', LOCAL_MANIFEST)

    def test_siblings_succeed(self):
        pkg = Package()
        pkg.set('as/df', LOCAL_MANIFEST)
        pkg.set('as/qw', LOCAL_MANIFEST)

    def test_local_repr(self):
        TEST_REPR = (
            "(local Package)\n"
            " └─asdf\n"
            " └─path1/\n"
            "   └─asdf\n"
            "   └─qwer\n"
            " └─path2/\n"
            "   └─first/\n"
            "     └─asdf\n"
            "   └─second/\n"
            "     └─asdf\n"
            " └─qwer\n"
        )
        pkg = Package()
        pkg.set('asdf', LOCAL_MANIFEST)
        pkg.set('qwer', LOCAL_MANIFEST)
        pkg.set('path1/asdf', LOCAL_MANIFEST)
        pkg.set('path1/qwer', LOCAL_MANIFEST)
        pkg.set('path2/first/asdf', LOCAL_MANIFEST)
        pkg.set('path2/second/asdf', LOCAL_MANIFEST)
        assert repr(pkg) == TEST_REPR

    def test_remote_repr(self):
        with patch('quilt3.packages.get_size_and_meta', return_value=(0, dict(), '0')):
            TEST_REPR = (
                "(remote Package)\n"
                " └─asdf\n"
            )
            pkg = Package()
            pkg.set('asdf', 's3://my-bucket/asdf')
            assert repr(pkg) == TEST_REPR

            TEST_REPR = (
                "(remote Package)\n"
                " └─asdf\n"
                " └─qwer\n"
            )
            pkg = Package()
            pkg.set('asdf', 's3://my-bucket/asdf')
            pkg.set('qwer', LOCAL_MANIFEST)
            assert repr(pkg) == TEST_REPR

    def test_repr_empty_package(self):
        pkg = Package()
        r = repr(pkg)
        assert r == "(empty Package)"

    def test_manifest(self):
        pkg = Package()
        pkg.set('as/df', LOCAL_MANIFEST)
        pkg.set('as/qw', LOCAL_MANIFEST)
        top_hash = pkg.build().top_hash
        manifest = list(pkg.manifest)

        pkg2 = Package.browse(top_hash=top_hash, registry='local')
        assert list(pkg.manifest) == list(pkg2.manifest)


    def test_map(self):
        pkg = Package()
        pkg.set('as/df', LOCAL_MANIFEST)
        pkg.set('as/qw', LOCAL_MANIFEST)
        assert set(pkg.map(lambda lk, entry: lk)) == {'as/df', 'as/qw'}

        pkg['as'].set_meta({'foo': 'bar'})
        assert set(pkg.map(lambda lk, entry: lk, include_directories=True)) ==\
            {'as/df', 'as/qw', 'as/'}


    def test_filter(self):
        pkg = Package()
        pkg.set('a/df', LOCAL_MANIFEST)
        pkg.set('a/qw', LOCAL_MANIFEST)

        p_copy = pkg.filter(lambda lk, entry: lk == 'a/df')
        assert list(p_copy) == ['a'] and list(p_copy['a']) == ['df']

        pkg = Package()
        pkg.set('a/df', LOCAL_MANIFEST)
        pkg.set('a/qw', LOCAL_MANIFEST)
        pkg.set('b/df', LOCAL_MANIFEST)
        pkg['a'].set_meta({'foo': 'bar'})
        pkg['b'].set_meta({'foo': 'bar'})

        p_copy = pkg.filter(lambda lk, entry: lk == 'a/', include_directories=True)
        assert list(p_copy) == []

        p_copy = pkg.filter(lambda lk, entry: lk == 'a/' or lk == 'a/df',
                            include_directories=True)
        assert list(p_copy) == ['a'] and list(p_copy['a']) == ['df']


    def test_import(self):
        with patch('quilt3.Package.browse') as browse_mock, \
            patch('quilt3.imports.list_packages') as list_packages_mock:
            browse_mock.return_value = quilt3.Package()
            list_packages_mock.return_value = ['foo/bar', 'foo/baz']

            from quilt3.data.foo import bar
            assert isinstance(bar, Package)
            browse_mock.assert_has_calls(
                [call('foo/baz', registry=ANY), call('foo/bar', registry=ANY)], any_order=True
            )

            from quilt3.data import foo
            assert hasattr(foo, 'bar') and hasattr(foo, 'baz')


    def test_invalid_key(self):
        pkg = Package()
        with pytest.raises(QuiltException):
            pkg.set('', LOCAL_MANIFEST)
        with pytest.raises(QuiltException):
            pkg.set('foo/', LOCAL_MANIFEST)
        with pytest.raises(QuiltException):
            pkg.set('foo', './')
        with pytest.raises(QuiltException):
            pkg.set('foo', os.path.dirname(__file__))

        # we do not allow '.' or '..' files or filename separators
        with pytest.raises(QuiltException):
            pkg.set('.', LOCAL_MANIFEST)
        with pytest.raises(QuiltException):
            pkg.set('..', LOCAL_MANIFEST)
        with pytest.raises(QuiltException):
            pkg.set('./foo', LOCAL_MANIFEST)
        with pytest.raises(QuiltException):
            pkg.set('../foo', LOCAL_MANIFEST)
        with pytest.raises(QuiltException):
            pkg.set('foo/.', LOCAL_MANIFEST)
        with pytest.raises(QuiltException):
            pkg.set('foo/..', LOCAL_MANIFEST)
        with pytest.raises(QuiltException):
            pkg.set('foo/./bar', LOCAL_MANIFEST)
        with pytest.raises(QuiltException):
            pkg.set('foo/../bar', LOCAL_MANIFEST)

        with pytest.raises(QuiltException):
            pkg.set('s3://foo/.', LOCAL_MANIFEST)
        with pytest.raises(QuiltException):
            pkg.set('s3://foo/..', LOCAL_MANIFEST)


    def test_default_package_get_local(self):
        foodir = pathlib.Path("foo_dir")
        bazdir = pathlib.Path("baz_dir")
        foodir.mkdir(parents=True, exist_ok=True)
        bazdir.mkdir(parents=True, exist_ok=True)
        with open('bar', 'w') as fd:
            fd.write(fd.name)
        with open('foo', 'w') as fd:
            fd.write(fd.name)
        with open(bazdir / 'baz', 'w') as fd:
            fd.write(fd.name)
        with open(foodir / 'bar', 'w') as fd:
            fd.write(fd.name)

        currdir = pathlib.Path('.').resolve().as_uri() + '/'

        # consistent local case
        pkg = quilt3.Package().set_dir("/", "./")
        assert pkg.get() == currdir

        # package with one inconsistent path, leading case
        pkg = quilt3.Package().set_dir("/", "./")
        pkg.set('badpath', 'bar')
        with pytest.raises(QuiltException):
            pkg.get()

        # package with one inconsistent path, training case
        pkg = quilt3.Package().set_dir("/", "./")
        # prefix with 'z_' to ensure that this entry is last in sorted order
        pkg.set('z_badpath', 'bar')
        with pytest.raises(QuiltException):
            pkg.get()

        # package with inconsistent schemes
        with patch('quilt3.packages.get_size_and_meta', return_value=(0, dict(), '0')):
            pkg = quilt3.Package().set_dir("/", "./")
            pkg.set("bar", "s3://test-bucket/bar")
            with pytest.raises(QuiltException):
                pkg.get()

        # package with inconsistent root directories
        with open('foo_dir/foo', 'w') as fd:
            fd.write(fd.name)
        pkg = quilt3.Package().set_dir("/", "./")
        pkg.set('foo', 'foo_dir/foo')
        with pytest.raises(QuiltException):
            pkg.get()
