# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

############################################################
# NOTE: This file is shared between compiler and registry. #
# Do not add any client or server specific code here.      #
############################################################

from enum import Enum
import hashlib
import struct

from six import iteritems, itervalues, string_types


LATEST_TAG = 'latest'
README = 'README'


class PackageFormat(Enum):
    HDF5 = 'HDF5'
    PARQUET = 'PARQUET'
    default = PARQUET


class Node(object):
    __slots__ = ('metadata',)

    @property
    @classmethod
    def json_type(cls):
        raise NotImplementedError

    def __init__(self, metadata):
        if metadata is None:
            metadata = {}
        assert isinstance(metadata, dict)
        self.metadata = metadata or {}

    def __eq__(self, other):
        if isinstance(other, self.__class__):
            return self.__json__() == other.__json__()
        return NotImplemented

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash(self.__json__())

    def __json__(self):
        val = {'type': self.json_type}
        if self.metadata:
            # Old clients don't support metadata in groups. If the metadata is empty,
            # let's not include it at all to avoid breaking things unnecessarily.
            # (Groups with actual metadata will still break old clients, though.)
            val['metadata'] = self.metadata
        return val

    def get_children(self):
        return {}

    def preorder(self):
        """
        Iterator that returns all nodes in the tree starting with the current node.
        """
        stack = [self]
        while stack:
            obj = stack.pop()
            yield obj
            stack.extend(itervalues(obj.get_children()))

class GroupNode(Node):
    __slots__ = ('children',)

    json_type = 'GROUP'

    def __init__(self, children, metadata=None):
        super(GroupNode, self).__init__(metadata)
        assert isinstance(children, dict)
        self.children = children

    def get_children(self):
        return self.children

    def __json__(self):
        val = super(GroupNode, self).__json__()
        val['children'] = self.children
        return val

class RootNode(GroupNode):
    __slots__ = ()

    json_type = 'ROOT'

class TableNode(Node):
    __slots__ = ('hashes',)

    json_type = 'TABLE'

    def __init__(self, hashes, format, metadata=None):
        super(TableNode, self).__init__(metadata)

        assert PackageFormat(format) == PackageFormat.PARQUET

        assert isinstance(hashes, list)
        assert isinstance(format, string_types), '%r' % format

        self.hashes = hashes

    def __json__(self):
        val = super(TableNode, self).__json__()
        val['hashes'] = self.hashes
        val['format'] = PackageFormat.PARQUET.value
        return val

class FileNode(Node):
    __slots__ = ('hashes',)

    json_type = 'FILE'

    def __init__(self, hashes, metadata=None):
        super(FileNode, self).__init__(metadata)

        assert isinstance(hashes, list)

        self.hashes = hashes

    def __json__(self):
        val = super(FileNode, self).__json__()
        val['hashes'] = self.hashes
        return val

NODE_TYPE_TO_CLASS = {cls.json_type: cls for cls in [GroupNode, RootNode, TableNode, FileNode]}

def encode_node(node):
    if isinstance(node, Node):
        return node.__json__()
    raise TypeError("Unexpected type: %r" % type(node))

def decode_node(value):
    type_str = value.pop('type', None)
    if type_str is None:
        return value
    node_cls = NODE_TYPE_TO_CLASS[type_str]
    return node_cls(**value)

def hash_contents(contents):
    """
    Creates a hash of key names and hashes in a package dictionary.

    "contents" must be a GroupNode.
    """
    assert isinstance(contents, GroupNode)

    result = hashlib.sha256()

    def _hash_int(value):
        result.update(struct.pack(">L", value))

    def _hash_str(string):
        assert isinstance(string, string_types)
        _hash_int(len(string))
        result.update(string.encode())

    def _hash_object(obj):
        _hash_str(obj.json_type)
        if isinstance(obj, (TableNode, FileNode)):
            hashes = obj.hashes
            _hash_int(len(hashes))
            for hval in hashes:
                _hash_str(hval)
        elif isinstance(obj, GroupNode):
            children = obj.children
            _hash_int(len(children))
            for key, child in sorted(iteritems(children)):
                _hash_str(key)
                _hash_object(child)
        else:
            assert False, "Unexpected object: %r" % obj

    _hash_object(contents)

    return result.hexdigest()

def find_object_hashes(root):
    """
    Iterator that returns hashes of all of the file and table nodes.

    :param root: starting node
    """
    for obj in root.preorder():
        if isinstance(obj, (TableNode, FileNode)):
            for objhash in obj.hashes:
                yield objhash
