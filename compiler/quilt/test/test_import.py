"""
Tests for magic imports.
"""

import os
import time

import pandas as pd
from six import string_types

from quilt.nodes import GroupNode, DataNode
from quilt.tools import command
from quilt.tools.const import PACKAGE_DIR_NAME
from quilt.tools.package import Package
from quilt.tools.store import PackageStore, StoreException
from .utils import patch, QuiltTestCase

class ImportTest(QuiltTestCase):
    def test_imports(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package', build_path)

        # Good imports

        from quilt.data.foo import package
        from quilt.data.foo.package import dataframes
        from quilt.data.foo.package import README

        # Contents of the imports

        assert isinstance(package, GroupNode)
        assert isinstance(dataframes, GroupNode)
        assert isinstance(dataframes.csv, DataNode)
        assert isinstance(README, DataNode)

        assert package.dataframes == dataframes
        assert package.README == README

        assert set(dataframes._keys()) == {'csv', 'nulls'}
        assert set(dataframes._group_keys()) == set()
        assert set(dataframes._data_keys()) == {'csv', 'nulls'}

        assert isinstance(README(), string_types)
        assert isinstance(README._data(), string_types)
        assert isinstance(dataframes.csv(), pd.DataFrame)
        assert isinstance(dataframes.csv._data(), pd.DataFrame)

        str(package)
        str(dataframes)
        str(README)

        # Bad attributes of imported packages

        with self.assertRaises(AttributeError):
            package.foo

        with self.assertRaises(AttributeError):
            package.dataframes.foo

        with self.assertRaises(AttributeError):
            package.dataframes.csv.foo

        # Bad imports

        with self.assertRaises(ImportError):
            import quilt.data.foo.bad_package

        with self.assertRaises(ImportError):
            import quilt.data.bad_user.bad_package

        with self.assertRaises(ImportError):
            from quilt.data.foo.dataframes import blah

        with self.assertRaises(ImportError):
            from quilt.data.foo.baz import blah

    def test_team_imports(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('test:bar/package', build_path)

        # Good imports

        from quilt.team.test.bar import package
        from quilt.team.test.bar.package import dataframes
        from quilt.team.test.bar.package import README

        # Contents of the imports

        assert isinstance(package, GroupNode)
        assert isinstance(dataframes, GroupNode)
        assert isinstance(dataframes.csv, DataNode)
        assert isinstance(README, DataNode)

        assert package.dataframes == dataframes
        assert package.README == README

        assert set(dataframes._keys()) == {'csv', 'nulls'}
        assert set(dataframes._group_keys()) == set()
        assert set(dataframes._data_keys()) == {'csv', 'nulls'}

        assert isinstance(README(), string_types)
        assert isinstance(README._data(), string_types)
        assert isinstance(dataframes.csv(), pd.DataFrame)
        assert isinstance(dataframes.csv._data(), pd.DataFrame)

        str(package)
        str(dataframes)
        str(README)

        # Bad attributes of imported packages

        with self.assertRaises(AttributeError):
            package.foo

        with self.assertRaises(AttributeError):
            package.dataframes.foo

        with self.assertRaises(AttributeError):
            package.dataframes.csv.foo

        # Bad imports

        with self.assertRaises(ImportError):
            import quilt.team.test.bar.bad_package

        with self.assertRaises(ImportError):
            import quilt.team.test.bad_user.bad_package

        with self.assertRaises(ImportError):
            from quilt.team.test.bar.dataframes import blah

        with self.assertRaises(ImportError):
            from quilt.team.test.bar.baz import blah

    def test_import_group_as_data(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_group_data.yml')
        command.build('foo/grppkg', build_path)

        # Good imports
        from quilt.data.foo import grppkg
        assert isinstance(grppkg.dataframes, GroupNode)

        # Make sure child dataframes were concatenated in the correct order (alphabetically by node name).
        df = grppkg.dataframes._data()
        assert df['x'].tolist() == [1, 2, 3, 4]
        assert df['y'].tolist() == [1, 4, 9, 16]

        # Incompatible Schema
        with self.assertRaises(StoreException):
            grppkg.incompatible._data()

        # Empty group
        grppkg.dataframes._add_group("empty")
        assert grppkg.dataframes.empty._data() is None

        # In-memory dataframe
        grppkg._set(['dataframes', 'foo'], pd.DataFrame([1, 2, 3]))
        with self.assertRaises(NotImplementedError):
            grppkg.dataframes._data()

    def test_multiple_package_dirs(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')  # Contains 'dataframes'
        simple_build_path = os.path.join(mydir, './build_simple.yml')  # Empty

        new_build_dir = 'aaa/bbb/%s' % PACKAGE_DIR_NAME

        # Build two packages:
        # - First one exists in the default dir and the new dir; default should take priority.
        # - Second one only exists in the new dir.

        # First package.
        command.build('foo/multiple1', build_path)

        # First and second package in the new build dir.
        with patch.dict(os.environ, {'QUILT_PRIMARY_PACKAGE_DIR': new_build_dir}):
            command.build('foo/multiple1', simple_build_path)
            command.build('foo/multiple2', simple_build_path)

        # Cannot see the second package yet.
        with self.assertRaises(ImportError):
            from quilt.data.foo import multiple2

        # Now search the new build dir.
        dirs = 'foo/%s:%s' % (PACKAGE_DIR_NAME, new_build_dir)
        with patch.dict(os.environ, {'QUILT_PACKAGE_DIRS': dirs}):
            # Can import the second package now.
            from quilt.data.foo import multiple2

            # The first package contains data from the default dir.
            from quilt.data.foo import multiple1
            assert multiple1.dataframes

    def test_save(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package1', build_path)

        from quilt.data.foo import package1

        # Build an identical package
        command.build('foo/package2', package1)

        from quilt.data.foo import package2
        teststore = PackageStore(self._store_dir)
        contents1 = open(os.path.join(teststore.package_path(None, 'foo', 'package1'),
                                      Package.CONTENTS_DIR,
                                      package1._package.get_hash())).read()
        contents2 = open(os.path.join(teststore.package_path(None, 'foo', 'package2'),
                                      Package.CONTENTS_DIR,
                                      package2._package.get_hash())).read()
        assert contents1 == contents2

        # Rename an attribute
        package1.dataframes2 = package1.dataframes
        del package1.dataframes

        # Modify an existing dataframe
        csv = package1.dataframes2.csv._data()
        csv.at[0, 'Int0'] = 42

        # Add a new dataframe
        df = pd.DataFrame(dict(a=[1, 2, 3]))
        package1._set(['new', 'df'], df)
        assert package1.new.df._data() is df

        # Add a new file
        file_path = os.path.join(mydir, 'data/foo.csv')
        package1._set(['new', 'file'], 'data/foo.csv', build_dir=mydir)
        assert package1.new.file._data() == file_path

        # Add a new group
        package1._add_group('newgroup')
        assert isinstance(package1.newgroup, GroupNode)
        package1.newgroup._add_group('foo')
        assert isinstance(package1.newgroup.foo, GroupNode)

        # Overwrite a leaf node
        new_path = os.path.join(mydir, 'data/nuts.csv')
        package1._set(['newgroup', 'foo'], 'data/nuts.csv', build_dir=mydir)
        assert package1.newgroup.foo._data() == new_path

        # Overwrite the whole group
        package1._set(['newgroup'], 'data/nuts.csv', build_dir=mydir)
        assert package1.newgroup._data() == new_path

        # Set some custom metadata
        package1._meta['foo'] = 'bar'
        package1.newgroup._meta['x'] = 'y'

        # Built a new package and verify the new contents
        command.build('foo/package3', package1)

        from quilt.data.foo import package3

        assert hasattr(package3, 'dataframes2')
        assert not hasattr(package3, 'dataframes')

        new_csv = package3.dataframes2.csv._data()
        assert new_csv.xs(0)['Int0'] == 42

        new_df = package3.new.df._data()
        assert new_df.xs(2)['a'] == 3

        new_file = package3.new.file._data()
        assert isinstance(new_file, string_types)

        assert package3._meta['foo'] == 'bar'
        assert package3.newgroup._meta['x'] == 'y'

    def test_set_non_node_attr(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package4', build_path)

        from quilt.data.foo import package4

        # Assign a DataFrame as a node
        # (should throw exception)
        df = pd.DataFrame(dict(a=[1, 2, 3]))
        with self.assertRaises(AttributeError):
            package4.newdf = df

    def test_load_update(self):
        # also tests dynamic import
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package5', build_path)
        from ..data.foo import package5

        # make a copy, to prove we can
        newpkgname = 'foo/copied_package'
        command.build(newpkgname, package5)

        newfilename = 'myfile'+str(int(time.time()))
        with open(newfilename, 'w') as fh:
            fh.write('hello world1')

        module = command.load(newpkgname)
        module._set([newfilename], newfilename)
        command.build(newpkgname, module)

        # current spec requires that build() *not* update the in-memory module tree.
        newpath1 = getattr(module, newfilename)()
        assert newpath1 == newfilename

        # current spec requires that load() reload from disk, i.e. gets a reference
        # to the local object store
        # this is important because of potential changes to myfile
        reloaded_module = command.load(newpkgname)
        assert reloaded_module is not module
        newpath2 = getattr(reloaded_module, newfilename)()
        assert 'myfile' not in newpath2

    def test_multiple_updates(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package6', build_path)
        from ..data.foo import package6

        newfilename1 = 'myfile1'+str(int(time.time()))
        with open(newfilename1, 'w') as fh:
            fh.write('hello world1')

        package6._set([newfilename1], newfilename1)

        newfilename2 = 'myfile2'+str(int(time.time()))
        with open(newfilename2, 'w') as fh:
            fh.write('hello world2')

        package6._set([newfilename1], newfilename2)

        assert getattr(package6, newfilename1)() == newfilename2

    def test_team_non_team_imports(self):
        mydir = os.path.dirname(__file__)
        build_path1 = os.path.join(mydir, './build_simple.yml')
        command.build('myteam:foo/team_imports', build_path1)
        build_path2 = os.path.join(mydir, './build_empty.yml')
        command.build('foo/team_imports', build_path2)

        # Verify that both imports work, and packages are in fact different.

        from ..team.myteam.foo import team_imports as pkg1
        from ..data.foo import team_imports as pkg2

        assert hasattr(pkg1, 'foo')
        assert not hasattr(pkg2, 'foo')

    def test_team_set_non_node_attr(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('test:bar/package4', build_path)

        from quilt.team.test.bar import package4

        # Assign a DataFrame as a node
        # (should throw exception)
        df = pd.DataFrame(dict(a=[1, 2, 3]))
        with self.assertRaises(AttributeError):
            package4.newdf = df
