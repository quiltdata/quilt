"""
Magic module that maps its submodules to Quilt tables.

Submodules have the following format: quilt.data.$user.$package.$table

E.g.:
  import quilt.data.$user.$package as $package
  print $package.$table
or
  from quilt.data.$user.$package import $table
  print $table

The corresponding data is looked up in `quilt_modules/$user/$package.h5`
in ancestors of the current directory.
"""

import imp
import os.path
import sys

import pandas as pd
from six import iteritems, string_types

from .tools import core
from .tools.store import PackageStore

__path__ = []  # Required for submodules to work

class Node(object):
    """
    Abstract class that represents a group or a leaf node in a package.
    """
    def __init__(self):
        # Can't instantiate it directly
        assert self.__class__ != Node.__class__

    def _class_repr(self):
        """Only exists to make it easier for subclasses to customize `__repr__`."""
        return "<%s>" % self.__class__.__name__

    def __repr__(self):
        return self._class_repr()

class DataNode(Node):
    """
    Represents a dataframe or a file. Allows accessing the contents using `()`.
    """
    def __init__(self, package, node, data=None):
        super(DataNode, self).__init__()
        self._package = package
        self._node = node
        self.__cached_data = data

    def __call__(self):
        return self.data()

    def data(self):
        """
        Returns the contents of the node: a dataframe or a file path.
        """
        if self.__cached_data is None:
            self.__cached_data = self._package.get_obj(self._node)
        return self.__cached_data

class GroupNode(DataNode):
    """
    Represents a group in a package. Allows accessing child objects using the dot notation.
    """

    def __repr__(self):
        pinfo = super(GroupNode, self).__repr__()
        kinfo = '\n'.join(sorted(self._keys()))
        return "%s\n%s" % (pinfo, kinfo)

    def _items(self):
        return ((name, child) for name, child in iteritems(self.__dict__)
                if not name.startswith('_'))

    def _data_keys(self):
        """
        every child key referencing a dataframe
        """
        return [name for name, child in self._items() if not isinstance(child, GroupNode)]

    def data(self):
        """
        Returns the contents of all data-children of this group as a dataframe.
        (Only supported for Parquet packages).
        """
        return self._package.get_obj(self._node)

    def _group_keys(self):
        """
        every child key referencing a group that is not a dataframe
        """
        return [name for name, child in self._items() if isinstance(child, GroupNode)]

    def _keys(self):
        """
        keys directly accessible on this object via getattr or .
        """
        return [name for name in self.__dict__ if not name.startswith('_')]

class PackageNode(GroupNode):
    """
    Represents a package.
    """    

    def _class_repr(self):
        finfo = self._package.get_path()[:-len(PackageStore.PACKAGE_FILE_EXT)]
        return "<%s %r>" % (self.__class__.__name__, finfo)

    def _set(self, path, value):
        assert isinstance(path, list) and len(path) > 0

        if isinstance(value, pd.DataFrame):
            core_node = core.TableNode(hashes=[])
        elif isinstance(value, string_types):
            core_node = core.FileNode(hashes=[])
        else:
            assert False, "Unexpected value: %r" % value

        node = self
        for key in path[:-1]:
            assert not key.startswith('_')
            if hasattr(node, key):
                child = getattr(node, key)
                if not isinstance(child, GroupNode):
                    raise ValueError("Key already %r exists, but is not a group" % key)
            else:
                child = GroupNode(self._package, core.GroupNode({}))
                setattr(node, key, child)

            node = child

        key = path[-1]
        assert not key.startswith('_')
        if hasattr(node, key):
            raise ValueError("Key %r already exists" % key)
        data_node = DataNode(self._package, core_node, value)
        setattr(node, path[-1], data_node)

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
                # find contents
                file_path = os.path.join(store_dir, parts[0])
                if os.path.isdir(file_path):
                    return FakeLoader(file_path)
        elif len(parts) == 2:
            user, package = parts
            pkgobj = PackageStore.find_package(user, package)
            if pkgobj:
                file_path = pkgobj.get_path()
                return PackageLoader(file_path, pkgobj)

        return None

sys.meta_path.append(ModuleFinder)
