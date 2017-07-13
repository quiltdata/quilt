"""
Test the build process
"""
#TODO: we should really test the CLI interface itself, rather than
#the functions that cli calls
import os

from six import assertRaisesRegex

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
        csv = dataframes.csv()
        tsv = dataframes.csv()
        xls = dataframes.xls()
        rows = len(csv.index)
        assert rows == len(tsv.index) and rows == len(xls.index), \
            'Expected dataframes to have same # rows'
        assert os.path.exists(README())
        cols = len(csv.columns)
        print(csv.columns, xls.columns, tsv.columns)
        assert cols == len(tsv.columns) and cols == len(xls.columns), \
            'Expected dataframes to have same # columns'
        # TODO add more integrity checks, incl. negative test cases

    def test_build_parquet_pyarrow(self):
        """
        Test compilation Parquet via pyarrow
        """
        os.environ["QUILT_PARQUET_LIBRARY"] = ParquetLib.ARROW.value
        Package.reset_parquet_lib()
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build.yml')
        build.build_package('test_arrow', PACKAGE, path)
        # TODO load DFs based on contents of .yml file at path
        # not hardcoded vals (this will require loading modules from variable
        # names, probably using __module__)
        from quilt.data.test_arrow.groot import dataframes, README
        csv = dataframes.csv()
        tsv = dataframes.csv()
        xls = dataframes.xls()
        rows = len(csv.index)
        assert rows == len(tsv.index) and rows == len(xls.index), \
            'Expected dataframes to have same # rows'
        cols = len(csv.columns)
        print(csv.columns, xls.columns, tsv.columns)
        assert cols == len(tsv.columns) and cols == len(xls.columns), \
            'Expected dataframes to have same # columns'
        assert os.path.exists(README())
        # TODO add more integrity checks, incl. negative test cases
        assert Package.get_parquet_lib() is ParquetLib.ARROW
        del os.environ["QUILT_PARQUET_LIBRARY"]

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

    def test_copy(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, 'data')
        buildfilepath = os.path.join(path, 'build.yml')
        assert not os.path.exists(buildfilepath), "%s already exists" % buildfilepath

        command.build_from_path('test_copy/generated', path)
        from quilt.data.test_copy.generated import bad, foo, nuts

        assert not os.path.exists(buildfilepath), "%s should not have been created!" % buildfilepath
