"""
Constants
"""
from enum import Enum

class TargetType(Enum):
    """
    Enums for target types
    """
    PANDAS = 'pandas'
    FILE = 'file'

DATEF = '%Y-%m-%d'
TIMEF = '%H:%M:%S'
DTIMEF = '%s %s' % (DATEF, TIMEF)
LATEST_TAG = 'latest'
PACKAGE_DIR_NAME = 'quilt_packages'
DEFAULT_BUILDFILE = 'build.yml'

# reserved words in build.yml
RESERVED = {
    'file': 'file',
    'checks': 'checks',
    'environments': 'environments',
    'transform': 'transform'
}

# SHA-2 Family
HASH_TYPE = 'sha256'
# RSA digital signature key Size
RSA_BITS = 2048

# TODO nan probably not a safe choice and may pollute number cols with strs
_kwargs = {} # default kwargs pylint:disable=C0103
# Supported build targets and file types
# file_extension should be lowercase
PARSERS = {
    'csv': {
        'module': 'pandas',
        'attr': 'read_csv',
        'failover' : {'engine' : 'python'},
        'kwargs': _kwargs
    },
    'ssv': {
        'module': 'pandas',
        'attr': 'read_csv',
        'failover' : {'engine' : 'python'},
        'kwargs': dict(_kwargs, sep=';')
    },
    'tsv': {
        'module': 'pandas',
        'attr': 'read_csv',
        'failover' : {'engine' : 'python'},
        'kwargs': dict(_kwargs, sep='\t')
    },
    'xls': {
        'module': 'pandas',
        'attr': 'read_excel',
        # TODO set sheetname='None' to get all sheets?
        # Currently defaults to sheetname=0, which imports first sheet only
        'kwargs': _kwargs
    },
    'xlsx': {
        'module': 'pandas',
        'attr': 'read_excel',
        # see comments under 'xls'
        'kwargs': _kwargs
    }
}
