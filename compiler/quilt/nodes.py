"""
Nodes that represent the data in a Quilt package.
"""
import os

import pandas as pd
from six import iteritems, string_types

from .tools.const import PRETTY_MAX_LEN
from .tools.util import is_nodename


class Node(object):
    """
    Abstract class that represents a group or a leaf node in a package.
    """
    def __init__(self, meta):
        # Can't instantiate it directly
        assert self.__class__ != Node.__class__
        assert meta is not None
        self._meta = meta

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

    def __call__(self):
        return self._data()

    def _data(self):
        raise NotImplementedError

class DataNode(Node):
    pass

class SerializedDataNode(DataNode):
    """
    Represents a dataframe or a file with data in the package store.
    """
    def __init__(self, package, node, meta):
        super(SerializedDataNode, self).__init__(meta)
        assert package is not None
        assert node is not None

        self._package = package
        self._node = node
        self.__cached_data = None

    def _data(self):
        """
        Returns the contents of the node: a dataframe or a file path.
        """
        if self.__cached_data is None:
            self.__cached_data = self._package.get_obj(self._node)
        return self.__cached_data

class InMemoryDataNode(DataNode):
    """
    Represents a newly-created dataframe or a file that's not backed by the package store.
    """
    def __init__(self, data, meta):
        super(InMemoryDataNode, self).__init__(meta)
        assert data is not None
        self.__data = data

    def _data(self):
        """
        Returns the contents of the node: a dataframe or a file path.
        """
        return self.__data

class GroupNode(Node):
    """
    Represents a group in a package. Allows accessing child objects using the dot notation.
    Warning: calling _data() on a large dataset may exceed local memory capacity in Python (Only
    supported for Parquet packages).
    """
    def __init__(self, package, node, meta):
        super(GroupNode, self).__init__(meta)

        self._package = package
        self._node = node

    def __repr__(self):
        pinfo = super(GroupNode, self).__repr__()
        items = [name + '/' for name in sorted(self._group_keys())]
        if items:
            items.append('\n')
        items += sorted(self._data_keys())
        # strip last new line if needed
        if items[-1] == '\n':
            items.pop()
        # compare with + 1 helps to prevent hide under '...' only one item
        if len(items) > PRETTY_MAX_LEN + 1:
            preview = PRETTY_MAX_LEN // 2
            items = items[:preview] + ['\n...\n'] + items[-preview:]
        data_info = '\n'.join(items)
        return '%s\n%s' % (pinfo, data_info)

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
        child = GroupNode(None, None, {'custom': {}})
        setattr(self, groupname, child)

    def _data(self):
        """
        Merges the contents of the child dataframes.
        """
        if self._package is None or self._node is None:
            raise NotImplementedError

        # XXX: This is wrong! The group could've been modified after the package was loaded.
        return self._package.get_obj(self._node)

class PackageNode(GroupNode):
    """
    Represents a package.
    """

    def _class_repr(self):
        finfo = self._package.get_path()
        return "<%s %r>" % (self.__class__.__name__, finfo)

    def _set(self, path, value, build_dir=''):
        """Create and set a node by path

        This creates a node from a filename or pandas DataFrame.

        If `value` is a filename, it must be relative to `build_dir`.
            `value` is stored as the export path.

        `build_dir` defaults to the current directory, but may be any
            arbitrary directory path, including an absolute path.

        Example:
            # Set `pkg.graph_image` to the data in '/home/user/bin/graph.png'.
            # If exported, it would export to '<export_dir>/bin/graph.png'
            `pkg._set(['graph_image'], 'bin/fizz.bin', '/home/user')`

        :param path:  Path list -- I.e. ['examples', 'new_node']
        :param value:  Pandas dataframe, or a filename relative to build_dir
        :param build_dir:  Directory containing `value` if value is a filename.
        """
        assert isinstance(path, list) and len(path) > 0

        if isinstance(value, pd.DataFrame):
            # all we really know at this point is that it's a pandas dataframe.
            metadata = {}
        elif isinstance(value, string_types + (bytes,)):
            # bytes -> string for consistency when retrieving metadata
            value = value.decode() if isinstance(value, bytes) else value
            if os.path.isabs(value):
                raise ValueError("Invalid path: expected a relative path, but received {!r}".format(value))
            # Security: filepath does not and should not retain the build_dir's location!
            metadata = {'filepath': value, 'transform': 'id'}
            if build_dir:
                value = os.path.join(build_dir, value)
        else:
            accepted_types = tuple(set((pd.DataFrame, bytes) + string_types))
            raise TypeError("Bad value type: Expected instance of any type {!r}, but received type {!r}"
                            .format(accepted_types, type(value)), repr(value)[0:100])

        for key in path:
            if not is_nodename(key):
                raise ValueError("Invalid name for node: {}".format(key))

        node = self
        for key in path[:-1]:
            child = getattr(node, key, None)
            if not isinstance(child, GroupNode):
                child = GroupNode(None, None, {})
                setattr(node, key, child)

            node = child

        key = path[-1]
        data_node = InMemoryDataNode(value, metadata)
        setattr(node, key, data_node)
