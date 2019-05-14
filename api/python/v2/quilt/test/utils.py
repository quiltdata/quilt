"""
Unittest setup.
"""

import os
import shutil
from stat import S_IWUSR
import tempfile
import unittest

import quilt
from ..tools.const import PACKAGE_DIR_NAME

try:
    # Python3
    from unittest.mock import patch
except ImportError:
    # Python2 - external dependency.
    from mock import patch

import responses


def quilt_dev_mode(func):
    """Sets quilt._DEV_MODE and restores original state on context exit

    Decorator.

    Use to enable dev mode during a function call -- for example, to
    disable input() prompts during a specific test.
    """
    def decorated(*args, **kwargs):
        dev_mode = quilt._DEV_MODE
        try:
            quilt._DEV_MODE = True
            return func(*args, **kwargs)
        finally:
            quilt._DEV_MODE = dev_mode
    return decorated

def try_require(string):
    """return true iff specified require string resolves properly;
    for use with @pytest.mark.skipif"""
    import pkg_resources
    try:
        pkg_resources.require(string)
    except pkg_resources.ResolutionError as ex:
        print(ex)
        return False
    return True

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

        def _onerror(func, path, exc_info):
            """
            Handle read-only files on Windows
            """
            if not os.access(path, os.W_OK):
                os.chmod(path, S_IWUSR)
                func(path)
            else:
                raise
        shutil.rmtree(self._test_dir, onerror=_onerror)

class QuiltTestCase(BasicQuiltTestCase):
    """
    - Mocks requests
    - (And inherits temp directory from superclass)
    """
    def setUp(self):
        super(QuiltTestCase, self).setUp()

        self.auth_patcher = patch('quilt.tools.command._load_auth', lambda: {})
        self.auth_patcher.start()

        self._store_dir = os.path.join(self._test_dir, PACKAGE_DIR_NAME)
        self.store_patcher = patch.dict(os.environ, {'QUILT_PRIMARY_PACKAGE_DIR': self._store_dir})
        self.store_patcher.start()

        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=True)
        self.requests_mock.start()

    def tearDown(self):
        self.requests_mock.stop()
        self.auth_patcher.stop()
        self.store_patcher.stop()

        super(QuiltTestCase, self).tearDown()
