"""
Python 2 / 3 compatibility

In cases where the `six` lib covers an item, use `six`.

For others, import the module here under the python3 name (if there are naming differences).

Unfortunately, this *doesn't* allow for `from .tools.compat.foo import bar`, so if needed,
import frequently-used objects here for convenience.
"""
# disable unused import warnings
# pylint: disable=W0611

import six as _six

if _six.PY34:
    import pathlib
    import tempfile
    # from unittest import mock

    # inspect.argspec is deprecated, so
    from inspect import signature
else:
    import pathlib2 as pathlib
    from backports import tempfile
    # import mock

    # inspect.argspec is deprecated, so
    from funcsigs import signature

# convenience references (examples) to allow `from .tools.compat import some_obj`
# path = mock.path
Path = pathlib.Path
# TemporaryDirectory = tempdir.TemporaryDirectory
