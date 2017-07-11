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

DATEF = '%F'
TIMEF = '%T'
DTIMEF = '%s %s' % (DATEF, TIMEF)
LATEST_TAG = 'latest'
PACKAGE_DIR_NAME = 'quilt_packages'
DEFAULT_BUILDFILE = 'build.yml'
DEFAULT_README = 'README.md'
# reserved words in build.yml
RESERVED = {
    'file': 'file',
    'transform': 'transform'
}

# SHA-2 Family
HASH_TYPE = 'sha256'
# RSA digital signature key Size
RSA_BITS = 2048

# TODO nan probably not a safe choice and may pollute number cols with strs
kwargs = {'keep_default_na': False, 'na_values': ['nan']}
# Supported build targets and file types
# BUILD[target][file_extension]
# file_extension should be lowercase
TARGET = {
    'pandas': {
        'csv': {
            'attr': 'read_csv',
            'failover' : {'engine' : 'python'},
            'kwargs': kwargs
        },
        'ssv': {
            'attr': 'read_csv',
            'failover' : {'engine' : 'python'},
            'kwargs': dict(kwargs, sep=';')
        },
        'tsv': {
            'attr': 'read_csv',
            'failover' : {'engine' : 'python'},
            'kwargs': dict(kwargs, sep='\t')
        },
        'xls': {
            'attr': 'read_excel',
            # TODO set sheetname='None' to get all sheets?
            # Currently defaults to sheetname=0, which imports first sheet only
            'kwargs': kwargs
        },
        'xlsx': {
            'attr': 'read_excel',
            # see comments under 'xls'
            'kwargs': kwargs
        }
    }
}
