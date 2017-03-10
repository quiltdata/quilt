import hashlib
import struct

from six import iteritems, string_types

from .const import HASH_TYPE, NodeType

def digest_file(fname):
    """
    Digest files using SHA-2 (256-bit)
    TESTING
      Produces identical output to `openssl sha256 FILE` for the following:
      * on all source .py files and some binary pyc files in parent dir
      * empty files with different names
      * 3.3GB DNAse Hypersensitive file
      * empty file, file with one space, file with one return all produce
      * distinct output
    PERF takes about 20 seconds to hash 3.3GB file
    on an empty file and on build.py
    INSPIRATION: http://stackoverflow.com/questions/3431825/generating-an-md5-checksum-of-a-file
    WARNING: not clear if we need to pad file bytes for proper cryptographic
      hashing
    """
    #chunk size in bytes
    SIZE = 4096
    h = hashlib.new(HASH_TYPE)
    with open(fname, 'rb') as f:
        for chunk in iter(lambda: f.read(SIZE), b''):
            h.update(chunk)
    return h.hexdigest()

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
