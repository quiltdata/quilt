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
import os.path
import string
import importlib
from contextlib import contextmanager


from .nodes import GroupNode
from .tools import command
from .tools.store import parse_package


def filepatch(module_name, func_name, action_func):
    """monkeypatch an open-like function (that takes a filename as the first argument)
    to rewrite that filename to the equivalent in Quilt's objs/ directory.  This is
    beneficial for taking advantage of Quilt (file dedup, indexing, reproducibility,
    versioning, etc) without needing to rewrite code that wants to read its data from
    files."""
    try:
        from unittest.mock import patch   # Python3
    except:
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
    patcher.start()
    return patcher

DEFAULT_MODULE_MAPPINGS = {
    'builtins': 'open', 'bz2': 'BZ2File', 'gzip': 'GzipFile'
    # for keras/tensorflow
    ,'h5py': 'File',
    # manually add tensorflow because it's a heavyweight library
    #'tensorflow': 'gfile.FastGFile', 'tensorflow': 'gfile.GFile'
}

# simple mapping of illegal chars to underscores.
# TODO: more sophisticated function for handling illegal identifiers, e.g. number as first char
DEFAULT_CHAR_MAPPINGS = dict([(char, '_') for char in string.whitespace + string.punctuation])

def make_mapfunc(pkg, hash=None, version=None, tag=None, force=False,
                 mappings=None, install=False, charmap=DEFAULT_CHAR_MAPPINGS, **kwargs):
    """core support for mapping filepaths to objects in quilt local objs/ datastore.
       TODO: add support for reading/iterating directories, e.g. os.scandir() and friends
    """
    if len(kwargs) == 0:
        kwargs = DEFAULT_MODULE_MAPPINGS
    if install:
        command.install(pkg, hash=hash, version=version, tag=tag, force=force)
    owner, pkg = parse_package(pkg)
    if mappings is None:
        mappings = { ".": "" }  # TODO: test this case
    pkgname = "quilt.data."+owner+"."+pkg
    if not callable(charmap):
        fromstr = tostr = ""
        for fromchar, tochar in charmap.items():
            fromstr += fromchar
            tostr += tochar
        charmap = str.maketrans(fromstr, tostr)
    #print(pkgname)
    module = importlib.import_module("quilt.data."+owner+"."+pkg)
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

    def mapfunc(filename, mappings=mappings, charmap=charmap):
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
        for key, val in kwargs.items():
            patchers.append(filepatch(key, val, mapfunc))
        yield
    finally:
        for patcher in patchers:
            patcher.stop()

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
    return [filepatch(key, val, mapfunc) for key, val in kwargs.items()]

def teardown(patchers):
    for patcher in patchers:
        patcher.stop()
