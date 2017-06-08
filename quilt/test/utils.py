"""
Unittest setup.
"""

import os
import shutil
import tempfile
import unittest

try:
    # Python3
    from unittest.mock import patch
except ImportError:
    # Python2 - external dependency.
    from mock import patch

import requests
import responses

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

        self.session_patcher = patch('quilt.tools.command._get_session', requests.Session)
        self.session_patcher.start()

        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=True)
        self.requests_mock.start()

    def tearDown(self):

        self.requests_mock.stop()
        self.session_patcher.stop()

        super(QuiltTestCase, self).tearDown()
