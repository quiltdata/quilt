"""
Build: parse and add user-supplied files to store
"""
import os
import re


from .const import PACKAGE_DIR_NAME
from .core import RootNode
from .package import Package

# start with alpha (_ may clobber attrs), continue with alphanumeric or _
VALID_NAME_RE = re.compile(r'^[a-zA-Z]\w*$')
CHUNK_SIZE = 4096

class StoreException(Exception):
    """
    Exception class for store I/O
    """
    pass


class PackageStore(object):
    """
    Base class for managing Quilt data package repositories. This
    class and its subclasses abstract file formats, file naming and
    reading and writing to/from data files.
    """
    PACKAGE_FILE_EXT = '.json'
    BUILD_DIR = 'build'
    OBJ_DIR = 'objs'
    TMP_OBJ_DIR = 'objs/tmp'

    def __init__(self, store_dir=PACKAGE_DIR_NAME):
        assert os.path.basename(os.path.abspath(store_dir)) == PACKAGE_DIR_NAME, \
            "Unexpected package directory: %s" % store_dir
        self._path = store_dir

    @classmethod
    def find_store_dirs(cls, start_dir='.'):
        """
        Walks up the directory tree and looks for `quilt_packages` directories
        in the ancestors of the starting directory.

        The algorithm is the same as Node's `node_modules` algorithm
        ( https://nodejs.org/docs/v7.4.0/api/modules.html#modules_all_together ),
        except that it doesn't stop at the top-level `quilt_packages` directory.

        Returns a (possibly empty) generator.
        """
        path = os.path.realpath(start_dir)
        while True:
            parent_path, name = os.path.split(path)
            if name != PACKAGE_DIR_NAME:
                package_dir = os.path.join(path, PACKAGE_DIR_NAME)
                if os.path.isdir(package_dir):
                    yield package_dir
            if parent_path == path:  # The only reliable way to detect the root.
                break
            path = parent_path

    @classmethod
    def find_package(cls, user, package, start_dir='.'):
        """
        Finds an existing package in one of the package directories.
        """
        cls._check_name(user, package)

        dirs = cls.find_store_dirs(start_dir)
        for store_dir in dirs:
            store = PackageStore(store_dir)
            pkg = store.get_package(user, package)
            if pkg is not None:
                return pkg
        return None

    @classmethod
    def _check_name(cls, user, package):
        if not VALID_NAME_RE.match(user):
            raise StoreException("Invalid user name: %r" % user)
        if not VALID_NAME_RE.match(package):
            raise StoreException("Invalid package name: %r" % package)

    def get_package(self, user, package):
        """
        Gets a package from this store.
        """
        self._check_name(user, package)

        path = os.path.join(self._path, user, package + self.PACKAGE_FILE_EXT)
        if os.path.exists(path):
            return Package(
                store=self,
                user=user,
                package=package,
                path=path
            )
        return None

    def install_package(self, user, package, contents):
        """
        Creates a new package in the innermost `quilt_packages` directory
        (or in a new `quilt_packages` directory in the current directory)
        and allocates a per-user directory if needed.
        """
        self._check_name(user, package)

        assert contents is not None

        for name in [user, self.OBJ_DIR, self.TMP_OBJ_DIR]:
            path = os.path.join(self._path, name)
            if not os.path.isdir(path):
                os.makedirs(path)

        path = os.path.join(self._path, user, package + self.PACKAGE_FILE_EXT)

        # Delete any existing data.
        try:
            os.remove(path)
        except OSError:
            pass

        return Package(
            store=self,
            user=user,
            package=package,
            path=path,
            contents=contents
        )

    def create_package(self, user, package, pkgformat):
        """
        Creates a new package and initializes its contents with the given format.
        See `install_package`.
        """
        contents = RootNode(dict(), pkgformat.value)
        return self.install_package(user, package, contents)

    def ls_packages(self):
        """
        List packages in this store.
        """
        packages = [
            (user, pkg[:-len(self.PACKAGE_FILE_EXT)])
            for user in os.listdir(self._path)
            if os.path.isdir(os.path.join(self._path, user))
            for pkg in os.listdir(os.path.join(self._path, user))
            if pkg.endswith(self.PACKAGE_FILE_EXT)]
        return packages

    def object_path(self, objhash):
        """
        Returns the path to an object file based on its hash.
        """
        return os.path.join(self._path, self.OBJ_DIR, objhash)

    def temporary_object_path(self, name):
        """
        Returns the path to a temporary object, before we know its hash.
        """
        return os.path.join(self._path, self.TMP_OBJ_DIR, name)
