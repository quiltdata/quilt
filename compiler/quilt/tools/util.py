"""
Helper functions.
"""
import ctypes
import gzip
import keyword
import os
import re
import shutil
import sys

from appdirs import user_config_dir, user_data_dir
from collections import namedtuple
from six import BytesIO, string_types, Iterator

from .const import QuiltException
from .compat import pathlib


APP_NAME = "QuiltCli"
APP_AUTHOR = "QuiltData"
BASE_DIR = user_data_dir(APP_NAME, APP_AUTHOR)
CONFIG_DIR = user_config_dir(APP_NAME, APP_AUTHOR)
PYTHON_IDENTIFIER_RE = re.compile(r'^[a-zA-Z_]\w*$')
EXTENDED_PACKAGE_RE = re.compile(
    r'^((?:\w+:)?\w+/[\w/]+)(?::h(?:ash)?:(.+)|:v(?:ersion)?:(.+)|:t(?:ag)?:(.+))?$'
)

# Windows soft/hardlink c functions
WIN_SOFTLINK = None
WIN_HARDLINK = None


#return type for parse_package_extended
PackageInfo = namedtuple("PackageInfo", "full_name, team, user, name, subpath, hash, version, tag")
def parse_package_extended(identifier):
    """
    Parses the extended package syntax and returns a tuple of (package, hash, version, tag).
    """
    match = EXTENDED_PACKAGE_RE.match(identifier)
    if match is None:
        raise ValueError

    full_name, pkg_hash, version, tag = match.groups()
    team, user, name, subpath = parse_package(full_name, allow_subpath=True)

    # namedtuple return value
    return PackageInfo(full_name, team, user, name, subpath, pkg_hash, version, tag)

def parse_package(name, allow_subpath=False):
    values = name.split(':', 1)
    team = values[0] if len(values) > 1 else None

    values = values[-1].split('/')
    # Can't do "owner, pkg, *subpath = ..." in Python2 :(
    (owner, pkg), subpath = values[:2], values[2:]
    if not owner or not pkg:
        # Make sure they're not empty.
        raise ValueError
    if subpath and not allow_subpath:
        raise ValueError

    if allow_subpath:
        return team, owner, pkg, subpath
    return team, owner, pkg

class FileWithReadProgress(Iterator):
    """
    Acts like a file with mode='rb', but displays a progress bar while the file is read.
    """
    def __init__(self, path_or_fd, progress_cb):
        if isinstance(path_or_fd, string_types):
            self._fd = open(path_or_fd, 'rb')
            self._need_to_close = True
        else:
            self._fd = path_or_fd
            self._need_to_close = False

        self._progress_cb = progress_cb

    def read(self, size=-1):
        """Read bytes and update the progress bar."""
        buf = self._fd.read(size)
        self._progress_cb(len(buf))
        return buf

    def __iter__(self):
        return self

    def __next__(self):
        """Read the next line and update the progress bar."""
        buf = next(self._fd)
        self._progress_cb(len(buf))
        return buf

    def tell(self):
        """Get the file position."""
        return self._fd.tell()

    def seek(self, offset, whence=0):
        """Set the new file position."""
        self._fd.seek(offset, whence)

    def close(self):
        """Close the file."""
        if self._need_to_close:
            self._fd.close()

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback): # pylint:disable=W0622
        self.close()


def file_to_str(fname):
    """
    Read a file into a string
    PRE: fname is a small file (to avoid hogging memory and its discontents)
    """
    data = None
    # rU = read with Universal line terminator
    with open(fname, 'rU') as fd:
        data = fd.read()
    return data


def gzip_compress(data):
    """
    Compress a string. Same as gzip.compress in Python3.
    """
    buf = BytesIO()
    with gzip.GzipFile(fileobj=buf, mode='wb') as fd:
        fd.write(data)
    return buf.getvalue()


def sub_dirs(path, invisible=False):
    """
    Child directories (non-recursive)
    """
    dirs = [x for x in os.listdir(path) if os.path.isdir(os.path.join(path, x))]
    if not invisible:
        dirs = [x for x in dirs if not x.startswith('.')]

    return dirs


def sub_files(path, invisible=False):
    """
    Child files (non-recursive)
    """
    files = [x for x in os.listdir(path) if os.path.isfile(os.path.join(path, x))]
    if not invisible:
        files = [x for x in files if not x.startswith('.')]

    return files


def is_identifier(string):
    """Check if string could be a valid python identifier

    :param string: string to be tested
    :returns: True if string can be a python identifier, False otherwise
    :rtype: bool
    """
    matched = PYTHON_IDENTIFIER_RE.match(string)
    return bool(matched) and not keyword.iskeyword(string)


def is_nodename(string):
    """Check if string could be a valid node name

    Convenience, and a good place to aggregate node-name related checks.

    :param string: string to be tested
    :returns: True if string could be used as a node name, False otherwise
    :rtype: bool
    """
    # TODO: Permit keywords once node['item'] notation is implemented
    # TODO: Update the following description once node['item'] notation is implemented
    ## Currently a node name has the following characteristics:
    # * Must be a python identifier
    # * Must not be a python keyword  (limitation of current implementation)
    # * Must not start with an underscore
    if string.startswith('_'):
        return False
    return is_identifier(string)


def to_identifier(string):
    """Makes a python identifier (perhaps an ugly one) out of any string.

    This isn't an isomorphic change, the original name can't be recovered
    from the change in all cases, so it must be stored separately.

    Examples:
    >>> to_identifier('Alice\'s Restaurant') -> 'Alice_s_Restaurant'
    >>> to_identifier('#if') -> 'if' -> QuiltException
    >>> to_identifier('9foo') -> 'n9foo'

    :param string: string to convert
    :returns: `string`, converted to python identifier if needed
    :rtype: string
    """
    # Not really useful to expose as a CONSTANT, and python will compile and cache
    result = re.sub(r'[^0-9a-zA-Z_]', '_', string)

    # compatibility with older behavior and tests, doesn't hurt anyways -- "_" is a
    # pretty useless name to translate to.  With this, it'll raise an exception.
    result = result.strip('_')

    if result and result[0].isdigit():
        result = "n" + result

    if not is_identifier(result):
        raise QuiltException("Unable to generate Python identifier from name: {!r}".format(string))

    return result


def to_nodename(string, invalid=None, raise_exc=False):
    """Makes a Quilt Node name (perhaps an ugly one) out of any string.

    This should match whatever the current definition of a node name is, as
    defined in is_nodename().

    This isn't an isomorphic change, the original name can't be recovered
    from the change in all cases, so it must be stored separately (`FileNode`
    metadata)

    If `invalid` is given, it should be an iterable of names that the returned
    string cannot match -- for example, other node names.

    If `raise_exc` is True, an exception is raised when the converted string
    is present in `invalid`.  Otherwise, the converted string will have a
    number appended to its name.

    Example:
    # replace special chars -> remove prefix underscores -> rename keywords
    # '!if' -> '_if' -> 'if' -> 'if_'
    >>> to_nodename('!if') -> 'if_'
    >>> to_nodename('if', ['if_']) -> 'if__2'
    >>> to_nodename('9#blah') -> 'n9_blah'
    >>> to_nodename('9:blah', ['n9_blah', 'n9_blah_2']) -> 'n9_blah_3'

    :param string: string to convert to a nodename
    :param invalid: Container of names to avoid.  Efficiency: Use set or dict
    :param raise_exc: Raise an exception on name conflicts if truthy.
    :returns: valid node name
    """
    string = to_identifier(string)

    #TODO: Remove this stanza once keywords are permissible in nodenames
    if keyword.iskeyword(string):
        string += '_'   # there are no keywords ending in "_"

    # Done if no deduplication needed
    if invalid is None:
        return string

    # Deduplicate
    if string in invalid and raise_exc:
        raise QuiltException("Conflicting node name after string conversion: {!r}".format(string))

    result = string
    counter = 1
    while result in invalid:
        # first conflicted name will be "somenode_2"
        # The result is "somenode", "somenode_2", "somenode_3"..
        counter += 1
        result = "{}_{}".format(string, counter)

    return result

def get_free_space(directory):
    if hasattr(shutil, 'disk_usage'):
        # Python3
        return shutil.disk_usage(directory).free
    elif hasattr(os, 'statvfs'):
        # Python2, posix
        res = os.statvfs(directory)
        return res.f_bavail * res.f_bsize
    else:
        # Python2, win32
        # Not implemented - but we don't support this combination, anyway.
        raise NotImplementedError

def fs_link(path, linkpath, linktype='soft'):
    """Create a hard or soft link of `path` at `linkpath`

    Works on Linux/OSX/Windows (Vista+).

    :param src: File or directory to be linked
    :param dest: Path of link to create
    :param linktype: 'soft' or 'hard'
    """
    global WIN_SOFTLINK
    global WIN_HARDLINK
    WIN_NO_ERROR = 22

    assert linktype in ('soft', 'hard')

    path, linkpath = pathlib.Path(path), pathlib.Path(linkpath)

    # Checks
    if not path.exists():    # particularly important on Windows to prevent false success
        raise QuiltException("Path to link to does not exist: {}".format(path))
    if linkpath.exists():
        raise QuiltException("Link path already exists: {}".format(linkpath))

    # Windows
    if os.name == 'nt':
        # clear out any pre-existing, un-checked errors
        ctypes.WinError()
            
        # Check Windows version (reasonably) supports symlinks
        if not sys.getwindowsversion()[0] >= 6:
            raise QuiltException("Unsupported operation: This version of Windows does not support linking.")

        # Acquire the windows CreateXLinkW() function
        if linktype == 'soft':
            if WIN_SOFTLINK is None:
                WIN_SOFTLINK = ctypes.windll.kernel32.CreateSymbolicLinkW
                WIN_SOFTLINK.restype = ctypes.c_bool
            create_link = lambda l, p: WIN_SOFTLINK(str(l), str(p), p.is_dir())
        elif linktype == 'hard':
            if WIN_HARDLINK is None:
                WIN_HARDLINK = ctypes.windll.kernel32.CreateHardLinkW
                WIN_HARDLINK.restype = ctypes.c_bool
            create_link = WIN_HARDLINK

        # Call and check results
        create_link(linkpath, path)
        # Check WinError, because the return value for CreateSymbolicLinkW's type is suspect due to a
        # (possible) bug: https://stackoverflow.com/questions/33010440/createsymboliclink-on-windows-10
        # We have user results with similar effects (success reported, but not actual)
        error = ctypes.WinError()
        if error.winerror:
            raise QuiltException("Linking failed: " + str(error), original_error=error)
        # Handle the case wehere linking failed and windows gave no error:
        if not linkpath.exists() and linkpath.is_symlink():
            raise QuiltException("Linking failed: Expected symlink at: {}".format(linkpath))
    # Linux, OSX
    else:
        try:
            if linktype == 'soft':
                linkpath.symlink_to(path)
            elif linktype == 'hard':
                os.link(str(path), str(linkpath))
        except OSError as error:
            raise QuiltException("Linking failed: " + str(error), original_error=error)
