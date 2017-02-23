import hashlib
import struct
from .const import HASH_TYPE

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
    Hashes a dictionary of object names and hash lists.
    
    Expected format:
    
    {
        "object1": ["hash1", "hash2", ...],
        "object2": [...],
        ...
    }
    """
    assert isinstance(contents, dict), "WTF? %s %s" % (type(contents), contents)

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
