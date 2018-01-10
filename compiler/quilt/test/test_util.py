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

        assert set(sub_files(path)) == set(['foo.txt'])
        assert set(sub_files(path, invisible=True)) == set(['.invisible.txt', 'foo.txt'])

    def test_sub_dirs(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './listdir')

        assert set(sub_dirs(path)) == set(['dir'])
        assert set(sub_dirs(path, invisible=True)) == set(['.invisible_dir', 'dir'])
