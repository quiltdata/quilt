"""

    context version:

    >>> import quilt.vfs
    >>> with quilt.vfs.mapdirs('uciml/iris', mappings={'foo/bar':'raw'}): print(open('foo/bar/iris_names').read()[0:100])
    ...
    1. Title: Iris Plants Database
    	Updated Sept 21 by C.Blake - Added discrepency information

    2. Sourc
    >>> print(open('foo/bar/iris_names').read()[0:100])
    Traceback (most recent call last):
      File "<stdin>", line 1, in <module>
    FileNotFoundError: [Errno 2] No such file or directory: 'foo/bar/iris_names'

    # --------------------------------------------------------------------------------

    explicit version:

    >>> import quilt.vfs
    >>> patchers = quilt.vfs.setup('uciml/iris', mappings={'foo/bar':'raw'})
    >>> print(open('foo/bar/iris_names').read()[0:100])
    1. Title: Iris Plants Database
    	Updated Sept 21 by C.Blake - Added discrepency information

    2. Sourc
    >>> quilt.vfs.teardown(patchers)
    >>> print(open('foo/bar/iris_names').read()[0:100])
    Traceback (most recent call last):
      File "<stdin>", line 1, in <module>
    FileNotFoundError: [Errno 2] No such file or directory: 'foo/bar/iris_names'


    # ---------------------------------------------------------------------------
    # various character mapping scenarios
    #
    with quilt.vfs.mapdirs('uciml/iris', mappings={'foo/bar':'.'}):
       assert(len(open('foo/bar/raw/iris_names').read()) > 100)

    # ---------------------------------------------------------------------------
    # various character mapping scenarios
    #
    with quilt.vfs.mapdirs('uciml/iris', mappings={'foo/bar':'.'}, charmap=
                           lambda name: name.replace('.', '_')):
       assert(len(open('foo/bar/raw/iris.names').read()) > 100)

    with quilt.vfs.mapdirs('uciml/iris', mappings={'foo/bar':'.'}):
       assert(len(open('foo/bar/raw/iris.names').read()) > 100)

    with quilt.vfs.mapdirs('uciml/iris', mappings={'foo/bar':'.'}, charmap={'.':'_'}):
       assert(len(open('foo/bar/raw/iris.names').read()) > 100)

    # default charmapping changes . to _
    with quilt.vfs.mapdirs('uciml/iris', mappings={'foo/bar':'raw'}):
       assert(len(open('foo/bar/iris_names').read()) > 100)

    # --------------------------------------------------------------------------------
    # TODO: get this to work:
    # https://github.com/xuetsing/image-classification-tensorflow/blob/master/classify.py#L13
    >>> import quilt.vfs; import tensorflow as tf
    >>> with quilt.vfs.mapdirs('uciml/iris', mappings={'foo/bar':'raw'}): len(tf.gfile.FastGFile('foo/bar/iris_names').read())
    ==> errors on not finding tf or tf.gfile


"""
## Imports
# System imports
import os
import sys
import string
import inspect
import functools
import importlib
from contextlib import contextmanager

# Third-party immports
from six.moves import builtins

# Our imports
from .nodes import GroupNode
from .tools import command
from .tools.store import parse_package


## Vars and "constants"
DEFAULT_MODULE_MAPPINGS = {
    'builtins': 'open',
    'bz2': 'BZ2File',
    'gzip': 'GzipFile',
    'h5py': 'File',    # for keras/tensorflow
    # manually add tensorflow because it's a heavyweight library
    'tensorflow.python.lib.io.file_io': 'FileIO',
    # 'tensorflow': 'tensorflow.gfile.GFile',
}

# each listed object will have the specific param modified by mapfunc.
DEFAULT_OBJECT_PARAM_PATCHES = {
    'builtins.open': ['file'],
    'bz2.BZ2File': ['filename'],
    'gzip.GzipFile': ['filename'],
    'h5py.File': ['name'],    # for keras/tensorflow
    # manually add tensorflow because it's a heavyweight library
    'tensorflow.python.lib.io.file_io.FileIO': ['name'],
    # 'tensorflow': 'tensorflow.gfile.GFile',
    }

_DEBUG = True


## Code
def debug(string, *format_args, **format_kwargs):
    """Useful if you want to mass enable/disable formatting.

    This basically just works as a print+format call, but prefixes
    each line with the caller's name.
    """

    if not _DEBUG:
        return
    stack = inspect.stack().copy()
    caller_name = stack[1][3]

    prefix = caller_name + ':\t'
    string = string.format(*format_args, **format_kwargs)
    string = string.replace('\n', '\n...\t')

    print(prefix + string)


if not _DEBUG:
    del debug
    del _DEBUG


def import_object(full_path):
    """Resolve foo.bar.baz notation into a module, object, and object name

    This requires at least two elements, module and object, and returns the
    module, object, and object name.

    example:
        import_object('foo.bar.baz')
        # returns (<module at foo.bar>, <baz object>, 'baz')

    :returns: module, object, object_name
    """
    full_path = full_path.split('.')

    if len(full_path) == 1:
        raise ValueError('Expected full_path to at least include two parts, in the form "module.callable"')

    # If 'builtins' is being used, we should use the six.moves.builtins module.
    if full_path[0] == 'builtins':
        full_path.insert(0, 'six')
        full_path.insert(1, 'moves')

    modpath = '.'.join(full_path[:-1])
    obj_name = full_path[-1]

    module = importlib.import_module(modpath)
    obj = getattr(module, obj_name)
    return module, obj, obj_name


def scrub_patchmap(patchmap, verbose=False):
    """Return a version of a patchmap with missing modules/callables removed.

    :param verbose: Mention each dropped module and/or function
    :param strict: Raise an error if module exists but func doesn't
    """
    result = {}

    for path, value in patchmap.items():
        try:
            import_object(path)
            result[path] = value
        except ImportError:
            if verbose:
                print("Dropped {} from patchmap (ImportError)".format(path), file=sys.stderr)
            continue
    return result
DEFAULT_OBJECT_PARAM_PATCHES = scrub_patchmap(DEFAULT_OBJECT_PARAM_PATCHES, verbose=True)


def create_patched_params_func(obj, param_func_map):
    """Creates a function that filters args through function calls first

    This is similar to a decorator (and can be used as one).  It returns
    a patched version of the original `obj`, which may be a class or
    function.

    The replacement function has the same signature as `obj`.  When the
    replacement is called:
        * For each `{param_name, func}` pair in param_func_map
            * Argument for the specific param is replaced with `func(arg)`
        * `obj` is called with the modified arguments.

    Works for functions or classes.

    :returns: Decorated `obj` that replaces params using mapped functions
    :rtype: function
    """
    params = inspect.signature(obj).parameters
    params_list = list(params)

    @functools.wraps(obj)
    def replacement(*args, **kwargs):
        args = list(args)
        for pos, value in enumerate(args):
            argname = params_list[pos]
            if argname in param_func_map:
                args[pos] = param_func_map[argname](value)
        for argname, value in kwargs.items():
            if argname in param_func_map:
                args[pos] = param_func_map[argname](value)
        return obj(*args, **kwargs)
    replacement.original = obj
    return replacement


def patch_objpath_with_func(full_path, func):
    """Replace callable at `full_path` with `func`"""
    module, obj, obj_name = import_object(full_path)
    func.original = obj
    setattr(module, obj_name, func)
    debug("module: {}\nreplacement: {}\noriginal: {}\n", module, func, obj)


def patch_objpath_with_map(full_path, param_func_map):
    """patch the object given in `full_path` using a func generated from `param_func_map`.

    See create_patched_params_func() docstring for details.

    :param full_object_path: module path to object (foo.bar)
    :param map: replacement parameters map as in patch_callable_params()
    """
    module, obj, obj_name = import_object(full_path)
    replacement = create_patched_params_func(obj, param_func_map)
    setattr(module, obj_name, replacement)


def patch_full_module(module_path, param_func_map, exclude=tuple(), include=tuple()):
    """Patch every callable with matching params in specified module

    In the root of the module specified by module_path, all attributes are checked.
    If the name starts with "__", it is skipped.
    If the name is in 'exclude', it is skipped.
    If `include` exists and the name is not in `include`, it is skipped.
    If the callable has no params matched in `param_func_map`, it is skipped.

    Remaining callables are patched so that any args sent to the callable
    are first modified via `param_func_map[param](arg)`.

    A list of patched object paths is returned.

    :param full_path: full module path, as foo.bar.baz
    :param params_map: {param: action_func} map to apply to incoming arguments
    :param exclude: exclude these names
    :param include: only include these names
    :returns: a list of patched object paths.
    """
    module = importlib.import_module(module_path)
    patched = []
    param_names = set(param_func_map)

    for name in dir(module):
        if name.startswith('__'):
            continue
        if name in exclude:
            continue
        if include and name not in include:
            continue

        obj = getattr(module, name)

        if not callable(obj):
            continue
        params = inspect.signature(obj).parameters
        matching_params = set(params) & param_names

        if not matching_params:
            continue
        objpath = module_path + '.' + name
        patch_objpath_with_map(objpath, {p: param_func_map[p] for p in matching_params})
        patched.append(objpath)
    return patched


def unpatch_objpath(full_objpath, raise_exc=False):
    """Restore original callable"""
    module, obj, obj_name = import_object(full_objpath)
    if not hasattr(obj, 'original') and not raise_exc:
        return
    setattr(module, obj_name, obj.original)


def unpatch_full_module(module_path_or_module):
    """For each attribute, unpatch any patched callables."""
    if isinstance(module_path_or_module, str):
        module = importlib.import_module(module_path)
    else:
        module = module

    for name in dir(module):
        attr = getattr(module, name)
        if callable(attr) and hasattr(attr, 'original'):
            setattr(module, name, attr.original)


# simple mapping of illegal chars to underscores.
# TODO: more sophisticated function for handling illegal identifiers, e.g. number as first char
DEFAULT_CHAR_MAPPINGS = dict([(char, '_') for char in string.whitespace + string.punctuation])


def make_mapfunc(pkg, hash=None, version=None, tag=None, force=False,
                 mappings=None, install=False, charmap=DEFAULT_CHAR_MAPPINGS):
    """core support for mapping filepaths to objects in quilt local objs/ datastore.
       TODO: add support for reading/iterating directories, e.g. os.scandir() and friends

    :param pkg: Quilt pkg, e.g. "user/example"
    :param hash: specific package hash
    :param version: specific package version
    :param tag: specific package tag
    :param force: don't prompt if installing and package is already installed
    :param mappings: {dirpath: nodepath} pairs, where dirpath is an OS path, and
                     nodepath is a python module path pointing to a quilt node
    :param install: If True, try to install the package first.
    :param charmap: {fromchar: tochar} pairs, or a function.
    """
    if install:
        command.install(pkg, hash=hash, version=version, tag=tag, force=force)
    owner, pkg = parse_package(pkg)

    if mappings is None:
        mappings = {".": ""}  # TODO: test this case

    if not callable(charmap):
        fromstr = tostr = ""
        for fromchar, tochar in charmap.items():
            fromstr += fromchar
            tostr += tochar
        charmap = str.maketrans(fromstr, tostr)

    # expand/clean dir mappings, e.g.
    # {"~asah/../foo": "."} ==> {"/Users/foo": ["uciml","raw"]}
    # {"foo/bar": "foo"} ==> {"/Users/asah/foo/bar": ["uciml", "raw", "foo"]}  # cwd=/Users/asah
    base_node = importlib.import_module("quilt.data." + owner + "." + pkg)
    expanded_mappings = _expand_dir_node_mapping(mappings, base_node)

    def mapfunc(filename, mappings=mappings, charmap=charmap):
        # TODO: disallow trailing slash - not allowed to open directories...
        abspath = os.path.abspath(os.path.expanduser(filename))
        # map subtrees:
        #   make_mapfunc("uciml/iris", mappings={".": "raw"}); open("bezdek_iris")
        #   make_mapfunc("uciml/iris"); open("raw/bezdek_iris")
        #   make_mapfunc("foo/bar", "baz/bat"); open("myfile")
        debug('checking {}... mappings={}', filename, mappings)
        for dirpath, node in expanded_mappings.items():
            #print('{}: checking {} => {}'.format(abspath, dirpath, nodepath))
            if abspath.startswith(dirpath):
                relpath = abspath[len(dirpath)+1:] # drop trailing slash
                for raw_piece in relpath.split(os.path.sep):
                    piece = charmap(raw_piece) if callable(charmap) else raw_piece.translate(charmap)
                    #print('  {} => {}   raw_piece={}  piece={}'.format(relpath, node, raw_piece, piece))
                    keys = node._keys()
                    #print('keys={} piece={}'.format(keys, piece))
                    if piece not in keys:
                        raise Exception("Quilt node path not found: {}  ({} not found in {})".format(
                            abspath, piece, keys))
                    node = getattr(node, piece)
                    #print('node={}'.format(node))
                if isinstance(keys, GroupNode):
                    raise Exception("Quilt node is a Group, not a Node/file: {}  ({} not found in {})".format(
                        abspath, piece, keys))
                return node()  # node's data is filename
        return filename

    return mapfunc


def _expand_dir_node_mapping(dir_node_mapping, base_node):
    result = {}
    for dirpath, nodepath in dir_node_mapping.items():
        expanded_path = os.path.abspath(os.path.expanduser(dirpath)).rstrip("/")
        node = base_node
        keys = None
        if nodepath not in ["", "."]:
            for key in nodepath.strip().strip(".").split("."):
                keys = node._keys()
                if key not in keys:
                    raise Exception("Invalid mapping: Quilt node path not found: {}  ({} not found in {})".format(
                        nodepath, key, keys))
                node = getattr(node, key)
        if isinstance(keys, GroupNode):
            # TODO: improve errmsg to be more useful
            # XXX: if is a gorup, is not a group?  is this 'should not be a group', or 'is a group, or..?'
            raise Exception("Invalid mapping: Quilt node is not a Group: {}".format(piece))
        result[expanded_path] = node
    return result


@contextmanager
def mapdirs(pkg, hash=None, version=None, tag=None,
            install=False, force=False,
            mappings=None,
            charmap=DEFAULT_CHAR_MAPPINGS,
            patchmap=None):
    """context-based virtual file support:

         with quilt.vfs.mapdirs('uciml/iris', mappings={'foo/bar':'raw'}):
             open('foo/bar/iris_names')

    """
    if patchmap is None:
        patchmap = DEFAULT_OBJECT_PARAM_PATCHES
    patches = []
    try:
        # in case of interruption/exception, patchers will contain a subset that can be backed-out
        mapfunc = make_mapfunc(pkg, hash=hash, version=version, tag=tag, force=force,
                               mappings=mappings, install=install, charmap=charmap)
        for object_path, params in patchmap.items():
            patch_objpath_with_map(object_path, {p: mapfunc for p in params})
        yield
    finally:
        for object_path in patches:
            unpatch_objpath(object_path)


def setup(pkg, hash=None, version=None, tag=None, force=False,
          mappings=None, install=False, charmap=DEFAULT_CHAR_MAPPINGS, **kwargs):
    """continuation-based virtual file support:

         patchers = quilt.vfs.setup('uciml/iris', mappings={'foo/bar':'raw'})
         open('foo/bar/iris_names')
         quilt.vfs.teardown(patchers)

       if you like, you can wrap the calls, which is similar to the context-version above

         patchers = quilt.vfs.setup('uciml/iris', mappings={'foo/bar':'raw'})
         try:
             open('foo/bar/iris_names')
         finally:
             quilt.vfs.teardown(patchers)
    """
    if len(kwargs) == 0:
        kwargs = DEFAULT_MODULE_MAPPINGS
    mapfunc = make_mapfunc(pkg, hash=hash, version=version, tag=tag, force=force,
                           mappings=mappings, install=install, charmap=charmap, **kwargs)
    return [filepatch(modname, fname, mapfunc) for modname, fname in kwargs.items()]


def teardown(patchers):
    for patcher in patchers:
        patcher.stop()
