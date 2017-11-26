"""
Build: parse and add user-supplied files to store
"""
import os
import re

from .const import PACKAGE_DIR_NAME
from .core import RootNode, CommandException
from .package import Package, PackageException
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
    PKG_DIR = 'pkgs'
    VERSION = '1.0'
    
    def __init__(self, location=None):
        if location is None:
            location = default_store_location()
            
        assert os.path.basename(os.path.abspath(location)) == PACKAGE_DIR_NAME, \
            "Unexpected package directory: %s" % location
        self._path = location

        objdir = os.path.join(self._path, self.OBJ_DIR)
        tmpobjdir = os.path.join(self._path, self.TMP_OBJ_DIR)
        pkgdir = os.path.join(self._path, self.PKG_DIR)

        if os.path.isdir(self._path):
            # Verify existing package store is compatible
            if self.VERSION != self._read_format_version():
                msg = "The package repository at {0} is not compatible"
                msg += " with this version of quilt. Revert to an"
                msg += " earlier version of quilt or remove the existing"
                msg += " package repository."
                raise StoreException(msg.format(self._path))            
        else:
            # Create a new package store
            os.makedirs(self._path)
            self._write_format_version()
            os.mkdir(objdir)
            os.mkdir(tmpobjdir)
            os.mkdir(pkgdir)
    
        assert os.path.isdir(objdir)
        assert os.path.isdir(tmpobjdir)
        assert os.path.isdir(pkgdir)

    # CHANGED:
    # hard-coded this to return exactly one directory, the package store in BASE_DIR.
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

    def _version_path(self):
        return os.path.join(self._path, '.format')
    
    def _read_format_version(self):
        if os.path.exists(self._version_path()):
            with open(self._version_path(), 'r') as versionfile:
                version = versionfile.read()
                return version
        else:
            return "0.0"

    def _write_format_version(self):
        with open(self._version_path(), 'w') as versionfile:
            versionfile.write(self.VERSION)

    # TODO: find a package instance other than 'latest', e.g. by
    # looking-up by hash, tag or version in the local store.
    def get_package(self, user, package):
        """
        Gets a package from this store.
        """
        self.check_name(user, package)
        path = self.package_path(user, package)
        if os.path.isdir(path):
            try:
                return Package(
                    store=self,
                    user=user,
                    package=package,
                    path=path
                    )
            except PackageException:
                pass
        return None

    def install_package(self, user, package, contents):
        """
        Creates a new package in the default package store
        and allocates a per-user directory if needed.
        """
        self.check_name(user, package)

        assert contents is not None
        path = self.package_path(user, package)

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

    def ls_packages(self):
        """
        List packages in this store.
        """
        packages = []
        pkgdir = os.path.join(self._path, self.PKG_DIR)
        for user in os.listdir(pkgdir):
            for pkg in os.listdir(os.path.join(pkgdir, user)):
                pkgpath = os.path.join(pkgdir, user, pkg)           
                pkgmap = {h : [] for h in os.listdir(os.path.join(pkgpath, Package.CONTENTS_DIR))}
                for tag in os.listdir(os.path.join(pkgpath, Package.TAGS_DIR)):
                    with open(os.path.join(pkgpath, Package.TAGS_DIR, tag), 'r') as tagfile:
                        pkghash = tagfile.read()
                        pkgmap[pkghash].append(tag)
                for pkghash, tags in pkgmap.items():
                    fullpkg = "{owner}/{pkg}".format(owner=user, pkg=pkg)
                    # Add an empty string tag for untagged hashes
                    displaytags = tags if tags else [""]
                    # Display a separate full line per tag like Docker
                    for tag in displaytags:
                        packages.append((fullpkg, str(tag), pkghash))
                        
        return packages

    def user_path(self, user):
        """
        Returns the path to directory with the user's package repositories.
        """
        return os.path.join(self._path, self.PKG_DIR, user)

    def package_path(self, user, package):
        """
        Returns the path to a package repository.
        """
        return os.path.join(self.user_path(user), package)

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

def parse_package_extended(name):
    hash = version = tag = None
    try:
        if ':' in name:
            name, versioninfo = name.split(':', 1)
            if ':' in versioninfo:
                info = versioninfo.split(':', 1)
                if len(info) == 2:
                    if 'version'.startswith(info[0]):
                        # usr/pkg:v:<string>  usr/pkg:version:<string>  etc
                        version = info[1]
                    elif 'tag'.startswith(info[0]):
                        # usr/pkg:t:<tag>  usr/pkg:tag:<tag>  etc
                        tag = info[1]
                    elif 'hash'.startswith(info[0]):
                        # usr/pkg:h:<hash>  usr/pkg:hash:<hash>  etc
                        hash = info[1]
                    else:
                        raise CommandException("Invalid versioninfo: %s." % info)
                else:
                    # usr/pkg:hashval
                    hash = versioninfo
        owner, pkg, subpath = parse_package(name, allow_subpath=True)
    except ValueError:
        pkg_format = 'owner/package_name/path[:v:<version> or :t:tag or :h:hash]'
        raise CommandException("Specify package as %s." % pkg_format)
    return owner, pkg, subpath, hash, version, tag

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
