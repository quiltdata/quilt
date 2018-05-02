"""
Tests for the package store.
"""

import os
import shutil

from ..tools.store import PackageStore, StoreException
from .utils import QuiltTestCase

class StoreTest(QuiltTestCase):
    def test_old_format(self):
        os.mkdir(self._store_dir)
        with open(os.path.join(self._store_dir, '.format'), 'w') as fd:
            fd.write('1.1')

        with self.assertRaises(StoreException):
            PackageStore(self._store_dir)

    def test_migrations(self):
        mydir = os.path.dirname(__file__)
        shutil.copytree(os.path.join(mydir, 'store_old_format'), self._store_dir)

        # We're starting with an old version.
        with open(os.path.join(self._store_dir, '.format')) as fd:
            assert fd.read() == '1.2'

        # Verify that packages work.
        pkg = PackageStore.find_package(None, 'test', 'simple')
        assert pkg is not None

        # Verify that objects work.
        node = pkg['foo']
        pkg.get_obj(node)

        # We now have a new version.
        with open(os.path.join(self._store_dir, '.format')) as fd:
            assert fd.read() == '1.4'
