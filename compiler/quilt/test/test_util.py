"""
Tests for quilt.tools.util
"""

import os

from .utils import QuiltTestCase
from ..tools.util import sub_dirs, sub_files

class UtilTest(QuiltTestCase):
    def test_sub_files(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './listdir')

        files = ['foo.txt']
        invis_files = ['.invisible.txt']
        children = ['dir/child.txt']
        dirs = ['dir']
        invis_dirs = ['.invisible_dir']

        for f in sub_files(path):
            assert f in files
            assert f not in invis_files
            assert f not in children
            assert f not in dirs and f not in invis_dirs

        for f in sub_files(path, invisible=True):
            assert f in files or f in invis_files
            assert f not in children
            assert f not in dirs and f not in invis_dirs

    def test_sub_dirs(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './listdir')

        files = ['foo.txt']
        invis_files = ['.invisible.txt']
        children = ['dir/child.txt']
        dirs = ['dir']
        invis_dirs = ['.invisible_dir']

        for d in sub_dirs(path):
            assert d in dirs
            assert d not in invis_dirs
            assert d not in files and d not in invis_files
            assert d not in children

        for d in sub_dirs(path, invisible=True):
            assert d in dirs or d in invis_dirs
            assert d not in files and d not in invis_files
            assert d not in children
