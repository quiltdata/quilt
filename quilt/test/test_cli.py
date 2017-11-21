"""
Tests for CLI

=== Adding/Removing Params ===

When a new param is created or deleted in main.py's ArgumentParser,
a test will fail.  The failed test will show the key paths for which
a test must be added or removed.

This indicates that there should be a test written for the specific
combination of arguments that has been created, and/or that tests
for arguments that no longer exist should be removed (or verified).

This helps to recognize when a change has been made that might be a
breaking change.

Key paths take the form:
    [0, 'version', 0, 'add', 0]
..where numbers indicate a positional param, and text indicates either
a permitted argument for a positional, or an option.

This currently leaves some ambiguity as to whether [0, 'foo', 'bar']
indicates:
    Anonymous positional argument 0
    Followed by required argument 'foo'
    Followed by required or optional argument 'bar'
or indicates:
    Positional 0, when 'foo' is given
    Followed by required or optional argument "bar"

This means if the argument order is restructured in a particular way,
a change may not be noticed.


=== CLI <--> Python API Testing ===

To test that the CLI is calling the API correctly, we mock the
command module using the MockCommand class.  During this process,
the following steps occur:
    * params for the specific commands tested are marked as tested
      in TESTED_PARAMS.
    * quilt is called as a subprocess with the specified options
      and QUILT_CLI_TEST="True" in the environment
    * QUILT_CLI_TEST is read and MockCommand is used
    * MockCommand emits JSON to stdout
    * JSON is read from subprocess
    * Function is verified to exist in actual command module
    * args and kwargs from CLI JSON are bound to the function
      (without calling it) to ensure that the arguments work.
    * Types, values, or other conditions may be checked by the test
      function as well.

The binding step should prevent any CLI parameters from changes or
removal (or incompatible additions) on the API side.
"""
import os
import sys
import json
from subprocess import call, check_output, PIPE, CalledProcessError

import pytest

from .utils import BasicQuiltTestCase, ArgparseIntrospector, RecursiveMappingWrapper, PACKAGE_DIR
from ..tools import command

# inspect.argspec is deprecated, so
try:
    from funcsigs import signature  # python 2.7
except ImportError:
    from inspect import signature

# When a test for CLI params is made, append the param key paths that
# the test addresses to this variable.
# Example key path by calling get_all_param_paths()
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


#TODO: Fix ambiguity of positional options vs anonymous positionals with separate options following them

def get_all_param_paths():
    """Get all paths by introspecting the ArgumentParser from main()

    This returns a list of key paths into the current param tree
    as per `get_current_param_tree()`.

    Key paths take the form:
        [0, 'version', 0, 'add', 0]
    ..where numbers indicate a positional param, and text indicates either
    a permitted argument for a positional, or an option.

    :returns: list of lists (list of key paths)
    :rtype: list
    """
    return get_missing_key_paths(get_current_param_tree(), {}, exhaustive=True)


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

def fails_binding(func, args, kwargs):
    """Check if the given `args` and `kwargs` fails binding to `func`.

    :returns: False if bound successfully, string message if failed.
    """
    try:
        signature(func).bind(*args, **kwargs)
        return False
    except TypeError as error:
        return error.args[0] if error.args and error.args[0] else "Failed to bind"


class MockCommand(object):
    _target = command
    def __getattr__(self, funcname):
        def dummy_func(*args, **kwargs):
            result = {'func': funcname, 'matched': hasattr(self._target, funcname), 'args': args, 'kwargs': kwargs}
            print(json.dumps(result, indent=4))
        return dummy_func


class TestCLI(BasicQuiltTestCase):
    def setUp(self):
        self.param_tree = get_current_param_tree()
        self.env = os.environ.copy()
        self.env['QUILT_CLI_TEST'] = "True"
        self.env['PYTHON_PATH'] = PACKAGE_DIR

        self.quilt_command = [sys.executable, '-c', 'from quilt.tools import main; main.main()']

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

    def test_cli_command_config(self):
        """Ensures the 'cli' command calls a specific API"""
        quilt = self.quilt_command
        env = self.env

        ## This test covers the following arguments that require testing
        TESTED_PARAMS.extend([
            [0, 'config'],
        ])

        ## This section tests for circumstances expected to be rejected by argparse.
        expect_fail_2_args = [
            'config --badparam'.split(),
            ]
        for args in expect_fail_2_args:
            assert call(quilt + args, env=env) == 2

        ## This section tests for appropriate types and values.
        cmd = quilt + ['config']
        result = json.loads(check_output(cmd, env=env).decode())  # Terminal default decoding

        # General tests
        assert result['matched'] is True  # func name recognized by MockCommand class?
        func = getattr(command, result['func'])
        assert not fails_binding(func, args=result['args'], kwargs=result['kwargs'])

        # Specific tests
        assert result['func'] == 'config'
        assert not result['args']
        assert not result['kwargs']

    def test_cli_command_push(self):
        quilt = self.quilt_command
        env = self.env

        ## This test covers the following arguments that require testing
        TESTED_PARAMS.extend([
            [0, 'push'],
            [0, 'push', 0],
            [0, 'push', '--public'],
            [0, 'push', '--reupload'],
        ])

        ## This section tests for circumstances expected to be rejected by argparse.
        expect_fail_2_args = [
            'push'.split(),
            'push --public'.split(),
            'push --reupload'.split(),
            'push --public --reupload'.split(),
            ]
        for args in expect_fail_2_args:
            assert call(quilt + args, env=env) == 2

        ## This section tests for appropriate types and values.
        cmd = quilt + 'push fakeuser/fakepackage'.split()
        result = json.loads(check_output(cmd, env=env).decode())  # Terminal default decoding

        # General tests
        assert result['matched'] is True    # func name recognized by MockCommand class?
        func = getattr(command, result['func'])
        assert not fails_binding(func, args=result['args'], kwargs=result['kwargs'])

        # Specific tests
        assert not result['args']
        assert result['func'] == 'push'
        assert result['kwargs']['reupload'] is False
        assert result['kwargs']['public'] is False
        assert result['kwargs']['package'] == 'fakeuser/fakepackage'

        ## Test the flags as well..
        cmd = quilt + 'push --reupload --public fakeuser/fakepackage'.split()
        result = json.loads(check_output(cmd, env=env).decode())  # Terminal default decoding

        # General tests
        assert result['matched'] is True    # func name recognized by MockCommand class?
        func = getattr(command, result['func'])
        assert not fails_binding(func, args=result['args'], kwargs=result['kwargs'])

        # Specific tests
        assert not result['args']
        assert result['func'] == 'push'
        assert result['kwargs']['reupload'] is True
        assert result['kwargs']['public'] is True
        assert result['kwargs']['package'] == 'fakeuser/fakepackage'

#TODO: Explore fast-test option by skipping subprocess call, acting on ArgumentParser directly.
#TODO: More tests!
#TODO: remove xfail once coverage is complete
@pytest.mark.xfail
def test_coverage():
    result = get_paramtest_coverage()

    assert not result['missing']  # cli params not tested yet
    assert result['percentage'] == 1
