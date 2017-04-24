"""
Integration test of installation from known public package(s)
"""
import pytest

from ..tools import command
from .integration import skip

@skip
def test_prod_install():
    # public package
    command.install('akarve/days', force=True)
    from quilt.data.akarve import days
    df = days.names.data()
    assert(df.loc[3]['Day'] == 'Wednesday')
    # TODO clean up after this test b/c tests shouldn't have side-effects
    # cleanup is non-trivial because there's no uninstall and it's overkill
    # to blow away all of quilt_packages

