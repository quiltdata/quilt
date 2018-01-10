"""
Test store functions
"""
import pytest

from ..tools import store
from ..tools.command import CommandException
from .utils import BasicQuiltTestCase


class StoreTest(BasicQuiltTestCase):
    def test_parse_package_names(self):
        # good parse strings
        expected = (None, 'user', 'package')
        assert store.parse_package('user/package') == expected

        expected = ('team', 'user', 'package')
        assert store.parse_package('team:user/package') == expected

        expected = (None, 'user', 'package', ['foo', 'bar'])
        assert store.parse_package('user/package/foo/bar', True) == expected

        expected = ('team', 'user', 'package', ['foo', 'bar'])
        assert store.parse_package('team:user/package/foo/bar', True) == expected

        expected = ('team', 'user', 'package', [])
        assert store.parse_package('team:user/package', True) == expected

        # bad parse strings
        with pytest.raises(CommandException, message='subdir should be rejected'):
            store.parse_package('user/package/subdir', allow_subpath=False)

        with pytest.raises(CommandException, match="Invalid user name"):
            store.parse_package('9user/package')

        with pytest.raises(CommandException, match='Invalid package name'):
            store.parse_package('user/!package')

        with pytest.raises(CommandException, match='Invalid element in subpath'):
            store.parse_package('user/package/&subdir', True)

        with pytest.raises(CommandException, message='subdir should be rejected'):
            store.parse_package('team:user/package/subdir', allow_subpath=False)

        with pytest.raises(CommandException, match='Invalid team name'):
            store.parse_package('team%:user/package/subdir', allow_subpath=True)

        with pytest.raises(CommandException, match="Invalid user name"):
            store.parse_package('team:9user/package')

        with pytest.raises(CommandException, match='Invalid package name'):
            store.parse_package('team:user/!package')

        with pytest.raises(CommandException, match='Invalid element in subpath'):
            store.parse_package('team:user/package/&subdir', True)

        # XXX: in this case, should we just strip the trialing slash?
        with pytest.raises(CommandException, match='Invalid element in subpath'):
            store.parse_package('team:user/package/subdir/', True)

