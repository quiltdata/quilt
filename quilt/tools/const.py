"""
Constants
"""
from enum import Enum

class TargetType(Enum):
    PANDAS = 'pandas'
    FILE = 'file'

DATEF = '%F'
TIMEF = '%T'
DTIMEF = '%s %s' % (DATEF, TIMEF)
LATEST_TAG = 'latest'
PACKAGE_DIR_NAME = 'quilt_packages'

# SHA-2 Family
HASH_TYPE = 'sha256'
# RSA digital signature key Size
RSA_BITS = 2048

# TODO nan probably not a safe choice and may pollute number cols with strs
NA_VALS = ['nan']
KEEP_NA = False
# Supported build targets and file types
# BUILD[target][file_extension]
# file_extension should be lowercase
TARGET = {
    'pandas': {
        'csv': {
            'attr': 'read_csv',
            'failover' : {'engine' : 'python'},
            'kwargs': {
                'keep_default_na': KEEP_NA,
                'na_values': NA_VALS,
            }
        },
        'ssv': {
            'attr': 'read_csv',
            'failover' : {'engine' : 'python'},
            'kwargs': {
                'keep_default_na': KEEP_NA,
                'na_values': NA_VALS,
                'sep': ';'
            }
        },
        'tsv': {
            'attr': 'read_csv',
            'failover' : {'engine' : 'python'},
            'kwargs': {
                'keep_default_na': KEEP_NA,
                'na_values': NA_VALS,
                'sep': '\t'
            }
        },
        'xls': {
            'attr': 'read_excel',
            # TODO set sheetname='None' to get all sheets?
            # Currently defaults to sheetname=0, which imports first sheet only
            'kwargs': {
                'keep_default_na': KEEP_NA,
                'na_values': NA_VALS
            }
        },
        'xlsx': {
            'attr': 'read_excel',
            # see comments under 'xls'
            'kwargs': {
                'keep_default_na': KEEP_NA,
                'na_values': NA_VALS
            }
        }
    }
}
