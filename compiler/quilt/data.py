"""
Magic module that maps its submodules to Quilt tables.

Submodules have the following format: quilt.data.$user.$package.$table

E.g.:
  import quilt.data.$user.$package as $package
  print $package.$table
or
  from quilt.data.$user.$package import $table
  print $table

The corresponding data is looked up in `quilt_modules/$user/$package.json`
in ancestors of the current directory.
"""

import imp
import os.path
import sys

from six import iteritems

from .nodes import DataNode, GroupNode, PackageNode
from .tools import core
from .tools.store import PackageStore


__path__ = []  # Required for submodules to work


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
    def __init__(self, path, package):
        self._path = path
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
    """
    Looks up submodules.
    """
    @staticmethod
    def find_module(fullname, path=None):
        """
        Looks up the table based on the module path.
        """
        if not fullname.startswith(__name__ + '.'):
            # Not a quilt submodule.
            return None

        submodule = fullname[len(__name__) + 1:]
        parts = submodule.split('.')

        if len(parts) == 1:
            for store_dir in PackageStore.find_store_dirs():
                store = PackageStore(store_dir)
                # parts[0] could be a username (Quilt public registry) or a team name (other registry)
                team_path = store.team_path(parts[0])
                user_path = store.user_path(None, parts[0])
                if os.path.isdir(team_path):
                    return FakeLoader(team_path)
                elif os.path.isdir(user_path):
                    return FakeLoader(user_path)
                else:
                    raise ImportError('Could not find any installed packages by user or team {user!r}.\n  '
                                      'Check the name, or use "quilt install {user}/<packagename>" to install'
                                      .format(user=parts[0]))
        elif len(parts) == 2:
            # Try Default Case: Quilt Public Cloud Registry
            for store_dir in PackageStore.find_store_dirs():
                user, package = parts
                store = PackageStore(store_dir)
                pkgobj = PackageStore.find_package(None, user, package)
                if pkgobj:
                    file_path = pkgobj.get_path()
                    return PackageLoader(file_path, pkgobj)

                # Try A Team/Other-Registry Path
                team, user = parts
                user_path = store.user_path(team, user)
                if os.path.isdir(user_path):
                    return FakeLoader(user_path)

            raise ImportError('Could not find package.\n  '
                              'Check the name, or use "quilt install {user1}/{package}" or\n'
                              '"quilt install {team}:{user2}/<packagename>" to install'
                              .format(user1=parts[0], team=parts[0], user2=parts[1], package=parts[1]))
        elif len(parts) == 3:
            for store_dir in PackageStore.find_store_dirs():
                store = PackageStore(store_dir)
                team, user, package = parts
                pkgobj = PackageStore.find_package(team, user, package)
                if pkgobj:
                    file_path = pkgobj.get_path()
                    return PackageLoader(file_path, pkgobj)
                else:
                    raise ImportError('Could not find any installed packages by user {user!r}.\n  '
                                      'Check the name, or use "quilt install {team}:{user}/{package}" to install'
                                      .format(team=parts[0], user=parts[1], package=parts[2]))
        return None

sys.meta_path.append(ModuleFinder)
