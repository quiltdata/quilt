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
from __future__ import print_function

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
import six

# Our imports
from .nodes import GroupNode
from .tools import command
from .tools.store import parse_package
from .tools.package import PackageException


## Vars and "constants"
# Default object patches
# {'module.object': <patch>}, where <patch> is one of the following (see `patch` function):
#   <function mapped_file_exists> -- a func to completely replace the object with.
#   ['param1', 'param2'] -- list of params to replace args of using replacer(arg) (generally mapfunc(arg))
#   {'filename': <function mapfunc>, 'mode': lambda x: 'r'} -- dict of params: arg_replacer_funcs
DEFAULT_OBJECT_PATCHES = {
    'builtins.open': ['file', 'name'],
    'bz2.BZ2File': ['filename'],
    'gzip.GzipFile': ['filename'],
    'h5py.File': ['name'],    # for keras/tensorflow
    # manually add tensorflow because it's a heavyweight library
}

# simple mapping of illegal chars to underscores.
# TODO: more sophisticated function for handling illegal identifiers, e.g. number as first char
DEFAULT_CHAR_MAPPINGS = dict([(char, '_') for char in string.whitespace + string.punctuation])


## Code
def scrub_patchmap(patchmap, verbose=False):
    """Return a version of a patchmap with missing modules/callables removed.

    :param verbose: Mention each dropped module and/or function
    :param strict: Raise an error if module exists but func doesn't
    """
    result = {}

    for path, value in patchmap.items():
        modpath, obj_name = path.rsplit('.', 1)
        try:
            module = importlib.import_module(modpath)
            getattr(module, obj_name)
            result[path] = value
        except ImportError:
            if verbose:
                print("Dropped {!r} from patchmap (module {!r} not found)".format(path, modpath),
                      file=sys.stderr)
        except AttributeError:
            if verbose:
                print("Dropped {!r} from patchmap ({!r} not found in {!r})".format(path, obj_name, modpath),
                      file=sys.stderr)
    return result
DEFAULT_OBJECT_PATCHES = scrub_patchmap(DEFAULT_OBJECT_PATCHES, verbose=True)


def arg_replacement_wrapper(obj, arg_replacer_map, inject_args=False, numeric=False):
    """Creates a wrapper that replaces args, then calls obj().

    This returns a wrapped version of the original `obj` (which may be a class
    or function).

    The wrapper function has the same signature as `obj`.  When the wrapper is
    called:
        * For each `{param_name, func}` pair in arg_replacer_map
            * Argument for the specific param is replaced with `func(arg)`
        * `obj` is called with the modified arguments.

    If `inject_args` is True, args in arg_replacer_map are inserted if missing,
    and the arg_replacer func is called with `None`.

    Example:
    >>> func = arg_replacement_wrapper(open, {'file': lambda x: x + '.txt'})
    >>> func('example')  # returns open('example.txt')

    Works for functions (or class objects, to modify __init__() args).

    Note: an arg replacer map may contain numeric keys to indicate positional
        args if the signature of `obj` can't be introspected, (as for some
        builtin functions).  If both a numeric and named key match an arg, the
        replacer function associated with the numeric key is used.  if
        `inject_args` is set, then the argnums are added until a gap is found.
        So if you only have {2: lambda x: 'foo'}, it won't be injected unless
        args 0 and 1 have been given by the user.

    :param obj: Callable object to decorate
    :param arg_replacer_map:
    :returns: Decorated `obj` that replaces params using mapped functions
    :rtype: function
    """
    params = _get_params(obj)  # can be None if function params couldn't be detected
    used_params = params if params else []

    @functools.wraps(obj)
    def replacement(*args, **kwargs):
        args = list(args)
        used_kwargs = list(arg_replacer_map) if inject_args else list(kwargs)
        paramnums_to_inject = []

        for position, value in enumerate(args):
            if position in arg_replacer_map:
                # param name matched by position number
                args[position] = arg_replacer_map[position](value)
                continue
            if position >= len(used_params):
                # we have no param name for position
                continue
            paramname = params[position]
            if paramname in arg_replacer_map:
                args[position] = arg_replacer_map[paramname](value)
        for paramname in used_kwargs:
            if isinstance(paramname, int):
                paramnums_to_inject.append(paramname)
                continue
            if paramname in arg_replacer_map:
                # if injecting, paramname may not be present in kwargs.
                value = kwargs.get(paramname)   # default to None
                kwargs[paramname] = arg_replacer_map[paramname](value)  # replace arg
        # `parmnums_to_inject` is empty when `inject_args` is `False`
        for paramnum in sorted(paramnums_to_inject):
            if paramnum == len(args):
                # argnum 0 when list is 0 will inject arg 0
                args[paramnum] = arg_replacer_map[paramnum](None)  # injecting, defaults to None
        return obj(*args, **kwargs)
    return replacement


def _get_params(obj):
    """Python2 doesn't have inspect.signature, so we get params other ways
    """
    if six.PY3:
        # Add whatever funcs are necessary
        py3_sigs = {'any': ['iterable']}
        if inspect.isbuiltin(obj) and obj.__name__ in py3_sigs:
            return py3_sigs[obj.__name__][:]
        try:
            if inspect.isclass(obj):
                return list(inspect.signature(obj.__init__).parameters)
            return list(inspect.signature(obj).parameters)
        except (TypeError, ValueError):
            return None
    # PY2
    py2_sigs = {
        # Add whatever func sigs are necessary
        'open': ['name', 'mode', 'buffering'],
        'file': ['name', 'mode', 'buffering'],
        }
    if inspect.isbuiltin(obj) and obj.__name__ in py2_sigs:
        return py2_sigs[obj.__name__][:]

    try:
        if inspect.isclass(obj):
            argspec = inspect.getargspec(obj.__init__)
        else:
            argspec = inspect.getargspec(obj)
        params = argspec.args
        if argspec.varargs:
            params.append(argspec.varargs)
        if argspec.keywords:
            params.append(argspec.keywords)
        return params
    except (TypeError, ValueError):
        pass
    return None


def patch_objpath_with_argmap(full_path, arg_replacer_map, inject_args=False):
    """patch the object given in `full_path` using a func generated from `arg_replacer_map`.

    See arg_replacement_wrapper() docstring for details.

    :param full_object_path: module path to object (foo.bar)
    :param map: replacement parameters map as in patch_callable_params()
    """
    modpath, obj_name = full_path.rsplit('.', 1)
    module = importlib.import_module(modpath)
    obj = getattr(module, obj_name)
    assert callable(obj)
    replacement = arg_replacement_wrapper(obj, arg_replacer_map, inject_args=inject_args)
    return Patch(full_path, replacement)


def patch_full_module(module_path, arg_replacer_map, exclude=tuple(), include=tuple()):
    """Patch every callable with matching params in specified module

    In the root of the module specified by module_path, all attributes are checked.
    If the name starts with "__", it is skipped.
    If the name is in 'exclude', it is skipped.
    If `include` exists and the name is not in `include`, it is skipped.
    If the callable has no params matched in `arg_replacer_map`, it is skipped.

    Remaining callables are patched using `patch_objpath_with_argmap()`.

    A list of patched object paths is returned.

    :param full_path: full module path, as foo.bar.baz
    :param params_map: {param: action_func} map to apply to incoming arguments
    :param exclude: exclude these names
    :param include: only include these names
    :returns: a list of patchers (start called)
    """
    module = importlib.import_module(module_path)
    patchers = []
    param_names = set(arg_replacer_map)

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
        params = _get_params(obj)
        matching_params = set(params) & param_names

        if not matching_params:
            continue
        objpath = module_path + '.' + name
        patch_map = {param: arg_replacer_map[param] for param in matching_params}
        patchers.append(patch_objpath_with_argmap(objpath, patch_map))
    return patchers


def apply_patchmap(patch_map, arg_replacer=lambda x: x, inject_args=False):
    """Apply a patch map

    Takes a patch map with the following form:
        {'modpath.to.object': <patch>}
        ..where <patch> is one of:
            * function to replace object with
            * list of param names for `object` to send as a map of
              {param name: arg_replacer} to `arg_replacement_wrapper`
            * map of {param_name: some_replacer_func} pairs to send to
              `arg_replacement_wrapper` with `object`

    Example:
    >>> patchmap = {
        # replace maybe_download_and_extract
        'include.data.maybe_download_and_extract': lambda x: None,
        # replace open('myfile') with function that calls open(arg_replacer('myfile'))
        'six.moves.importlib.open': ['file'],
        # replace BZ2File('myfile', compresslevel=3) with a function that calls
        #         BZ2File(mapfunc('myfile'), compresslevel=5)
        'bz2.BZ2File': {'filename': <mapfunc>, 'compresslevel': lambda x: 5},
    }
    Lastly, `inject` is passed directly into `patch_objpath_with_argmap`.  It causes
    missing args to be injected as "None", then passed to the arg_replacer func, and
    ultimately to the original callable object.
    """
    # minor name conflict
    apply_patch = globals()['patch']

    patchers = []
    for obj_path, patch in patch_map.items():
        patchers.append(apply_patch(obj_path, patch, arg_replacer, inject_args))
    return patchers


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
        # changed to be Py2 compatible
        table = list(range(256))
        for ordinal in table:
            char = chr(ordinal)
            table[ordinal] = charmap.get(char, char)
        charmap = ''.join(table)

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
        for dirpath, node in expanded_mappings.items():
            if abspath.startswith(dirpath):
                relpath = abspath[len(dirpath)+1:] # drop trailing slash
                for raw_piece in relpath.split(os.path.sep):
                    piece = charmap(raw_piece) if callable(charmap) else raw_piece.translate(charmap)
                    keys = node._keys()
                    if piece not in keys:
                        raise FileNotFoundError("Quilt node path not found: {}  ({} not found in {})".format(
                            abspath, piece, keys))
                    node = getattr(node, piece)
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
                    message = "Invalid mapping: Quilt node path not found: {}  ({} not found in {})"
                    raise FileNotFoundError(message.format(nodepath, key, keys))
                node = getattr(node, key)
        if isinstance(keys, GroupNode):
            # TODO: improve errmsg to be more useful
            # XXX: if is a gorup, is not a group?  is this 'should not be a group', or 'is a group, or..?'
            raise Exception("Invalid mapping: Quilt node is not a Group: {}".format(piece))
        result[expanded_path] = node
    return result


def make_file_exists(mapfunc):
    """Using mapfunc, determine if a file exists."""
    def file_exists(filename):
        try:
            mapfunc(filename)
            return True
        except FileNotFoundError:
            return False
        except PackageException as ex:
            if str(ex) == "Must pass at least one file path":
                return True
        except Exception as ex:
            print()
            print(ex)
            print()
        else:
            pass
        raise Exception("Unknown condition in file_exists() for filename {!r}".format(filename))

    return file_exists


@contextmanager
def mapdirs(pkg, hash=None, version=None, tag=None, install=False, force=False, mappings=None,
            charmap=DEFAULT_CHAR_MAPPINGS, patchmap=None, mapfunc=None):
    """context-based virtual file support:

         with quilt.vfs.mapdirs('uciml/iris', mappings={'foo/bar':'raw'}):
             open('foo/bar/iris_names')

    """
    if patchmap is None:
        patchmap = DEFAULT_OBJECT_PATCHES
    patchers = []
    try:
        # in case of interruption/exception, patchers will contain a subset that can be backed-out
        mapfunc = make_mapfunc(pkg, hash=hash, version=version, tag=tag, force=force,
                               mappings=mappings, install=install, charmap=charmap)
        patchers.extend(apply_patchmap(patchmap, arg_replacer=mapfunc))
        yield
    finally:
        for patcher in patchers:
            patcher.stop()


def setup(pkg, hash=None, version=None, tag=None, force=False,
          mappings=None, install=False, charmap=DEFAULT_CHAR_MAPPINGS, mapfunc=None,
          **kwargs):
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
        kwargs = DEFAULT_OBJECT_PATCHES
    if mapfunc is None:
        mapfunc = make_mapfunc(pkg, hash=hash, version=version, tag=tag, force=force,
                               mappings=mappings, install=install, charmap=charmap)
    return apply_patchmap(kwargs, arg_replacer=mapfunc)



def teardown(patchers):
    for patcher in patchers:
        patcher.stop()


class Patch(object):
    """Call to patch object at `object_path` with `replacement`.

    call p.stop() to unpatch.

    This object does not attempt to read from parent module's path
    like the `mock` lib does.  This allows it to handle badly-formed
    packages that don't update modules along the imported path (like
    tensorflow).
    """
    def __init__(self, object_path, replacement):
        self.module_name, self.name = object_path.rsplit('.', 1)
        if self.module_name == 'builtins':
            self.module_name = 'six.moves.builtins'
        self.module = importlib.import_module(self.module_name)
        self.obj = getattr(self.module, self.name)
        self.replacement = replacement
        replacement.replaced_original = self.obj
        setattr(self.module, self.name, self.replacement)

    def stop(self):
        setattr(self.module, self.name, self.obj)


def patch(object_path, patch, arg_replacer=None, inject_args=False):
    """Patch a single specified object with the given patch.

    `patch` can be:
        * replacement func
        * list of params to replace args for using arg_replacer(arg)
        * dict of params and arg replacer functions so param's argument
          is replaced by patch[param](arg)
    """
    if inspect.isfunction(patch):
        return Patch(object_path, patch)
    if isinstance(patch, list):
        if not callable(arg_replacer):
            raise TypeError("Expected `arg_replacer` to be callable when `patch` is a param list.")
        patch = {param_name: arg_replacer for param_name in patch}
    return patch_objpath_with_argmap(object_path, patch, inject_args=inject_args)


def setup_tensorflow(pkg, hash=None, version=None, tag=None, force=False, mappings=None,
                     install=False, charmap=DEFAULT_CHAR_MAPPINGS, mapfunc=None, **kwargs):
    """TensorFlow is a special case - badly behaved Python API."""
    import tensorflow

    if mapfunc is None:
        mapfunc = make_mapfunc(pkg, hash=hash, version=version, tag=tag, force=force,
                               mappings=mappings, install=install, charmap=charmap)

    #TODO: checkpoints -- low-level access
    # My roadblock is when tensorflow calls tensorflow.python.pywrap_tensorflow.GetMatchingFiles.
    # I think we would need to match the functionality of whatever's happening in C there,
    # and patch over that function -- and potentially others.
    #
    # patching file_exists gets us further along in having tf read checkpoints from quilt, but
    # ultimately tf does that on a lower level, so it may be moot.
    file_exists = make_file_exists(mapfunc)

    patchmap = DEFAULT_OBJECT_PATCHES.copy()
    patchmap.update({
        ## param specifications for params that can be replaced by mapfunc
        # Patch object that GFile and and FastGFile are based on
        'tensorflow.python.lib.io.file_io.FileIO': ['name'],

        # see TODO: checkpoints -- low-level access
        'tensorflow.python.lib.io.file_io.read_file_to_string': ['filename'],
        'tensorflow.python.lib.io.file_io.get_matching_files': ['filename'],

        ## objects with specific per-param function replacements
        #'example.class.func': {'some_wrapped_param': lambda arg: arg + '.txt'}

        ## specific full-function replacements
        # see TODO: checkpoints -- low-level access
        'tensorflow.python.lib.io.file_io.file_exists': file_exists,

        # patch maybe_download() to return the Quilt filename
        # 'tensorflow.contrib.learn.datasets.base.maybe_download':
        #     lambda fn, fndir, url: mapfunc(fndir + '/' + fn),
    })
    patchmap.update(kwargs)

    # don't patch gzip.GzipFile() because TF uses gzip.GzipFile(fileobj=) instead of filename
    patchmap.pop('gzip.GzipFile', None)

    return setup(pkg, mapfunc=mapfunc, **patchmap)
