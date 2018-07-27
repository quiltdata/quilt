# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

############################################################
# NOTE: This file is shared between compiler and registry. #
# Do not add any client or server specific code here.      #
############################################################

from enum import Enum
import hashlib
import struct

from six import iteritems, itervalues, string_types

from .compat import pathlib
from .const import TargetType
from .util import is_nodename

LATEST_TAG = 'latest'
README = 'README'


class PackageFormat(Enum):
    HDF5 = 'HDF5'
    PARQUET = 'PARQUET'
    default = PARQUET


class Node(object):
    __slots__ = ('metadata_hash',)

    @property
    @classmethod
    def json_type(cls):
        raise NotImplementedError

    def __init__(self, metadata_hash):
        assert metadata_hash is None or isinstance(metadata_hash, string_types)
        self.metadata_hash = metadata_hash

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
        if self.metadata_hash is not None:
            # For backwards compatibility, only store metadata_hash if it's set, to avoid
            # breaking old clients unnecessarily.
            val['metadata_hash'] = self.metadata_hash
        return val

    def get_children(self):
        return {}

    def get_hash(self):
        return hash_contents(self)

class GroupNode(Node):
    __slots__ = ('children',)

    json_type = 'GROUP'

    def __init__(self, children, metadata_hash=None):
        super(GroupNode, self).__init__(metadata_hash)
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

    def __getitem__(self, item):
        """Get a (core) node from this package.

        Usage:
            p['item']
            p['path/item']

        :param item: Node name or path, as in "node" or "node/subnode".
        """
        node = self
        path = pathlib.PurePosixPath(item)

        # checks
        if not item:    # No blank node names.
            raise TypeError("Invalid node reference: Blank node names not permitted.")
        if path.anchor:
            raise TypeError("Invalid node reference: Absolute path.  Remove prefix {!r}".format(path.anchor))

        try:
            count = 0
            for part in path.parts:
                if not is_nodename(part):
                    raise TypeError("Invalid node name: {!r}".format(part))
                node = node.children[part]
                count += 1
            return node
        except KeyError:
            traversed = '/'.join(path.parts[:count])
            raise KeyError(traversed, path.parts[count])
        except AttributeError:
            traversed = '/'.join(path.parts[:count])
            raise TypeError("Not a GroupNode: Node at {!r}".format(traversed))

    def __contains__(self, item):
        """Check package contains a specific node name or node path.

        Usage:
            'item' in p
            'path/item' in p

        :param item: Node name or path, as in "node" or "node/subnode".
        """
        try:
            self[item]  #pylint: disable=W0104
            return True
        except (KeyError, TypeError):
            return False


    def add(self, node_path, hashes, target, source_path, transform, user_meta_hash):
        """
        Adds an object (name-hash mapping) or group to package contents.
        """
        assert isinstance(node_path, list)
        assert user_meta_hash is None or isinstance(user_meta_hash, str)
        
        contents = self
        
        if not node_path:
            # Allow setting metadata on the root node, but that's it.
            assert target is TargetType.GROUP
            contents.metadata_hash = user_meta_hash
            return

        ptr = contents
        for node in node_path[:-1]:
            ptr = ptr.children[node]

        metadata = dict(
            q_ext=transform,
            q_path=source_path,
            q_target=target.value
        )

        if target is TargetType.GROUP:
            node = GroupNode(dict())
        else:
            node = FileNode(
                hashes=hashes,
                metadata=dict(
                    q_ext=transform,
                    q_path=source_path,
                    q_target=target.value
                ),
                metadata_hash=user_meta_hash
            )

        ptr.children[node_path[-1]] = node


class TableNode(Node):
    __slots__ = ('hashes', 'metadata')

    json_type = 'TABLE'

    def __init__(self, hashes, format, metadata=None, metadata_hash=None):
        super(TableNode, self).__init__(metadata_hash)

        assert PackageFormat(format) == PackageFormat.PARQUET

        assert isinstance(hashes, list)
        assert isinstance(format, string_types), '%r' % format

        self.hashes = hashes
        self.metadata = metadata or {}

    def __json__(self):
        val = super(TableNode, self).__json__()
        val['hashes'] = self.hashes
        val['metadata'] = self.metadata
        val['format'] = PackageFormat.PARQUET.value
        return val


class FileNode(Node):
    __slots__ = ('hashes', 'metadata')

    json_type = 'FILE'

    def __init__(self, hashes, metadata=None, metadata_hash=None):
        super(FileNode, self).__init__(metadata_hash)

        assert isinstance(hashes, list)

        self.hashes = hashes
        self.metadata = metadata or {}

    def __json__(self):
        val = super(FileNode, self).__json__()
        val['hashes'] = self.hashes
        val['metadata'] = self.metadata
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

        # Backward compatibility: only hash metadata_hash if it's present.
        if obj.metadata_hash is not None:
            _hash_str(obj.metadata_hash)

    _hash_object(contents)

    return result.hexdigest()

def find_object_hashes(root, meta_only=False):
    """
    Iterator that returns hashes of all of the file and table nodes.

    :param root: starting node
    """
    stack = [root]
    while stack:
        obj = stack.pop()
        if not meta_only and isinstance(obj, (TableNode, FileNode)):
            for objhash in obj.hashes:
                yield objhash
        stack.extend(itervalues(obj.get_children()))
        if obj.metadata_hash is not None:
            yield obj.metadata_hash
