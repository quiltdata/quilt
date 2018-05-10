"""
Nodes that represent the data in a Quilt package.
"""
import os

import pandas as pd
from six import iteritems, string_types

from .tools import core
from .tools.const import PRETTY_MAX_LEN
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

    def __call__(self):
        return self._data()

    def _data(self):
        raise NotImplementedError


class DataNode(Node):
    """
    Represents a dataframe or a file. Allows accessing the contents using `()`.
    """
    def __init__(self, package, node, data=None):
        super(DataNode, self).__init__()
        self._package = package
        self._node = node
        self.__cached_data = data

    def _data(self):
        """
        Returns the contents of the node: a dataframe or a file path.
        """
        if self.__cached_data is None:
            # TODO(dima): Temporary code.
            store = self._package.get_store()
            if isinstance(self._node, core.TableNode):
                self.__cached_data = store.load_dataframe(self._node.hashes)
            elif isinstance(self._node, core.FileNode):
                self.__cached_data = store.get_file(self._node.hashes)
            else:
                assert False
        return self.__cached_data


class GroupNode(Node):
    """
    Represents a group in a package. Allows accessing child objects using the dot notation.
    Warning: calling _data() on a large dataset may exceed local memory capacity in Python (Only
    supported for Parquet packages).
    """
    def __init__(self):
        super(GroupNode, self).__init__()

    def __setattr__(self, name, value):
        if name.startswith('_') or isinstance(value, Node):
            super(Node, self).__setattr__(name, value)
        else:
            raise AttributeError("{val} is not a valid package node".format(val=value))

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
        child = GroupNode()
        setattr(self, groupname, child)

    def _data(self):
        """
        Merges all child dataframes. Only works for dataframes stored on disk - not in memory.
        """
        store = None
        hash_list = []
        stack = [self]
        while stack:
            node = stack.pop()
            if isinstance(node, GroupNode):
                stack.extend(child for _, child in sorted(node._items(), reverse=True))
            else:
                if not isinstance(node._node, core.TableNode):
                    raise ValueError("Group contains non-dataframe nodes")
                if not node._node.hashes:
                    raise NotImplementedError("Can only merge built dataframes. Build this package and try again.")
                node_store = node._package.get_store()
                if store is None:
                    store = node_store
                elif node_store is not store:
                    raise NotImplementedError("Can only merge dataframes from the same store")
                hash_list += node._node.hashes

        if not hash_list:
            return None

        return store.load_dataframe(hash_list)


class PackageNode(GroupNode):
    """
    Represents a package.
    """
    def __init__(self, package):
        super(PackageNode, self).__init__()
        self._package = package

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
            metadata = {'q_target': 'pandas'}
            core_node = core.TableNode(hashes=[], format=core.PackageFormat.default.value, metadata=metadata)
        elif isinstance(value, string_types + (bytes,)):
            # bytes -> string for consistency when retrieving metadata
            value = value.decode() if isinstance(value, bytes) else value
            if os.path.isabs(value):
                raise ValueError("Invalid path: expected a relative path, but received {!r}".format(value))
            # q_ext blank, as it's for formats loaded as DataFrames, and the path is stored anyways.
            # Security: q_path does not and should not retain the build_dir's location!
            metadata = {'q_path': value, 'q_target': 'file', 'q_ext': ''}
            core_node = core.FileNode(hashes=[], metadata=metadata)
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
                child = GroupNode()
                setattr(node, key, child)

            node = child

        key = path[-1]
        data_node = DataNode(self._package, core_node, value)
        setattr(node, key, data_node)
