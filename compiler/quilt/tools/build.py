"""
parse build file, serialize package
"""
from collections import defaultdict, Iterable
import glob
import importlib
import json
import os
import re
from types import ModuleType

import numpy as np
import pandas as pd
from pandas import DataFrame as df
from six import iteritems, string_types

import yaml
from tqdm import tqdm

from .compat import pathlib
from .const import DEFAULT_BUILDFILE, PACKAGE_DIR_NAME, PARSERS, RESERVED
from .core import PackageFormat
from .hashing import digest_file, digest_string
from .package import Package, ParquetLib
from .store import PackageStore, StoreException
from .util import FileWithReadProgress, is_nodename, to_nodename, parse_package

from . import check_functions as qc            # pylint:disable=W0611


class BuildException(Exception):
    """
    Build-time exception class
    """
    pass


def _have_pyspark():
    """
    Check if we're running Pyspark
    """
    if _have_pyspark.flag is None:
        try:
            if Package.get_parquet_lib() is ParquetLib.SPARK:
                import pyspark  # pylint:disable=W0612
                _have_pyspark.flag = True
            else:
                _have_pyspark.flag = False
        except ImportError:
            _have_pyspark.flag = False
    return _have_pyspark.flag
_have_pyspark.flag = None

def _path_hash(path, transform, kwargs):
    """
    Generate a hash of source file path + transform + args
    """
    sortedargs = ["%s:%r:%s" % (key, value, type(value))
                  for key, value in sorted(iteritems(kwargs))]
    srcinfo = "{path}:{transform}:{{{kwargs}}}".format(path=os.path.abspath(path),
                                                   transform=transform,
                                                   kwargs=",".join(sortedargs))
    return digest_string(srcinfo)

def _is_internal_node(node):
    is_leaf = not node or node.get(RESERVED['file']) or node.get(RESERVED['package'])
    return not is_leaf

def _pythonize_name(name):
    safename = re.sub('[^A-Za-z0-9]+', '_', name).strip('_')

    if safename and safename[0].isdigit():
        safename = "n%s" % safename

    if not is_nodename(safename):
        raise BuildException("Unable to determine a Python-legal name for %r" % name)
    return safename

def _run_checks(dataframe, checks, checks_contents, nodename, rel_path, target, env='default'):
    _ = env  # TODO: env support for checks
    print("Running data integrity checks...")
    checks_list = re.split(r'[,\s]+', checks.strip())
    unknown_checks = set(checks_list) - set(checks_contents)
    if unknown_checks:
        raise BuildException("Unknown check(s) '%s' for %s @ %s" %
                             (", ".join(list(unknown_checks)), rel_path, target))
    for check in checks_list:
        res = exec_yaml_python(checks_contents[check], dataframe, nodename, rel_path, target)
        if not res and res is not None:
            raise BuildException("Data check failed: %s on %s @ %s" % (
                check, rel_path, target))

def _gen_glob_data(dir, pattern, child_table):
    """Generates node data by globbing a directory for a pattern"""
    dir = pathlib.Path(dir)
    matched = False
    used_names = set()  # Used by to_nodename to prevent duplicate names
    # sorted so that renames (if any) are consistently ordered
    for filepath in sorted(dir.glob(pattern)):
        if filepath.is_dir():
            continue
        else:
            matched = True

        # create node info
        node_table = {} if child_table is None else child_table.copy()
        filepath = filepath.relative_to(dir)
        node_table[RESERVED['file']] = str(filepath)
        node_name = to_nodename(filepath.stem, invalid=used_names)
        used_names.add(node_name)
        print("Matched with {!r}: {!r}".format(pattern, str(filepath)))

        yield node_name, node_table

    if not matched:
        print("Warning: {!r} matched no files.".format(pattern))
        return

def _build_node(build_dir, package, name, node, fmt, target='pandas', checks_contents=None,
                dry_run=False, env='default', ancestor_args={}):
    """
    Parameters
    ----------
    ancestor_args : dict
      any transform inherited from an ancestor
      plus any inherited handler kwargs
      Users can thus define kwargs that affect entire subtrees
      (e.g. transform: csv for 500 .txt files)
      and overriding of ancestor or peer values.
      Child transform or kwargs override ancestor k:v pairs.
    """
    if _is_internal_node(node):
        # NOTE: YAML parsing does not guarantee key order
        # fetch local transform and kwargs values; we do it using ifs
        # to prevent `key: None` from polluting the update
        local_args = {}
        if node.get(RESERVED['transform']):
            local_args[RESERVED['transform']] = node[RESERVED['transform']]
        if node.get(RESERVED['kwargs']):
            local_args[RESERVED['kwargs']] = node[RESERVED['kwargs']]
        group_args = ancestor_args.copy()
        group_args.update(local_args)
        # if it's not a reserved word it's a group that we can descend
        groups = {k: v for k, v in iteritems(node) if k not in RESERVED}
        for child_name, child_table in groups.items():
            if glob.has_magic(child_name):
                # child_name is a glob string, use it to generate multiple child nodes
                for gchild_name, gchild_table in _gen_glob_data(build_dir, child_name, child_table):
                    full_gchild_name = name + '/' + gchild_name if name else gchild_name
                    _build_node(build_dir, package, full_gchild_name, gchild_table, fmt,
                        checks_contents=checks_contents, dry_run=dry_run, env=env, ancestor_args=group_args)
            else:
                if not isinstance(child_name, str) or not is_nodename(child_name):
                    raise StoreException("Invalid node name: %r" % child_name)
                full_child_name = name + '/' + child_name if name else child_name
                _build_node(build_dir, package, full_child_name, child_table, fmt,
                    checks_contents=checks_contents, dry_run=dry_run, env=env, ancestor_args=group_args)
    else:  # leaf node
        # prevent overwriting existing node names
        if name in package:
            raise BuildException("Naming conflict: {!r} added to package more than once".format(name))
        # handle group leaf nodes (empty groups)
        if not node:
            if not dry_run:
                package.save_group(name)
            return
       
        include_package = node.get(RESERVED['package'])
        if include_package:
            team, user, pkgname, subpath = parse_package(include_package, allow_subpath=True)
            existing_pkg = PackageStore.find_package(team, user, pkgname)
            if existing_pkg is None:
                raise BuildException("Package not found: %s" % include_package)

            if subpath:
                try:
                    node = existing_pkg["/".join(subpath)]
                except KeyError:                    
                    msg = "Package {team}:{owner}/{pkg} has no subpackage: {subpath}"
                    raise BuildException(msg.format(team=team,
                                                    owner=user,
                                                    pkg=pkgname,
                                                    subpath=subpath))
            else:
                node = existing_pkg.get_contents()
            package.save_package_tree(name, node)
        else:
            # handle remaining leaf nodes types
            rel_path = node.get(RESERVED['file'])
            if not rel_path:
                raise BuildException("Leaf nodes must define a %s key" % RESERVED['file'])
            path = os.path.join(build_dir, rel_path)

            # get either the locally defined transform or inherit from an ancestor
            transform = node.get(RESERVED['transform']) or ancestor_args.get(RESERVED['transform'])

            ID = 'id' # pylint:disable=C0103
            if transform:
                transform = transform.lower()
                if (transform not in PARSERS) and (transform != ID):
                    raise BuildException("Unknown transform '%s' for %s @ %s" %
                                         (transform, rel_path, target))
            else: # guess transform if user doesn't provide one
                _, ext = splitext_no_dot(rel_path)
                transform = ext
                if transform not in PARSERS:
                    transform = ID
                print("Inferring 'transform: %s' for %s" % (transform, rel_path))
            # TODO: parse/check environments:
            # environments = node.get(RESERVED['environments'])

            checks = node.get(RESERVED['checks'])
            if transform == ID:
                #TODO move this to a separate function
                if checks:
                    with open(path, 'r') as fd:
                        data = fd.read()
                        _run_checks(data, checks, checks_contents, name, rel_path, target, env=env)
                if not dry_run:
                    print("Registering %s..." % path)
                    package.save_file(path, name, rel_path)
            else:
                # copy so we don't modify shared ancestor_args
                handler_args = dict(ancestor_args.get(RESERVED['kwargs'], {}))
                # local kwargs win the update
                handler_args.update(node.get(RESERVED['kwargs'], {}))
                # Check Cache
                store = PackageStore()
                path_hash = _path_hash(path, transform, handler_args)
                source_hash = digest_file(path)

                cachedobjs = []
                if os.path.exists(store.cache_path(path_hash)):
                    with open(store.cache_path(path_hash), 'r') as entry:
                        cache_entry = json.load(entry)
                        if cache_entry['source_hash'] == source_hash:
                            cachedobjs = cache_entry['obj_hashes']
                            assert isinstance(cachedobjs, list)

                # TODO: check for changes in checks else use cache
                # below is a heavy-handed fix but it's OK for check builds to be slow  
                if not checks and cachedobjs and all(os.path.exists(store.object_path(obj)) for obj in cachedobjs):
                    # Use existing objects instead of rebuilding
                    package.save_cached_df(cachedobjs, name, rel_path, transform, target, fmt)
                else:
                    # read source file into DataFrame
                    print("Serializing %s..." % path)
                    if _have_pyspark():
                        dataframe = _file_to_spark_data_frame(transform, path, target, handler_args)
                    else:
                        dataframe = _file_to_data_frame(transform, path, target, handler_args)

                    if checks:
                        # TODO: test that design works for internal nodes... e.g. iterating
                        # over the children and getting/checking the data, err msgs, etc.
                        _run_checks(dataframe, checks, checks_contents, name, rel_path, target, env=env)

                    # serialize DataFrame to file(s)
                    if not dry_run:
                        print("Saving as binary dataframe...")
                        obj_hashes = package.save_df(dataframe, name, rel_path, transform, target, fmt)

                        # Add to cache
                        cache_entry = dict(
                            source_hash=source_hash,
                            obj_hashes=obj_hashes
                            )
                        with open(store.cache_path(path_hash), 'w') as entry:
                            json.dump(cache_entry, entry)

def _remove_keywords(d):
    """
    copy the dict, filter_keywords

    Parameters
    ----------
    d : dict
    """
    return { k:v for k, v in iteritems(d) if k not in RESERVED }

def _file_to_spark_data_frame(ext, path, target, handler_args):
    from pyspark import sql as sparksql
    _ = target  # TODO: why is this unused?
    ext = ext.lower() # ensure that case doesn't matter
    logic = PARSERS.get(ext)
    kwargs = dict(logic['kwargs'])
    kwargs.update(handler_args)

    spark = sparksql.SparkSession.builder.getOrCreate()
    dataframe = None
    reader = None
    # FIXME: Add json support?
    if logic['attr'] == "read_csv":
        sep = kwargs.get('sep')
        reader = spark.read.format("csv").option("header", "true")
        if sep:
            reader = reader.option("delimiter", sep)
        dataframe = reader.load(path)

        for col in dataframe.columns:
            pcol = _pythonize_name(col)
            if col != pcol:
                dataframe = dataframe.withColumnRenamed(col, pcol)
    else:
        dataframe = _file_to_data_frame(ext, path, target, handler_args)
    return dataframe

def _file_to_data_frame(ext, path, target, handler_args):
    _ = target  # TODO: why is this unused?
    logic = PARSERS.get(ext)
    the_module = importlib.import_module(logic['module'])
    if not isinstance(the_module, ModuleType):
        raise BuildException("Missing required module: %s." % logic['module'])
    # allow user to specify handler kwargs and override default kwargs
    kwargs = logic['kwargs'].copy()
    kwargs.update(handler_args)
    failover = logic.get('failover', None)
    handler = getattr(the_module, logic['attr'], None)
    if handler is None:
        raise BuildException("Invalid handler: %r" % logic['attr'])

    dataframe = None
    try_again = False
    try:
        size = os.path.getsize(path)
        with tqdm(total=size, unit='B', unit_scale=True) as progress:
            def _callback(count):
                progress.update(count)
            with FileWithReadProgress(path, _callback) as fd:
                dataframe = handler(fd, **kwargs)
    except ValueError as error:
        if failover:
            warning = "Warning: failed fast parse on input %s.\n" % path
            warning += "Switching to Python engine."
            print(warning)
            try_again = True
        else:
            raise BuildException(str(error))

    if try_again:
        failover_args = {}
        failover_args.update(failover)
        failover_args.update(kwargs)
        try:
            dataframe = handler(path, **failover_args)
        except ValueError as error:
            raise BuildException(str(error))

    # cast object columns to strings
    # TODO does pyarrow finally support objects?
    for name, col in dataframe.iteritems():
        if col.dtype == 'object':
            dataframe[name] = col.astype(str)

    return dataframe

def build_package(team, username, package, yaml_path, checks_path=None, dry_run=False, env='default'):
    """
    Builds a package from a given Yaml file and installs it locally.

    Returns the name of the package.
    """
    def find(key, value):
        """
        find matching nodes recursively;
        only descend iterables that aren't strings
        """
        if isinstance(value, Iterable) and not isinstance(value, string_types):
            for k, v in iteritems(value):
                if k == key:
                    yield v
                elif isinstance(v, dict):
                    for result in find(key, v):
                        yield result
                elif isinstance(v, list):
                    for item in v:
                        for result in find(key, item):
                            yield result

    build_data = load_yaml(yaml_path)
    # default to 'checks.yml' if build.yml contents: contains checks, but
    # there's no inlined checks: defined by build.yml
    if (checks_path is None and list(find('checks', build_data['contents'])) and
        'checks' not in build_data):
        checks_path = 'checks.yml'
        checks_contents = load_yaml(checks_path, optional=True)
    elif checks_path is not None:
        checks_contents = load_yaml(checks_path)
    else:
        checks_contents = None
    build_package_from_contents(team, username, package, os.path.dirname(yaml_path), build_data,
                                checks_contents=checks_contents, dry_run=dry_run, env=env)

def build_package_from_contents(team, username, package, build_dir, build_data,
                                checks_contents=None, dry_run=False, env='default'):
    contents = build_data.get('contents', {})
    if not isinstance(contents, dict):
        raise BuildException("'contents' must be a dictionary")
    pkgformat = build_data.get('format', PackageFormat.default.value)
    if not isinstance(pkgformat, str):
        raise BuildException("'format' must be a string")
    try:
        pkgformat = PackageFormat(pkgformat)
    except ValueError:
        raise BuildException("Unsupported format: %r" % pkgformat)

    # HDF5 no longer supported.
    if pkgformat is PackageFormat.HDF5:
        raise BuildException("HDF5 format is no longer supported; please use PARQUET instead.")

    # inline checks take precedence
    checks_contents = {} if checks_contents is None else checks_contents
    checks_contents.update(build_data.get('checks', {}))

    store = PackageStore()
    newpackage = store.create_package(team, username, package, dry_run=dry_run)
    _build_node(build_dir, newpackage, '', contents, pkgformat,
                checks_contents=checks_contents, dry_run=dry_run, env=env)

    if not dry_run:
        newpackage.save_contents()

def splitext_no_dot(filename):
    """
    Wrap os.path.splitext to return the name and the extension
    without the '.' (e.g., csv instead of .csv)
    """
    name, ext = os.path.splitext(filename)
    ext = ext.lower()
    return name, ext.strip('.')

def generate_contents(startpath, outfilename=DEFAULT_BUILDFILE):
    """
    Generate a build file (yaml) based on the contents of a
    directory tree.
    """
    def _ignored_name(name):
        return (
            name.startswith('.') or
            name == PACKAGE_DIR_NAME or
            name.endswith('~') or
            name == outfilename
        )

    def _generate_contents(dir_path):
        safename_duplicates = defaultdict(list)
        for name in os.listdir(dir_path):
            if _ignored_name(name):
                continue

            path = os.path.join(dir_path, name)

            if os.path.isdir(path):
                nodename = name
                ext = None
            elif os.path.isfile(path):
                nodename, ext = splitext_no_dot(name)
            else:
                continue

            safename = _pythonize_name(nodename)
            safename_duplicates[safename].append((name, nodename, ext))

        safename_to_name = {}
        for safename, duplicates in iteritems(safename_duplicates):
            for name, nodename, ext in duplicates:
                if len(duplicates) > 1 and ext:
                    new_safename = _pythonize_name(name)  # Name with ext
                else:
                    new_safename = safename
                existing_name = safename_to_name.get(new_safename)
                if existing_name is not None:
                    raise BuildException(
                        "Duplicate node names in directory %r. %r was renamed to %r, which overlaps with %r" % (
                        dir_path, name, new_safename, existing_name)
                    )
                safename_to_name[new_safename] = name

        contents = {}
        for safename, name in iteritems(safename_to_name):
            path = os.path.join(dir_path, name)

            if os.path.isdir(path):
                data = _generate_contents(path)
            else:
                rel_path = os.path.relpath(path, startpath)
                data = dict(file=rel_path)

            contents[safename] = data

        return contents

    return dict(
        contents=_generate_contents(startpath)
    )

def generate_build_file(startpath, outfilename=DEFAULT_BUILDFILE):
    """
    Generate a build file (yaml) based on the contents of a
    directory tree.
    """
    buildfilepath = os.path.join(startpath, outfilename)
    if os.path.exists(buildfilepath):
        raise BuildException("Build file %s already exists." % buildfilepath)

    contents = generate_contents(startpath, outfilename)

    with open(buildfilepath, 'w') as outfile:
        yaml.dump(contents, outfile, default_flow_style=False)
    return buildfilepath

def load_yaml(filename, optional=False):
    if optional and (filename is None or not os.path.isfile(filename)):
        return None
    with open(filename, 'r') as fd:
        data = fd.read()
    try:
        res = yaml.load(data)
    except yaml.scanner.ScannerError as error:
        mark = error.problem_mark
        message = ["Bad yaml syntax in {!r}".format(filename),
                   "  Line {}, column {}:".format(mark.line, mark.column)]
        message.extend(error.problem_mark.get_snippet().split(os.linesep))
        message.append("  " + error.problem)
        raise BuildException('\n'.join(message))
    if res is None:
        if optional:
            return None
        raise BuildException("Unable to open YAML file: %s" % filename)
    return res

def exec_yaml_python(chkcode, dataframe, nodename, path, target='pandas'):
    # TODO False vs Exception...
    try:
        # setup for eval
        qc.nodename = nodename
        qc.filename = path
        qc.data = dataframe
        eval_globals = {
            'qc': qc, 'numpy': np, 'df': df, 'pd': pd, 're': re
        }
        # single vs multi-line checks - YAML hackery
        if '\n' in str(chkcode):
            # note: python2 doesn't support named args for exec()
            # https://docs.python.org/2/reference/simple_stmts.html#exec
            exec(str(chkcode), eval_globals, {})  # pylint:disable=W0122
            res = True
        else:
            # str() to handle True/False
            res = eval(str(chkcode), eval_globals, {})  # pylint:disable=W0123
    except qc.CheckFunctionsReturn as ex:
        res = ex.result
    except Exception as ex:
        raise BuildException("Data check raised exception: %s on %s @ %s" % (ex, path, target))
    return res
