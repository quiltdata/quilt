"""
Build: parse and add user-supplied files to store
"""
import os
import re

from distutils.dir_util import mkpath

from .const import PACKAGE_DIR_NAME
from .core import RootNode, CommandException
from .package import Package
from .util import BASE_DIR

# start with alpha (_ may clobber attrs), continue with alphanumeric or _
VALID_NAME_RE = re.compile(r'^[a-zA-Z]\w*$')
CHUNK_SIZE = 4096

# Helper function to return the default package store path
def default_store_location():
    path=os.path.realpath(BASE_DIR)
    package_dir = os.path.join(path, PACKAGE_DIR_NAME)
    return package_dir


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
    TMP_OBJ_DIR = os.path.join('objs', 'tmp')
    
    def __init__(self, location=None):
        if location is None:
            location = default_store_location()

        if not os.path.isdir(location):
            mkpath(location)
        
        assert os.path.basename(os.path.abspath(location)) == PACKAGE_DIR_NAME, \
            "Unexpected package directory: %s" % location
        self._path = location

    # CHANGE:
    # hard-code this to return exactly one directory, the package store in BASE_DIR.
    # Leave the mechanism so we can support read-only package directories (e.g. as
    # shared caches) later.
    @classmethod
    def find_store_dirs(cls):
        """
        Returns a list with one entry.
        """
        package_dir = default_store_location()
        return [package_dir]
        
    @classmethod
    def find_package(cls, user, package, store_dir=None):
        """
        Finds an existing package in one of the package directories.
        """
        cls.check_name(user, package)
        dirs = cls.find_store_dirs()
        for store_dir in dirs:
            store = PackageStore(store_dir)
            pkg = store.get_package(user, package)
            if pkg is not None:
                return pkg
        return None

    @classmethod
    def check_name(cls, user, package):
        if not VALID_NAME_RE.match(user):
            raise StoreException("Invalid user name: %r" % user)
        if not VALID_NAME_RE.match(package):
            raise StoreException("Invalid package name: %r" % package)

    # CHANGE:
    # - lookup hash in contents based on tag or version
    # - load package manifest from contents dir
    def get_package(self, user, package, tag='latest', version=None):
        """
        Gets a package from this store.
        """
        self.check_name(user, package)

        path = os.path.join(self._path, user, package)
        if os.path.isdir(path):
            return Package(
                store=self,
                user=user,
                package=package,
                path=path
            )
        return None

    # CHANGE:
    # - check if pacakge already exists
    # - save new manifest as hash
    # - update contents
    def install_package(self, user, package, contents):
        """
        Creates a new package in the innermost `quilt_packages` directory
        (or in a new `quilt_packages` directory in the current directory)
        and allocates a per-user directory if needed.
        """
        self.check_name(user, package)

        assert contents is not None

        for name in [user, self.OBJ_DIR, self.TMP_OBJ_DIR]:
            path = os.path.join(self._path, name)
            if not os.path.isdir(path):
                os.makedirs(path)

        path = os.path.join(self._path, user, package)

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

    def create_package(self, user, package, dry_run=False):
        """
        Creates a new package and initializes its contents. See `install_package`.
        """
        if dry_run:
            return Package(self, user, package, '.', RootNode(dict()))
        contents = RootNode(dict())
        return self.install_package(user, package, contents)

    # CHANGE:
    # read all local package instances and build map of metadata:
    # hash: (size, created, etc.)
    # read contents and sort by package
    # foreach package:
    #     lookup versions:
    #         list all instances with versions, ordered by version
    #     lookup tags:
    #         list all instances with tags, ordered by tag
    # Alternate: order instances by reverse creation date
    # mark each instance printed in metadata map
    # list all untagged, unversioned instances for the package
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

def parse_package(name, allow_subpath=False):
    try:
        values = name.split('/')
        # Can't do "owner, pkg, *subpath = ..." in Python2 :(
        (owner, pkg), subpath = values[:2], values[2:]
        if not owner or not pkg:
            # Make sure they're not empty.
            raise ValueError
        if subpath and not allow_subpath:
            raise ValueError
    except ValueError:
        pkg_format = 'owner/package_name/path' if allow_subpath else 'owner/package_name'
        raise CommandException("Specify package as %s." % pkg_format)

    try:
        PackageStore.check_name(owner, pkg)
    except StoreException as ex:
        raise CommandException(str(ex))

    if allow_subpath:
        return owner, pkg, subpath
    return owner, pkg
