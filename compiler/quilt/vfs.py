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
import pkg_resources

from .nodes import GroupNode
from .tools import command
from .tools.store import parse_package
from .tools.util import to_nodename, filepath_to_nodepath
from .tools.compat import pathlib


DEFAULT_MODULE_MAPPINGS = {
    'builtins': 'open',
    'bz2': 'BZ2File',
    'gzip': 'GzipFile',
    'h5py': 'File',    # for keras/tensorflow
    }

# TODO: replace global variable
PATCHERS = []

class QuiltVfsReadError(OSError):
    pass


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
DEFAULT_MODULE_MAPPINGS = scrub_patchmap(DEFAULT_MODULE_MAPPINGS, True)


def _expand_mappings(mappings, module):
    """Expand mappings and ensure they refer to group nodes

    Peeled off from make_mapfunc and simplified.
    """
    expanded_mappings = {}
    for fromdir, topath in mappings.items():
        expanded_path = os.path.abspath(os.path.expanduser(fromdir)).rstrip("/")
        node = module
        if topath not in ["", "."]:
            # this line replaces the below for loop, once done.
            #node = module._package[topath]
            for piece in topath.split('.'):
                node = getattr(node, piece)
        if not isinstance(node, GroupNode):
            # TODO: improve errmsg to be more useful
            raise ValueError("Invalid mapping: Node path is not a Group: {}".format(topath))
        expanded_mappings[expanded_path] = node
    return expanded_mappings


def make_mapfunc(pkg, mappings=None):
    """core support for mapping filepaths to objects in quilt local objs/ datastore.
       TODO: add support for reading/iterating directories, e.g. os.scandir() and friends
    """
    team, owner, pkg = parse_package(pkg)
    charmap_func = to_nodename
    if mappings is None:
        mappings = { ".": "" }  # TODO: test this case

    module = command.load(owner+'/'+pkg)
    # expand/clean dir mappings, e.g.
    # {"~asah/../foo": "."} ==> {"/Users/foo": quilt.data.uciml.raw}
    # {"foo/bar": "foo"} ==> {"/Users/asah/foo/bar": quilt.data.uciml.raw.foo}  # cwd=/Users/asah
    expanded_mappings = _expand_mappings(mappings, module)

    def mapfunc(filename, charmap_func=charmap_func):
        # TODO: disallow trailing slash - not allowed to open directories...
        abspath = os.path.abspath(os.path.expanduser(filename))
        # map subtrees:
        #   make_mapfunc("uciml/iris", mappings={".": "raw"}); open("bezdek_iris")
        #   make_mapfunc("uciml/iris"); open("raw/bezdek_iris")
        #   make_mapfunc("foo/bar", "baz/bat"); open("myfile")
        for fromdir, node in expanded_mappings.items():
            if abspath.startswith(fromdir):
                relpath = abspath[len(fromdir)+1:] # drop trailing slash
                piece = relpath  # for error when referencing node root
                for raw_piece in relpath.split("/") if relpath else relpath:  # skip ''
                    piece = charmap_func(raw_piece)
                    keys = node._keys()
                    if piece not in keys:
                        raise QuiltVfsReadError("Quilt node path not found: {}  ({} not found in {})".format(
                                                abspath, piece, keys))
                    node = getattr(node, piece)
                if isinstance(node, GroupNode):
                    raise QuiltVfsReadError("Quilt node is a Group, not a Node/file: {!r}  ({!r} not found in {})"
                                            .format(abspath, piece, node._keys()))
                return node()
        return filename
    return mapfunc


@contextmanager
def mapdirs(pkg, hash=None, version=None, tag=None, force=False,
            mappings=None, install=False, charmap=to_nodename, **kwargs):
    """context-based virtual file support:

         with quilt.vfs.mapdirs('uciml/iris', mappings={'foo/bar':'raw'}):
             open('foo/bar/iris_names')

    """
    if len(kwargs) == 0:
        kwargs = DEFAULT_MODULE_MAPPINGS
    patchers = []
    try:
        # in case of interruption/exception, patchers will contain a subset that can be backed-out
        mapfunc = make_mapfunc(pkg, mappings=mappings)
        for module_name, func_name in kwargs.items():
            patchers.append(filepatch(module_name, func_name, mapfunc))
        yield
    finally:
        for patcher in patchers:
            patcher.stop()

def setup(pkg, mappings=None, ensure_installed=True, create_if_missing=False, export=True, force_export=False,
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
    prep_package(pkg, ensure_installed=ensure_installed, create_if_missing=create_if_missing, export=export,
                 force_export=force_export)

    if len(kwargs) == 0:
        kwargs = DEFAULT_MODULE_MAPPINGS

    mapfunc = make_mapfunc(pkg, mappings=mappings)
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


def setup_keras_dataset(data_pkg, keras_dataset_name, **kwargs):
    """Keras is a special case -- patch get_file()"""
    mapfunc = make_mapfunc(data_pkg)
    def keras_mapfunc(filename, **kwargs):
        return mapfunc(filename)

    # TODO: keras checkpoints support

    patch('keras.datasets.'+keras_dataset_name, 'get_file', keras_mapfunc)


def setup_tensorflow_checkpoints(package, ensure_installed=True, create_if_missing=False, export=True,
                                 force_export=False):
    """Patch `tensorflow.train.Saver` to save to a Quilt package

    This is a quick way to utilize Quilt in a way that requires minimal
    involvement from the user, ideal for insertion into existing projects.

    For more complex scenarios, use `quilt.vfs.make_saver`.

    Params:
        See `quilt.vfs.make_saver`.
    """
    generate_tf_saver_class()
    prep_package(package=package, ensure_installed=ensure_installed, create_if_missing=create_if_missing,
                 export=export, force_export=force_export)

    team, owner, package, subpath = command.parse_package(package, allow_subpath=True)
    package = pathlib.PurePosixPath("{}{}/{}".format((team + ':' if team else ''), owner, package))
    subpath = pathlib.PurePosixPath('/'.join(subpath))

    # patch Saver.save() to read the checkpoint data and copy into Quilt.
    def save_latest_to_quilt(obj, sess, save_path, global_step=None, latest_filename="checkpoint",
                             meta_graph_suffix="meta", write_meta_graph=True, write_state=True):
        return QuiltTfSaver._save(package, subpath, obj, sess, save_path, global_step, latest_filename,
                                  meta_graph_suffix, write_meta_graph, write_state)
    return patch('tensorflow.train.Saver', 'save', save_latest_to_quilt)


## These helpers -- create_if_missing, try_export, and prep_package are meant to
#  be useful for VFS or the TF Saver subclass, but have not been integrated into VFS.
def create_if_missing(package):
    """Checks that the given package exists, and if not, creates a blank one."""
    try:
        command.load(package)
        print("Found {!r}".format(package))
    except command.CommandException as error:
        print("Creating empty package: {!r}".format(package))
        team, owner, pkg, subpath = command.parse_package_extended(package)
        command.build_package_from_contents(team, owner, pkg, '', {'contents': {}})


def try_export(package, force=False):
    """Attempts to export files from a package.

    :returns: True on success, False otherwise
    """
    try:
        module = command.load(package)
        if not module._keys():
            print("Unable to export: Empty module.")
            return False
        if force:
            print("Exporting with force=True -- may overwrite existing data")
        command.export(package, force=force)
        return True
    except AttributeError as error:
        print("Unable to export: Specified module subpath doesn't exist.")
        print("    Module subpath will be created at save time.")
        return False
    except command.CommandException as error:
        if 'subdir already exists:' not in str(error):
            raise
        print("Unable to export -- subdir already exists.")


def prep_package(package, ensure_installed=True, create_if_missing=False, export=True, force_export=False):
    """Prepare to use the specified package.

    This performs a few common activities that may be needed before usage.

    :param package: Package specified as [team:]user/pkg[/subnode...].
        Required.
    :param bool ensure_installed: Check locally for package, and install from
        registry if missing. Default `True`.
    :param bool create_if_missing: Create `package` if other options fail.
        Default `False`.
    :param bool export: Export the package before usage.  Avoids exporting
        over existing data by default.  Default `True`.
    :param bool force_export: Allow export to overwrite existing data.
        Default `False`.
    """
    team, owner, pkg, _ = command.parse_package(package, allow_subpath=True)
    team = team + ':' if team else ''
    pkg = '{team}{owner}/{pkg}'.format(**locals())

    if ensure_installed:
        try:
            command.load(pkg)
        except command.CommandException as error:
            msg = str(error)
            if not msg.startswith('Package') and msg.endswith('not found.'):
                raise

            print("Installing {!r}".format(pkg))
            try:
                command.install(pkg)
            except command.CommandException as error:
                if not 'do you need to log in?' in str(error):
                    raise
                if not create_if_missing:
                    raise
                print("Unable to find or install {!r}".format(pkg))
    if create_if_missing:
        globals()['create_if_missing'](pkg)
    if export:
        try_export(package, force=force_export)


def make_saver(*args, **kwargs):
    """Initialize a new QuiltTfSaver object.

    A `QuiltTfSaver` object will save checkpoint-related info. It is a
    subclass of `tensorflow.train.Saver` that saves checkpoint data as
    a quilt package (or part of a quilt package, when a subnode is
    specified).

    `make_saver` is a convenience factory function which calls
    `generate_tf_saver_class` if needed, then returns an instance of
    `QuiltTfSaver`.

    The `QuiltTfSaver` is used in place of a `tensorflow.train.Saver`
    object.  Only the `package` parameter is required, but setting
    other parameters may be useful.  Quilt parameters are documented
    below, and other parameters are passed onto the base `Saver` class.

    The QuiltTfSaver has safe defaults.

    Quilt parameters require keyword arguments.

    :param package: Package specified as [team:]user/pkg[/subnode...].
        Required.
    :param bool ensure_installed: Check locally for package, and
        install from registry if missing. Default `True`.
    :param bool create_if_missing: Create `package` if other options
        fail.  Default `False`.
    :param bool export: Export the package before usage.  By default,
        this tries not to overwrite existing data. Default `True`.
    :param bool force_export: Allow export to overwrite existing data.
        Default `False`.
    """
    if QuiltTfSaver is None:
        generate_tf_saver_class()
    return QuiltTfSaver(*args, **kwargs)


def generate_tf_saver_class():
    """Generate the QuiltTfSaver class.

    This makes the QuiltTfSaver class available in the `quilt.vfs`
    module.  Use this if you need to access the class without
    instantiating it first.  Otherwise, it's more direct to use the
    `make_saver` factory function.
    """
    global QuiltTfSaver

    from tensorflow import train

    class QuiltTfSaver(train.Saver):
        # See 'make_saver' for documentation.
        def __init__(self, *args, **kwargs):
            # can't do (*args, some_arg=foo, **kwargs) in py2.7, unfortunately..
            quilt_kwargs = ('quilt_package', 'ensure_installed', 'create_if_missing',
                            'export', 'force_export')
            quilt_kwargs = {key: kwargs.pop(key) for key in quilt_kwargs if key in kwargs}

            super(QuiltTfSaver, self).__init__(*args, **kwargs)

            quilt_package = quilt_kwargs.pop('quilt_package')   # required
            team, owner, package, subpath = command.parse_package(quilt_package, allow_subpath=True)
            self.quilt_package = pathlib.PurePosixPath("{}{}/{}".format((team + ':' if team else ''), owner, package))
            self.quilt_subpath = pathlib.PurePosixPath('/'.join(subpath))
            prep_package(quilt_package, **quilt_kwargs)

        def save(self, sess, save_path, global_step=None, latest_filename='checkpoint', meta_graph_suffix="meta",
                 write_meta_graph=True, write_state=True):

            return self._save(self.quilt_package, self.quilt_subpath, self, sess, save_path, global_step,
                              latest_filename, meta_graph_suffix, write_meta_graph, write_state)

        _original_save = train.Saver.save

        @classmethod
        def _save(cls, package, subpath, obj, sess, save_path, global_step, latest_filename, meta_graph_suffix,
                  write_meta_graph, write_state):
            # perform the save
            path_prefix = cls._original_save(obj, sess, save_path, global_step, latest_filename,
                                             meta_graph_suffix, write_meta_graph, write_state)

            # when mixing path types, the first one wins --
            #   examples:
            #       save_path is OS native, so save_path / subpath == an OS native path
            #       subpath is a PurePosixPath, so subpath / save_path == a PurePosixPath.

            full_package = package / subpath

            # retain OS path style by using Path()
            save_path = pathlib.Path(save_path)         # tensorboard/cifar-10
            path_prefix = pathlib.Path(path_prefix)     # tensorboard/cifar-10/-20

            # print(latest_filename)      # checkpoint
            # print(save_path)            # tensorboard/cifar-10
            # print(path_prefix)          # tensorboard/cifar-10/-20

            # Update checkpoint file
            latest_filename_file_path = save_path / latest_filename
            latest_filename_node_path = filepath_to_nodepath(full_package / latest_filename_file_path, '/')

            module = command.update(str(latest_filename_node_path), str(latest_filename_file_path))
            command.build(str(package), module)

            # read the checkpoint data and write to quilt
            used = set()
            for filepath in save_path.glob(path_prefix.name + "*"):   # foo/bar/-1234*
                file_node_path = filepath_to_nodepath(full_package / filepath, nodepath_separator='/', invalid=used)
                used.add(file_node_path)
                command.build(str(package), command.update(file_node_path, str(filepath)))
            print("Quilt: Updated checkpoint in {!r}".format(str(full_package)))
            return path_prefix
    QuiltTfSaver.__doc__ = make_saver.__doc__
QuiltTfSaver = None
