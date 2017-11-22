"""
Test the build process
"""
#TODO: we should really test the CLI interface itself, rather than
#the functions that cli calls
import os

import pandas.api.types as ptypes
from six import assertRaisesRegex, string_types
import yaml

from .. import nodes
from ..tools.package import ParquetLib, Package
from ..tools import build, command
from .utils import QuiltTestCase

PACKAGE = 'groot'

class BuildTest(QuiltTestCase):

    def test_build_parquet_default(self):
        """
        Test compilation to Parquet via the default library
        """
        Package.reset_parquet_lib()
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build.yml')
        build.build_package('test_parquet', PACKAGE, path)
        # TODO load DFs based on contents of .yml file at PATH
        # not hardcoded vals (this will require loading modules from variable
        # names, probably using __module__)
        from quilt.data.test_parquet.groot import dataframes, README
        self._test_dataframes(dataframes)
        assert os.path.exists(README())

    def test_build_parquet_pyarrow(self):
        """
        Test compilation Parquet via pyarrow
        """
        os.environ["QUILT_PARQUET_LIBRARY"] = ParquetLib.ARROW.value
        Package.reset_parquet_lib()
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build.yml')
        build.build_package('test_arrow', PACKAGE, path)
        from quilt.data.test_arrow.groot import dataframes, README
        self._test_dataframes(dataframes)
        assert os.path.exists(README())
        assert Package.get_parquet_lib() is ParquetLib.ARROW
        del os.environ["QUILT_PARQUET_LIBRARY"]

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

    def test_build_hdf5(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build_hdf5.yml')
        with assertRaisesRegex(self, build.BuildException, "no longer supported"):
            build.build_package('test_hdf5', PACKAGE, path)

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
        build.build_package('test_generated', 'generated', buildfilepath)
        os.remove(buildfilepath)
        from quilt.data.test_generated.generated import bad, foo, nuts, README

    def test_failover(self):
        """
        Test failover to the slower python read-csv on Pandas error
        """
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build_failover.yml')
        build.build_package('test_failover', PACKAGE, path)
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
            # Weird characters replaced with a single "_"
            'a_b_c': {'file': 'a%%b___c'},
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
        buildfilepath = os.path.join(path, 'build.yml')
        if os.path.exists(buildfilepath):
            os.remove(buildfilepath)

        with self.assertRaises(build.BuildException):
            build.generate_build_file(path)

    def test_copy(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, 'data')
        buildfilepath = os.path.join(path, 'build.yml')
        assert not os.path.exists(buildfilepath), "%s already exists" % buildfilepath

        command.build_from_path('test_copy/generated', path)
        from quilt.data.test_copy.generated import bad, foo, nuts

        assert not os.path.exists(buildfilepath), "%s should not have been created!" % buildfilepath
