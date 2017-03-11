from enum import Enum
import hashlib
import struct

from six import iteritems, string_types

class NodeType(Enum):
    GROUP = 'GROUP'
    TABLE = 'TABLE'
    FILE = 'FILE'

def hash_contents(contents):
    """
    Creates a hash of key names and hashes in a package dictionary.

    Expected format:

    {
        "type": "GROUP",
        "children": {
            "table1": {
                "type": "TABLE",
                "metadata": {...},
                "hashes": ["hash1", "hash2", ...]
            }
            "group1": {
                "type": "GROUP",
                "children": {
                    "table2": {
                        ...
                    },
                    "group2": {
                        ...
                    },
                    ...
                }
            },
            ...
        }
    }
    """
    assert isinstance(contents, dict)
    assert NodeType(contents["type"]) is NodeType.GROUP

    result = hashlib.sha256()

    def _hash_int(value):
        result.update(struct.pack(">L", value))

    def _hash_str(string):
        assert isinstance(string, string_types)
        _hash_int(len(string))
        result.update(string.encode())

    def _hash_object(obj):
        assert isinstance(obj, dict), "Unexpected object: %r" % obj
        obj_type = NodeType(obj["type"])
        _hash_str(obj_type.value)
        if obj_type is NodeType.TABLE or obj_type is NodeType.FILE:
            hashes = obj["hashes"]
            _hash_int(len(hashes))
            for h in hashes:
                _hash_str(h)
        elif obj_type is NodeType.GROUP:
            children = obj["children"]
            assert isinstance(children, dict)
            _hash_int(len(children))
            for key, child in sorted(iteritems(children)):
                _hash_str(key)
                _hash_object(child)
        else:
            assert False, "Unexpected object type: %s" % obj_type

    _hash_object(contents)

    return result.hexdigest()
