"""
Helper functions.
"""
import re
import gzip
import os
import keyword

from appdirs import user_config_dir, user_data_dir
from six import BytesIO, string_types, Iterator

from .compat import pathlib


APP_NAME = "QuiltCli"
APP_AUTHOR = "QuiltData"
BASE_DIR = user_data_dir(APP_NAME, APP_AUTHOR)
CONFIG_DIR = user_config_dir(APP_NAME, APP_AUTHOR)


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
    val = re.match(r'^[a-zA-Z_]\w*$', string) and not keyword.iskeyword(string)
    return True if val else False


def is_nodename(string):
    """Check if string could be a valid node name

    Convenience, and a good place to aggregate node-name related checks.

    :param string: string to be tested
    :returns: True if string could be used as a node name, False otherwise
    :rtype: bool
    """
    if string.startswith('_'):
        return False
    return is_identifier(string)


def to_identifier(string):
    """Makes a python identifier (perhaps an ugly one) out of any string.

    This isn't an isomorphic change, the original filename can't be recovered
    from the change in all cases, so it must be stored separately.

    Examples:
    >>> to_identifier('#if') -> '_if'
    >>> to_identifier('global') -> 'global_'
    >>> to_identifier('9foo') -> 'n9foo'

    :param string: string to convert
    :returns: `string`, converted to python identifier if needed
    :rtype: string
    """
    # Not really useful to expose as a CONSTANT, and python will compile and cache
    string = re.sub(r'[^0-9a-zA-Z_]', '_', string)

    if string[0].isdigit():
        string = "n" + string
    if keyword.iskeyword(string):
        string = string + '_'

    return string


def to_nodename(string, invalid=None, raise_exc=False):
    """Makes a Quilt Node name (perhaps an ugly one) out of any string.

    This isn't an isomorphic change, the original filename can't be recovered
    from the change in all cases, so it must be stored separately (as
    `FileNode` metadata).

    If `invalid` is given, it should be an iterable of names that the returned
    string cannot match -- for example, other node names.

    If `raise_exc` is False (default), an exception is raised when the
    converted string is present in `invalid`.  Otherwise, the converted string
    will have a number appended to its name.

    Example:
    # replace special chars -> remove prefix underscores -> rename keywords
    # '!if' -> '_if' -> 'if' -> 'if_'
    >>> to_nodename('!if') -> 'if_'
    >>> to_nodename('if', ['if_']) -> 'if__2'
    >>> to_nodename('9#blah') -> 'n9_blah'
    >>> to_nodename('9:blah', ['n9_blah', 'n9_blah_2']) -> 'n9_blah_3'

    :param string: string to convert to a nodename
    :param invalid: iterable of names to avoid
    :type invalid: iterable
    :param raise_exc: Raise an exception on name conflicts if truthy.
    :type raise_exc: bool
    :returns: valid node name
    :rtype: string
    """
    string = to_identifier(to_identifier(string).lstrip('_'))

    if string[0].isdigit():  # for valid cases like '_903'.lstrip('_') == invalid '903'
        string = 'n' + string

    if invalid is None:
        return string

    if not isinstance(invalid, set):
        invalid = set(invalid)

    if string in invalid and raise_exc:
        raise ValueError("Conflicting node name after string conversion: {!r}".format(string))

    result = string
    counter = 1
    while result in invalid:
        # first conflicted name will be "somenode_2"
        # The result is "somenode", "somenode_2", "somenode_3"..
        counter += 1
        result = "{}_{}".format(string, counter)

    return result


def filepath_to_nodepath(filepath, nodepath_separator='.', invalid=None):
    """Converts a single relative file path into a nodepath

    For example, 'foo/bar' -> 'foo.bar' -- see `to_nodename` for renaming rules.

    If the result is in 'invalid', the last element is renamed to avoid conflicts.

    :param filepath: filepath to convert to nodepath
    :param nodepath_separator: separator between node pathnames, typically '.' or '/'
    :param invalid: List of invalid or already-used results.
    """
    if not isinstance(invalid, set):
        invalid = set() if invalid is None else set(invalid)

    # PureWindowsPath recognizes c:\\, \\, or / anchors, and / or \ separators.
    filepath = pathlib.PureWindowsPath(filepath)
    if filepath.anchor:
        raise ValueError("Invalid filepath (relative file path required): " + str(pathlib.Path(filepath)))

    nodepath = pathlib.PurePath('/'.join(to_nodename(part) for part in filepath.parts))
    name = nodepath.name
    counter = 1
    while str(nodepath) in invalid:
        # first conflicted name will be "somenode_2"
        # The result is "somenode", "somenode_2", "somenode_3"..
        counter += 1
        nodepath = nodepath.with_name("{}_{}".format(name, counter))

    return nodepath_separator.join(nodepath.parts)


def filepaths_to_nodepaths(filepaths, nodepath_separator='.', iterator=True):
    """Converts multiple relative file paths into nodepaths.

    Automatically prevents naming conflicts amongst generated nodepath names.

    See `filepath_to_nodepath` for more info.

    :param filepaths: relative paths to convert to nodepaths
    :param nodepath_separator: used between node pathnames, typically '.' or '/'
    :param iterator: [default True] If falsey, return a list instead of an iterator.
    """
    result = _filepaths_to_nodepaths(filepaths, nodepath_separator)
    if iterator:
        return result
    return list(result)


def _filepaths_to_nodepaths(filepaths, nodepath_separator='.'):
    invalid = set()
    for path in filepaths:
        result = filepath_to_nodepath(path, nodepath_separator, invalid=invalid)
        invalid.add(result)
        yield result
