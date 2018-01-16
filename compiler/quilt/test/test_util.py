"""
Tests for quilt.tools.util
"""

import os

from .utils import QuiltTestCase
from ..tools.util import sub_dirs, sub_files, glob_insensitive
from ..tools.compat import pathlib, tempfile


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

    def test_glob_insensitive(self):
        with tempfile.TemporaryDirectory() as tempdir:
            tempdir = pathlib.Path(tempdir)

            base_files = [
                tempdir / 'foo.txt',
                tempdir / 'bar.txt',
                tempdir / 'baz.txt',
            ]

            subdir_files = [
                tempdir / 'fizz/foo.txt',
                tempdir / 'fizz/cat.csv',
                tempdir / 'fizz/snoz.csv',
                tempdir / 'fizz/buzz/bonk.tsv',
            ]

            subdirs = [
                tempdir / 'fizz',
                tempdir / 'fizz/buzz',
            ]
            for path in subdir_files:
                path.parent.mkdir(parents=True, exist_ok=True)

            for path in base_files + subdir_files:
                path.touch()

            assert set(glob_insensitive(tempdir, '*.tXt', shortpaths=False)) == set(base_files)
            assert not list(glob_insensitive(tempdir, '*cat', shortpaths=False))
            assert set(glob_insensitive(tempdir, '**/*.?sv', shortpaths=False)) == set(subdir_files[1:])
            assert set(glob_insensitive(tempdir, '**/*.[Tc]sv', shortpaths=False)) == set(subdir_files[1:])
            assert set(glob_insensitive(tempdir, '**/*[!xs]?', include_dirs=True, shortpaths=False)) == set(subdirs)
            result = glob_insensitive(tempdir, '**/*', include_dirs=True, include_files=False, shortpaths=False)
            assert set(result) == set(subdirs)

