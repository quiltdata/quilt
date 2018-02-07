"""
Python 2 / 3 compatibility

In cases where the `six` lib covers an item, use `six`.

For others, import the module here under the python3 name (if there are naming differences).

Unfortunately, this *doesn't* allow for `from .tools.compat.foo import bar`, so if needed,
import frequently-used objects here for convenience.
"""
# unused imports -- pylint: disable=W0611

import sys as _sys

# XXX: This originally had a few modules, but I've managed to remove the others.
#      I'm tentatively still keeping compat.py, otherwise the try: except: block ends up in
#      each module's import stanzas, instead of 'from compat import pathlib'.

# Reflecting requirements in setup.py
# Python < 3.6
if _sys.version_info < (3, 6):
    import pathlib2 as pathlib
else:
    import pathlib


# Since `from compat.something import bar` isn't doable, feel free to import any
# convenience references here, so they are available via `from compat import bar`

# examples..
# from some_module import some_item
# patch = mock.patch
# Path = pathlib.Path
