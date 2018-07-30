"""
Test the build process
"""
import os

import pytest
import numpy as np
import pandas.api.types as ptypes
from pandas.core.frame import DataFrame
from six import assertRaisesRegex, string_types
import yaml

from ..nodes import DataNode, GroupNode, PackageNode
from ..tools.store import ParquetLib, PackageStore
from ..tools.compat import pathlib
from ..tools import build, command, store
from .utils import QuiltTestCase, patch

PACKAGE = 'groot'

class BuildTest(QuiltTestCase):

    def test_build_parquet_default(self):
        """
        Test compilation to Parquet via the default library
        """
        PackageStore.reset_parquet_lib()
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build_large.yml')
        build.build_package(None, 'test_parquet', PACKAGE, [], path)
        # TODO load DFs based on contents of .yml file at PATH
        # not hardcoded vals (this will require loading modules from variable
        # names, probably using __module__)
        from quilt.data.test_parquet.groot import dataframes, README
        self._test_dataframes(dataframes)
        assert os.path.exists(README())


    def test_build_from_cache(self):
        """
        Build the same package twice and verify that the cache is used and
        that the package is successfully generated.
        """
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build_large.yml')
        teststore = store.PackageStore()

        # Build once to populate cache
        build.build_package(None, 'test_cache', PACKAGE, [], path)

        # Verify cache contents
        srcpath = os.path.join(mydir, 'data/10KRows13Cols.csv')
        path_hash = build._path_hash(srcpath, 'csv',  {'parse_dates': ['Date0']})
        assert os.path.exists(teststore.cache_path(path_hash))

        # Build again using the cache
        build.build_package(None, 'test_cache', PACKAGE, [], path)

        # TODO load DFs based on contents of .yml file at PATH
        # not hardcoded vals (this will require loading modules from variable
        # names, probably using __module__)
        from quilt.data.test_cache.groot import dataframes, README
        self._test_dataframes(dataframes)
        assert os.path.exists(README())

    def test_parquet_env_var(self):
        """
        Test setting the parquet library using the env variable.
        """
        try:
            assert PackageStore.get_parquet_lib() == ParquetLib.ARROW

            with patch.dict(os.environ, {'QUILT_PARQUET_LIBRARY': ParquetLib.ARROW.value}):
                PackageStore.reset_parquet_lib()
                assert PackageStore.get_parquet_lib() == ParquetLib.ARROW

            with patch.dict(os.environ, {'QUILT_PARQUET_LIBRARY': ParquetLib.SPARK.value}):
                PackageStore.reset_parquet_lib()
                assert PackageStore.get_parquet_lib() == ParquetLib.SPARK
        finally:
            PackageStore.reset_parquet_lib()

    # shared testing logic between pyarrow and default env
    def _test_dataframes(self, dataframes):
        csv = dataframes.csv()
        tsv = dataframes.csv()
        xls = dataframes.xls()
        xls_skip = dataframes.xls_skip()
        rows = len(csv.index)
        assert rows == len(tsv.index) and rows == len(xls.index), \
            'Expected dataframes to have same # rows'
        cols = len(csv.columns)
        assert cols == len(tsv.columns) and cols == len(xls.columns), \
            'Expected dataframes to have same # columns'
        assert xls_skip.shape == (9997, 13), \
            'Expected 9,997 Rows and 13 Columns'
        nulls = dataframes.nulls()
        assert ptypes.is_string_dtype(nulls['strings']), \
            'Expected column of strings to deserialize as strings'
        assert ptypes.is_integer_dtype(nulls['integers']), \
            'Expected column of integers to deserialize as integers'
        assert ptypes.is_float_dtype(nulls['floats']), \
            'Expected column of floats to deserialize as floats'
        assert ptypes.is_numeric_dtype(nulls['integers_nulled']), \
            'Expected column of ints with nulls to deserialize as numeric'
        # TODO add more integrity checks, incl. negative test cases

    def test_build_bad_transform(self):
        path = pathlib.Path(__file__).parent / 'build_bad_transform.yml'

        with pytest.raises(build.BuildException):
            build.build_package(None, 'test_bad_transform', PACKAGE, [], str(path))

    def test_build_bad_file(self):
        # Ensure we generate an error on bad build files
        path = pathlib.Path(__file__).parent / 'build_bad_file.yml'

        with pytest.raises(build.BuildException):
            build.build_package(None, 'test_bad_file', PACKAGE, [], str(path))

    def test_build_empty(self):
        """
        test building from build_empty.yml
        """
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build_empty.yml')
        build.build_package(None, 'empty', 'pkg', [], path)

        from quilt.data.empty import pkg
        assert not pkg._keys(), 'Expected package to be empty'

    def test_build_reserved(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build_reserved.yml')
        build.build_package(None, 'reserved', 'pkg', [], path)
        from quilt.data.reserved import pkg
        assert pkg.file, 'Expected package'
        assert pkg.checks, 'Expected package'
        assert pkg.environments, 'Expected package'
        assert pkg.kwargs, 'Expected package'
        assert pkg.transform, 'Expected package'

    def test_build_group_args(self):
        """
        test building from build_group_args.yml
        """
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build_group_args.yml')
        build.build_package(None, 'groups', 'pkg', [], path)

        from quilt.data.groups import pkg

        assert isinstance(pkg.group_a.csv(), DataFrame), \
            'Expected parent `transform: csv` to affect group_a.csv()'
        assert isinstance(pkg.group_a.tsv(), DataFrame), \
            'Expected local `transform: tsv` to affect group_a.tsv()'
        # TODO these tests should really test the node type and verify it as a file node
        # but currently both raw files and DFs are DataNode instances
        assert isinstance(pkg.group_b.txt(), string_types), \
            'Expected `transform: id` to be inferred from file extension'
        assert isinstance(pkg.group_b.subgroup.txt(), string_types), \
            'Expected `transform: id` to be inferred from file extension'
        # ENDTODO
        assert isinstance(pkg.group_b.tsv(), DataFrame), \
            'Expected `transform: tsv` to be inferred from file extension'
        assert pkg.group_b.tsv()['Date0'].dtype == np.dtype('<M8[ns]'), \
            'Expected Date0 column to parse as date'
        assert pkg.group_b.subgroup.tsv().shape == (1, 3), \
            'Expected `transform: tsv` and one skipped row from group args'
        assert pkg.group_b.subgroup.csv().shape == (0, 2), \
            'Expected local `transform: csv` and one skipped row from group args'
        assert pkg.group_b.subgroup.many_tsv.one().shape == (1, 3), \
            'Expected local `transform: csv` and one skipped row from group args'
        assert isinstance(pkg.group_b.subgroup.many_tsv.two(), DataFrame), \
            'Expected `transform: tsv` from ancestor'
        assert isinstance(pkg.group_b.subgroup.many_tsv.three(), DataFrame), \
            'Expected `transform: tsv` from ancestor'
        assert not pkg.group_empty._keys(), 'Expected group_empty to be empty'
        assert not pkg.group_x.empty_child._keys(), 'Expected group_x.emptychild to be empty'

    def test_generate_buildfile(self):
        """
        Test auto-generating a buildfile for compilation
        """
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, 'data')
        buildfilepath = os.path.join(path, 'build.yml')
        assert not os.path.exists(buildfilepath), "%s already exists" % buildfilepath
        build.generate_build_file(path)
        assert os.path.exists(buildfilepath)
        build.build_package(None, 'test_generated', 'generated', [], buildfilepath)
        os.remove(buildfilepath)
        from quilt.data.test_generated.generated import bad, foo, nuts, README

    def test_failover(self):
        """
        Test failover to the slower python read-csv on Pandas error
        """
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build_failover.yml')
        build.build_package(None, 'test_failover', PACKAGE, [], path)
        from quilt.data.test_failover.groot import bad

    def test_duplicates(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, 'dups_good')
        buildfilepath = os.path.join(path, 'build.yml')
        if os.path.exists(buildfilepath):
            os.remove(buildfilepath)

        build.generate_build_file(path)
        assert os.path.exists(buildfilepath)

        with open(buildfilepath) as fd:
            docs = yaml.load_all(fd)
            data = next(docs, None)

        contents = data['contents']

        assert contents == {
            # File extensions added to "a" due to conflicts
            'a_txt': {'file': 'a.txt'},
            'a_csv': {'file': 'a.csv'},
            # "a" dir stays the same - but it's fine cause other "a"s got renamed
            'a': {},
            # Directories don't actually have extensions, so include them even with no conficts
            'dir_ext': {},
            # Weird characters replaced with "_"
            'a__b___c': {'file': 'a%%b___c'},
            # Prepend "n" to files that start with a number
            'n1': {'file': '1'},
            # ... even if there used to be an underscore there
            'n123': {'file': '_123'},
            # Handle conflicts with numbers, too
            'n1_txt': {'file': '1.txt'},
        }

        os.remove(buildfilepath)

    def test_duplicates_conflict(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, 'dups_bad')
        buildfilename = 'build_test_duplicates_conflict.yml'
        buildfilepath = os.path.join(path, buildfilename)
        if os.path.exists(buildfilepath):
            os.remove(buildfilepath)

        with self.assertRaises(build.BuildException):
            build.generate_build_file(path, outfilename=buildfilename)

    def test_copy(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, 'data')
        buildfilename = 'build_test_copy.yml'
        buildfilepath = os.path.join(path, buildfilename)
        assert not os.path.exists(buildfilepath), "%s already exists" % buildfilepath

        command.build_from_path('test_copy/generated', path, outfilename=buildfilename)
        from quilt.data.test_copy.generated import bad, foo, nuts

        assert not os.path.exists(buildfilepath), "%s should not have been created!" % buildfilepath

    def test_build_yaml_syntax_error(self):
        """
        Attempt to build a yml file with a syntax error
        """
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build_bad_syntax.yml')

        with assertRaisesRegex(self, build.BuildException, r'Bad yaml syntax.*build_bad_syntax\.yml'):
            build.build_package(None, 'test_syntax_error', PACKAGE, [], path)

    def test_build_no_contents_node(self):
        """
        Attempt to build a yml file without contents node
        """
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build_no_contents_node.yml')

        with assertRaisesRegex(self, build.BuildException, r'Error in build_no_contents_node.yml'):
            build.build_package(None, 'no_contents', PACKAGE, [], path)

    def test_build_checks_yaml_syntax_error(self):    # pylint: disable=C0103
        """
        Attempt to build a yml file with a syntax error
        """
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build_checks_bad_syntax.yml')
        checks_path = os.path.join(mydir, './checks_bad_syntax.yml')

        with assertRaisesRegex(self, build.BuildException, r'Bad yaml syntax.*checks_bad_syntax\.yml'):
            build.build_package(None, 'test_syntax_error', PACKAGE, [], path, checks_path=checks_path)

    def test_build_glob_naming_conflict(self):
        mydir = pathlib.Path(os.path.dirname(__file__))
        buildfile = mydir / 'build_globbing_name_conflict.yml'

        with pytest.raises(command.CommandException, match="Naming conflict:"):
            command.build('test/globdata', str(buildfile))

    def test_build_via_glob(self):
        # TODO: flesh out this test
        # TODO: remove any unused files from globbing
        mydir = pathlib.Path(os.path.dirname(__file__))
        buildfile = mydir / 'build_globbing.yml'

        command.build('test/globdata', str(buildfile))

        from quilt.data.test import globdata

        # simple checks to ensure files were found and built
        globdata.csv.csv
        globdata.csv.foo
        globdata.csv.nulls
        globdata.csv.nuts
        globdata.csv.n100Rows13Cols
        globdata.csv.subnode.csv
        globdata.csv.subnode.foo
        globdata.csv.subnode.goo
        # excel, kwargs sent
        assert len(globdata.excel.n100Rows13Cols()) == 95
        # naming collision -- acceptable during a single glob specification, should result in a rename
        globdata.collision.csv
        globdata.collision.csv_2

    def test_package_getitem(self):
        # TODO: flesh out this test
        # TODO: remove any unused files from globbing
        mydir = pathlib.Path(os.path.dirname(__file__))
        buildfile = mydir / 'build_simple_nest.yml'

        command.build('test/package_getitem', str(buildfile))

        from quilt.data.test import package_getitem as node
        package = node._package

        ## Positive tests
        # simple checks to ensure matching contents for item notation
        assert package['foo']
        assert package['subnode/nuts']

        ## Negative tests
        # Valid key, but item not present (KeyError)
        with pytest.raises(KeyError) as error_info:
            package['subnode/blah']
        assert error_info.value.args == ('subnode', 'blah')

        # blank node names aren't valid
        with pytest.raises(TypeError, match="Invalid node reference"):
            package['']

        # no absolute paths
        with pytest.raises(TypeError, match="Invalid node reference"):
            package['/foo']

        # Only valid node names permitted..
        with pytest.raises(TypeError, match="Invalid node name"):
            package['subnode/9blah']

        # No subreferencing a non-GroupNode
        with pytest.raises(TypeError, match="Not a GroupNode"):
            package['foo/blah']

    def test_package_contains(self):
        # TODO: flesh out this test
        # TODO: remove any unused files from globbing
        mydir = pathlib.Path(os.path.dirname(__file__))
        buildfile = mydir / 'build_simple_nest.yml'

        command.build('test/package_contains', str(buildfile))

        from quilt.data.test import package_contains as node
        package = node._package

        ## Positive tests
        # simple checks to ensure checkeng contents works
        assert 'foo' in package
        assert 'subnode/nuts' in package

        ## Negative tests
        # These should all return False, but raise no exceptions.
        assert not 'subnode/blah' in package
        assert not '' in package
        assert not '/foo' in package
        assert not 'subnode/9blah' in package
        assert not 'foo/blah' in package

    def test_package_compose(self):
        mydir = pathlib.Path(os.path.dirname(__file__))
        buildfile = mydir / 'build_simple.yml'
        command.build('test/simple', str(buildfile))

        buildfile = mydir / 'build_compose.yml'
        command.build('test/compose1', str(buildfile))

        from quilt.data.test import simple
        from quilt.data.test import compose1

        assert simple.foo().equals(compose1.from_simple_foo())

    def test_compose_package_not_found(self):
        mydir = pathlib.Path(os.path.dirname(__file__))
        buildfile = mydir / 'build_simple.yml'
        command.build('test/simple', str(buildfile))

        missing_dep_build = {
            'contents': {
                'foo': {
                    'package':
                        'test/notapackage'
                    }
                }
            }

        with assertRaisesRegex(self, build.BuildException, r'Package.*not found'):
            build.build_package_from_contents(None, 'test', 'compose2', [], str(mydir), missing_dep_build)

    def test_compose_subpackage_not_found(self):
        mydir = pathlib.Path(os.path.dirname(__file__))
        buildfile = mydir / 'build_simple.yml'
        command.build('test/simple', str(buildfile))

        missing_dep_build = {
            'contents': {
                'foo': {
                    'package':
                        'test/simple/notasubpackage'
                    }
                }
            }

        with assertRaisesRegex(self, build.BuildException, r'Package.*has no subpackage.*'):
            build.build_package_from_contents(None, 'test', 'compose', [], str(mydir), missing_dep_build)

    def test_included_package_is_group_node(self):
        mydir = pathlib.Path(os.path.dirname(__file__))
        buildfile = mydir / 'build_simple.yml'
        command.build('test/simple', str(buildfile))

        build_compose_contents = {
            'contents': {
                'from_simple_foo': {
                    'package': 'test/simple'
                    }
                }
            }
        build.build_package_from_contents(None, 'test', 'compose3', [], str(mydir), build_compose_contents)
        from quilt.data.test import compose3

        assert type(compose3.from_simple_foo) is GroupNode

    def test_top_level_include_is_root_node(self):
        mydir = pathlib.Path(os.path.dirname(__file__))
        buildfile = mydir / 'build_simple.yml'
        command.build('test/simple', str(buildfile))

        build_compose_contents = {
            'contents': {
                'package': 'test/simple'
                }
            }
        build.build_package_from_contents(None, 'test', 'compose_root', [], str(mydir), build_compose_contents)
        from quilt.data.test import compose_root, simple

        assert type(compose_root) is PackageNode
        assert simple.foo().equals(compose_root.foo())

    def test_group_node_iter(self):
        mydir = pathlib.Path(os.path.dirname(__file__))
        build_compose_contents = {
            'contents': {
                'grp': {
                    'subgrp1': {
                        'data1': {
                            'file': 'data/foo.csv'
                        }
                    },
                    'subgrp2': {
                        'data2': {
                            'file': 'data/foo.csv'
                        }
                    },
                }
            }
        }

        build.build_package_from_contents(None, 'test', 'pkg_node', [], str(mydir), build_compose_contents)

        from quilt.data.test import pkg_node

        for node in pkg_node:
            assert isinstance(node, GroupNode)

        for grps in pkg_node.grp:
            assert isinstance(grps, GroupNode)
            for dat in grps:
                assert isinstance(dat, DataNode)
                for nothing in dat:
                    assert False, 'DataNode should not have iterable children'

    def test_package_and_file_raises_exception(self):
        mydir = pathlib.Path(os.path.dirname(__file__))
        bad_build_contents = {
            'contents': {
                'foo': {
                    'package':
                        'test/simple/notasubpackage',
                    'file':
                        'mydir/myfile.csv'
                    }
                }
            }
        with self.assertRaises(build.BuildException):
            build.build_package_from_contents(None, 'test', 'shouldfail', [], str(mydir), bad_build_contents)

    def test_parquet_source_file(self):
        df = DataFrame(dict(a=[1, 2, 3])) # pylint:disable=C0103
        import pyarrow as pa
        from pyarrow import parquet
        table = pa.Table.from_pandas(df)
        parquet.write_table(table, 'simpledf.parquet')

        build_contents = {
            'contents': {
                'df': {
                    'file': 'simpledf.parquet'
                    }
                }
            }
        build.build_package_from_contents(None, 'test', 'fromparquet', [], '.', build_contents)
        pkg = command.load('test/fromparquet')
        assert df.equals(pkg.df()) # pylint:disable=E1101

    #TODO: Add test for checks on a parquet-sourced dataframe

    def test_subpackage(self):
        mydir = pathlib.Path(os.path.dirname(__file__))

        command.build('test/foo')

        df = DataFrame(dict(a=[1, 2, 3]))
        arr = np.array([4, 5, 6])
        path = str(mydir / 'build_simple.yml')

        command.build('test/foo/empty')
        command.build('test/foo/df', df)
        command.build('test/foo/arr', arr)
        command.build('test/foo/file', path)  # Adds as a plain file
        command.build('test/foo/stuff', path, build_file=True)  # Builds a subpackage

        pkg = command.load('test/foo')
        assert len(pkg.empty) == 0
        assert pkg.df().equals(df)
        assert np.array_equal(pkg.arr(), arr)
        assert pkg.file
        assert pkg.stuff.foo

        # Cannot build a package out of a data node.
        with self.assertRaises(command.CommandException):
            command.build('test/foo', df)
        with self.assertRaises(command.CommandException):
            command.build('test/foo', arr)

        # Cannot build a subpackage if the package does not exist.
        with self.assertRaises(command.CommandException):
            command.build('test/non_existant/blah')
        with self.assertRaises(command.CommandException):
            command.build('test/non_existant/foo', df)
