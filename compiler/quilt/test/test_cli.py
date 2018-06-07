"""
Tests for CLI

Quick reference:
    When adding a new test, the test should append the specific param
        key paths it covers to TESTED_PARAMS.
    When test_cli_new_param or test_cli_missing_param fails, add or
        remove the param key paths from KNOWN_PARAMS, and add/remove
        related tests, which should be easily findable by the key path.
    When test_coverage fails, the path is present in KNOWN_PARAMS, but
        no test has added the key path to TESTED_PARAMS.

=== Adding/Removing Params ===
Terminology:
    param tree: param info represented by an `ArgparseIntrospector`
    keypath: A list, containing indexes into a nested mapping.
        A keypath can be used directly to get an item from an
        `ArgparseIntrospector` object, for example:
            keypath = [0, 'access', 0, 'add', 0]
            params = get_all_param_paths()
            # returns 'package', which is the name of the first param
            # for 'quilt access add <package>, <user>'
            params[keypath]

Usage:
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


=== CLI <--> Python API Testing ===

To test that the CLI is calling the API correctly, we mock the
command module using the MockObject class.  During this process,
the following steps occur:
    * params for the specific commands to be tested are marked as
      tested in TESTED_PARAMS.
    * If the OS environment has QUILT_TEST_CLI_SUBPROC=True
      * Quilt is called as a subprocess with the specified options
        and QUILT_TEST_CLI_SUBPROC="True" in the environment
      * QUILT_TEST_CLI_SUBPROC is read and MockObject is used
        by tools/main.py
      * MockObject emits JSON to stdout
      * JSON is read from subprocess
    * Otherwise:
      * quilt.tools.main.command is mocked with MockObject
      * quilt.tools.main.argument_parser() is called
      * quilt.tools.main.main() is called with parsed args
    * Function calls are read from MockObject instance
    * Function is verified to exist in actual command module
    * args and kwargs are bound to the function (without calling it)
      to ensure that the arguments work.
    * Types, values, or other conditions to be sent to the command
      function may be checked by the specific test as well.

The binding step should prevent any CLI parameters from changes or
removal (or incompatible additions) on the API side.
"""
#NOTE: This is slow in subproc mode due to frequent quilt executions (see #194)
#TODO: More tests!
#TODO: remove xfail from test_coverage() once coverage is complete

# BUG: (minor) add args/kwargs items into param trees.
# It's not very easy to do this, but it fixes the issue that
# we currently leave some ambiguity as to whether [0, 'foo', 'bar']
# indicates:
#     Anonymous positional argument 0
#     Followed by required argument 'foo'
#     Followed by required or optional argument 'bar'
# or indicates:
#     Positional 0, when 'foo' is given
#     Followed by required or optional argument "bar"
#
# This means if the argument order is restructured in a particular way,
# a change may not be noticed.  And, as we all know, if it's possible,
# it will eventually occur.
# Fixing this improves our coverage, but might be somewhat complex.

import collections
import inspect
import json
import os
import pkg_resources
import signal
import sys

from subprocess import check_output, CalledProcessError, Popen, PIPE

import pytest
from six import string_types, PY2

from ..tools.const import EXIT_KB_INTERRUPT
from .utils import BasicQuiltTestCase

# inspect.argspec is deprecated, so
try:
    from funcsigs import signature  # python 2.7
except ImportError:
    from inspect import signature


## "Static" vars
_TEST_DIR = os.path.dirname(os.path.abspath(__file__))
_QUILT_DIR = os.path.dirname(_TEST_DIR)
PACKAGE_DIR = os.path.dirname(_QUILT_DIR)

# When a test for CLI params is called, append the param key paths that
# the test addresses to this variable.
# Get an example key path by calling get_all_param_paths()
TESTED_PARAMS = []

## KNOWN_PARAMS
# This is a list of keypaths.
# When adding a new param to the cli, add the param here.
# New or missing cli param keypaths can be found in test errors,
# These can be directly added or removed from the KNOWN_PARAMS
# variable, as befits your situation.
KNOWN_PARAMS = [
    ['--dev'],
    ['--version'],
    [0],
    [0, 'access'],
    [0, 'access', 0],
    [0, 'access', 0, 'add'],
    [0, 'access', 0, 'add', 0],
    [0, 'access', 0, 'add', 1],
    [0, 'access', 0, 'list'],
    [0, 'access', 0, 'list', 0],
    [0, 'access', 0, 'remove'],
    [0, 'access', 0, 'remove', 0],
    [0, 'access', 0, 'remove', 1],
    [0, 'audit'],
    [0, 'audit', 0],
    [0, 'build'],
    [0, 'build', 0],
    [0, 'build', 1],
    [0, 'check'],
    [0, 'check', '--env'],
    [0, 'check', 0],
    [0, 'config'],
    [0, 'delete'],
    [0, 'delete', 0],
    [0, 'export'],
    [0, 'export', 0],
    [0, 'export', 1],
    [0, 'export', '-f'],
    [0, 'export', '-s'],
    [0, 'generate'],
    [0, 'generate', 0],
    [0, 'help'],
    [0, 'help', 0],
    [0, 'inspect'],
    [0, 'inspect', 0],
    [0, 'install'],
    [0, 'install', '-f'],
    [0, 'install', '-m'],
    [0, 'install', '-t'],
    [0, 'install', '-v'],
    [0, 'install', '-x'],
    [0, 'install', 0],
    [0, 'log'],
    [0, 'log', 0],
    [0, 'login'],
    [0, 'login', 0],
    [0, 'logout'],
    [0, 'ls'],
    [0, 'push'],
    [0, 'push', '--public'],
    [0, 'push', '--team'],
    [0, 'push', '--reupload'],
    [0, 'push', 0],
    [0, 'rm'],
    [0, 'rm', '-f'],
    [0, 'rm', 0],
    [0, 'search'],
    [0, 'search', 0],
    [0, 'tag'],
    [0, 'tag', 0],
    [0, 'tag', 0, 'add'],
    [0, 'tag', 0, 'add', 0],
    [0, 'tag', 0, 'add', 1],
    [0, 'tag', 0, 'add', 2],
    [0, 'tag', 0, 'list'],
    [0, 'tag', 0, 'list', 0],
    [0, 'tag', 0, 'remove'],
    [0, 'tag', 0, 'remove', 0],
    [0, 'tag', 0, 'remove', 1],
    [0, 'user'],
    [0, 'user', 0],
    [0, 'user', 0, 'create'],
    [0, 'user', 0, 'create', 0],
    [0, 'user', 0, 'create', 1],
    [0, 'user', 0, 'create', 2],
    [0, 'user', 0, 'delete'],
    [0, 'user', 0, 'delete', 0],
    [0, 'user', 0, 'delete', '-f'],
    [0, 'user', 0, 'delete', 1],
    [0, 'user', 0, 'disable'],
    [0, 'user', 0, 'disable', 0],
    [0, 'user', 0, 'disable', 1],
    [0, 'user', 0, 'enable'],
    [0, 'user', 0, 'enable', 0],
    [0, 'user', 0, 'enable', 1],
    [0, 'user', 0, 'list'],
    [0, 'user', 0, 'list', 0],
    [0, 'user', 0, 'reset-password'],
    [0, 'user', 0, 'reset-password', 0],
    [0, 'user', 0, 'reset-password', 1],
    [0, 'version'],
    [0, 'version', 0],
    [0, 'version', 0, 'add'],
    [0, 'version', 0, 'add', 0],
    [0, 'version', 0, 'add', 1],
    [0, 'version', 0, 'add', 2],
    [0, 'version', 0, 'list'],
    [0, 'version', 0, 'list', 0],
]


## Helper functions
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

    :rtype: ArgparseIntrospector
    """
    from ..tools import main
    return ArgparseIntrospector(main.argument_parser())


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

    :param a: ArgparseIntrospector or list of paths to acquire paths from
    :param b: ArgparseIntrospector or list of paths be tested
    :param exhaustive: Include children of paths missing from b as well
    :rtype: list
    """
    if isinstance(a, ArgparseIntrospector):
        a = list(a.iterpaths())
    if isinstance(b, ArgparseIntrospector):
        b = list(b.iterpaths())
    b_set = set(tuple(kp) for kp in b)

    results = []
    for kpath in a:
        if tuple(kpath) not in b_set:
            results.append(kpath)
    return results


def get_paramtest_coverage():
    """Shows CLI param test coverage based on reporting by test functions.

    Returns a dict with `'missing'` and `'percentage'` keys.
    """
    ideal_data = [tuple(v) for v in get_all_param_paths()]
    ideal = set(ideal_data)
    tested = set(tuple(v) for v in TESTED_PARAMS)
    # remove covered test cases that aren't in the main argparser
    tested &= ideal
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


class ArgparseIntrospector(collections.Mapping):
    def __init__(self, argparse_object, ignore=('-h', '--help'), leaf_func=lambda x: getattr(x, 'dest', None)):
        """Create a parameter tree from an argparse parser.

        Once an ArgumentParser is configured, it can be passed as the param
        `argparse_object`, which makes the parameters available as a tree.

        If any parameter has an item from `ignore` in its opton strings, it
        will be excluded from the tree and from iteration.

        The `leaf_func` param warrants a bit more of an in-depth description.
        When an object is found not to have any further children, it is passed
        to the leaf_func.  The returned value is then entered into the tree.
        The default function simply returns the object's "dest" attribute,
        which acts as a very short description of what the argument is, in
        this case.

        :param argparse_object: A (configured) ArgumentParser object
        :param ignore: Ignore arguments in given iterable (-h, --help by default)
        :param leaf_func: Receives an object.  Data returned is entered into tree.
        """
        self.data = argparse_object
        self.ignored = ignore
        self.leaf_func = leaf_func

    def __getitem__(self, key):
        """Fetch value by key or key path."""
        if not isinstance(key, list):
            return self._getitem(key)
        key_path = key
        if not key_path:
            raise KeyError("empty key path list")
        value = self
        for k in key_path:
            try:
                value = value[k]
            except (KeyError, TypeError):
                raise KeyError("Invalid key path", key_path)
        return value

    def _getitem(self, k):
        if k in self.ignored:
            raise KeyError("Ignored: {!r}".format(k))

        if isinstance(k, int):
            positionals = self.data._get_positional_actions()
            try:
                action = positionals[k]
            except IndexError:
                raise KeyError(k)
            choices = action.choices
            if not choices:
                return self.leaf_func(action)
            return collections.OrderedDict((choice, ArgparseIntrospector(parser))
                                            for choice, parser in choices.items())
        else:
            optionals = self.data._get_optional_actions()
            for o in optionals:
                if k in o.option_strings:
                    return self.leaf_func(o)
        raise KeyError(k)

    def __len__(self):
        return len(tuple(self.__iter__()))

    def __iter__(self):
        for index, positional in enumerate(self.data._get_positional_actions()):
            yield index
        for optional in self.data._get_optional_actions():
            if any(s in self.ignored for s in optional.option_strings):
                continue
            yield optional.option_strings[0]

    def as_dict(self):
        def _mcopy(old):
            if not old:
                return self.leaf_func(old.data)
            if not isinstance(old, collections.Mapping):
                return old
            new = {}
            for k, v in old.items():
                new[k] = _mcopy(v) if v else None
            return new
        return _mcopy(self)

    @classmethod
    def _iterpaths(cls, mapping, sortkey=lambda x: repr(x)):
        """Iterate recursively over contained keys and key paths"""
        if sortkey:
            keys = sorted(mapping, key=sortkey)
        else:
            keys = mapping.keys()
        for key in keys:
            value = mapping[key]
            yield [key]
            if isinstance(value, collections.Mapping):
                for path in cls._iterpaths(value, sortkey):
                    yield [key] + path

    def iterpaths(self, sortkey=lambda x: repr(x)):
        for x in self._iterpaths(self, sortkey):
            yield x

    def __repr__(self):
        message = "ArgparseIntrospector with args: [\n    {}\n]"
        args = '\n    '.join(repr(x) for x in self.iterpaths())
        return message.format(args)


class MockObject(object):
    """Mocks objects with callables.

    For any attribute that is accessed, if that attribute is callable
    or doesn't exist, it retrieves a fake callabe.
    The fake callable does the following:
      * asserts that self._result is empty
      * records the call args as self._result
      * records whether or not the function existed
      * if use_stdout is True, it prints json of _result to stdout
    """
    _target = None
    __result = {}

    def __init__(self, target, use_stdout=False):
        self._target = target
        self._use_stdout = use_stdout

    @property
    def _result(self):
        """Deletes itself after being read."""
        result = self.__result
        self.__result = {}
        return result

    @_result.setter
    def _result(self, v):
        assert not self.__result
        self.__result = v

    def __getattr__(self, attrname):
        matched = hasattr(self._target, attrname)
        attr = getattr(self._target, attrname, None)

        # don't mock non-callable attributes
        if matched and not callable(attr):
            return attr
        # don't mock exceptions
        if inspect.isclass(attr) and issubclass(attr, BaseException):
            return attr

        def dummy_func(*args, **kwargs):
            bind_failure = fails_binding(attr, args=args, kwargs=kwargs)

            result = {
                'func': attrname,
                'matched': matched,
                'args': args,
                'kwargs': kwargs,
                'bind failure': bind_failure,
            }

            if self._use_stdout:
                print(json.dumps(result, indent=4))
            self._result = result
        return dummy_func


class TestCLI(BasicQuiltTestCase):
    def setUp(self):
        # must be imported from within functions to avoid circular import
        from ..tools import main, command

        self.mock_command = MockObject(command)
        main.command = self.mock_command
        self._main = main

        self.param_tree = get_current_param_tree()
        self.parser = self.param_tree.data

        # used when using subprocess calls
        self.env = os.environ.copy()
        self.env['PYTHON_PATH'] = PACKAGE_DIR

        self.quilt_command = [sys.executable, '-c', 'from quilt.tools import main; main.main()',
                              'quilt testing']
        self.quilt_shell_command = ' '.join([sys.executable, '-c',
                                             '"from quilt.tools import main; main.main()"',
                                             '"quilt testing"'])

    def tearDown(self):
        # restore the real 'command' module back to the 'main' module
        self._main.command = self.mock_command._target

    def execute(self, cli_args):
        """Execute a command using the method specified by the environment

        When "QUILT_TEST_CLI_SUBPROC" is set to "True", use a subprocess.
        Otherwise, call main() directly.

        :returns: dict of return codes and calls made to `command` functions
        """
        # CLI mode -- actually executes "quilt <cli args>"
        # This mode is preferable, once quilt load times improve.
        if self.env.get('QUILT_TEST_CLI_SUBPROC', '').lower() == 'true':
            return self.execute_cli(cli_args)
        # Fast mode -- calls main.main(cli_args) instead of actually executing quilt
        else:
            return self.execute_fast(cli_args)

    def execute_cli(self, cli_args):
        """Execute quilt <cli_args> by executing quilt in a subprocess

        Typically only runs when 'QUILT_TEST_CLI_SUBPROC' is set, and also
        sets it in the subprocess OS environment.

        This method is preferable for completeness of testing, but currently
        quilt loads far too slowly for it to be useful except perhaps in
        automated testing like Travis or Appveyor.
        """
        result = {}

        quilt = self.quilt_command
        cmd = quilt + cli_args
        env = self.env.copy()

        if not env.get('QUILT_TEST_CLI_SUBPROC', '').lower() == 'true':
            env['QUILT_TEST_CLI_SUBPROC'] = "True"

        try:
            result = json.loads(check_output(cmd, env=env).decode())
            result['return code'] = 0
        except CalledProcessError as error:
            result['return code'] = error.returncode
        return result

    def execute_fast(self, cli_args):
        """Execute quilt by calling quilt.tools.main.main(cli_args)

        This process is significantly faster than execute_cli, but may be
        slightly less complete.
        """
        result = {}
        try:
            self._main.main(cli_args)
        except SystemExit as error:
            result['return code'] = error.args[0] if error.args else 0
        else:
            result['return code'] = 0
        result.update(self.mock_command._result)
        return result

    def execute_with_checks(self, cli_args, funcname):
        """Execute via self.execute, then perform basic checks on the results

        Convenience method.

        This may not always be applicable, but it checks a few commond conditions.
        """
        result = self.execute(cli_args)

        assert result['return code'] == 0      # command accepted by argparse?
        assert result['matched'] is True       # found func in mocked object?
        assert not result['bind failure']      # argparse calling args matched func args?
        assert not result['args']              # only kwargs were used to call the function?
        assert result['func'] == funcname      # called func matches expected funcname?

        return result

    def test_cli_new_param(self):
        missing_paths = get_missing_key_paths(self.param_tree, KNOWN_PARAMS, exhaustive=True)
        if missing_paths:
            message = "Unknown/new CLI param key paths:\n\t{}"
            pytest.fail(message.format('\n\t'.join(repr(x) for x in missing_paths)))

    def test_cli_missing_param(self):
        missing_paths = get_missing_key_paths(KNOWN_PARAMS, self.param_tree, exhaustive=True)
        if missing_paths:
            message = "Missing CLI param key paths:\n\t{}"
            pytest.fail(message.format('\n\t'.join(repr(x) for x in missing_paths)))

    def test_cli_command_config(self):
        """Ensures the 'config' command calls a specific API"""
        ## This test covers the following arguments that require testing
        TESTED_PARAMS.extend([
            [0, 'config'],
        ])

        ## This section tests for circumstances expected to be rejected by argparse.
        expect_fail_2_args = [
            'config --badparam'.split(),
            ]
        for args in expect_fail_2_args:
            assert self.execute(args)['return code'] == 2

        ## This section tests for appropriate types and values.
        cmd = ['config']
        result = self.execute_with_checks(cmd, funcname='config')

        assert not result['kwargs']

    def test_cli_command_login(self):
        """Ensures the 'login' command calls a specific API"""
        ## This test covers the following arguments that require testing
        TESTED_PARAMS.extend([
            [0, 'login'],
            [0, 'login', 0],
        ])

        ## This section tests for circumstances expected to be rejected by argparse.
        expect_fail_2_args = [
            'login too many params'.split(),
            ]
        for args in expect_fail_2_args:
            assert self.execute(args)['return code'] == 2, 'with args: ' + str(args)

        ## This section tests for acceptable types and values.
        # plain login
        cmd = ['login']
        result = self.execute_with_checks(cmd, funcname='login')

        assert result['kwargs']['team'] is None

        # login with team name
        cmd = ['login', 'example_team']
        result = self.execute_with_checks(cmd, funcname='login')

        assert result['kwargs'] == {'team': 'example_team'}

    def test_cli_command_logout(self):
        """Ensures the 'login' command calls a specific API"""
        ## This test covers the following arguments that require testing
        TESTED_PARAMS.extend([
            [0, 'logout'],
        ])

        ## This section tests for circumstances expected to be rejected by argparse.
        expect_fail_2_args = [
            'logout too many params'.split(),
            ]
        for args in expect_fail_2_args:
            assert self.execute(args)['return code'] == 2, 'with args: ' + str(args)

        ## This section tests for acceptable types and values.
        cmd = ['logout']
        result = self.execute_with_checks(cmd, funcname='logout')
        assert not result['args']

    def test_cli_command_push(self):
        ## This test covers the following arguments that require testing
        TESTED_PARAMS.extend([
            [0, 'push'],
            [0, 'push', 0],
            [0, 'push', '--public'],
            [0, 'push', '--reupload'],
            [0, 'push', '--team'],
            [0, 'push', '--team', '--public'],
        ])

        ## This section tests for circumstances expected to be rejected by argparse.
        expect_fail_2_args = [
            'push'.split(),
            'push --public'.split(),
            'push --reupload'.split(),
            'push --public --reupload'.split(),
            'push --public --team'.split(),
            ]
        for args in expect_fail_2_args:
            assert self.execute(args)['return code'] == 2, "using args: " + str(args)

        ## This section tests for appropriate types and values.
        cmd = 'push fakeuser/fakepackage'.split()
        result = self.execute_with_checks(cmd, funcname='push')

        assert result['kwargs'] == {
            'reupload': False,
            'is_public': False,
            'package': 'fakeuser/fakepackage',
            'is_team': False,
        }

        ## Test the flags as well..
        # public (and reupload)
        cmd = 'push --reupload --public fakeuser/fakepackage'.split()
        result = self.execute_with_checks(cmd, funcname='push')

        assert result['kwargs'] == {
            'reupload': True,
            'is_public': True,
            'package': 'fakeuser/fakepackage',
            'is_team': False,
        }

        # team (without reupload)
        cmd = 'push --reupload --team blah:fakeuser/fakepackage'.split()
        result = self.execute_with_checks(cmd, funcname='push')

        assert result['kwargs'] == {
            'reupload': True,
            'is_public': False,
            'package': 'blah:fakeuser/fakepackage',
            'is_team': True,
        }

    def test_cli_command_export(self):
        ## This test covers the following arguments that require testing
        TESTED_PARAMS.extend([
            [0, 'export'],
            [0, 'export', 0],
            [0, 'export', 1],
            [0, 'export', '-f'],
            [0, 'export', '-s'],
            ])

        ## This section tests for circumstances expected to be rejected by argparse.
        expect_fail_2_args = [
            'export'.split(),
            'export too many args'.split(),
            ]
        for args in expect_fail_2_args:
            assert self.execute(args)['return code'] == 2

        ## This section tests for appropriate types and values.
        # run the command
        cmd = 'export fakeuser/fakepackage'.split()
        result = self.execute_with_checks(cmd, funcname='export')

        assert result['kwargs'] == {
            'package': 'fakeuser/fakepackage',
            'output_path': '.',
            'force': False,
            'symlinks': False,
        }

        # run command with dest
        cmd = 'export fakeuser/fakepackage fakedir'.split()
        result = self.execute_with_checks(cmd, funcname='export')

        assert result['kwargs'] == {
            'package': 'fakeuser/fakepackage',
            'output_path': 'fakedir',
            'force': False,
            'symlinks': False,
        }

        # run command with force
        cmd = 'export fakeuser/fakepackage fakedir --force'.split()
        result = self.execute_with_checks(cmd, funcname='export')

        assert result['kwargs'] == {
            'package': 'fakeuser/fakepackage',
            'output_path': 'fakedir',
            'force': True,
            'symlinks': False,
        }

        # run command with symlinks
        cmd = 'export fakeuser/fakepackage fakedir --symlinks'.split()
        result = self.execute_with_checks(cmd, funcname='export')

        assert result['kwargs'] == {
            'package': 'fakeuser/fakepackage',
            'output_path': 'fakedir',
            'force': False,
            'symlinks': True,
        }

    def test_cli_option_dev_flag(self):
        # also test ctrl-c
        if os.name == 'nt':
            # Due to how Windows handles ctrl-c events with process groups and consoles,
            # it's not really feasible to test this on Windows because it will want to kill
            # PyTest (and/or the console on the testing system), or to just kill the
            # subprocess (kill -9 equivalent).
            #
            # It *may* be possible if we create a separate terminal for testing, join it,
            # disable ctrl-c events in our own process and our parent process (if any, f.e.
            # when running in appveyor), send a ctrl-c event, then re-enable ctrl-c events
            # for our own and parent process.  ..that *might* work, but I'm not really
            # familiar with the win32 api.
            pytest.xfail("This test is problematic on Windows.")

        TESTED_PARAMS.append(['--dev'])

        SIGINT = signal.SIGINT

        cmd = ['--dev', 'install', 'user/test']
        result = self.execute(cmd)

        # was the --dev arg accepted by argparse?
        assert result['return code'] == 0

        # We need to run a command that blocks.  To do so, I'm disabling the
        # test mocking of the command module, and executing a command that
        # blocks while waiting for input ('config').
        test_environ = os.environ.copy()
        test_environ['QUILT_TEST_CLI_SUBPROC'] = 'false'
        test_environ['PYTHONUNBUFFERED'] = "true"   # prevent blank stdout due to buffering

        # With no '--dev' arg, the process should exit without a traceback
        cmd = self.quilt_command + ['config']
        proc = Popen(cmd, stdin=PIPE, stdout=PIPE, stderr=PIPE, env=test_environ)

        # Wait for some expected text
        expected = b"Please enter the URL"
        response = proc.stdout.read(len(expected))  # blocks if 'quilt config' produces too little output.
        assert response == expected

        # Send interrupt, and fetch result
        proc.send_signal(SIGINT)
        stdout, stderr = (b.decode() for b in proc.communicate())

        assert 'Traceback' not in stderr
        # Return code should indicate keyboard interrupt
        assert proc.returncode == EXIT_KB_INTERRUPT

        # With the '--dev' arg, the process should display a traceback
        cmd = self.quilt_command + ['--dev', 'config']
        proc = Popen(cmd, stdin=PIPE, stdout=PIPE, stderr=PIPE, env=test_environ)

        # Wait for some expected text
        expected = b"Please enter the URL"
        response = proc.stdout.read(len(expected))  # blocks if 'quilt config' produces too little output.
        assert response == expected

        # Send interrupt, and check result
        proc.send_signal(SIGINT)
        stdout, stderr = (b.decode() for b in proc.communicate())

        assert 'Traceback (most recent call last)' in stderr
        # Return code should be the generic exit code '1' for unhandled exception
        assert proc.returncode == 1


# need capsys, so this isn't in the unittest class
def test_cli_command_version_flag(capsys):
    """Tests that `quilt --version` is working"""
    TESTED_PARAMS.append(['--version'])

    from quilt.tools.main import main

    with pytest.raises(SystemExit):
        main(['--version'])
    outerr = capsys.readouterr()

    # there's not a lot to test here -- this literally just does the same thing
    # that 'quilt --version' does, but this at least ensures that it still
    # exists and still produces the expected result.
    dist = pkg_resources.get_distribution('quilt')
    expectation = "quilt {} ({})\n".format(dist.version, dist.egg_name())

    # in python 2, apparently argparse's 'version' handler prints to stderr.
    result = outerr.err if PY2 else outerr.out

    assert expectation == result


# need capsys, so this isn't in the unittest class
def test_cli_command_in_help(capsys):
    """Tests for inclusion in 'help'

    Only tests the base subcommand, not sub-subcommands.
    """
    TESTED_PARAMS.append(['--version'])

    from quilt.tools.main import main

    expected_params = set()
    hidden_params = set()
    expected_optionals = set()
    hidden_optionals = {'--dev'}

    for argpath in KNOWN_PARAMS:
        if len(argpath) == 1:
            if isinstance(argpath[0], string_types):
                assert argpath[0].startswith('-'),  "bug in test, not in tested code"
                expected_optionals.add(argpath[0])
            continue
        if isinstance(argpath[1], string_types):
            expected_params.add(argpath[1])

    with pytest.raises(SystemExit):
        main(['help'])

    outerr = capsys.readouterr()
    lines = outerr.out.split('\n')

    for pos, line in enumerate(lines):
        if line.strip() == '<subcommand>':
            start = pos + 1

    found_params = []
    for pos, line in enumerate(lines[start:]):
        print(line)
        if line.strip() == "optional arguments:":
            print("stopping (optionals)")
            start = pos + 1
            break
        splitline = line.split(None, 1)
        if not splitline:
            print('skipped (splitline)')
            continue
        if line[4] == ' ':  # skip multiline help text
            print('skipped (char 4)')
            continue
        arg = splitline[0]
        found_params.append(arg)

    assert found_params == sorted(found_params), 'Help params should be sorted properly'
    assert set(found_params) | hidden_params == expected_params, 'Found params do not match expected params'

    found_optionals = []
    for line in lines[start:]:
        splitline = line.split(None, 1)   # ignore second optional form if present (--help, -h)
        if not splitline:
            continue
        optional = splitline[0].rstrip(',')
        if not optional.startswith('-'):
            continue
        print(optional)
        if optional in ['--help', '-h']:
            continue
        found_optionals.append(optional)

    assert found_optionals == sorted(found_optionals)
    assert set(found_optionals) | hidden_optionals == expected_optionals


@pytest.mark.xfail
def test_coverage():
    result = get_paramtest_coverage()

    # this display can be removed once this function isn't xfailed anymore
    if result['missing']:
        msg = ("\nThe following param paths aren't tested,\n"
               "except for change notification and signature matching:\n  {}")
        print(msg.format("\n  ".join(repr(x) for x in result['missing'])))
    print("Param-path specific test coverage: {:.0f}%".format(result['percentage'] * 100))

    assert not result['missing']  # cli params not tested yet
    assert result['percentage'] == 1
