"""
Implementation of imports from `quilt.data` and `quilt.team`.

E.g.:
  import quilt.data.$user.$package as $package
  print $package.$table
or
  from quilt.data.$user.$package import $table
  print $table
"""

import imp
import os.path
import sys

from six import iteritems

from .nodes import DataNode, GroupNode, PackageNode
from .tools import core
from .tools.const import SYSTEM_METADATA, TargetType
from .tools.store import PackageStore


class FakeLoader(object):
    """
    Fake module loader used to create intermediate user and package modules.
    """
    def __init__(self, path):
        self._path = path

    def load_module(self, fullname):
        """
        Returns an empty module.
        """
        mod = sys.modules.setdefault(fullname, imp.new_module(fullname))
        mod.__file__ = self._path
        mod.__loader__ = self
        mod.__path__ = []
        mod.__package__ = fullname
        return mod


def _from_core_node(package, core_node):
    if core_node.metadata_hash is not None:
        metadata = package.get_store().load_metadata(core_node.metadata_hash)
        assert SYSTEM_METADATA not in metadata
    else:
        metadata = {}

    if isinstance(core_node, (core.TableNode, core.FileNode)):
        metadata[SYSTEM_METADATA] = {
            'filepath': core_node.metadata.get('q_path'),
            'transform': core_node.metadata.get('q_ext'),
            'target':
                TargetType.PANDAS.value
                if isinstance(core_node, core.TableNode)
                else core_node.metadata.get('q_target', TargetType.FILE.value),
        }
        node = DataNode(package, core_node.hashes, None, metadata)
    else:
        if isinstance(core_node, core.RootNode):
            node = PackageNode(package, metadata)
        elif isinstance(core_node, core.GroupNode):
            node = GroupNode(metadata)
        else:
            assert "Unexpected node: %r" % core_node

        for name, core_child in iteritems(core_node.children):
            child = _from_core_node(package, core_child)
            node[name] = child

    return node


class PackageLoader(object):
    """
    Module loader for Quilt tables.
    """
    def __init__(self, package):
        self._package = package

    def load_module(self, fullname):
        """
        Returns an object that lazily looks up tables and groups.
        """
        mod = sys.modules.get(fullname)
        if mod is not None:
            return mod

        # We're creating an object rather than a module. It's a hack, but it's approved by Guido:
        # https://mail.python.org/pipermail/python-ideas/2012-May/014969.html

        mod = _from_core_node(self._package, self._package.get_contents())
        sys.modules[fullname] = mod
        return mod


class ModuleFinder(object):
    def __init__(self, module, teams):
        self._module_name = module
        self._teams = teams

    """
    Looks up submodules.
    """
    def find_module(self, fullname, path=None):
        """
        Looks up the table based on the module path.
        """
        if not fullname.startswith(self._module_name + '.'):
            # Not a quilt submodule.
            return None

        submodule = fullname[len(self._module_name) + 1:]
        parts = submodule.split('.')

        # Pop the team prefix if this is a team import.
        if self._teams:
            team = parts.pop(0)
        else:
            team = None

        # Handle full paths first.
        if len(parts) == 2:
            pkg = PackageStore.find_package(team, parts[0], parts[1])
            if pkg is not None:
                return PackageLoader(pkg)
            else:
                return None

        # Return fake loaders for partial paths.
        for store_dir in PackageStore.find_store_dirs():
            store = PackageStore(store_dir)

            if len(parts) == 0:
                assert self._teams
                path = store.team_path(team)
            elif len(parts) == 1:
                path = store.user_path(team, parts[0])

            if os.path.isdir(path):
                return FakeLoader(path)

        # Nothing is found.
        return None
