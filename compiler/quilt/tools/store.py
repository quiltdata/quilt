"""
Build: parse and add user-supplied files to store
"""
import os
import re

from shutil import rmtree

from .const import DEFAULT_TEAM, PACKAGE_DIR_NAME
from .core import FileNode, RootNode, TableNode
from .package import Package, PackageException
from .util import BASE_DIR, sub_dirs, sub_files, is_nodename

CHUNK_SIZE = 4096

# Helper function to return the default package store path
def default_store_location():
    package_dir = os.path.join(BASE_DIR, PACKAGE_DIR_NAME)
    return os.getenv('QUILT_PRIMARY_PACKAGE_DIR', package_dir)

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
    VERSION = '1.3'

    def __init__(self, location=None):
        if location is None:
            location = default_store_location()

        assert os.path.basename(os.path.abspath(location)) == PACKAGE_DIR_NAME, \
            "Unexpected package directory: %s" % location
        self._path = location

        version = self._read_format_version()

        if version not in (None, self.VERSION):
            msg = (
                "The package repository at {0} is not compatible"
                " with this version of quilt. Revert to an"
                " earlier version of quilt or remove the existing"
                " package repository."
            )
            raise StoreException(msg.format(self._path))

    def create_dirs(self):
        """
        Creates the store directory and its subdirectories.
        """
        if not os.path.isdir(self._path):
            os.makedirs(self._path)
        for dir_name in [self.OBJ_DIR, self.TMP_OBJ_DIR, self.PKG_DIR, self.CACHE_DIR]:
            path = os.path.join(self._path, dir_name)
            if not os.path.isdir(path):
                os.mkdir(path)
        if not os.path.exists(self._version_path()):
            self._write_format_version()

    @classmethod
    def find_store_dirs(cls):
        """
        Returns the primary package directory and any additional ones from QUILT_PACKAGE_DIRS.
        """
        store_dirs = [default_store_location()]
        extra_dirs_str = os.getenv('QUILT_PACKAGE_DIRS')
        if extra_dirs_str:
            store_dirs.extend(extra_dirs_str.split(':'))
        return store_dirs

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
    def check_name(cls, team, user, package, subpath=None):
        if team is not None and not is_nodename(team):
            raise StoreException("Invalid team name: %r" % team)
        if not is_nodename(user):
            raise StoreException("Invalid user name: %r" % user)
        if not is_nodename(package):
            raise StoreException("Invalid package name: %r" % package)
        if subpath:
            for element in subpath:
                if not is_nodename(element):
                    raise StoreException("Invalid element in subpath: %r" % element)

    def _version_path(self):
        return os.path.join(self._path, '.format')

    def _read_format_version(self):
        if os.path.exists(self._version_path()):
            with open(self._version_path(), 'r') as versionfile:
                version = versionfile.read()
                return version
        else:
            return None

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

        self.create_dirs()

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
        # TODO: do we really want to delete invisible dirs?
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
        if not os.path.isdir(pkgdir):
            return
        for team in sub_dirs(pkgdir):
            for user in sub_dirs(self.team_path(team)):
                for pkg in sub_dirs(self.user_path(team, user)):
                    pkgpath = self.package_path(team, user, pkg)
                    for hsh in sub_files(os.path.join(pkgpath, Package.CONTENTS_DIR)):
                        yield Package(self, user, pkg, pkgpath, pkghash=hsh)

    def ls_packages(self):
        """
        List packages in this store.
        """
        packages = []
        pkgdir = os.path.join(self._path, self.PKG_DIR)
        if not os.path.isdir(pkgdir):
            return []
        for team in sub_dirs(pkgdir):
            for user in sub_dirs(self.team_path(team)):
                for pkg in sub_dirs(self.user_path(team, user)):
                    pkgpath = self.package_path(team, user, pkg)
                    pkgmap = {h: [] for h in sub_files(os.path.join(pkgpath, Package.CONTENTS_DIR))}
                    for tag in sub_files(os.path.join(pkgpath, Package.TAGS_DIR)):
                        with open(os.path.join(pkgpath, Package.TAGS_DIR, tag), 'r') as tagfile:
                            pkghash = tagfile.read()
                            pkgmap[pkghash].append(tag)
                    for pkghash, tags in pkgmap.items():
                        # add teams here if any other than DEFAULT_TEAM should be hidden.
                        team_token = '' if team in (DEFAULT_TEAM,) else team + ':'
                        fullpkg = "{team}{owner}/{pkg}".format(team=team_token, owner=user, pkg=pkg)
                        # Add an empty string tag for untagged hashes
                        displaytags = tags if tags else [""]
                        # Display a separate full line per tag like Docker
                        for tag in displaytags:
                            packages.append((fullpkg, str(tag), pkghash))

        return packages

    def team_path(self, team=None):
        """
        Returns the path to directory with the team's users' package repositories.
        """
        if team is None:
            team = DEFAULT_TEAM
        return os.path.join(self._path, self.PKG_DIR, team)

    def user_path(self, team, user):
        """
        Returns the path to directory with the user's package repositories.
        """
        return os.path.join(self.team_path(team), user)

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