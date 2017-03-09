import os

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
