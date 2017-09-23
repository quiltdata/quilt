import os.path
from os import makedirs

from OpenSSL.crypto import (dump_privatekey, dump_publickey, FILETYPE_PEM, load_privatekey,
                            load_publickey, PKey, sign, TYPE_RSA, verify, X509)

from .const import HASH_TYPE, RSA_BITS
from .util import BASE_DIR, file_to_str

def gen_rsa():
    """
    Generate an RSA Key Pair for digital signature
    this is designed to be called once per user
    TODO maybe this belongs in server-specific code since server will 
    need to know public and private keys
    """
    pkey = PKey()
    pkey.generate_key(TYPE_RSA, RSA_BITS)
    pkey.check()
    return pkey

PATH = os.path.join(BASE_DIR, 'keys')
PUB_KEY = os.path.join(PATH, 'public.pem')
PRI_KEY = os.path.join(PATH, 'private.pem')
def to_pem_files(pkey, path=PATH):
    """
    Dump an RSA key pair to PEM files at the specified path
    """
    if has_public_key() or has_private_key():
        raise Exception('RSA_KEYS_EXIST', 'Refusing to overwrite') 
    else:
        # create directories if needed
        if not os.path.exists(path):
            makedirs(path)
        # write public key
        with open(PUB_KEY, 'w+') as pubfile:
            pubfile.write(dump_publickey(FILETYPE_PEM, pkey).decode('utf-8'))
        # write private key
        with open(PRI_KEY, 'w+') as prifile:
            prifile.write(dump_privatekey(FILETYPE_PEM, pkey).decode('utf-8'))

def has_private_key(path=PRI_KEY):
    """
    does private key exist
    """
    return os.path.exists(path)

def has_public_key(path=PUB_KEY):
    """
    does public key exist
    """
    return os.path.exists(path)

def read_private_pem(path):
    """
    PRE path points to a valid .pem file
    """
    return load_privatekey(FILETYPE_PEM, file_to_str(path))

def read_public_pem(path):
    """
    PRE path points to a valid .pem file
    """
    return load_publickey(FILETYPE_PEM, file_to_str(path))

def sign_str(data, key):
    """
    Sign a string blob
    """
    return sign(key, data, HASH_TYPE)

def verify_sig(data, sig, public_key):
    """
    Verify a signature
    """
    # HACK b/c openssl expects an X509 object
    cert = X509()
    cert.set_pubkey(public_key)
    return verify(cert, sig, data, HASH_TYPE)
