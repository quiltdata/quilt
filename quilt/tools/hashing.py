import hashlib
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
