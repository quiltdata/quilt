import hashlib
import struct
from .const import HASH_TYPE, NodeType, TYPE_KEY

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
        if obj_type is NodeType.TABLE:
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
