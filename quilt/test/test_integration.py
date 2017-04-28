"""
Integration test of installation from known public package(s)
"""
import pytest


from ..tools import command
from .utils import QuiltTestCaseBasic
from .integration import skip

@skip
class IntegrationTest(QuiltTestCaseBasic):
    def test_prod_install(self):
        # public package
        command.install('akarve/days')
        from quilt.data.akarve import days
        df = days.names.data()
        # check for expected datum
        assert(df.loc[3]['Day'] == 'Wednesday')