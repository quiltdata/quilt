"""Implementation of the Python Quilt T4 data package loader."""

from importlib.machinery import ModuleSpec
import sys

from t4.util import get_from_config
from t4 import list_packages, Package


MODULE_PATH = []


class DataPackageImporter:
    """
    Data package module loader. Executes package import code and adds the package to the
    module cache.
    """

    @classmethod
    def create_module(cls, spec):  # pylint: disable=unused-argument
        """
        Module creator. Returning None causes Python to use the default module creator.
        """
        return None

    @classmethod
    def exec_module(cls, module):
        """
        Module executor.
        """
        name_parts = module.__name__.split('.')
        registry = get_from_config('default_local_registry')

        if module.__name__ == 't4.data':
            # __path__ must be set even if the package is virtual. Since __path__ will be
            # scanned by all other finders preceding this one in sys.meta_path order, make sure
            # it points to someplace lacking importable objects
            module.__path__ = MODULE_PATH
            return module

        elif len(name_parts) == 3:  # e.g. module.__name__ == t4.data.foo
            namespace = name_parts[2]

            # we do not know the name the user will ask for, so populate all valid names
            for pkg in list_packages():
                pkg_user, pkg_name = pkg.split('/')
                if pkg_user == namespace:
                    module.__dict__[pkg_name] = Package.browse(pkg, registry=registry)

            module.__path__ = MODULE_PATH
            return module

        else:
            assert False


# pylint: disable=too-few-public-methods
class DataPackageFinder:
    """
    Data package module loader finder. This class sits on `sys.meta_path` and returns the
    loader it knows for a given path, if it knows a compatible loader.
    """

    @classmethod
    def find_spec(cls, fullname, path=None, target=None):  # pylint: disable=unused-argument
        """
        This functions is what gets executed by the loader.
        """
        # an implementation for subpackage imports exists, but this has significant
        # consistency issues. For now let's avoid, but you can see the full code at
        # https://github.com/ResidentMario/package-autorelaod/blob/master/loader.py
        name_parts = fullname.split('.')
        if name_parts[:2] != ['t4', 'data'] or len(name_parts) > 3:
            return None
        else:
            return ModuleSpec(fullname, DataPackageImporter())


def start_data_package_loader():
    """
    Adds the data package loader to the module loaders.
    """
    sys.meta_path.append(DataPackageFinder())
