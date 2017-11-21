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
import inspect
import collections
from subprocess import call, check_output, PIPE, CalledProcessError

import pytest

from .utils import BasicQuiltTestCase
from ..tools import command, main

# inspect.argspec is deprecated, so
try:
    from funcsigs import signature  # python 2.7
except ImportError:
    from inspect import signature


## "Static" vars
_TEST_DIR = os.path.abspath(inspect.stack()[0][1])
PACKAGE_DIR = os.path.join('/', *_TEST_DIR.split(os.path.sep)[:-3])

# When a test for CLI params is made, append the param key paths that
# the test addresses to this variable.
# Get an example key path by calling get_all_param_paths()
TESTED_PARAMS = []


## KNOWN_PARAMS
# When adding a new param to the cli, add the param here.
# New or missing cli params can be found in test errors as keypaths,
# which are simply lists of dict keys.  These can be added to or
# removed from KNOWN_PARAMS as befits your situation.
# The end value should be the argparse 'dest' arg (if present, or None.

#TODO: KNOWN_PARAMS could potentially be a path list instead of a dict tree.
#      This has the benefit of being easier to understand at a glance, and of
#      being easy to update from failed test copypasta.
#      A nested list wouldn't really do -- this needs to represent both
#      positional and keyword arguments.
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

    def __getitem__(self, k):
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

    def __repr__(self):
        args = '\n'.join(repr(x) for x in self)
        return 'ArgparseIntrospector with args:\n' + args


class RecursiveMappingWrapper(collections.MutableMapping):
    """Wrap a mapping, providing recursive access to items via key lists

    allows:
    >>> x = RecursiveMappingWrapper({'a': {'b': 'c'}})
    >>> x[['a', 'b']]
    'c'
    >>> x[['a', 'n']] = 9
    >>> x.obj
    {'a': {'b': 'c', 'n': 9}}

    It does not implicitly add new dicts/mappings by default, so:
    >>> x = RecursiveMappingWrapper({})
    >>> x[['foo', 'bar']] = 'baz'
    <raises KeyError('Invalid key path', ['foo'])>
    >>> x['foo'] = {}
    >>> x[['foo', 'bar']] = 'baz'
    >>> x.obj
    {'foo': {'bar': 'baz'}}

    However, if `implicit_fill` is truthy, then the following occurs:
    >>> x = RecursiveMappingWrapper({}, implicit_fill=True)
    >>> x[['foo', 'bar']]
    <raises KeyError('Invalid key path', ['foo'])>
    >>> x[['foo', 'bar']] = 'baz'
    >>> x.obj
    {'foo': {'bar': 'baz'}}

    :param obj: mapping/dict to wrap
    :param implicit_fill: implicitly resolve interim keys to new dict objects
    """
    def __init__(self, obj, implicit_fill=False):
        if not isinstance(obj, collections.Mapping):
            raise TypeError("`obj` must be a mapping.")
        super(RecursiveMappingWrapper, self).__init__()
        self.obj = obj
        self.implicit_fill = implicit_fill

    def __delitem__(self, key):
        """Delete by key or key path."""
        if not isinstance(key, list):
            del self.obj[key]
            return
        keys = key
        try:
            key = keys[-1]
        except IndexError:
            raise KeyError("empty key list")
        obj = self._get_next_to_last(keys)
        try:
            del obj[key]
        except KeyError:
            raise KeyError("Invalid key path", keys)

    def __eq__(self, other):
        if isinstance(other, self.__class__):
            return self.obj == other.obj
        return self.obj == other

    def __getitem__(self, key):
        """Fetch value by key or key path."""
        if not isinstance(key, list):
            return self.obj[key]
        keys = key
        try:
            key = keys[-1]
        except IndexError:
            raise KeyError("empty key list")
        obj = self._get_next_to_last(keys)
        try:
            return obj[key]
        except KeyError:
            raise KeyError("Invalid key path", keys)

    def __iter__(self):
        """Iterate over keys (not key paths)."""
        return iter(self.obj)

    def __len__(self):
        return len(self.obj)

    def __repr__(self):
        return "{}({})".format(type(self).__name__, self.obj)

    def __setitem__(self, key, value):
        if not isinstance(key, list):
            self.obj[key] = value
            return
        keys = key
        try:
            key = keys[-1]
        except IndexError:
            raise KeyError("empty key list")
        obj = self._get_next_to_last(keys, implicit_fill=self.implicit_fill)
        obj[key] = value

    def _get_next_to_last(self, keys, implicit_fill=False):
        # list is our recursive type, because it is mutable, and can't be
        # used for a key, anyways.
        if not isinstance(keys, list):
            raise TypeError('`keys` must be a list')
        obj = self.obj
        path = []
        try:
            for k in keys[:-1]:
                path.append(k)
                if implicit_fill:
                    obj[k] = obj.get(k, {})
                obj = obj[k]
        except KeyError:
            raise KeyError("Invalid key path", path)
        return obj

    def __getattr__(self, item):
        return getattr(self.obj, item)

    def iterpaths(self, sortkey=lambda x: repr(x)):
        """Iterate recursively over contained keys and key paths"""
        if sortkey:
            keys = sorted(self, key=sortkey)
        else:
            keys = self.keys()
        for key in keys:
            value = self[key]
            yield [key]
            if isinstance(value, collections.Mapping):
                if not isinstance(value, self.__class__):
                    value = self.__class__(value)
                for path in value.iterpaths():
                    yield [key] + path


class MockObject(object):
    """Mocks objects with callables.

    For any attribute that is accessed, it gives a function that prints
    JSON information to stdout instead.
    """
    _target = None
    __result = {}

    def __init__(self, target):
        self._target = target

    @property
    def _result(self):
        """Deletes itself after being read."""
        result = self.__result
        self.__result = {}
        return result

    @_result.setter
    def _result(self, v):
        self.__result = v

    def __getattr__(self, funcname):
        def dummy_func(*args, **kwargs):
            result = {
                'func': funcname,
                'matched': hasattr(self._target, funcname),
                'args': args,
                'kwargs': kwargs
                }
            print(json.dumps(result, indent=4))
            self._result = result
        return dummy_func


class TestCLI(BasicQuiltTestCase):
    def setUp(self):
        self.mock_command = MockObject(command)
        main.command = self.mock_command
        self.param_tree = get_current_param_tree()
        self.parser = self.param_tree.data

        # if using subprocess calls
        self.env = os.environ.copy()
        self.env['QUILT_CLI_TEST'] = "True"
        self.env['PYTHON_PATH'] = PACKAGE_DIR

        self.quilt_command = [sys.executable, '-c', 'from quilt.tools import main; main.main()']

    def tearDown(self):
        main.command = self.mock_command._target

    def execute(self, cli_args):

        #TODO: Enable switching between direct and subprocess modes

        # Subprocess mode -- snippets, untested, may not work
        # quilt = self.quilt_command
        # env = self.env
        # cmd = quilt + ['config']
        # result = json.loads(check_output(cmd, env=env).decode())  # Terminal default decoding

        # direct mode -- uses quilt.tools.main.main()
        result = {}
        try:
            main.main(cli_args)
        except SystemExit as error:
            result['return code'] = error.args[0] if error.args else 0
        else:
            result['return code'] = 0
        result.update(self.mock_command._result)
        return result

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
        result = self.execute(cmd)

        # General tests
        assert result['return code'] == 0
        assert result['matched'] is True  # func name recognized by MockCommand class?
        func = getattr(command, result['func'])
        assert not fails_binding(func, args=result['args'], kwargs=result['kwargs'])

        # Specific tests
        assert result['func'] == 'config'
        assert not result['args']
        assert not result['kwargs']

    def test_cli_command_push(self):
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
            assert self.execute(args)['return code'] == 2

        ## This section tests for appropriate types and values.
        cmd = 'push fakeuser/fakepackage'.split()
        result = self.execute(cmd)

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
        cmd = 'push --reupload --public fakeuser/fakepackage'.split()
        result = self.execute(cmd)

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
