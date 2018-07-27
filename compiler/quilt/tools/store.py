"""
Build: parse and add user-supplied files to store
"""
import json
import os
from shutil import copyfile, move, rmtree
from stat import S_IRUSR, S_IRGRP, S_IROTH, S_IWUSR
import uuid

from enum import Enum
import numpy as np
import pandas as pd

from .const import DEFAULT_TEAM, PACKAGE_DIR_NAME, QuiltException, SYSTEM_METADATA
from .core import FileNode, RootNode, find_object_hashes
from .hashing import digest_file
from .package import Package, PackageException
from .util import BASE_DIR, sub_dirs, sub_files, is_nodename

CHUNK_SIZE = 4096

# Helper function to return the default package store path
def default_store_location():
    package_dir = os.path.join(BASE_DIR, PACKAGE_DIR_NAME)
    return os.getenv('QUILT_PRIMARY_PACKAGE_DIR', package_dir)

class ParquetLib(Enum):
    SPARK = 'pyspark'
    ARROW = 'pyarrow'

class StoreException(QuiltException):
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

    __parquet_lib = None

    @classmethod
    def get_parquet_lib(cls):
        """
        Find/choose a library to read and write Parquet files
        based on installed options.
        """
        if cls.__parquet_lib is None:
            parq_env = os.environ.get('QUILT_PARQUET_LIBRARY', ParquetLib.ARROW.value)
            cls.__parquet_lib = ParquetLib(parq_env)
        return cls.__parquet_lib

    @classmethod
    def reset_parquet_lib(cls):
        cls.__parquet_lib = None

    @classmethod
    def set_parquet_lib(cls, parqlib):
        cls.__parquet_lib = ParquetLib(parqlib)

    def __init__(self, location=None):
        if location is None:
            location = default_store_location()

        assert os.path.basename(os.path.abspath(location)) == PACKAGE_DIR_NAME, \
            "Unexpected package directory: %s" % location
        self._path = location

        version = self._read_format_version()

        if version == '1.2':
            # Migrate to the teams format.
            pkgdir = os.path.join(self._path, self.PKG_DIR)
            old_dirs = sub_dirs(pkgdir)
            os.mkdir(os.path.join(pkgdir, DEFAULT_TEAM))
            for old_dir in old_dirs:
                os.rename(os.path.join(pkgdir, old_dir), os.path.join(pkgdir, DEFAULT_TEAM, old_dir))
            self._write_format_version()
        elif version not in (None, self.VERSION):
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
    def find_package(cls, team, user, package, pkghash=None, store_dir=None):
        """
        Finds an existing package in one of the package directories.
        """
        cls.check_name(team, user, package)
        dirs = cls.find_store_dirs()
        for store_dir in dirs:
            store = PackageStore(store_dir)
            pkg = store.get_package(team, user, package, pkghash=pkghash)
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
    def get_package(self, team, user, package, pkghash=None):
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
                    path=path,
                    pkghash=pkghash,
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
                remove_objs.update(find_object_hashes(pkg.get_contents()))
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
                    pkgmap = {h : [] for h in sub_files(os.path.join(pkgpath, Package.CONTENTS_DIR))}
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
            remove_objs.difference_update(find_object_hashes(pkg.get_contents()))

        for obj in remove_objs:
            path = self.object_path(obj)
            if os.path.exists(path):
                os.chmod(path, S_IWUSR)
                os.remove(path)
        return remove_objs

    def _read_parquet_arrow(self, hash_list):
        from pyarrow.parquet import ParquetDataset

        objfiles = [self.object_path(h) for h in hash_list]
        dataset = ParquetDataset(objfiles)
        table = dataset.read(nthreads=4)
        dataframe = table.to_pandas()
        return dataframe

    def _read_parquet_spark(self, hash_list):
        from pyspark import sql as sparksql

        spark = sparksql.SparkSession.builder.getOrCreate()
        objfiles = [self.object_path(h) for h in hash_list]
        dataframe = spark.read.parquet(*objfiles)
        return dataframe

    def _check_hashes(self, hash_list):
        for objhash in hash_list:
            path = self.object_path(objhash)
            if not os.path.exists(path):
                raise StoreException("Missing object fragments; re-install the package")

    def load_dataframe(self, hash_list):
        """
        Creates a DataFrame from a set of objects (identified by hashes).
        """
        self._check_hashes(hash_list)
        parqlib = self.get_parquet_lib()
        if parqlib is ParquetLib.SPARK:
            return self._read_parquet_spark(hash_list)
        elif parqlib is ParquetLib.ARROW:
            try:
                return self._read_parquet_arrow(hash_list)
            except ValueError as err:
                raise StoreException(str(err))
        else:
            assert False, "Unimplemented Parquet Library %s" % parqlib

    def save_dataframe(self, dataframe):
        """
        Save a DataFrame to the store.
        """
        storepath = self.temporary_object_path(str(uuid.uuid4()))

        # switch parquet lib
        parqlib = self.get_parquet_lib()
        if isinstance(dataframe, pd.DataFrame):
            #parqlib is ParquetLib.ARROW: # other parquet libs are deprecated, remove?
            import pyarrow as pa
            from pyarrow import parquet
            table = pa.Table.from_pandas(dataframe)
            parquet.write_table(table, storepath)
        elif parqlib is ParquetLib.SPARK:
            from pyspark import sql as sparksql
            assert isinstance(dataframe, sparksql.DataFrame)
            dataframe.write.parquet(storepath)
        else:
            assert False, "Unimplemented ParquetLib %s" % parqlib

        # Move serialized DataFrame to object store
        if os.path.isdir(storepath): # Pyspark
            hashes = []
            files = [ofile for ofile in os.listdir(storepath) if ofile.endswith(".parquet")]
            for obj in files:
                path = os.path.join(storepath, obj)
                objhash = digest_file(path)
                self._move_to_store(path, objhash)
                hashes.append(objhash)
            rmtree(storepath)
        else:
            filehash = digest_file(storepath)
            self._move_to_store(storepath, filehash)
            hashes = [filehash]

        return hashes

    def load_numpy(self, hash_list):
        """
        Loads a numpy array.
        """
        assert len(hash_list) == 1
        self._check_hashes(hash_list)
        with open(self.object_path(hash_list[0]), 'rb') as fd:
            return np.load(fd, allow_pickle=False)

    def save_numpy(self, nparray):
        storepath = self.temporary_object_path(str(uuid.uuid4()))
        with open(storepath, 'wb') as fd:
            np.save(fd, nparray, allow_pickle=False)

        filehash = digest_file(storepath)
        self._move_to_store(storepath, filehash)

        return filehash

    def get_file(self, hash_list):
        """
        Returns the path of the file - but verifies that the hash is actually present.
        """
        assert len(hash_list) == 1
        self._check_hashes(hash_list)
        return self.object_path(hash_list[0])

    def save_file(self, srcfile):
        """
        Save a (raw) file to the store.
        """
        filehash = digest_file(srcfile)
        if not os.path.exists(self.object_path(filehash)):
            # Copy the file to a temporary location first, then move, to make sure we don't end up with
            # truncated contents if the build gets interrupted.
            tmppath = self.temporary_object_path(filehash)
            copyfile(srcfile, tmppath)
            self._move_to_store(tmppath, filehash)

        return filehash

    def load_metadata(self, metahash):
        self._check_hashes([metahash])
        path = self.object_path(metahash)
        with open(path) as fd:
            return json.load(fd)

    def save_metadata(self, metadata):
        """
        Save metadata to the store.
        """
        if metadata in (None, {}):
            return None

        if SYSTEM_METADATA in metadata:
            raise StoreException("Not allowed to store %r in metadata" % SYSTEM_METADATA)

        path = self.temporary_object_path(str(uuid.uuid4()))

        with open(path, 'w') as fd:
            try:
                # IMPORTANT: JSON format affects the hash of the package.
                # In particular, it cannot contain line breaks because of Windows (LF vs CRLF).
                # To be safe, we use the most compact encoding.
                json.dump(metadata, fd, sort_keys=True, separators=(',', ':'))
            except (TypeError, ValueError):
                raise StoreException("Metadata is not serializable")

        metahash = digest_file(path)
        self._move_to_store(path, metahash)
        return metahash

    def _move_to_store(self, srcpath, objhash):
        """
        Make the object read-only and move it to the store.
        """
        destpath = self.object_path(objhash)
        if os.path.exists(destpath):
            # Windows: delete any existing object at the destination.
            os.chmod(destpath, S_IWUSR)
            os.remove(destpath)
        os.chmod(srcpath, S_IRUSR | S_IRGRP | S_IROTH)  # Make read-only
        move(srcpath, destpath)
