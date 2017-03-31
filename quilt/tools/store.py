"""
Build: parse and add user-supplied files to store
"""
import os
import re


from .const import PACKAGE_DIR_NAME
from .core import PackageFormat
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

    def __init__(self, startpath='.'):
        self._start_dir = startpath

    def find_package_dirs(self):
        """
        Walks up the directory tree and looks for `quilt_packages` directories
        in the ancestors of the starting directory.

        The algorithm is the same as Node's `node_modules` algorithm
        ( https://nodejs.org/docs/v7.4.0/api/modules.html#modules_all_together ),
        except that it doesn't stop at the top-level `quilt_packages` directory.

        Returns a (possibly empty) generator.
        """
        path = os.path.realpath(self._start_dir)
        while True:
            parent_path, name = os.path.split(path)
            if name != PACKAGE_DIR_NAME:
                package_dir = os.path.join(path, PACKAGE_DIR_NAME)
                if os.path.isdir(package_dir):
                    yield package_dir
            if parent_path == path:  # The only reliable way to detect the root.
                break
            path = parent_path

    def get_package(self, user, package):
        """
        Finds an existing package in one of the package directories.
        """
        if not VALID_NAME_RE.match(user):
            raise StoreException("Invalid user name: %r" % user)
        if not VALID_NAME_RE.match(package):
            raise StoreException("Invalid package name: %r" % package)

        pkg_dirs = self.find_package_dirs()
        for package_dir in pkg_dirs:
            path = os.path.join(package_dir, user, package + self.PACKAGE_FILE_EXT)
            if os.path.exists(path):
                pkg = Package(user=user,
                              package=package,
                              path=path,
                              pkg_dir=package_dir)
                pkg.load_contents()
                return pkg
        return None

    def create_package(self, user, package, contents):
        """
        Creates a new package in the innermost `quilt_packages` directory
        (or in a new `quilt_packages` directory in the current directory)
        and allocates a per-user directory if needed.
        """
        if not VALID_NAME_RE.match(user):
            raise StoreException("Invalid user name: %r" % user)
        if not VALID_NAME_RE.match(package):
            raise StoreException("Invalid package name: %r" % package)

        package_dir = next(self.find_package_dirs(), PACKAGE_DIR_NAME)
        for name in [user, Package.OBJ_DIR, Package.TMP_OBJ_DIR]:
            path = os.path.join(package_dir, name)
            if not os.path.isdir(path):
                os.makedirs(path)

        path = os.path.join(package_dir, user, package + self.PACKAGE_FILE_EXT)

        # Delete any existing data.
        try:
            os.remove(path)
        except OSError:
            pass

        return Package(user=user,
                       package=package,
                       path=path,
                       pkg_dir=package_dir,
                       contents=contents)

    @classmethod
    def ls_packages(cls, pkg_dir):
        """
        List installed packages.
        """
        packages = [
            (user, pkg[:-len(PackageStore.PACKAGE_FILE_EXT)])
            for user in os.listdir(pkg_dir)
            for pkg in os.listdir(os.path.join(pkg_dir, user))
            if pkg.endswith(PackageStore.PACKAGE_FILE_EXT)]
        return packages

def ls_packages(pkg_dir):
    """
    List all packages from all package directories.
    """
    packages = PackageStore.ls_packages(pkg_dir)
    return packages
