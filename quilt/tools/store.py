"""
Build: parse and add user-supplied files to store
"""
from enum import Enum
import json
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

from .const import DTIMEF, FORMAT_HDF5, FORMAT_PARQ, FORMAT_SPARK, NodeType
from .hashing import digest_file, hash_contents
from .util import flatten_contents

# start with alpha (_ may clobber attrs), continue with alphanumeric or _
VALID_NAME_RE = re.compile(r'^[a-zA-Z]\w*$')
CHUNK_SIZE = 4096
ZLIB_LEVEL = 2  # Maximum level.
ZLIB_METHOD = zlib.DEFLATED  # The only supported one.
ZLIB_WBITS = zlib.MAX_WBITS | 16  # Add a gzip header and checksum.
CONTENTS_FILE = 'contents.json'    

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
    PACKAGE_FILE_EXT = '.json'
    BUILD_DIR = 'build'
    OBJ_DIR = 'objs'

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
        self._find_path_read()
        print("Build store (base)")

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        pass

    def get_contents(self):
        contents = {}
        try:
            with open(self._path, 'r') as contents_file:
                contents = json.loads(contents_file.read())
        except IOError:
            # TODO: Should we initialize contents.json on pkg creation?
            pass
        return contents

    def save_contents(self, contents):
        with open(self._path, 'w') as contents_file:
            contents_file.write(json.dumps(contents))

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

    def get_path(self):
        return self._path
    
    def _find_path_read(self):
        """
        Finds an existing package in one of the package directories.
        """
        self._path = None
        self._pkg_dir = None
        if not VALID_NAME_RE.match(self._user):
            raise StoreException("Invalid user name: %r" % self._user)
        if not VALID_NAME_RE.match(self._package):
            raise StoreException("Invalid package name: %r" % self._package)

        pkg_dirs = PackageStore.find_package_dirs()
        for package_dir in pkg_dirs:
            path = os.path.join(package_dir, self._user, self._package + self.PACKAGE_FILE_EXT)
            if os.path.exists(path):
                self._path = path
                self._pkg_dir = package_dir
                return
        return

    def _find_path_write(self):
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
        obj_path = os.path.join(package_dir, self.OBJ_DIR)
        if not os.path.isdir(obj_path):
            os.makedirs(obj_path)
        path = os.path.join(user_path, self._package + self.PACKAGE_FILE_EXT)
        self._path = path
        self._pkg_dir = package_dir
        return


class HDF5PackageStore(PackageStore):
    """
    HDF5 Implementation of PackageStore.
    """
    DF_NAME = 'df'
    DATA_FILE_EXT = '.h5'

    def __init__(self, user, package, mode):
        super(HDF5PackageStore, self).__init__(user, package, mode)
        self.__store = None

    def exists(self):
        """
        Returns True if the package is already installed.
        """
        return not self._path is None   

    def get(self, path):
        """
        Read a DataFrame from the store.
        """
        if not self.exists():
            raise StoreException("Package not found")

        key = path.lstrip('/')
        ipath = key.split('/')

        ptr = self.get_contents()
        path_so_far = []
        for node in ipath:
            path_so_far += node
            if not node in ptr:
                raise StoreException("Key {path} Not Found in Package {owner}/{pkg}".format(
                    path=path_so_far,
                    owner=self._user,
                    pkg=self._package))
            ptr = ptr[node]
        node = ptr

        if NodeType(node['type']) is NodeType.TABLE:
            filehash = node['hash']
            objpath = os.path.join(self._pkg_dir, self.OBJ_DIR, filehash + self.DATA_FILE_EXT)
            with pd.HDFStore(objpath, 'r') as store:
                return store.get(self.DF_NAME)
        else:
            return node
        assert False, "Shouldn't reach here"

    def get_by_hash(self, hash):
        objpath = os.path.join(self._pkg_dir, self.OBJ_DIR, hash + self.DATA_FILE_EXT)
        return open(objpath, 'rb')

    def get_hash(self):
        print("HASHING CONTENTS=%s" % self.get_contents())
        flat_contents = flatten_contents(self.get_contents())
        print("FLAT: %s" % flat_contents)
        return hash_contents(flat_contents)

    class UploadFile(object):
        """
        Helper class to manage temporary package files uploaded by push.
        """
        def __init__(self, store, hash):
            self._store = store
            self._hash = hash

        def __enter__(self):
            self._temp_file = tempfile.TemporaryFile()
            with self._store.get_by_hash(self._hash) as input_file:
                zlib_obj = zlib.compressobj(ZLIB_LEVEL, ZLIB_METHOD, ZLIB_WBITS)
                for chunk in iter(lambda: input_file.read(CHUNK_SIZE), b''):
                    self._temp_file.write(zlib_obj.compress(chunk))
                self._temp_file.write(zlib_obj.flush())
            self._temp_file.seek(0)
            return self._temp_file

        def __exit__(self, type, value, traceback):
            self._temp_file.close()

    def tempfile(self, hash):
        """
        Create and return a temporary file for uploading to a registry.
        """
        return self.UploadFile(self, hash)

    def install(self, contents, urls):
        """
        Download and install a package locally.
        """
        self._find_path_write()
        local_filename = self.get_path()
        with open(local_filename, 'w') as contents_file:
            contents_file.write(json.dumps(contents))

        # Download individual object files and store
        # in object dir. Verify individual file hashes.
        # Verify global hash?

        def install_table(node, urls):
            hashes = node['hash']
            for download_hash in hashes:
                url = urls[download_hash]

                # download and install
                print("INSTALL: %s" % download_hash)
                response = requests.get(url, stream=True)
                if not response.ok:
                    msg = "Download {hash} failed: error {code}"
                    raise StoreException(msg.format(hash=download_hash, code=response.status_code))

                local_filename = os.path.join(self._pkg_dir,
                                              self.OBJ_DIR,
                                              download_hash + self.DATA_FILE_EXT)

                with open(local_filename, 'wb') as output_file:
                    # `requests` will automatically un-gzip the content, as long as
                    # the 'Content-Encoding: gzip' header is set.
                    for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                        if chunk: # filter out keep-alive new chunks
                            output_file.write(chunk)

                file_hash = digest_file(local_filename)
                if file_hash != download_hash:
                    os.remove(local_filename)
                    raise StoreException("Mismatched hash! Expected %s, got %s." %
                                         (download_hash, file_hash))
        
        def install_tables(contents, urls):
            for key in contents.keys():
                if key == 'type':
                    continue
                node = contents.get(key)
                print("NODE=%s" % node)
                if NodeType(node.get('type')) is NodeType.GROUP:
                    return install_tables(node, urls)
                else:
                    install_table(node, urls)

        return install_tables(contents, urls)
        
    def keys(self, prefix):
        return self.get_contents().keys()

    def save_df(self, df, name, path, ext, target):
        """
        Save a DataFrame to the store.
        """
        self._find_path_write()
        print("NAME=%s" % name)
        print("PATH=%s" % path)
        print("PKG_DIR=%s" % self._pkg_dir)
        print("EXT=%s" % ext)
        buildfile = name.lstrip('/').replace('/', '.')
        storepath = os.path.join(self._pkg_dir, buildfile + self.DATA_FILE_EXT)
        with pd.HDFStore(storepath, mode=self._mode) as store:
            store[self.DF_NAME] = df

        # Update contents
        contents = self.get_contents()
        filehash = digest_file(storepath)
        ipath = buildfile.split('.')
        print("IPATH=%s" % ipath)
        dfname = ipath.pop()

        ptr = contents
        for node in ipath:
            if not node in ptr:
                ptr[node] = dict(type=NodeType.GROUP.value)
            ptr = ptr[node]

        ptr[dfname] = dict(type=NodeType.TABLE.value,
                           hash=[filehash],
                           q_ext=ext,
                           q_path=path,
                           q_target=target)
        print("FINAL CONTENTS=%s" % contents)
        
        objpath = os.path.join(self._pkg_dir, self.OBJ_DIR, filehash + self.DATA_FILE_EXT)
        os.rename(storepath, objpath)
        self.save_contents(contents)

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

    def get(self, path):
        """
        Read a DataFrame to the store.
        """
        spark = SparkSession.builder.getOrCreate()
        fpath = self.get_path() + path + self.PACKAGE_FILE_EXT
        df = spark.read.parquet(fpath)
        return df

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
    elif pkg_format == FORMAT_SPARK:
        return SparkPackageStore(user, package, mode)
    else:
        store = HDF5PackageStore(user, package, mode)
        print("got store=%s" % store)
        return store

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
