"""
parse build file, serialize package
"""
import os
import re

import yaml
import pandas as pd

from .store import PackageStore, VALID_NAME_RE, StoreException
from .const import DEFAULT_BUILDFILE, PACKAGE_DIR_NAME, RESERVED, TARGET
from .core import PackageFormat
from .util import FileWithReadProgress

class BuildException(Exception):
    """
    Build-time exception class
    """
    pass

def _is_internal_node(node):
    # all of an internal nodes children are dicts
    return all(isinstance(x, dict) for x in node.values())

def _pythonize_name(name):
    safename = re.sub('[^A-Za-z0-9_]+', '_', name)
    starts_w_number = re.match('^[0-9].*', safename)
    if starts_w_number:
        safename = ("abc%s" % safename)

    safename = safename.strip('_')

    if not VALID_NAME_RE.match(safename):
        raise BuildException("Unable to determine a Python-legal name for %s" % name)
    return safename

def _build_node(build_dir, package, name, node, target='pandas'):
    if _is_internal_node(node):
        for child_name, child_table in node.items():
            if not isinstance(child_name, str) or not VALID_NAME_RE.match(child_name):
                raise StoreException("Invalid node name: %r" % child_name)
            _build_node(build_dir, package, name + '/' + child_name, child_table)
    else: # leaf node
        rel_path = node.get(RESERVED['file'])
        if not rel_path:
            raise BuildException("Leaf nodes must define a %s key" % RESERVED['file'])
        path = os.path.join(build_dir, rel_path)

        transform = node.get(RESERVED['transform'])
        ID = 'id'
        if transform:
            if (transform not in TARGET[target]) and (transform != ID):
                raise BuildException("Unknown transform '%s' for %s @ %s" %
                                     (transform, rel_path, target))
        else: # guess transform if user doesn't provide one
            ignore, ext = splitext_no_dot(rel_path)
            if ext in TARGET[target]:
                transform = ext
                print("Inferring 'transform: %s' for %s" % (transform, rel_path))
            else:
                transform = ID
                print("No transform given for %s. Using 'transform: %s'" % (rel_path, transform))

        if transform == ID:
            print("Copying %s..." % path)
            package.save_file(path, name, rel_path)
        else:
            user_kwargs = {k: node[k] for k in node if k not in RESERVED}
            # read source file into DataFrame

            print("Serializing %s..." % path)
            try:
                df = _file_to_spark_data_frame(transform, path, target, user_kwargs)
            except ImportError:
                df = _file_to_data_frame(transform, path, target, user_kwargs)

            # serialize DataFrame to file(s)
            print("Saving as binary dataframe...")
            package.save_df(df, name, rel_path, transform, target)

def _file_to_spark_data_frame(ext, path, target, user_kwargs):
    from pyspark import sql as sparksql

    ext = ext.lower() # ensure that case doesn't matter
    spark = sparksql.SparkSession.builder.getOrCreate()
    df = spark.read.load(path, format=ext, header=True, **user_kwargs)
    for col in df.columns:
        pcol = _pythonize_name(col)
        if col != pcol:
            df = df.withColumnRenamed(col, pcol)
    return df

def _file_to_data_frame(ext, path, target, user_kwargs):
    ext = ext.lower() # ensure that case doesn't matter
    platform = TARGET.get(target)
    if platform is None:
        raise BuildException('Unsupported target platform: %s' % target)
    logic = platform.get(ext)
    if logic is None:
        raise BuildException(
            "Unsupported transform: %s. Try setting a 'transform' key." % ext)
    fname = logic['attr']
    # allow user to specify handler kwargs and override default kwargs
    kwargs = dict(logic['kwargs'])
    kwargs.update(user_kwargs)
    failover = logic.get('failover', None)
    handler = getattr(pd, fname, None)
    if handler is None:
        raise BuildException("Invalid transform: %r" % fname)

    df = None
    try_again = False
    try:
        with FileWithReadProgress(path) as fd:
            df = handler(fd, **kwargs)
    except UnicodeDecodeError as error:
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
        df = handler(path, **failover_args)

    return df

def build_package(username, package, yaml_path):
    """
    Builds a package from a given Yaml file and installs it locally.

    Returns the name of the package.
    """
    build_dir = os.path.dirname(yaml_path)
    fd = open(yaml_path)
    docs = yaml.load_all(fd)
    data = next(docs, None) # leave other dicts in the generator
    if not isinstance(data, dict):
        raise BuildException("Unable to parse YAML: %s" % yaml_path)

    contents = data.get('contents', {})
    if not isinstance(contents, dict):
        raise BuildException("'contents' must be a dictionary")
    pkgformat = data.get('format', PackageFormat.default.value)
    if not isinstance(pkgformat, str):
        raise BuildException("'format' must be a string")
    try:
        pkgformat = PackageFormat(pkgformat)
    except ValueError:
        raise BuildException("Unsupported format: %r" % pkgformat)

    store = PackageStore()
    newpackage = store.create_package(username, package, pkgformat)
    _build_node(build_dir, newpackage, '', contents)
    newpackage.save_contents()

def splitext_no_dot(filename):
    """
    Wrap os.path.splitext to return the name and the extension
    without the '.' (e.g., csv instead of .csv)
    """
    name, ext = os.path.splitext(filename)
    ext = ext.lower()
    ext.strip('.')
    return name, ext.strip('.')

def generate_build_file(startpath, outfilename=DEFAULT_BUILDFILE):
    """
    Generate a build file (yaml) based on the contents of a
    directory tree.
    """
    def _generate_contents(dir_path):
        contents = {}

        for name in os.listdir(dir_path):
            if name.startswith('.') or \
               name == PACKAGE_DIR_NAME or \
               name.endswith('~') or \
               name == outfilename:
                continue

            path = os.path.join(dir_path, name)

            if os.path.isdir(path):
                nodename = name
                ext = None
                data = _generate_contents(path)
            elif os.path.isfile(path):
                nodename, ext = splitext_no_dot(name)
                rel_path = os.path.relpath(path, startpath)
                data = dict(file=rel_path)
            else:
                continue

            try:
                safename = _pythonize_name(nodename)
                if safename in contents:
                    if ext:
                        safename = "{name}_{ext}".format(name=safename, ext=ext)
                    else:
                        print("Warning: duplicate name %r in %s." % (safename, dir_path))
                        continue
                contents[safename] = data
            except BuildException:
                warning = "Warning: could not determine a Python-legal name for {path}; skipping."
                print(warning.format(path=path))

        return contents

    buildfilepath = os.path.join(startpath, outfilename)
    if os.path.exists(buildfilepath):
        raise BuildException("Build file %s already exists." % buildfilepath)

    contents = dict(
        contents=_generate_contents(startpath)
    )

    with open(buildfilepath, 'w') as outfile:
        yaml.dump(contents, outfile, default_flow_style=False)
    return buildfilepath
