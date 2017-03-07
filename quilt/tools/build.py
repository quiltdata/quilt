import os
import re

import yaml
import pandas as pd

from .store import get_store, VALID_NAME_RE, StoreException
from .const import TARGET
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
        safename = ("a%s" % safename)

    safename = safename.rstrip('_')
    safename = safename.lstrip('_')

    if not VALID_NAME_RE.match(safename):
        raise BuildException("Unable to determine a Python-legal name for %s" % name)
    return safename

def _build_file(build_dir, store, name, rel_path, target='file'):
    path = os.path.join(build_dir, rel_path)
    store.save_file(path, name, name, target)

def _build_table(build_dir, store, name, table, target='pandas'):
    if isinstance(table, list):
        if len(table) != 2:
            raise BuildException(
                "Table definition must be a list of [type, path]")
        ext, rel_path = table
        path = os.path.join(build_dir, rel_path)
        # read source file into DataFrame
        print("Reading %s..." % path)
        df = _file_to_data_frame(ext, path, target)
        # serialize DataFrame to file(s)
        print("Writing the dataframe...")
        store.save_df(df, name, path, ext, target)

    elif isinstance(table, dict):
        # TODO the problem with this, it does not seem to iterate
        # in the same order as the entries in the file, which is
        # weird as users might expect error/success messages to be in
        # file order
        for child_name, child_table in table.items():
            if not isinstance(child_name, str) or not VALID_NAME_RE.match(child_name):
                raise StoreException("Invalid table name: %r" % child_name)
            _build_table(build_dir, store, name + '/' + child_name, child_table)
    else:
        raise BuildException("Table definition must be a list or dict")

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
        with FileWithReadProgress(path) as fd:
            df = handler(fd, **failover_args)

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

    tables = data.get('tables')
    format = data.get('format')
    files = data.get('files')
    readme = files.get('README') if files else None
    if not isinstance(tables, dict):
        raise BuildException("'tables' must be a dictionary")

    with get_store(username, package, format, 'w') as store:
        store.clear_contents()
        _build_table(build_dir, store, '', tables)
        if readme is not None:
            _build_file(build_dir, store, 'README', rel_path=readme)

def generate_build_file(startpath, outfilename='build.yml'):
    startbase = os.path.basename(startpath)
    buildfiles = {startbase : {}}
    buildtables = {startbase : {}}

    def add_to_buildfiles(path, files):
        try:
            safepath = [_pythonize_name(dir) if dir != '.' else '.' for dir in path]
        except BuildException:
            warning = "Warning: could not determine a Python-legal name for {path}; skipping."
            print(warning.format(path=os.sep.join(path)))
            return

        ptr = buildfiles
        for dir in path:
            if dir not in ptr:
                ptr[dir] = {}
            ptr = ptr[dir]
        for file in files:
            fullpath = "/".join(path + [file])
            try:
                name, ext = file.split('.')
            except ValueError:
                # file with no extension
                name = file
            ptr[_pythonize_name(name)] = fullpath

    def add_to_buildtables(path, files):
        try:
            safepath = [_pythonize_name(dir) if dir != '.' else '.' for dir in path]
        except BuildException:
            warning = "Warning: could not determine a Python-legal name for {path}; skipping."
            print(warning.format(path=os.sep.join(path)))
            return

        ptr = buildtables
        for folder in safepath:
            if folder not in ptr:
                # pythonize folder
                ptr[folder] = {}
            ptr = ptr[folder]
        for file in files:
            fullpath = "/".join(path + [file])
            name, ext = file.split('.')
            # pythonize name
            ptr[_pythonize_name(name)] = [ext.lower(), fullpath]

    for root, dirs, files in os.walk(startpath):
        # skip hidden directories
        for d in dirs:
            if d.startswith('.'):
                dirs.remove(d)

        rel_path = os.path.relpath(root, startpath)
        path = rel_path.split(os.sep)

        tablefiles = []
        rawfiles = []
        for file in files:
            # skip hidden files
            if file.startswith('.'):
                continue
            try:
                name, ext = file.split('.')
                # separate files into tables and raw
                if ext.lower() in TARGET['pandas']:
                    tablefiles.append(file)
                else:
                    rawfiles.append(file)
            except ValueError:
                # File with no extension
                rawfiles.append(file)

        if rawfiles:
            add_to_buildfiles(path, rawfiles)

        if tablefiles:
            add_to_buildtables(path, tablefiles)

    for contents in [buildfiles, buildtables]:
        if '.' in contents:
            for key in contents['.']:
                contents[key] = contents['.'][key]
            del contents['.']

    contents = dict(files=buildfiles, tables=buildtables)
    buildfilepath = os.path.join(startpath, outfilename)
    with open(buildfilepath, 'w') as outfile:
        yaml.dump(contents, outfile)
    return buildfilepath
