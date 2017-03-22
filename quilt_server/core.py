from enum import Enum
import hashlib
import struct

from six import iteritems, string_types


class PackageFormat(Enum):
    HDF5 = 'HDF5'
    FASTPARQUET = 'FAST_PARQUET'
    ARROW = 'ARROW_PARQUET'
    SPARK = 'SPARK_PARQUET'
    default = HDF5

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

class RootNode(GroupNode):
    json_type = 'ROOT'

    def __init__(self, children, format=PackageFormat.default):
        self.format = PackageFormat(format)
        super(RootNode, self).__init__(children)

class TableNode(Node):
    json_type = 'TABLE'

    def __init__(self, hashes, metadata=None):
        if metadata is None:
            metadata = {}

        assert isinstance(hashes, list)
        assert isinstance(metadata, dict)

        self.hashes = hashes
        self.metadata = metadata

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
    elif isinstance(node, Enum):
        return node.value
    raise TypeError

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
        if isinstance(obj, TableNode) or isinstance(obj, FileNode):
            hashes = obj.hashes
            _hash_int(len(hashes))
            for h in hashes:
                _hash_str(h)
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

def find_object_hashes(contents):
    """
    Iterator that returns hashes of all of the tables.
    """
    for obj in contents.children.values():
        if isinstance(obj, TableNode) or isinstance(obj, FileNode):
            for objhash in obj.hashes:
                yield objhash
        elif isinstance(obj, GroupNode):
            for objhash in find_object_hashes(obj):
                yield objhash
