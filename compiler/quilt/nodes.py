"""
Nodes that represent the data in a Quilt package.
"""

import pandas as pd
from six import iteritems, string_types

from .tools import core
from .tools.util import is_nodename


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

    def __setattr__(self, name, value):
        if name.startswith('_') or isinstance(value, Node):
            super(Node, self).__setattr__(name, value)
        else:
            raise AttributeError("{val} is not a valid package node".format(val=value))

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
        return self._data()

    @property
    def _filename(self):
        if isinstance(self._node, core.FileNode):
            return self._data()

    def _data(self):
        """
        Returns the contents of the node: a dataframe or a file path.
        """
        if self.__cached_data is None:
            self.__cached_data = self._package.get_obj(self._node)
        return self.__cached_data

class GroupNode(DataNode):
    """
    Represents a group in a package. Allows accessing child objects using the dot notation.
    Warning: calling _data() on a large dataset may exceed local memory capacity in Python (Only
    supported for Parquet packages).
    """

    def __repr__(self):
        pinfo = super(GroupNode, self).__repr__()
        group_info = '\n'.join(name + '/' for name in sorted(self._group_keys()))
        if group_info:
            group_info = group_info + '\n'
        data_info = '\n'.join(sorted(self._data_keys()))
        return '%s\n%s%s' % (pinfo, group_info, data_info)

    def _items(self):
        return ((name, child) for name, child in iteritems(self.__dict__)
                if not name.startswith('_'))

    def _data_keys(self):
        """
        every child key referencing a dataframe
        """
        return [name for name, child in self._items() if not isinstance(child, GroupNode)]

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

    def _add_group(self, groupname):
        child = GroupNode(self._package, core.GroupNode({}))
        setattr(self, groupname, child)

    @classmethod
    def __iterpaths(cls, base_path, node):
        assert isinstance(base_path, list)
        assert isinstance(node, GroupNode)

        for name, child_node in node._items():
            if isinstance(child_node, GroupNode):
                for path in cls.__iterpaths(base_path + [name], child_node):
                    yield path
            elif isinstance(child_node, DataNode):
                yield base_path + [name]

    def _iterpaths(self):
        """
        Iterates paths in this and all child nodes

        :returns: list of path lists
        """
        return self.__iterpaths([], self)


class PackageNode(GroupNode):
    """
    Represents a package.
    """

    def _class_repr(self):
        finfo = self._package.get_path()
        return "<%s %r>" % (self.__class__.__name__, finfo)

    def _set(self, path, value):
        assert isinstance(path, list) and len(path) > 0

        if isinstance(value, pd.DataFrame):
            # all we really know at this point is that it's a pandas dataframe.
            metadata = {'q_target': 'pandas'}
            core_node = core.TableNode(hashes=[], format=core.PackageFormat.default.value, metadata=metadata)
        elif isinstance(value, string_types + (bytes,)):
            # bytes -> string for consistency when retrieving metadata
            value = value.decode() if isinstance(value, bytes) else value

            # q_ext blank, as it's for formats loaded as DataFrames, and the path is stored anyways.
            metadata = {'q_path': value, 'q_target': 'file', 'q_ext': ''}
            core_node = core.FileNode(hashes=[], metadata=metadata)
        else:
            accepted_types = (pd.DataFrame, bytes) + string_types
            raise TypeError("Bad value type: Expected instance of any type {!r}, but received type {!r}"
                            .format(accepted_types, type(value)), repr(value)[0:100])

        for key in path:
            if not is_nodename(key):
                raise ValueError("Invalid name for node: {}".format(key))

        node = self
        for key in path[:-1]:
            child = getattr(node, key, None)
            if not isinstance(child, GroupNode):
                child = GroupNode(self._package, core.GroupNode({}))
                setattr(node, key, child)

            node = child

        key = path[-1]
        data_node = DataNode(self._package, core_node, value)
        setattr(node, key, data_node)
