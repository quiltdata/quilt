"""
Integration test of installation from known public package(s)
"""
from unittest.mock import patch

import pytest

from ..tools import command
from .utils import BasicQuiltTestCase
from .integration import skip

@skip
class IntegrationTest(BasicQuiltTestCase):
    """only runs if --integration ENV_URL is provided to pytest"""
    def test_env_install(self):
        env = pytest.config.getoption("--integration")
        with patch('quilt.tools.command.QUILT_PKG_URL', env):
            # public package
            command.install('akarve/days') # package exists on both stage and prod
            from quilt.data.akarve import days
            df = days.names.data()
            # check for expected datum
            assert df.loc[3]['Day'] == 'Wednesday', 'unexpected value in days df at loc[3]'
