# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

############################################################
# NOTE: This file is shared between compiler and registry. #
# Do not add any client or server specific code here.      #
############################################################

from enum import Enum
import hashlib
import os
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

class GroupNode(Node):
    json_type = 'GROUP'

    def __init__(self, children):
        assert isinstance(children, dict)
        self.children = children

    def preorder(self):
        """
        Performs a pre-order walk of the package tree starting at this node.
        It returns a list of the nodes in the order visited.
        """
        stack = [self]
        output = []

        while stack:
            node = stack.pop()
            for child in itervalues(node.children):
                output.append(child)
                if isinstance(child, GroupNode):
                    stack.append(child)
        return output

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

class FileNode(Node):
    json_type = 'FILE'

    def __init__(self, hashes, metadata=None):
        if metadata is None:
            metadata = {}

        assert isinstance(hashes, list)
        assert isinstance(metadata, dict)

        self.hashes = hashes
        self.metadata = metadata

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

def find_object_hashes(obj):
    """
    Iterator that returns hashes of all of the tables.
    """
    if isinstance(obj, (TableNode, FileNode)):
        for objhash in obj.hashes:
            yield objhash
    elif isinstance(obj, GroupNode):
        for child in itervalues(obj.children):
            for objhash in find_object_hashes(child):
                yield objhash
