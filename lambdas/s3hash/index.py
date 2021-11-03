import hashlib
import functools
import urllib.request


def read_file_chunks(fileobj, chunksize=128 * 2 ** 10):
    return iter(functools.partial(fileobj.read, chunksize), b'')


def hash_fileobj(*, fileobj, hashobj_constructor=hashlib.sha256):
    hashobj = hashobj_constructor()
    for chunk in read_file_chunks(fileobj):
        hashobj.update(chunk)
    return hashobj.hexdigest()


def lambda_handler(url, context):
    with urllib.request.urlopen(url) as f:
        return hash_fileobj(fileobj=f)
