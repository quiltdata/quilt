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
    @property
    @classmethod
    def json_type(cls):
        raise NotImplementedError

    def __eq__(self, other):
        if isinstance(other, self.__class__):
            return self.__dict__ == other.__dict__
        return NotImplemented

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash(self.__dict__)

    def __json__(self):
        return dict(self.__dict__, type=self.json_type)

    def get_children(self):
        raise NotImplementedError

    def find_all_nodes(self, sort=False):
        """
        Iterator that returns all nodes in the tree starting with the current node.

        :param sort: within each group, sort child nodes by name
        """
        stack = [self]
        while stack:
            obj = stack.pop()
            yield obj
            if sort:
                stack.extend(child for name, child in sorted(iteritems(obj.get_children()), reverse=True))
            else:
                stack.extend(itervalues(obj.get_children()))

class GroupNode(Node):
    json_type = 'GROUP'

    def __init__(self, children):
        assert isinstance(children, dict)
        self.children = children

    def get_children(self):
        return self.children

class RootNode(GroupNode):
    json_type = 'ROOT'

class TableNode(Node):
    json_type = 'TABLE'

    def __init__(self, hashes, format, metadata=None):
        if metadata is None:
            metadata = {}

        assert isinstance(hashes, list)
        assert isinstance(format, string_types), '%r' % format
        assert isinstance(metadata, dict)

        self.hashes = hashes
        self.format = PackageFormat(format)
        self.metadata = metadata

    def __json__(self):
        val = super(TableNode, self).__json__()
        val['format'] = self.format.value
        return val

    def get_children(self):
        return {}

class FileNode(Node):
    json_type = 'FILE'

    def __init__(self, hashes, metadata=None):
        if metadata is None:
            metadata = {}

        assert isinstance(hashes, list)
        assert isinstance(metadata, dict)

        self.hashes = hashes
        self.metadata = metadata

    def children(self):
        return {}

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

def find_object_hashes(root, sort=False):
    """
    Iterator that returns hashes of all of the file and table nodes.

    :param root: starting node
    :param sort: within each group, sort child nodes by name
    """
    for obj in root.find_all_nodes(sort=sort):
        if isinstance(obj, (TableNode, FileNode)):
            for objhash in obj.hashes:
                yield objhash
