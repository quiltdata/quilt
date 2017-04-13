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

from .tools.core import GroupNode
from .tools.package import PackageException
from .tools.store import PackageStore

__path__ = []  # Required for submodules to work

class DataNode(object):
    """
    Represents either the root of the package or a group, similar to nodes
    in HDFStore's `root`.
    """
    def __init__(self, package, prefix=''):
        assert not prefix.endswith('/')

        self._package = package
        self._prefix = prefix
        self._node = self._package.get(self._prefix)

    def __eq__(self, other):
        if isinstance(other, self.__class__):
            return self._package == other._package and self._prefix == other._prefix
        return NotImplemented

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash((self._package, self._prefix))

    def __getattr__(self, name):
        # TODO clean if... up since VALID_NAME_RE no longer allows leading _
        if name.startswith('_'):
            raise AttributeError
        path = self._prefix + '/' + name

        try:
            return DataNode(self._package, path)
        except PackageException:
            raise AttributeError("No such table or group: %s" % path)

    def __repr__(self):
        cinfo = str(self.__class__)
        finfo = 'File: ' + self._package.get_path()
        pinfo = 'Path: ' + self._prefix + ('/' if self._is_group() else '')
        #TODO maybe show all descendant subpaths instead of just children
        groups = sorted(k + '/' for k in self._group_keys())
        dfs = sorted(self._df_keys())
        output = [cinfo, finfo, pinfo] + groups + dfs
        return '\n'.join(output)

    def __dir__(self):
        # https://mail.python.org/pipermail/python-ideas/2011-May/010321.html
        return sorted(set((dir(type(self)) + list(self.__dict__) + self._keys())))

    def _is_group(self):
        return isinstance(self._node, GroupNode)

    def _is_df(self):
        return not isinstance(self._node, GroupNode)

    def _df(self):
        assert not isinstance(self._node, GroupNode)
        return self._package.get_obj(self._node)

    def _df_keys(self):
        """
        every child key referencing a dataframe
        """
        pref = self._prefix + '/'
        return [k for k in self._keys()
                if not isinstance(self._package.get(pref + k), GroupNode)]

    def _group_keys(self):
        """
        every child key referencing a group that is not a dataframe
        """
        pref = self._prefix + '/'
        return [k for k in self._keys()
                if isinstance(self._package.get(pref + k), GroupNode)]

    def _keys(self):
        """
        keys directly accessible on this object via getattr or .
        """
        if not self._is_group():
            return []
        return list(self._node.children)


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

        mod = DataNode(self._package)
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
