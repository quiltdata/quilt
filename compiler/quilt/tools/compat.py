"""
Python 2 / 3 compatibility

In cases where the `six` lib covers an item, use `six`.

For others, import the module here under the python3 name (if there are naming differences).

Unfortunately, this *doesn't* allow for `from .tools.compat.foo import bar`, so if needed,
import frequently-used objects here for convenience.
"""
# unused imports -- pylint: disable=W0611

import sys as _sys


# Reflecting requirements in setup.py
# Python < 3.4
if _sys.version_info < (3, 4):
    from funcsigs import signature  # inspect.argspec is deprecated
else:
    from inspect import signature   # inspect.argspec is deprecated

# Python < 3.5
if _sys.version_info < (3, 5):
    import pathlib2 as pathlib
else:
    import pathlib


# Example convenience references to allow `from .tools.compat import some_obj`

# patch = mock.patch
# Path = pathlib.Path
