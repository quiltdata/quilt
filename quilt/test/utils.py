"""
Unittest setup.
"""

import os
import shutil
import tempfile
import unittest

from distutils.dir_util import mkpath

from ..tools.const import PACKAGE_DIR_NAME

try:
    # Python3
    from unittest.mock import patch
except ImportError:
    # Python2 - external dependency.
    from mock import patch

import responses

def test_store_dir():
    test_dir = tempfile.mkdtemp(prefix='quilt-test-')
    package_dir = os.path.join(test_dir, PACKAGE_DIR_NAME)
    mkpath(package_dir)
    return package_dir

class BasicQuiltTestCase(unittest.TestCase):
    """
    Base class for unittests.
    - Creates a temporary directory
    """
    def setUp(self):
        self._old_dir = os.getcwd()
        self._test_dir = tempfile.mkdtemp(prefix='quilt-test-')
        os.chdir(self._test_dir)

    def tearDown(self):
        os.chdir(self._old_dir)
        shutil.rmtree(self._test_dir)

class QuiltTestCase(BasicQuiltTestCase):
    """
    - Mocks requests
    - (And inherits temp directory from superclass)
    """
    def setUp(self):
        super(QuiltTestCase, self).setUp()

        self.auth_patcher = patch('quilt.tools.command._create_auth', lambda: None)
        self.auth_patcher.start()

        self._store_dir = test_store_dir()
        print("STORE DIR: %s" % self._store_dir)
        self.store_patcher = patch('quilt.tools.store.default_store_dir', lambda: self._store_dir)
        self.store_patcher.start()

        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=True)
        self.requests_mock.start()

    def tearDown(self):

        self.requests_mock.stop()
        self.auth_patcher.stop()
        self.store_patcher.stop()

        super(QuiltTestCase, self).tearDown()
