"""
Unittest setup.
"""

import os
import shutil
import inspect
import tempfile
import unittest
import collections

from ..tools.const import PACKAGE_DIR_NAME

try:
    # Python3
    from unittest.mock import patch
except ImportError:
    # Python2 - external dependency.
    from mock import patch

import responses


_TEST_DIR = os.path.abspath(inspect.stack()[0][1])
PACKAGE_DIR = os.path.join('/', *_TEST_DIR.split(os.path.sep)[:-3])


class BasicQuiltTestCase(unittest.TestCase):
    """
    Base class for unittests.
    - Creates a temporary directory
    """
    def setUp(self):
        self._old_dir = os.getcwd()
        self._test_dir = tempfile.mkdtemp(prefix='quilt-test-')
        os.chdir(self._test_dir)

    def tearDown(self):
        os.chdir(self._old_dir)
        shutil.rmtree(self._test_dir)

class QuiltTestCase(BasicQuiltTestCase):
    """
    - Mocks requests
    - (And inherits temp directory from superclass)
    """
    def setUp(self):
        super(QuiltTestCase, self).setUp()

        self.auth_patcher = patch('quilt.tools.command._create_auth', lambda: None)
        self.auth_patcher.start()

        self._store_dir = os.path.join(self._test_dir, PACKAGE_DIR_NAME)
        self.store_patcher = patch('quilt.tools.store.default_store_location', lambda: self._store_dir)
        self.store_patcher.start()

        self.requests_mock = responses.RequestsMock(assert_all_requests_are_fired=True)
        self.requests_mock.start()

    def tearDown(self):
        self.requests_mock.stop()
        self.auth_patcher.stop()
        self.store_patcher.stop()

        super(QuiltTestCase, self).tearDown()


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
