import os
import re

import yaml
import pandas as pd

from .store import PackageStore, VALID_NAME_RE, StoreException
from .const import PACKAGE_DIR_NAME, TARGET
from .core import PackageFormat
from .util import FileWithReadProgress

class BuildException(Exception):
    """
    Build-time exception class
    """
    pass

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
    if isinstance(node, list):
        if len(node) != 2:
            raise BuildException(
                "Node definition must be a list of [type, path]")
        ext, rel_path = node
        path = os.path.join(build_dir, rel_path)

        if ext == 'raw':
            print("Copying %s..." % path)
            package.save_file(path, name, rel_path)
        else:
            # read source file into DataFrame
            print("Reading %s..." % path)
            df = _file_to_data_frame(ext, path, target)
            # serialize DataFrame to file(s)
            print("Writing the dataframe...")
            package.save_df(df, name, rel_path, ext, target)

    elif isinstance(node, dict):
        # TODO the problem with this, it does not seem to iterate
        # in the same order as the entries in the file, which is
        # weird as users might expect error/success messages to be in
        # file order
        for child_name, child_table in node.items():
            if not isinstance(child_name, str) or not VALID_NAME_RE.match(child_name):
                raise StoreException("Invalid table name: %r" % child_name)
            _build_node(build_dir, package, name + '/' + child_name, child_table)
    else:
        raise BuildException("Node definition must be a list or dict")

def _file_to_data_frame(ext, path, target):
    ext = ext.lower() #ensure that case doesn't matter
    platform = TARGET.get(target)
    if platform is None:
        raise BuildException('Unsupported target platform: %s' % target)
    logic = platform.get(ext)
    if logic is None:
        raise BuildException('Unsupported input file type: .%s' % ext)
    fname = logic['attr']
    kwargs = logic['kwargs']
    failover = logic.get('failover', None)
    handler = getattr(pd, fname, None)
    if handler is None:
        raise BuildException("Invalid ingest function: %r" % fname)

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
    newpackage = store.create_package(username, package)
    newpackage.set_format(pkgformat)
    _build_node(build_dir, newpackage, '', contents)

def splitext_no_dot(filename):
    """
    Wrap os.path.splitext to return the name and the extension
    without the '.' (e.g., csv instead of .csv)
    """
    name, ext = os.path.splitext(filename)
    ext.strip('.')
    return name, ext.strip('.')

def generate_build_file(startpath, outfilename='build.yml'):
    """
    Generate a build file (yaml) based on the contents of a
    directory tree.
    """
    def _generate_contents(dir_path):
        contents = {}

        for name in os.listdir(dir_path):
            if name.startswith('.') or name == PACKAGE_DIR_NAME:
                continue

            path = os.path.join(dir_path, name)

            if os.path.isdir(path):
                nodename = name
                data = _generate_contents(path)
            elif os.path.isfile(path):
                nodename, ext = splitext_no_dot(name)
                ext = ext.lower()
                rel_path = os.path.relpath(path, startpath)
                if ext in TARGET['pandas']:
                    data = [ext, rel_path]
                else:
                    data = ['raw', rel_path]
            else:
                continue

            try:
                safename = _pythonize_name(nodename)
                if safename in contents:
                    print("Warning: duplicate name %r in %s." % (safename, dir_path))
                    continue
                contents[safename] = data
            except BuildException:
                warning = "Warning: could not determine a Python-legal name for {path}; skipping."
                print(warning.format(path=path))

        return contents

    contents = dict(
        contents=_generate_contents(startpath)
    )
    buildfilepath = os.path.join(startpath, outfilename)
    with open(buildfilepath, 'w') as outfile:
        yaml.dump(contents, outfile)
    return buildfilepath
