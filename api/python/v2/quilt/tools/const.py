"""
Constants
"""
from enum import Enum

class TargetType(Enum):
    """
    Enums for target types
    """
    PANDAS = 'pandas'
    NUMPY = 'numpy'
    FILE = 'file'
    GROUP = 'group'

DATEF = '%Y-%m-%d'
TIMEF = '%H:%M:%S'
DTIMEF = '%s %s' % (DATEF, TIMEF)
PACKAGE_DIR_NAME = 'quilt_packages'
DEFAULT_BUILDFILE = 'build.yml'
DEFAULT_QUILT_YML = 'quilt.yml'
DEFAULT_TEAM = 'Quilt'
ELLIPSIS = u'\u2026'

# reserved words in build.yml
RESERVED = {
    'checks': 'checks',
    'environments': 'environments',
    'file': 'file',
    'meta': 'meta',
    'kwargs': 'kwargs',
    'package': 'package',
    'transform': 'transform'
}

SYSTEM_METADATA = '_system'

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
    }
}

# Exit codes
EXIT_KB_INTERRUPT = 4
TEAM_ID_ERROR = "Invalid team name: "


# Exceptions
class QuiltException(Exception):
    """Base Exception for Quilt

    Any time an exception is raised by Quilt code and isn't caught by
    the module raising it, it should use a `QuiltException` or subclass.

    `QuiltException` is the base for all quilt exceptions, such as
    `CommandException`, `BuildException`, etc.

    All `QuiltException` instances should have a user friendly message,
    even if not expected to be seen by a user.  This is available as the
    'message' attribute, or as `str(error)`.

    **kwargs will be added directly as attributes to the error, so a
    dict of `{'code': 90, 'original_error': <OSError Object>}` would be
    added as `self.code` and `self.original_error`.

    :param message: Error message to display
    :param **kwargs: Additional key, value pairs to set as attributes
    """
    def __init__(self, message, **kwargs):
        # We use NewError("Prefix: " + str(error)) a lot.
        # To be consistent across Python 2.7 and 3.x:
        # 1) This `super` call must exist, or 2.7 will have no text for str(error)
        # 2) This `super` call must have only one argument (the message) or str(error) will be a repr of args
        super(QuiltException, self).__init__(message)
        self.message = message
        for k, v in kwargs.items():
            setattr(self, k, v)