"""
Build: parse and add user-supplied files to store
"""
from operator import attrgetter
import os
import re
import tempfile
import time
import zlib

import pandas as pd
import requests

try:
    import fastparquet
except ImportError:
    fastparquet = None

try:
    from pyspark.sql import SparkSession
except ImportError:
    SparkSession = None

from .const import DTIMEF, FORMAT_HDF5, FORMAT_PARQ
from .hashing import digest_file

# start with alpha (_ may clobber attrs), continue with alphanumeric or _
VALID_NAME_RE = re.compile(r'^[a-zA-Z]\w*$')
CHUNK_SIZE = 4096
ZLIB_LEVEL = 2  # Maximum level.
ZLIB_METHOD = zlib.DEFLATED  # The only supported one.
ZLIB_WBITS = zlib.MAX_WBITS | 16  # Add a gzip header and checksum.


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
    PACKAGE_DIR_NAME = 'quilt_packages'

    @classmethod
    def find_package_dirs(cls, start='.'):
        """
        Walks up the directory tree and looks for `quilt_packages` directories
        in the ancestors of the starting directory.

        The algorithm is the same as Node's `node_modules` algorithm
        ( https://nodejs.org/docs/v7.4.0/api/modules.html#modules_all_together ),
        except that it doesn't stop at the top-level `quilt_packages` directory.

        Returns a (possibly empty) generator.
        """
        path = os.path.realpath(start)
        while True:
            parent_path, name = os.path.split(path)
            if name != cls.PACKAGE_DIR_NAME:
                package_dir = os.path.join(path, cls.PACKAGE_DIR_NAME)
                if os.path.isdir(package_dir):
                    yield package_dir
            if parent_path == path:  # The only reliable way to detect the root.
                break
            path = parent_path

    def __init__(self, user, package, mode):
        self._user = user
        self._package = package
        self._mode = mode
        self._path = self.get_path()

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        pass

    def keys(self, prefix):
        """
        Returns a list of package contents.
        """
        raise StoreException("Not Implemented")

    def get_hash(self):
        """
        Returns the hash digest of the package data.
        """
        raise StoreException("Not Implemented")

    def create_path(self):
        """
        Creates a path to store a data package in the innermost `quilt_packages`
        directory (or in a new `quilt_packages` directory in the current directory)
        and allocates a per-user directory if needed.
        """
        if not VALID_NAME_RE.match(self._user):
            raise StoreException("Invalid user name: %r" % self._user)
        if not VALID_NAME_RE.match(self._package):
            raise StoreException("Invalid package name: %r" % self._package)

        package_dir = next(PackageStore.find_package_dirs(), self.PACKAGE_DIR_NAME)
        user_path = os.path.join(package_dir, self._user)
        if not os.path.isdir(user_path):
            os.makedirs(user_path)
        path = os.path.join(user_path, self._package)
        return path

    def get_path(self):
        """
        Finds an existing package in one of the package directories.
        """
        if not VALID_NAME_RE.match(self._user):
            raise StoreException("Invalid user name: %r" % self._user)
        if not VALID_NAME_RE.match(self._package):
            raise StoreException("Invalid package name: %r" % self._package)

        pkg_dirs = PackageStore.find_package_dirs()
        for package_dir in pkg_dirs:
            path = os.path.join(package_dir, self._user, self._package)
            if os.path.exists(path):
                return path
        return None


class HDF5PackageStore(PackageStore):
    """
    HDF5 Implementation of PackageStore.
    """
    PACKAGE_FILE_EXT = '.h5'

    def __init__(self, user, package, mode):
        super(HDF5PackageStore, self).__init__(user, package, mode)
        self.__store = None

    def __enter__(self):
        if self._mode == 'w' and self._path is None:
            self._path = self.create_path()
        self.__get_store()
        return self

    def __exit__(self, type, value, traceback):
        self.__store.close()
        self.__store = None

    def __get_store(self):
        if self.__store is None:
            self.__store = pd.HDFStore(self._path, mode=self._mode)
        return self.__store

    def exists(self):
        """
        Returns True if the package is already installed.
        """
        return not self._path is None

    def create_path(self):
        """
        Creates a new .h5 file in the innermost `quilt_packages` directory
        (or in a new `quilt_packages` directory in the current directory).
        Overwrites any existing package.
        """
        path = super(HDF5PackageStore, self).create_path() + self.PACKAGE_FILE_EXT
        return path

    def get_path(self):
        """
        Finds an existing package in one of the package directories.
        """
        if not VALID_NAME_RE.match(self._user):
            raise StoreException("Invalid user name: %r" % self._user)
        if not VALID_NAME_RE.match(self._package):
            raise StoreException("Invalid package name: %r" % self._package)

        pkg_dirs = PackageStore.find_package_dirs()
        for package_dir in pkg_dirs:
            path = os.path.join(package_dir, self._user, self._package + self.PACKAGE_FILE_EXT)
            if os.path.exists(path):
                return path
        return None

    def get(self, path):
        """
        Read a DataFrame from the store.
        """
        if not self.exists():
            raise StoreException("Package not found")

        return self.__get_store().get(path)

    def get_hash(self):
        path = self.get_path()
        if path is None:
            raise StoreException("Package not found")
        return digest_file(path)

    class UploadFile(object):
        """
        Helper class to manage temporary package files uploaded by push.
        """
        def __init__(self, store):
            self._store = store
            self._path = store.get_path()

        def __enter__(self):
            self._temp_file = tempfile.TemporaryFile()
            with open(self._path, 'rb') as input_file:
                zlib_obj = zlib.compressobj(ZLIB_LEVEL, ZLIB_METHOD, ZLIB_WBITS)
                for chunk in iter(lambda: input_file.read(CHUNK_SIZE), b''):
                    self._temp_file.write(zlib_obj.compress(chunk))
                self._temp_file.write(zlib_obj.flush())
            self._temp_file.seek(0)
            return self._temp_file

        def __exit__(self, type, value, traceback):
            self._temp_file.close()

    def tempfile(self):
        """
        Create and return a temporary file for uploading to a registry.
        """
        return self.UploadFile(self)

    def install(self, url, download_hash):
        """
        Download and install a package locally.
        """
        local_filename = self.create_path()

        response = requests.get(url, stream=True)
        if not response.ok:
            raise StoreException("Download failed: error %s" % response.status_code)

        assert local_filename, "Blank filename? %s" % local_filename

        with open(local_filename, 'wb') as output_file:
            # `requests` will automatically un-gzip the content, as long as
            # the 'Content-Encoding: gzip' header is set.
            for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                if chunk: # filter out keep-alive new chunks
                    output_file.write(chunk)

        file_hash = self.get_hash()
        if file_hash != download_hash:
            os.remove(local_filename)
            raise StoreException("Mismatched hash! Expected %s, got %s." %
                                 (download_hash, file_hash))


    def keys(self, prefix):
        # prepending root ensures dots is never empty, preventing an
        # exception from attrgetter
        dots = 'root' + prefix.replace('/', '.')
        node = attrgetter(dots)(self.__get_store())
        return node._v_children.keys()

    def save_df(self, df, name, path, ext, target):
        """
        Save a DataFrame to the store.
        """
        self.__store[name] = df

        # add metadata as HDF5 attrs
        dots = 'root' + name.replace('/', '.')
        snode = attrgetter(dots)(self.__store)
        # in spite of pytables docs
        # http://www.pytables.org/usersguide/libref/declarative_classes.html#attributesetclassdescr
        # snode.attrs does not work
        snode._v_attrs.q_ext = ext
        snode._v_attrs.q_path = path
        snode._v_attrs.q_target = target
        snode._v_attrs.q_timestamp = time.strftime(DTIMEF, time.gmtime())

    @classmethod
    def ls_packages(cls, pkg_dir):
        """
        List installed packages.
        """
        hdf5_packages = [
            (user, pkg[:-len(HDF5PackageStore.PACKAGE_FILE_EXT)])
            for user in os.listdir(pkg_dir)
            for pkg in os.listdir(os.path.join(pkg_dir, user))
            if pkg.endswith(HDF5PackageStore.PACKAGE_FILE_EXT)]
        return hdf5_packages


class ParquetPackageStore(PackageStore):
    """
    Parquet Implementation of PackageStore.
    """

    PACKAGE_FILE_EXT = '.parq'

    def __init__(self, user, package, mode):
        super(ParquetPackageStore, self).__init__(user, package, mode)
        if fastparquet is None:
            raise StoreException("Module fastparquet is required for ParquetPackageStore.")

        if self._mode == 'w':
            path = self.create_path()
        else:
            path = self.get_path()
        self.active_path = path

    def create_path(self):
        """
        Creates a new subdirectory in the innermost `quilt_packages` directory
        (or in a new `quilt_packages` directory in the current directory).
        """
        path = super(ParquetPackageStore, self).create_path()
        if not os.path.isdir(path):
            os.makedirs(path)
        return path

    def save_df(self, df, name, path, ext, target):
        """
        Save a DataFrame to the store.
        """
        # Below should really use os.path.join, but name is
        # arriving with a leading / that breaks it.
        path = self.active_path + name + self.PACKAGE_FILE_EXT
        fastparquet.write(path, df)

    def get(self, path):
        """
        Read a DataFrame to the store.
        """
        fpath = self.get_path() + path + self.PACKAGE_FILE_EXT
        pfile = fastparquet.ParquetFile(fpath)
        return pfile.to_pandas()

    def get_hash(self):
        raise StoreException("Not Implemented")

    @classmethod
    def ls_packages(cls, pkg_dir):
        """
        List installed packages.
        """
        parq_packages = [
            (user, pkg)
            for user in os.listdir(pkg_dir)
            for pkg in os.listdir(os.path.join(pkg_dir, user))
            if os.path.isdir(pkg)]
        return parq_packages

class SparkPackageStore(ParquetPackageStore):
    """
    Spark Implementation of PackageStore.
    """
    def __init__(self, user, package, mode):
        super(SparkPackageStore, self).__init__(user, package, mode)

        if SparkSession is None:
            raise StoreException("Module SparkSession from pyspark.sql is required for " +
                                 "SparkPackageStore.")

# Helper functions
def get_store(user, package, format=None, mode='r'):
    """
    Return a PackageStore object of the appropriate type for a
    given data package.
    """
    pkg_format = format
    if not pkg_format:
        pkg_format = os.environ.get('QUILT_PACKAGE_FORMAT', FORMAT_HDF5)
    if pkg_format == FORMAT_PARQ:
        return ParquetPackageStore(user, package, mode)
    else:
        return HDF5PackageStore(user, package, mode)

def ls_packages(pkg_dir):
    """
    List all packages from all package directories.
    """
    pkg_format = os.environ.get('QUILT_PACKAGE_FORMAT', FORMAT_HDF5)
    if pkg_format == FORMAT_HDF5:
        packages = HDF5PackageStore.ls_packages(pkg_dir)
    elif pkg_format == FORMAT_PARQ:
        packages = ParquetPackageStore.ls_packages(pkg_dir)
    else:
        raise StoreException("Unsupported Package Format %s" % pkg_format)
    return packages
