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
from difflib import get_close_matches

from .nodes import DataNode, GroupNode, PackageNode
from .tools import core
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
    if isinstance(core_node, core.TableNode) or isinstance(core_node, core.FileNode):
        node = DataNode(package, core_node)
    else:
        if isinstance(core_node, core.RootNode):
            node = PackageNode(package, core_node)
        elif isinstance(core_node, core.GroupNode):
            node = GroupNode(package, core_node)
        else:
            assert "Unexpected node: %r" % core_node

        for name, core_child in iteritems(core_node.children):
            child = _from_core_node(package, core_child)
            setattr(node, name, child)

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

        dirs = []
        # Return fake loaders for partial paths.
        for store_dir in PackageStore.find_store_dirs():
            store = PackageStore(store_dir)

            # append all dirs for matching
            dirs += [d for d in os.listdir(store_dir) if os.path.isdir(os.path.join(store_dir, d))]

            if len(parts) == 0:
                assert self._teams
                path = store.team_path(team)
            elif len(parts) == 1:
                path = store.user_path(team, parts[0])

            if os.path.isdir(path):
                return FakeLoader(path)

        # make a guess in case of typo
        # e.g. user typed 'pakcage' instead of 'package'
        guess = get_close_matches(parts[0], dirs, n=1)
        if guess:
            raise ValueError('"%s" not found. Did you mean %s?' % (parts[0], guess))
        else:
            # Nothing is found.
            raise ValueError('Not found. Do you need to `quilt install %s`?' % submodule)
