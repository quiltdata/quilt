"""
Helper functions.
"""
import re
import gzip
import os
import keyword
import fnmatch

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
    from the change in all cases, so it must be stored separately (`FileNode`
    metadata)

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
        raise ValueError("Invalid filepath (relative file path required): " + str(PurePosixPath(filepath)))

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


def glob_insensitive(dir, pattern, path_objects=True, include_dirs=True, include_files=True, shortpaths=True):
    """Case-insensitive globbing

    Glob the specified dir for files matching the given pattern.

    Pattern can use any of the normal shell script wildcards:
        * : match any number of characters in a name
        ? : math one character in a name
        [abc] : match any one of the contained characters
        [!abc] : don't match any of the contained characters
        ** : 'match all files and one or more subdirs', which seems to be
             the going method of saying "match anything and everything"

    :param dir: folder to start in
    :param pattern: pattern to match with
    :param path_objects: yield Path objects instead of strings
    :param include_dirs: include dirs in the result
    :param include_files: include files in the result
    """
    # This is a little longer and more complex than I'd like, but it works,
    # and it provides all of the needed functionality.

    # Initial setup and error checks
    dir = pathlib.Path(dir)

    if not pattern:
        raise BuildException("Invalid glob pattern: nonexistent.")
    pattern = pathlib.PureWindowsPath(pattern)

    if pattern.anchor:
        pattern = pathlib.PurePath(pattern)
        raise BuildException("Invalid glob pattern (only relative patterns are allowed): " + str(pattern))

    for part in pattern.parts:
        if '**' in part and part != '**':
            raise BuildException("Invalid glob pattern, in element {!r}: '**' must stand alone.".format(part))

    # Break the glob expression into a list of regular expressions
    expressions = []
    for part in pattern.parts:
        # except this -- we need to recognize it separately
        if part == '**':
            expressions.append('**')
        else:
            # use fnmatch, slightly modified -- no dotall, no multiline, $ for ending.
            expressions.append('^' + fnmatch.translate(part).rsplit(r'\Z', 1)[0] + '$')
    expressions = tuple(expressions)

    for item in _dir_match(dir, expressions, include_dirs, include_files):
        if shortpaths:
            item = item.relative_to(dir)
        yield item if path_objects else str(item)


def _dir_match_prep(expressions):
    """A couple of sanity checks, and minor prep for _dir_match()

    Evaluates 'expressions' tuple for current expression, remainder, and
    recursion state.
    """
    # Multiple '**' are meaningless, and interfere.
    assert expressions
    assert isinstance(expressions, tuple)  # ensure no writing between recursions

    while expressions[1:] and expressions[0] == expressions[1] == "**":
        expressions = expressions[1:]

    expr = expressions[0]
    remaining = expressions[1:]
    if expr == '**':
        recursive = True
        if remaining:
            expr = remaining[0]
            remaining = remaining[1:]
        else:
            expr = '.*'  # ** -- match all files and dirs
    else:
        recursive = False
    return expr, remaining, recursive


def _dir_match(dir, expressions, include_dirs, include_files, _yielded=None):
    """Match a tuple of regexps against a dir and its subfolders

    :param dir:  Dir to match against
    :param expressions: a tuple of regular expressions (generated
                        from glob string)
    :param include_dirs: True to include directories in the result
    :param include_files: True to include files in the result
    :param yielded: Internal, prevent multiple matches
    :return: iterator of Path objects
    """
    expr, remaining, recursive = _dir_match_prep(expressions)

    # track results, avoid returning anything more than once
    yielded = set() if _yielded is None else _yielded

    # `dir` should have been a dir, but just in case it's a file:
    if dir.is_file():
        if not remaining:
            if match(expr, dir):
                yield dir
                yielded.add(dir)
        return

    for path in dir.iterdir():
        if path.name.startswith('.'):
            continue
        matched = re.match(expr, path.name, flags=re.IGNORECASE)
        if path.is_dir():
            if matched:
                if not remaining:  # this indicates a complete match -- pattern is used up
                    if include_dirs:  # yield it if we want dirs
                        if path not in yielded:
                            yield path
                            yielded.add(path)
                else:   # more pattern to process, but we did match.  Pass remaining pattern.
                    # for recursion of **/foo, this passes on 'foo'
                    for item in _dir_match(path, remaining, include_dirs, include_files, yielded):
                        if item not in yielded:
                            yield item
                            yielded.add(item)
            if recursive:
                # if recursive, we also want to pass on the full group of expressions as they were originally.
                for item in _dir_match(path, expressions, include_dirs, include_files, yielded):
                    if item not in yielded:
                        yield item
                        yielded.add(item)
        else:  # file
            if matched and not remaining:
                if include_files and path not in yielded:
                    yield path
                    yielded.add(path)
