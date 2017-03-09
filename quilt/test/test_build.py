"""
Test the build process
"""
#TODO: we should really test the CLI interface itself, rather than
#the functions that cli calls
import os

try:
    import fastparquet
except ImportError:
    fastparquet = None

try:
    import pyarrow
except ImportError:
    pyarrow = None

import pytest

from quilt.tools import build
from quilt.tools.const import PackageFormat
from .utils import QuiltTestCase


PACKAGE = 'groot'

class BuildTest(QuiltTestCase):
    def test_build_hdf5(self):
        """
        Test compilation
        """
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build.yml')
        build.build_package('test_hdf5', PACKAGE, path)
        # TODO load DFs based on contents of .yml file at PATH
        # not hardcoded vals (this will require loading modules from variable
        # names, probably using __module__)
        from quilt.data.test_hdf5.groot import csv, tsv, xls
        rows = len(csv.index)
        assert rows == len(tsv.index) and rows == len(xls.index), \
            'Expected dataframes to have same # rows'
        cols = len(csv.columns)
        print(csv.columns, xls.columns, tsv.columns)
        assert cols == len(tsv.columns) and cols == len(xls.columns), \
            'Expected dataframes to have same # columns'
        # TODO add more integrity checks, incl. negative test cases

    @pytest.mark.skipif("fastparquet is None")
    def test_build_fastparquet(self):
        """
        Test compilation
        """
        os.environ["QUILT_PACKAGE_FORMAT"] = PackageFormat.FASTPARQUET.value
        mydir = os.path.dirname(__file__)
        PATH = os.path.join(mydir, './build.yml')
        build.build_package('test_parquet', PACKAGE, PATH)
        # TODO load DFs based on contents of .yml file at PATH
        # not hardcoded vals (this will require loading modules from variable
        # names, probably using __module__)
        from quilt.data.test_parquet.groot import csv, tsv, xls
        rows = len(csv.index)
        assert rows == len(tsv.index) and rows == len(xls.index), \
            'Expected dataframes to have same # rows'
        cols = len(csv.columns)
        print(csv.columns, xls.columns, tsv.columns)
        assert cols == len(tsv.columns) and cols == len(xls.columns), \
            'Expected dataframes to have same # columns'
        del(os.environ["QUILT_PACKAGE_FORMAT"])
        # TODO add more integrity checks, incl. negative test cases

    @pytest.mark.skipif("pyarrow is None")
    def test_build_arrow(self):
        """
        Test compilation
        """
        os.environ["QUILT_PACKAGE_FORMAT"] = PackageFormat.ARROW.value
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build.yml')
        build.build_package('test_parquet', PACKAGE, path)
        # TODO load DFs based on contents of .yml file at path
        # not hardcoded vals (this will require loading modules from variable
        # names, probably using __module__)
        from quilt.data.test_parquet.groot import csv, tsv, xls
        rows = len(csv.index)
        assert rows == len(tsv.index) and rows == len(xls.index), \
            'Expected dataframes to have same # rows'
        cols = len(csv.columns)
        print(csv.columns, xls.columns, tsv.columns)
        assert cols == len(tsv.columns) and cols == len(xls.columns), \
            'Expected dataframes to have same # columns'
        del os.environ["QUILT_PACKAGE_FORMAT"]
        # TODO add more integrity checks, incl. negative test cases

    def test_failover(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './build_failover.yml')
        build.build_package('test_failover', PACKAGE, path)
        from quilt.data.test_failover import bad
