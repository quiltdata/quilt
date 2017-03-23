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
from .tools.store import PackageStore

__path__ = []  # Required for submodules to work

class DataNode(object):
    """
    Represents either the root of the package or a group, similar to nodes
    in HDFStore's `root`.
    """
    def __init__(self, package, prefix=''):
        self._prefix = prefix
        self._package = package

    def __getattr__(self, name):
        # TODO clean if... up since VALID_NAME_RE no longer allows leading _
        if name.startswith('_'):
            raise AttributeError
        path = self._prefix + '/' + name
        return self._get_package_obj(path)

    def __repr__(self):
        cinfo = str(self.__class__)
        finfo = 'File: ' + self._package.get_path()
        pinfo = 'Path: ' + self._prefix + '/'
        #TODO maybe show all descendant subpaths instead of just children
        groups = sorted(k + '/' for k in self._groups())
        dfs = sorted(self._dfs())
        output = [cinfo, finfo, pinfo] + groups + dfs
        return '\n'.join(output)

    def _dfs(self):
        """
        every child key referencing a dataframe
        """
        pref = self._prefix + '/'
        return [k for k in self._keys()
                if not isinstance(self._get_package_obj(pref + k), DataNode)]

    def _get_package_obj(self, path):
        try:
            obj = self._package.get(path)
        except KeyError:
            # No such group or table
            raise AttributeError("No such table or group: %s" % path)

        if isinstance(obj, GroupNode):
            return DataNode(self._package, path)
        else:
            return obj

    def _groups(self):
        """
        every child key referencing a group that is not a dataframe
        """
        pref = self._prefix + '/'
        return [k for k in self._keys()
                if isinstance(self._get_package_obj(pref + k), DataNode)]

    def _keys(self):
        """
        keys directly accessible on this object via getattr or .
        """
        group = self._package.get(self._prefix)
        assert isinstance(group, GroupNode), "{type} {grp}".format(type=type(group), grp=group)
        return group.children.keys()


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
        store = PackageStore()
        if not fullname.startswith(__name__ + '.'):
            # Not a quilt submodule.
            return None

        submodule = fullname[len(__name__) + 1:]
        parts = submodule.split('.')

        if len(parts) == 1:
            for package_dir in store.find_package_dirs():
                # find contents
                file_path = os.path.join(package_dir, parts[0])
                if os.path.isdir(file_path):
                    return FakeLoader(file_path)
        elif len(parts) == 2:
            user, package = parts
            pkgobj = store.get_package(user, package)
            if pkgobj:
                file_path = pkgobj.get_path()
                return PackageLoader(file_path, pkgobj)

        return None

sys.meta_path.append(ModuleFinder)
