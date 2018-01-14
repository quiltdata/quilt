"""
parse build file, serialize package
"""
from collections import defaultdict, Iterable
import importlib
import json
from types import ModuleType
import os
import re
import fnmatch

from pandas.errors import ParserError
from six import iteritems, itervalues, string_types

import yaml
from tqdm import tqdm

#TODO: Use this once merged with tensorflow branch
#from .compat import pathlib
import pathlib
from .const import DEFAULT_BUILDFILE, PACKAGE_DIR_NAME, PARSERS, RESERVED
from .core import PackageFormat, BuildException, exec_yaml_python, load_yaml
from .hashing import digest_file, digest_string
from .package import Package, ParquetLib
from .store import PackageStore, VALID_NAME_RE, StoreException
# TODO: uncomment to_nodename once merged with tensorflow branch
from .util import FileWithReadProgress#, to_nodename

from . import check_functions as qc            # pylint:disable=W0611


# TODO: use imported to_nodename once merged with tensorflow branch
def to_nodename(string):
    # Replace invalid characters
    string = re.sub('[^0-9a-zA-Z_]', '_', string)

    # Replace or shift over invalid leading chars
    if string[0].isdigit():
        string = 'n' + string
    string = re.sub('^[^a-zA-Z_]+', '_', string)

    return string


def glob_insensitive(dir, pattern, path_objects=True):
    dir = pathlib.Path(dir)
    pattern = pathlib.Path(pattern)

    if pattern.anchor:
        raise BuildException("Invalid file pattern (only relative patterns are allowed): " + pattern)

    for part in pattern.parts:
        if '**' in part and part != '**':
            raise BuildException("Invalid filename pattern: received {!r}, but '**' must stand alone.".format(part))

    pat = []
    zero_or_more_dirs = r'([^/]*/)*'
    for part in pattern.parts:
        if part == '**':
            pat.append(zero_or_more_dirs)
        else:
            word = fnmatch.translate(part).rsplit(r'\Z', 1)[0]
            word = word.replace('.*', r'[^/]*')
            if pat and pat[-1] != zero_or_more_dirs:
                pat.append('/')
            pat.append(word)
    pat = ''.join(pat)
    regex = re.compile('^' + pat + '$', re.IGNORECASE)

    def match(path):
        """Case-insensitive match"""
        if not path:
            return False
        return regex.match('/'.join(path.parts)) is not None

    # TODO: optimize
    # this is potentially awful because it walks the full subdirs, but it handles case insensitivity
    # with full globbing, e.g., '**/[!c]??.TXT' matches 'subdir/foo.txt', 'subdir/subdir/goo.Txt', etc.
    for path in dir.glob('**/*'):  # case sensitive, but matches everything
        if match(path.relative_to(dir)):
            yield path if path_objects else str(path)


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
    is_leaf = not node or node.get(RESERVED['file'])
    return not is_leaf

def _pythonize_name(name):
    safename = re.sub('[^A-Za-z0-9]+', '_', name).strip('_')

    if safename and safename[0].isdigit():
        safename = "n%s" % safename

    if not VALID_NAME_RE.match(safename):
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

# TODO: Move to util?
def _is_glob(string):
    if '*' in string:
        return True
    if '?' in string:
        return True
    if '[' in string and ']' in string:
        return True
    return False

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
    TRANSFORM = RESERVED['transform']
    KWARGS = RESERVED['kwargs']
    FILE = RESERVED['file']
    from pprint import pprint
    pprint(node)

    if _is_internal_node(node):
        # NOTE: YAML parsing does not guarantee key order
        # fetch local transform and kwargs values; we do it using ifs
        # to prevent `key: None` from polluting the update
        local_args = {}
        if node.get(TRANSFORM):
            local_args[TRANSFORM] = node[TRANSFORM]
        if node.get(KWARGS):
            local_args[KWARGS] = node[KWARGS]
        group_args = ancestor_args.copy()
        group_args.update(local_args)
        # if it's not a reserved word it's a group that we can descend
        groups = {k: v for k, v in iteritems(node) if k not in RESERVED}
        for child_name, child_table in groups.items():
            if _is_glob(child_name):
                for filename in glob_insensitive(build_dir, child_name, path_objects=False):
                    # TODO: use node name conflict avoidance once merged with tensorflow branch
                    globchild_name = to_nodename(filename)
                    globchild_table = child_table.copy()
                    globchild_table[FILE] = filename
                    _build_node(build_dir, package, name + '/' + globchild_name, globchild_table, fmt,
                                checks_contents=checks_contents, dry_run=dry_run, env=env, ancestor_args=group_args)
            else:
                if not isinstance(child_name, str) or not VALID_NAME_RE.match(child_name):
                    raise StoreException("Invalid node name: %r" % child_name)
                _build_node(build_dir, package, name + '/' + child_name, child_table, fmt,
                    checks_contents=checks_contents, dry_run=dry_run, env=env, ancestor_args=group_args)
    else: # leaf node
        # handle group leaf nodes (empty groups)
        if not node:
            if not dry_run:
                package.save_group(name)
            return
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
                print("Copying %s..." % path)
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

            # Check to see that cached objects actually exist in the store
            if cachedobjs and all(os.path.exists(store.object_path(obj)) for obj in cachedobjs):
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
    except (UnicodeDecodeError, ParserError) as error:
        if failover:
            warning = "Warning: failed fast parse on input %s.\n" % path
            warning += "Switching to Python engine."
            print(warning)
            try_again = True
        else:
            raise error
    except ValueError as error:
        raise BuildException(str(error))

    if try_again:
        failover_args = {}
        failover_args.update(failover)
        failover_args.update(kwargs)
        dataframe = handler(path, **failover_args)

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
                        "Duplicate node names. %r was renamed to %r, which overlaps with %r" % (
                            name, new_safename, existing_name)
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
