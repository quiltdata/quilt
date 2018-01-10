"""
Tests for quilt.tools.util
"""

import os

from .utils import QuiltTestCase
from ..tools.util import children

class UtilTest(QuiltTestCase):
    def test_children(self):
        mydir = os.path.dirname(__file__)
        path = os.path.join(mydir, './files')
        everything = os.listdir(path)

        allvisible = children(path, dirs=True, files=True)
        # ensure invisible files are not returned by default

        for f in allvisible:
            assert not f.startswith('.'), 'Expected only visible files'

        visiblefiles = children(path, dirs=False, files=True, noinvisible=True)
        for f in visiblefiles:
            assert os.path.isfile(os.path.join(path, f)), 'Expected only files'
            assert not f.startswith('.'), 'Expected only visible files'

        visiblefiles = children(path, dirs=False, files=True, noinvisible=True)
        for f in visiblefiles:
            assert os.path.isfile(os.path.join(path, f)), 'Expected only files'
            assert not f.startswith('.'), 'Expected only visible files'

        allfiles = children(path, dirs=False, files=True, noinvisible=False)
        for f in allfiles:
            assert os.path.isfile(os.path.join(path, f)), 'Expected only files'

        visibledirs = children(path, dirs=True, files=False, noinvisible=True)
        for d in visibledirs:
            assert os.path.isdir(os.path.join(path, d)), 'Expected only dirs'
            assert not d.startswith('.'), 'Expected only visible dirs'

        alldirs = children(path, dirs=True, files=False, noinvisible=True)
        for d in alldirs:
            assert os.path.isdir(os.path.join(path, d)), 'Expected only dirs'

        assert set(everything) == set(children(path, files=True, dirs=True, noinvisible=False)), \
            'Expected same results as os.listdir (files, dirs, visible, and invisible' 
