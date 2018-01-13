"""
Integration test of installation from known public package(s)
"""
from .utils import patch

import pytest

from ..tools import command
from .utils import BasicQuiltTestCase
from .integration import skip

def _mock_url(team):
    return pytest.config.getoption("--integration")

@skip
@patch('quilt.tools.command.get_registry_url', _mock_url)
class IntegrationTest(BasicQuiltTestCase):
    def test_env_install(self):
        # public package
        command.install('akarve/days') # package exists on both stage and prod
        from quilt.data.akarve import days
        df = days.names._data()
        # check for expected datum
        assert df.loc[3]['Day'] == 'Wednesday', 'unexpected value in days df at loc[3]'
