"""
Magic imports for `quilt.team`
"""

import sys

from .imports import ModuleFinder

__path__ = []  # Required for submodules to work


sys.meta_path.append(ModuleFinder(__name__, True))
