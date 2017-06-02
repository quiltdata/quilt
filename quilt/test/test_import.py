"""
Tests for magic imports.
"""

import os

import pandas as pd
from six import string_types

from quilt.data import GroupNode, DataNode
from quilt.tools import command
from quilt.tools.const import PACKAGE_DIR_NAME
from .utils import QuiltTestCase

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

        assert set(dataframes._keys()) == {'xls', 'csv', 'tsv'}
        assert set(dataframes._group_keys()) == set()
        assert set(dataframes._data_keys()) == {'xls', 'csv', 'tsv'}

        assert isinstance(README(), string_types)
        assert isinstance(README.data(), string_types)
        assert isinstance(dataframes.csv(), pd.DataFrame)
        assert isinstance(dataframes.csv.data(), pd.DataFrame)

        assert isinstance(dataframes.data(), pd.DataFrame())
        
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

    def test_multiple_package_dirs(self):
        # First level
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/nested', build_path)

        # Second level: different package
        os.mkdir("aaa")
        os.chdir("aaa")
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/nested', build_path)

        # Third level: empty package directory
        os.mkdir("bbb")
        os.chdir("bbb")
        os.mkdir(PACKAGE_DIR_NAME)

        # Imports should find the second package
        from quilt.data.foo.nested import dataframes

    def test_save(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package1', build_path)

        from quilt.data.foo import package1

        # Build an identical package
        command.build('foo/package2', package1)
        contents1 = open('quilt_packages/foo/package1.json').read()
        contents2 = open('quilt_packages/foo/package2.json').read()
        assert contents1 == contents2

        # Rename an attribute
        package1.dataframes2 = package1.dataframes
        del package1.dataframes

        # Modify an existing dataframe
        csv = package1.dataframes2.csv.data()
        csv.set_value(0, 'Int0', 42)

        # Add a new dataframe
        df = pd.DataFrame(dict(a=[1, 2, 3]))
        package1._set(['new', 'df'], df)

        # Add a new file
        file_path = os.path.join(mydir, 'data/foo.csv')
        package1._set(['new', 'file'], file_path)

        # Can't overwrite things
        with self.assertRaises(ValueError):
            package1._set(['new'], file_path)
        with self.assertRaises(ValueError):
            package1._set(['new', 'file'], file_path)

        # Built a new package and verify the new contents
        command.build('foo/package3', package1)

        from quilt.data.foo import package3

        assert hasattr(package3, 'dataframes2')
        assert not hasattr(package3, 'dataframes')

        new_csv = package3.dataframes2.csv.data()
        assert new_csv.xs(0)['Int0'] == 42

        new_df = package3.new.df.data()
        assert new_df.xs(2)['a'] == 3

        new_file = package3.new.file.data()
        assert isinstance(new_file, string_types)
