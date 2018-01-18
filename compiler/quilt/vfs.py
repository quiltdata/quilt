"""
=========
Quilt VFS
=========

Basic usage
===========

The quilt VFS allows you to use file node data directly with native Python applications.
In more complex situations with non-native code, such as with TensorFlow, it can be used
by exporting, then patching save callbacks to update quilt.

Usage as context manager:
    >>> import quilt.vfs
    >>> # 'mappings' allows you to map forlders to modules.
    >>> with quilt.vfs.mapdirs('uciml/iris', mappings={'foo/bar':'raw'}):
    ...     print(open('foo/bar/iris_names').read()[0:100])

    1. Title: Iris Plants Database
        Updated Sept 21 by C.Blake - Added discrepency information

    2. Sourc
    >>> print(open('foo/bar/iris_names').read()[0:100])  # context closed, mapping no longer available.
    Traceback (most recent call last):
      File "<stdin>", line 1, in <module>
    FileNotFoundError: [Errno 2] No such file or directory: 'foo/bar/iris_names'

# --------------------------------------------------------------------------------

Explicit usage:
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

various character mapping scenarios:
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
"""
# --------------------------------------------------------------------------------
# TODO: ensure this works:
# https://github.com/xuetsing/image-classification-tensorflow/blob/master/classify.py#L13

import os.path
import importlib
from contextlib import contextmanager
import re
import glob

from .nodes import GroupNode
from .tools import command
from .tools.store import parse_package
from .tools.util import to_nodename, filepath_to_nodepath
from .tools.compat import pathlib


DEFAULT_CHAR_MAPPINGS = to_nodename

# TODO: replace global variable
PATCHERS = []

def patchers_start():
    for patcher in PATCHERS:
        patcher.start()

def patchers_stop():
    for patcher in PATCHERS:
        patcher.stop()

def filepatch(module_name, func_name, action_func):
    """monkeypatch an open-like function (that takes a filename as the first argument)
    to rewrite that filename to the equivalent in Quilt's objs/ directory.  This is
    beneficial for taking advantage of Quilt (file dedup, indexing, reproducibility,
    versioning, etc) without needing to rewrite code that wants to read its data from
    files."""
    try:
        from unittest.mock import patch   # Python3
    except ImportError:
        from mock import patch  # Python2
        if module_name == 'builtins':
            module_name = '__builtin__'

    module = importlib.import_module(module_name)
    patcher = None
    def open_func(filename, mode='r', module=module, *args, **kwargs):
        patcher.stop()
        try:
            filename = action_func(filename)
            node = module
            for piece in func_name.split('.'):
                node = getattr(node, piece)
            #print(func); print(filename);
            res = node(filename, mode=mode, *args, **kwargs)
        finally:
            patcher.start()
        return res
    patcher = patch(module_name+'.'+func_name, open_func)
    PATCHERS.append(patcher)
    patcher.start()
    return patcher


def scrub_patchmap(patchmap, verbose=False, strict=False):
    """Return a version of patchmap with missing modules/callables removed.

    :param verbose: Mention each dropped module and/or function
    :param strict: Raise an error if module exists but func doesn't
    """
    result = {}

    for module_name, funcname in patchmap.items():
        try:
            module = importlib.import_module(module_name)
        except ImportError:
            if verbose:
                print("Dropped {} from the patch map (module not present)".format(module_name))
            continue
        if not hasattr(module, funcname):
            if verbose:
                print("Dropped {}.{} from the patch map (func/class not present)".format(module, funcname))
            if strict:
                raise AttributeError("{} is missing from module {}".format(funcname, module_name))
            continue
        if not callable(getattr(module, funcname)):
            if verbose:
                print("Dropped {}.{} from the patch map (not callable)".format(module, funcname))
            if strict:
                raise TypeError("{}.{} is not callable".format(funcname, module_name))
            continue
        result[module_name] = funcname
    return result


DEFAULT_MODULE_MAPPINGS = {
    'builtins': 'open',
    'bz2': 'BZ2File',
    'gzip': 'GzipFile',
    'h5py': 'File',    # for keras/tensorflow
    # manually add tensorflow because it's a heavyweight library
    #'tensorflow': 'gfile.FastGFile',
    #'tensorflow': 'gfile.GFile',
}
DEFAULT_MODULE_MAPPINGS = scrub_patchmap(DEFAULT_MODULE_MAPPINGS, True)


def create_charmap_func(charmap):
    if callable(charmap):
        return charmap
    fromstr = tostr = ""
    for fromchar, tochar in charmap.items():
        fromstr += fromchar
        tostr += tochar
    return lambda val: val.translate(str.maketrans(fromstr, tostr))

def make_mapfunc(pkg, hash=None, version=None, tag=None, force=False,
                 mappings=None, install=False, charmap=DEFAULT_CHAR_MAPPINGS, **kwargs):
    """core support for mapping filepaths to objects in quilt local objs/ datastore.
       TODO: add support for reading/iterating directories, e.g. os.scandir() and friends
    """
    if install:
        command.install(pkg, hash=hash, version=version, tag=tag, force=force)
    team, owner, pkg = parse_package(pkg)
    charmap_func = create_charmap_func(charmap)
    if mappings is None:
        mappings = { ".": "" }  # TODO: test this case

    #print(pkgname)
    module = command.load(owner+'/'+pkg)
    # expand/clean dir mappings, e.g.
    # {"~asah/../foo": "."} ==> {"/Users/foo": ["uciml","raw"]}
    # {"foo/bar": "foo"} ==> {"/Users/asah/foo/bar": ["uciml", "raw", "foo"]}  # cwd=/Users/asah
    expanded_mappings = {}
    for fromdir, topath in mappings.items():
        expanded_path = os.path.abspath(os.path.expanduser(fromdir)).rstrip("/")
        #print('expanded_path: {} fromdir={} topath={}'.format(expanded_path, fromdir, topath))
        node = module
        keys = None
        topath = topath.strip() # just in case
        if topath not in [ "", "." ]:
            for piece in topath.strip().strip(".").split("."):
                keys = node._keys()
                #print('keys={}'.format(keys))
                if piece not in keys:
                    raise Exception("Invalid mapping: Quilt node path not found: {}  ({} not found in {})".format(
                        topath, piece, keys))
                node = getattr(node, piece)
                #print('node={}'.format(node))
        if isinstance(keys, GroupNode):
            # TODO: improve errmsg to be more useful
            raise Exception("Invalid mapping: Quilt node is not a Group: {}".format(piece))
        expanded_mappings[expanded_path] = node

    def mapfunc(filename, mappings=mappings, charmap_func=charmap_func):
        # TODO: disallow trailing slash - not allowed to open directories...
        abspath = os.path.abspath(os.path.expanduser(filename))
        # map subtrees:
        #   make_mapfunc("uciml/iris", mappings={".": "raw"}); open("bezdek_iris")
        #   make_mapfunc("uciml/iris"); open("raw/bezdek_iris")
        #   make_mapfunc("foo/bar", "baz/bat"); open("myfile")
        #print('checking {}... mappings={}'.format(filename, mappings))
        for fromdir, node in expanded_mappings.items():
            #print('{}: checking {} => {}'.format(abspath, fromdir, topath))
            if abspath.startswith(fromdir):
                relpath = abspath[len(fromdir)+1:] # drop trailing slash
                for raw_piece in relpath.split("/"):
                    piece = charmap_func(raw_piece)
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
                return node()
        return filename

    return mapfunc

@contextmanager
def mapdirs(pkg, hash=None, version=None, tag=None, force=False,
            mappings=None, install=False, charmap=DEFAULT_CHAR_MAPPINGS, **kwargs):
    """context-based virtual file support:

         with quilt.vfs.mapdirs('uciml/iris', mappings={'foo/bar':'raw'}):
             open('foo/bar/iris_names')

    """
    if len(kwargs) == 0:
        kwargs = DEFAULT_MODULE_MAPPINGS
    patchers = []
    try:
        # in case of interruption/exception, patchers will contain a subset that can be backed-out
        mapfunc = make_mapfunc(pkg, hash=hash, version=version, tag=tag, force=force,
                               mappings=mappings, install=install, charmap=charmap, **kwargs)
        for module_name, func_name in kwargs.items():
            patchers.append(filepatch(module_name, func_name, mapfunc))
        yield
    finally:
        for patcher in patchers:
            patcher.stop()

def setup(pkg, hash=None, version=None, tag=None, force=False,
          mappings=None, install=False, charmap=DEFAULT_CHAR_MAPPINGS, ensure_installed=True, **kwargs):
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
    if ensure_installed:
        try:
            command.load(pkg)
        except command.CommandException as error:
            msg = str(error)
            if not msg.startswith('Package') and msg.endswith('not found.'):
                raise
            command.install(pkg, force=True)

    if len(kwargs) == 0:
        kwargs = DEFAULT_MODULE_MAPPINGS
    mapfunc = make_mapfunc(pkg, hash=hash, version=version, tag=tag, force=force,
                           mappings=mappings, install=install, charmap=charmap, **kwargs)
    return [filepatch(module_name, fname, mapfunc) for module_name, fname in kwargs.items()]

def teardown(patchers):
    for patcher in patchers:
        patcher.stop()

def patch(module_name, func_name, action_func=lambda *args, **kwargs: None):
    """wrapper for unittest.mock.patch supporting py2 and py3 and default action func."""
    try:
        from unittest.mock import patch   # Python3
    except:
        from mock import patch  # Python2
        if module_name == 'builtins':
            module_name = '__builtin__'
    patcher = patch(module_name+'.'+func_name, action_func)
    patcher.start()
    return patcher

def setup_keras_dataset(data_pkg, keras_dataset_name, hash=None, version=None, tag=None, force=False,
                        mappings=None, install=False, charmap=DEFAULT_CHAR_MAPPINGS, **kwargs):
    """Keras is a special case -- patch get_file()"""
    mapfunc = make_mapfunc(data_pkg)
    def keras_mapfunc(filename, **args):
        return mapfunc(filename)

    # TODO: keras checkpoints support

    patch('keras.datasets.'+keras_dataset_name, 'get_file', keras_mapfunc)

## Abandoned?
# def setup_tensorflow(data_pkg, chkpt_pkg=None, checkpoints_nodepath="checkpoints",
#                      hash=None, version=None, tag=None, force=False,
#                      mappings=None, install=False, charmap=DEFAULT_CHAR_MAPPINGS, **kwargs):
#     """TensorFlow is a special case - badly behaved Python API."""
#     if chkpt_pkg is None:
#         chkpt_pkg = data_pkg
#     import tensorflow
#     tensorflow.python = tensorflow  # hack: needs to be a module
#     tensorflow.python.platform = tensorflow  # hack: needs to be a module
#     module_mappings = DEFAULT_MODULE_MAPPINGS.copy()
#     # unpatch gzip.GzipFile() because TF uses gzip.GzipFile(fileobj=) instead of filename
#     del module_mappings['gzip']
#     # patch gfile.Open()
#     module_mappings['tensorflow.python.platform.gfile'] = 'Open'
#     setup(data_pkg, hash=hash, version=version, tag=tag, force=force,
#           mappings=mappings, install=install, charmap=charmap, **module_mappings)
#     # patch maybe_download() to return the Quilt filename
#     mapfunc = make_mapfunc(data_pkg, hash=hash, version=version, tag=tag, force=force,
#           mappings=mappings, install=install, charmap=charmap, **module_mappings)
#     patch('tensorflow.contrib.learn.datasets.base', 'maybe_download',
#           lambda fn, fndir, url: mapfunc(fndir+'/'+fn))

def setup_tensorflow_checkpoints(pkg, checkpoints_nodepath="checkpoints"):
    """TensorFlow is a special case - badly behaved Python API."""
    # TODO: add features, e.g. configurable checkpoints path
    import tensorflow
    # export prev checkpoints, which are too hard to virtualize because
    # TF has complex I/O functions to find the latest checkpoint etc.
    command.export(pkg, force=True, filter=lambda path: re.search('/?tensorboard/', path))

    # XXX: We could also subclass Saver(), as a Saver object is always needed to save progress
    # patch Saver.save() to read the checkpoint data and copy into Quilt.
    def save_latest_to_quilt(obj,
                             sess,
                             save_path,
                             global_step=None,
                             latest_filename="checkpoint",
                             meta_graph_suffix="meta",
                             write_meta_graph=True,
                             write_state=True,
                             ):

        # Stop any patching we're currently doing, including this function
        save_patcher.stop()  # Patcher for this function -- defined below in parent scope.
        patchers_stop()

        # allow save() to proceed as normal
        path_prefix = obj.save(sess, save_path, global_step, latest_filename,
                               meta_graph_suffix, write_meta_graph, write_state)

        # read the latest checkpoint file and write to quilt
        last_chk_path = tensorflow.train.latest_checkpoint(checkpoint_dir=save_path)
        # TODO: Agnostic posix/nt/pure paths using pathlib
        pkginfo = pkg+'/'+checkpoints_nodepath+'/'+latest_filename
        command.build(pkg, command.update(pkginfo, os.path.join(save_path, latest_filename)))

        # read the checkpoint data and write to quilt
        for filename in glob.glob(path_prefix + "*"):  # foo/bar/-1234*
            basename = os.path.basename(filename)   # foo/bar/-1234.meta ==> -1234.meta
            quilt_path = pkg + '/' + filepath_to_nodepath(checkpoints_nodepath+'/'+basename, '/')
            command.build(pkg, command.update(quilt_path, filename))

        #print('save_latest_to_quilt done.  path_prefix={}  pkg={}'.format(path_prefix, pkg))
        patchers_start()
        save_patcher.start()
        return path_prefix
    save_patcher = patch('tensorflow.train.Saver', 'save', save_latest_to_quilt)
