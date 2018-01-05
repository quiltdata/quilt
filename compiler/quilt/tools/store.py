"""
Build: parse and add user-supplied files to store
"""
import os
import re

from shutil import rmtree

from .const import PACKAGE_DIR_NAME
from .core import FileNode, RootNode, TableNode, CommandException
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
    BUILD_DIR = 'build'
    OBJ_DIR = 'objs'
    TMP_OBJ_DIR = 'tmp'
    PKG_DIR = 'pkgs'
    CACHE_DIR = 'cache'
    VERSION = '1.2'
    
    def __init__(self, location=None):
        if location is None:
            location = default_store_location()
            
        assert os.path.basename(os.path.abspath(location)) == PACKAGE_DIR_NAME, \
            "Unexpected package directory: %s" % location
        self._path = location
        objdir = os.path.join(self._path, self.OBJ_DIR)
        tmpobjdir = os.path.join(self._path, self.TMP_OBJ_DIR)
        pkgdir = os.path.join(self._path, self.PKG_DIR)
        cachedir = os.path.join(self._path, self.CACHE_DIR)

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
            os.mkdir(cachedir)
    
        assert os.path.isdir(objdir)
        assert os.path.isdir(tmpobjdir)
        assert os.path.isdir(pkgdir)
        assert os.path.isdir(cachedir)


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
    def find_package(cls, team, user, package, store_dir=None):
        """
        Finds an existing package in one of the package directories.
        """
        cls.check_name(team, user, package)
        dirs = cls.find_store_dirs()
        for store_dir in dirs:
            store = PackageStore(store_dir)
            pkg = store.get_package(team, user, package)
            if pkg is not None:
                return pkg
        return None

    @classmethod
    def check_name(cls, team, user, package):
        if team is not None and not VALID_NAME_RE.match(team):
            raise StoreException("Invalid team name: %r" % team)
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
    def get_package(self, team, user, package):
        """
        Gets a package from this store.
        """
        self.check_name(team, user, package)
        path = self.package_path(team, user, package)
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

    def install_package(self, team, user, package, contents):
        """
        Creates a new package in the default package store
        and allocates a per-user directory if needed.
        """
        self.check_name(team, user, package)

        assert contents is not None
        path = self.package_path(team, user, package)

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

    def create_package(self, team, user, package, dry_run=False):
        """
        Creates a new package and initializes its contents. See `install_package`.
        """
        if dry_run:
            return Package(self, user, package, '.', RootNode(dict()))
        contents = RootNode(dict())
        return self.install_package(team, user, package, contents)

    def remove_package(self, team, user, package):
        """
        Removes a package (all instances) from this store.
        """
        self.check_name(team, user, package)

        path = self.package_path(team, user, package)
        remove_objs = set()
        if os.path.isdir(path):
            # Collect objects from all instances for potential cleanup
            contents_path = os.path.join(path, Package.CONTENTS_DIR)
            for instance in os.listdir(contents_path):
                pkg = Package(self, user, package, path, pkghash=instance)
                for node in pkg.get_contents().preorder():
                    if isinstance(node, (FileNode, TableNode)):
                        for objhash in node.hashes:
                            remove_objs.add(objhash)
            # Remove package manifests
            rmtree(path)
        
        return self.prune(remove_objs)        

    def iterpackages(self):
        """
        Return an iterator over all the packages in the PackageStore.
        """
        pkgdir = os.path.join(self._path, self.PKG_DIR)
        for user in os.listdir(pkgdir):
            for pkg in os.listdir(os.path.join(pkgdir, user)):
                pkgpath = os.path.join(pkgdir, user, pkg)
                for hsh in os.listdir(os.path.join(pkgpath, Package.CONTENTS_DIR)):
                    yield Package(self, user, pkg, pkgpath, pkghash=hsh)

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

    def user_path(self, team, user):
        """
        Returns the path to directory with the user's package repositories.
        """
        name = team + ':' + user if team else user
        return os.path.join(self._path, self.PKG_DIR, name)

    def package_path(self, team, user, package):
        """
        Returns the path to a package repository.
        """
        return os.path.join(self.user_path(team, user), package)

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

    def cache_path(self, name):
        """
        Returns the path to a temporary object, before we know its hash.
        """
        return os.path.join(self._path, self.CACHE_DIR, name)

    def prune(self, objs=None):
        """
        Clean up objects not referenced by any packages. Try to prune all
        objects by default.
        """
        if objs is None:
            objdir = os.path.join(self._path, self.OBJ_DIR)
            objs = os.listdir(objdir)
        remove_objs = set(objs)

        for pkg in self.iterpackages():
            for node in pkg.get_contents().preorder():
                # TODO: the or below isn't scalable. Add a common baseclass for
                # File and Table nodes like DataNode in nodes.py.
                if isinstance(node, (FileNode, TableNode)):
                    for objhash in node.hashes:
                        remove_objs.discard(objhash)

        removed = []
        for obj in remove_objs:
            os.remove(self.object_path(obj))
            removed.append(obj)
        return removed
            
########################################
# Helper Functions
########################################

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
        team, owner, pkg, subpath = parse_package(name, allow_subpath=True)
    except ValueError:
        pkg_format = 'owner/package_name/path[:v:<version> or :t:tag or :h:hash]'
        raise CommandException("Specify package as %s." % pkg_format)
    return owner, pkg, subpath, hash, version, tag

def parse_package(name, allow_subpath=False):
    try:
        values = name.split(':', 1)
        if len(values) > 1:
            team = values[0]
        else:
            team = None

        values = values[-1].split('/')
        # Can't do "owner, pkg, *subpath = ..." in Python2 :(
        (owner, pkg), subpath = values[:2], values[2:]
        if not owner or not pkg:
            # Make sure they're not empty.
            raise ValueError
        if subpath and not allow_subpath:
            raise ValueError

    except ValueError:
        pkg_format = '[team:]owner/package_name/path' if allow_subpath else '[team:]owner/package_name'
        raise CommandException("Specify package as %s." % pkg_format)

    try:
        PackageStore.check_name(team, owner, pkg)
    except StoreException as ex:
        raise CommandException(str(ex))

    if allow_subpath:
        return team, owner, pkg, subpath
    return team, owner, pkg
