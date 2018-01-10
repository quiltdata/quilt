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

        for f in sub_files(path):
            assert os.path.isfile(os.path.join(path, f)), 'Expected only files'
            assert not f.startswith('.'), 'Expected only visible files'

        for f in sub_files(path, invisible=True):
            assert os.path.isfile(os.path.join(path, f)), 'Expected only files'

    def test_sub_dirs(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './listdir')

        for d in sub_dirs(path):
            assert os.path.isdir(os.path.join(path, d)), 'Expected only dirs'
            assert not d.startswith('.'), 'Expected only visible files'

        for d in sub_dirs(path, invisible=True):
            assert os.path.isdir(os.path.join(path, d)), 'Expected only dirs'
