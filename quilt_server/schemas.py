"""
Definition of the package schema, helper functions, etc.
"""

from enum import Enum
import hashlib
import struct


class NodeType(Enum):
    GROUP = 'GROUP'
    TABLE = 'TABLE'
    FILE = 'FILE'

TYPE_KEY = "$type"

SHA256_PATTERN = r'[0-9a-f]{64}'

PACKAGE_SCHEMA = {
    'type': 'object',
    'properties': {
        'description': {
            'type': 'string'
        },
        'contents': {
            'type': 'object',
            'additionalProperties': {
                'type': 'object',
                'oneOf': [
                    {
                        'properties': {
                            TYPE_KEY: {
                                'enum': [NodeType.TABLE.value, NodeType.FILE.value]
                            },
                            'metadata': {
                                'type': 'object'
                            },
                            'hashes': {
                                'type': 'array',
                                'items': {
                                    'type': 'string',
                                    'pattern': SHA256_PATTERN
                                }
                            }
                        },
                        'required': [TYPE_KEY, 'hashes'],
                        'additionalProperties': False,
                    },
                    {
                        'properties': {
                            TYPE_KEY: {
                                'enum': [NodeType.GROUP.value]
                            }
                        },
                        'required': [TYPE_KEY],
                        'additionalProperties': {
                            '$ref': '#/properties/contents/additionalProperties'
                        }
                    }
                ]
            }
        }
    },
    'required': ['description', 'contents'],
    'additionalProperties': False,
}

def hash_contents(contents):
    """
    Creates a hash of key names and hashes in a dictionary matching
    the "contents" in `PACKAGE_SCHEMA` above. "metadata" fields are ignored.

    Expected format:

    {
        "table1": {
            "$type": "TABLE",
            "metadata": {...},
            "hashes": ["hash1", "hash2", ...]
        }
        "group1": {
            "$type": "GROUP",
            "table2": {
                ...
            },
            "group2": {
                ...
            },
            ...
        },
        ...
    }
    """
    assert isinstance(contents, dict)

    result = hashlib.sha256()

    def hash_int(value):
        result.update(struct.pack(">L", value))

    def hash_str(string):
        hash_int(len(string))
        result.update(string.encode())

    def hash_object(obj):
        assert isinstance(obj, dict)
        obj_type = NodeType(obj[TYPE_KEY])
        hash_str(obj_type.value)
        if obj_type is NodeType.TABLE or obj_type is NodeType.FILE:
            hashes = obj["hashes"]
            hash_int(len(hashes))
            for h in hashes:
                assert isinstance(h, str)
                hash_str(h)
        elif obj_type is NodeType.GROUP:
            hash_int(len(obj) - 1)  # Skip the "$type"
            for key, child in sorted(obj.items()):
                assert isinstance(key, str)
                if key != TYPE_KEY:
                    hash_str(key)
                    hash_object(child)
        else:
            assert False

    hash_int(len(contents))
    for key, obj in sorted(contents.items()):
        assert isinstance(key, str)
        hash_object(obj)

    return result.hexdigest()

def find_object_hashes(contents):
    """
    Iterator that returns hashes of all of the tables.
    """
    for key, obj in contents.items():
        if key == TYPE_KEY:
            continue
        obj_type = NodeType(obj[TYPE_KEY])
        if obj_type is NodeType.TABLE or obj_type is NodeType.FILE:
            yield from obj["hashes"]
        elif obj_type is NodeType.GROUP:
            yield from find_object_hashes(obj)
