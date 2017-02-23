"""
Helper functions.
"""
import os.path
import re

from appdirs import user_data_dir

from .const import NodeType

APP_NAME = "QuiltCli"
APP_AUTHOR = "QuiltData"
BASE_DIR = user_data_dir(APP_NAME, APP_AUTHOR)

def file_to_str(fname):
    """
    Read a file into a string
    PRE: fname is a small file (to avoid hogging memory and its discontents)
    """
    data = None
    # rU = read with Universal line terminator
    with open(fname, 'rU') as f:
        data = f.read()
    return data

def flatten_contents(contents, prefix=[]):
    assert isinstance(contents, dict)
    elements = {}
    for key, node in contents.items():
        print("Node is: {node}".format(node=node))
        assert isinstance(node, dict), "Node is: {node}".format(node=node)
        path = prefix + [key]
        type = NodeType(node.pop('type'))
        if type is NodeType.TABLE:
            fullname = ".".join(path)
            elements[fullname] = node['hash']
        elif type is NodeType.GROUP:
            elements.update(flatten_contents(node, prefix + [key]))
        else:
            assert False, "Unknown NodeType? {type}".format(type=type.value)

    return elements
