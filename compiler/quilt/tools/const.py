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
    GROUP = 'group'

DATEF = '%Y-%m-%d'
TIMEF = '%H:%M:%S'
DTIMEF = '%s %s' % (DATEF, TIMEF)
PACKAGE_DIR_NAME = 'quilt_packages'
DEFAULT_BUILDFILE = 'build.yml'
DEFAULT_QUILT_YML = 'quilt.yml'
DEFAULT_TEAM = 'Quilt'

# reserved words in build.yml
RESERVED = {
    'checks': 'checks',
    'environments': 'environments',
    'file': 'file',
    'kwargs': 'kwargs',
    'package': 'package',
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
PANDAS_PARSERS = {
    'csv': {
        'attr': 'read_csv',
        'failover' : {'engine' : 'python'},
        'kwargs': _kwargs
    },
    'ssv': {
        'attr': 'read_csv',
        'failover' : {'engine' : 'python'},
        'kwargs': dict(_kwargs, sep=';')
    },
    'tsv': {
        'attr': 'read_csv',
        'failover' : {'engine' : 'python'},
        'kwargs': dict(_kwargs, sep='\t')
    },
    'xls': {
        'attr': 'read_excel',
        # TODO set sheetname='None' to get all sheets?
        # Currently defaults to sheetname=0, which imports first sheet only
        'kwargs': _kwargs
    },
    'xlsx': {
        'attr': 'read_excel',
        # see comments under 'xls'
        'kwargs': _kwargs
    },
}

# Exit codes
EXIT_KB_INTERRUPT = 4
TEAM_ID_ERROR = "Invalid team name: "
