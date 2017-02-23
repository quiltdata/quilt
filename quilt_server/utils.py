"""
Helper functions.
"""

import hashlib
import struct

def hash_contents(contents):
    """
    Hashes a dictionary of object names and hash lists.

    Expected format:

    {
        "object1": ["hash1", "hash2", ...],
        "object2": [...],
        ...
    }
    """
    assert isinstance(contents, dict)

    result = hashlib.sha256()

    def hash_len(obj):
        result.update(struct.pack(">L", len(obj)))

    def hash_str(string):
        hash_len(string)
        result.update(string.encode())

    hash_len(contents)
    for key, hash_list in sorted(contents.items()):
        assert isinstance(key, str)
        assert isinstance(hash_list, list)
        hash_str(key)
        hash_len(hash_list)
        for h in hash_list:
            assert isinstance(h, str)
            hash_str(h)

    return result.hexdigest()
