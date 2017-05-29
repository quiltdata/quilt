"""
Integration test of installation from known public package(s)
"""
import pytest

from ..tools import command
from .utils import BasicQuiltTestCase
from .integration import skip

@skip
class IntegrationTest(BasicQuiltTestCase):
    """only runs if --integration ENV_URL is provided to pytest"""
    def test_prod_install(self):
        # this is done in preference to os.environ.get since there is no
        # guarantee that command.QUILT_PKG_URL == os.environ.get['QUILT_PKG_URL']
        # WARNING: not thread safe
        old_env = command.QUILT_PKG_URL
        env = pytest.config.getoption("--integration")
        command.QUILT_PKG_URL = env
        # public package
        command.install('akarve/days') # package exists on both stage and prod
        from quilt.data.akarve import days
        df = days.names.data()
        # check for expected datum
        assert df.loc[3]['Day'] == 'Wednesday', 'unexpected value in days df at loc[3]'
        # restore env
        command.QUILT_PKG_URL = old_env
