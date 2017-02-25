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

import pytest

from quilt.tools import build
from quilt.tools.const import FORMAT_PARQ


USER = 'test_121'
PACKAGE = 'groot'

def test_build():
    """
    Test compilation
    """
    mydir = os.path.dirname(__file__)
    PATH = os.path.join(mydir, './build.yml')
    build.build_package(USER, PACKAGE, PATH)
    # TODO load DFs based on contents of .yml file at PATH
    # not hardcoded vals (this will require loading modules from variable
    # names, probably using __module__)
    from quilt.data.test_121.groot import csv, tsv, xls
    rows = len(csv.index)
    assert rows == len(tsv.index) and rows == len(xls.index), \
        'Expected dataframes to have same # rows'
    cols = len(csv.columns)
    print(csv.columns, xls.columns, tsv.columns)
    assert cols == len(tsv.columns) and cols == len(xls.columns), \
        'Expected dataframes to have same # columns'
    # TODO add more integrity checks, incl. negative test cases

@pytest.mark.skipif("fastparquet is None")
def test_build_parquet():
    """
    Test compilation
    """
    os.environ["QUILT_PACKAGE_FORMAT"] = FORMAT_PARQ
    mydir = os.path.dirname(__file__)
    PATH = os.path.join(mydir, './build.yml')
    build.build_package(USER, PACKAGE, PATH)
    # TODO load DFs based on contents of .yml file at PATH
    # not hardcoded vals (this will require loading modules from variable
    # names, probably using __module__)
    from quilt.data.test_121.groot import csv, tsv, xls
    rows = len(csv.index)
    assert rows == len(tsv.index) and rows == len(xls.index), \
        'Expected dataframes to have same # rows'
    cols = len(csv.columns)
    print(csv.columns, xls.columns, tsv.columns)
    assert cols == len(tsv.columns) and cols == len(xls.columns), \
        'Expected dataframes to have same # columns'
    del os.environ["QUILT_PACKAGE_FORMAT"]
    # TODO add more integrity checks, incl. negative test cases

