"""
Tests for CLI

When a new param is created or deleted in main.py's ArgumentParser,
this will throw an error.

There should be a test written for the command itself, but it must
at least be added to the KNOWN_PARAMS variable in this test.

This helps you to recognize when you are making what might be a
breaking change.
"""
from subprocess import check_output, PIPE, CalledProcessError
import shutil

import pytest
from argparse import ArgumentParser, SUPPRESS

from quilt.tools import main
from .utils import BasicQuiltTestCase, ArgparseIntrospector, RecursiveMappingWrapper

# param paths that have already been tested.
TESTED_PARAMS = []

# When adding a new param to the cli, add the param here.
# New or missing cli params can be found in test errors as keypaths,
# which are simply lists of dict keys.  These can be added to or
# removed from KNOWN_PARAMS as befits your situation.
# The end value should be the argparse 'dest' arg (if present, or None.
KNOWN_PARAMS = {
    0: {
        "access": {
            0: {
                "list": {
                    0: "package"
                },
                "add": {
                    0: "package",
                    1: "user"
                },
                "remove": {
                    0: "package",
                    1: "user",
                }
            }
        },
        "build": {
            0: "package",
            1: "path"
        },
        "check": {
            0: "path",
            "--env": "env"
        },
        "config": None,
        "delete": {
            0: "package"
        },
        "generate": {
            0: "directory"
        },
        "inspect": {
            0: "package"
        },
        "install": {
            0: "package",
            "-v": "version",
            "-x": "hash",
            "-f": "force",
            "-t": "tag"
        },
        "log": {
            0: "package"
        },
        "login": None,
        "logout": None,
        "ls": None,
        "push": {
            0: "package",
            "--public": "public",
            "--reupload": "reupload"
        },
        "search": {
            0: "query"
        },
        "tag": {
            0: {
                "list": {
                    0: "package"
                },
                "add": {
                    0: "package",
                    1: "tag",
                    2: "pkghash"
                },
                "remove": {
                    0: "package",
                    1: "tag"
                }
            }
        },
        "version": {
            0: {
                "list": {
                    0: "package"
                },
                "add": {
                    0: "package",
                    1: "version",
                    2: "pkghash"
                }
            }
        },
    }
}


def get_current_param_tree():
    """Get a tree of param names.

    This has the same structure as KNOWN_PARAMS, but contains the
    current params from main().

    :rtype: dict
    """
    from ..tools.main import argument_parser
    return ArgparseIntrospector(argument_parser()).as_dict()


def get_missing_key_paths(a, b, exhaustive=False):
    """Return key paths from a that aren't in b

    Key paths take the form of a list of keys in a which, if followed, lead to
    a missing key in b.

    If 'exhaustive' is True, then paths in `a` whose parents are known to be
    missing from `b` will also be included.  If it is False, only the topmost
    key paths will be included.
    Example:
        if two paths are missing from `b`:  ['x', 'y', 'z'] and ['x', 'y'],
        then with `exhaustive` set, both will be returned.  With `exhaustive`
        not set, only ['x', 'y'] will be returned.

    :param a: Mapping to acquire paths from
    :param b: Mapping to be tested
    :param exhaustive: Include children of paths missing from b as well
    :rtype: list
    """
    a = RecursiveMappingWrapper(a) if not isinstance(a, RecursiveMappingWrapper) else a
    b = RecursiveMappingWrapper(b) if not isinstance(b, RecursiveMappingWrapper) else b

    results = []
    for kpath in a.iterpaths():
        try:
            b[kpath]
        except KeyError:
            if exhaustive:
                results.append(kpath)
            if any(result == kpath[:len(result)] for result in results):
                continue
            results.append(kpath)
    return results


def get_paramtest_coverage():
    """Shows CLI param test coverage based on reporting by test functions.

    Returns a dict with `'missing'` and `'percentage'` keys.
    """
    param_tree = RecursiveMappingWrapper(get_current_param_tree())
    ideal_data = [tuple(v) for v in param_tree.iterpaths()]
    ideal = set(ideal_data)
    tested = set(tuple(v) for v in TESTED_PARAMS)
    # remove covered test cases that aren't in the main argparser
    tested = tested - tested.difference(ideal)
    missing = ideal - tested
    covered = ideal - missing
    return {'missing': [list(v) for v in ideal_data if v in missing],
            'percentage': len(covered) / len(ideal)}


class TestCLI(BasicQuiltTestCase):
    def setUp(self):
        self.param_tree = get_current_param_tree()

    def tearDown(self):
        pass

    def test_cli_new_param(self):
        missing_paths = get_missing_key_paths(self.param_tree, KNOWN_PARAMS, exhaustive=True)
        if missing_paths:
            message = "Unknown/new CLI params:\n\t{}"
            pytest.fail(message.format('\n\t'.join(repr(x) for x in missing_paths)))

    def test_cli_missing_param(self):
        missing_paths = get_missing_key_paths(KNOWN_PARAMS, self.param_tree, exhaustive=True)
        if missing_paths:
            message = "Missing CLI params:\n\t{}"
            pytest.fail(message.format('\n\t'.join(repr(x) for x in missing_paths)))
