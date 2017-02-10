"""
Test sign.py via pytest
"""
import os.path
from OpenSSL.crypto import Error
from ..tools import hashing, sign
from ..tools.util import BASE_DIR

# known correct hash via shell: `openssl sha256 nuts.csv`
NUTS_HASH = '6cf793e4a8bc99b510d63b860b9d6791f027a4b3cc474c958b8e5932610a598b'
def test_sig():
    """
    TODO: test against signature and public key tampering (ideally with
    real sigs and real keys; currently we trust the correctness of the
    pyopenssl implementation)
    """
    if sign.has_private_key() and sign.has_public_key():
        print('using existing key pair')
    elif sign.has_private_key() or sign.has_public_key():
        raise Exception('INCOMPLETE_RSA_PAIR', 'missing public.pem or private.pem')
    else:
        print('generating a fresh RSA key pair')
        sign.to_pem_files(sign.gen_rsa())
    # fetch RSA keys from disk
    KROOT = os.path.join(BASE_DIR, 'keys')
    pub = sign.read_public_pem(os.path.join(KROOT, 'public.pem'))
    pri = sign.read_private_pem(os.path.join(KROOT, 'private.pem'))
    mydir = os.path.dirname(__file__)
    TEST_DATA = os.path.join(mydir, '../test/data/nuts.csv')
    # check hash fxn against known openssl hash values
    my_hash = hashing.digest_file(TEST_DATA)
    print('Checking sha256 file digest')
    assert  my_hash == NUTS_HASH, 'Unexpected hash value for nuts.csv'
    # sign hash with private key
    sig = sign.sign_str(my_hash, pri)
    # verify signature with public key
    sign.verify_sig(my_hash, sig, pub)
    failed = False
    try:
        # tamper with hash
        print('Checking digital signature')
        sign.verify_sig(my_hash + '0', sig, pub)
    except Error as err:
        print(err)
        # we expect to hit this error if things are working correctly
        failed = True
    finally:
        assert failed, 'hash tampering did not invalidate signature'
