"""
Build: parse and add user-supplied files to store
"""
import json
import os
import re
import tempfile
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

from .const import FORMAT_HDF5, FORMAT_PARQ, FORMAT_SPARK, NodeType, TYPE_KEY
from .hashing import digest_file, hash_contents

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
        self._pkg_dir = None
        self._path = None
        self._find_path_read()

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        pass

    def get_contents(self):
        """
        Returns a dictionary with the contents of the package.
        """
        contents = {}
        try:
            with open(self._path, 'r') as contents_file:
                contents = json.load(contents_file)
        except IOError:
            # TODO: Should we initialize contents.json on pkg creation?
            pass
        return contents

    def clear_contents(self):
        """
        Removes the package's contents file.
        """
        if self._path:
            os.remove(self._path)
        self._path = None

    def save_contents(self, contents):
        """
        Saves an updated version of the package's contents.
        """
        with open(self._path, 'w') as contents_file:
            json.dump(contents, contents_file)

    def keys(self, prefix):
        """
        Returns a list of package contents.
        """
        raise StoreException("Not Implemented")

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
            path_so_far += [node]
            if not node in ptr:
                raise StoreException("Key {path} Not Found in Package {owner}/{pkg}".format(
                    path="/".join(path_so_far),
                    owner=self._user,
                    pkg=self._package))
            ptr = ptr[node]
        node = ptr

        if NodeType(node[TYPE_KEY]) is NodeType.TABLE:
            hash_list = node['hashes']
            return self.dataframe(hash_list)
        else:
            return node

    def get_hash(self):
        """
        Returns the hash digest of the package data.
        """
        raise StoreException("Not Implemented")

    def get_path(self):
        """
        Returns the path to the package's contents file.
        """
        return self._path

    def exists(self):
        """
        Returns True if the package is already installed.
        """
        return not self._path is None

    def install(self, contents, urls):
        """
        Download and install a package locally.
        """
        self._find_path_write()
        local_filename = self.get_path()
        with open(local_filename, 'w') as contents_file:
            json.dump(contents, contents_file)

        # Download individual object files and store
        # in object dir. Verify individual file hashes.
        # Verify global hash?

        def install_table(node, urls):
            """
            Downloads and installs the set of objects for one table.
            """
            hashes = node['hashes']
            for download_hash in hashes:
                url = urls[download_hash]

                # download and install
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
            """
            Parses package contents and calls install_table for each table.
            """
            for key, node in contents.items():
                if key == TYPE_KEY:
                    continue
                if NodeType(node[TYPE_KEY]) is NodeType.GROUP:
                    return install_tables(node, urls)
                else:
                    install_table(node, urls)

        return install_tables(contents, urls)

    def _object_path(self, objhash):
        """
        Returns the path to an object file based on its hash.
        """
        return os.path.join(self._pkg_dir, self.OBJ_DIR, objhash + self.DATA_FILE_EXT)

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

    def _add_to_contents(self, fullname, objhash, ext, path, target):
        """
        Adds an object (name-hash mapping) to the package's contents.
        """
        contents = self.get_contents()
        ipath = fullname.split('.')
        dfname = ipath.pop()

        ptr = contents
        for node in ipath:
            ptr = ptr.setdefault(node, {TYPE_KEY: NodeType.GROUP.value})
            ptr = ptr[node]

        ptr[dfname] = dict({TYPE_KEY: NodeType.TABLE.value},
                           hashes=[objhash],
                           metadata=dict(q_ext=ext,
                                         q_path=path,
                                         q_target=target)
                          )

        self.save_contents(contents)


class HDF5PackageStore(PackageStore):
    """
    HDF5 Implementation of PackageStore.
    """
    DF_NAME = 'df'
    DATA_FILE_EXT = '.h5'

    def __init__(self, user, package, mode):
        super(HDF5PackageStore, self).__init__(user, package, mode)
        self.__store = None

    def dataframe(self, hash_list):
        """
        Creates a DataFrame from a set of objects (identified by hashes).
        """
        assert len(hash_list) == 1, "Multi-file DFs not supported in HDF5."
        filehash = hash_list[0]
        with pd.HDFStore(self._object_path(filehash), 'r') as store:
            return store.get(self.DF_NAME)

    def get_hash(self):
        return hash_contents(self.get_contents())

    class UploadFile(object):
        """
        Helper class to manage temporary package files uploaded by push.
        """
        def __init__(self, store, objhash):
            self._store = store
            self._hash = objhash

        def __enter__(self):
            self._temp_file = tempfile.TemporaryFile()
            with open(self._store._object_path(self._hash), 'rb') as input_file:
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

    def keys(self, prefix):
        """
        Returns a list of package contents.
        """
        return self.get_contents().keys()

    def save_df(self, df, name, path, ext, target):
        """
        Save a DataFrame to the store.
        """
        self._find_path_write()
        buildfile = name.lstrip('/').replace('/', '.')
        storepath = os.path.join(self._pkg_dir, buildfile + self.DATA_FILE_EXT)
        with pd.HDFStore(storepath, mode=self._mode) as store:
            store[self.DF_NAME] = df
        filehash = digest_file(storepath)
        self._add_to_contents(buildfile, filehash, ext, path, target)
        objpath = os.path.join(self._pkg_dir, self.OBJ_DIR, filehash + self.DATA_FILE_EXT)
        os.rename(storepath, objpath)


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

    DATA_FILE_EXT = '.parq'

    def __init__(self, user, package, mode):
        if fastparquet is None:
            raise StoreException("Module fastparquet is required for ParquetPackageStore.")
        super(ParquetPackageStore, self).__init__(user, package, mode)

    def save_df(self, df, name, path, ext, target):
        """
        Save a DataFrame to the store.
        """
        self._find_path_write()
        buildfile = name.lstrip('/').replace('/', '.')
        storepath = os.path.join(self._pkg_dir, buildfile + self.DATA_FILE_EXT)
        fastparquet.write(storepath, df)

        filehash = digest_file(storepath)
        self._add_to_contents(buildfile, filehash, ext, path, target)
        objpath = os.path.join(self._pkg_dir, self.OBJ_DIR, filehash + self.DATA_FILE_EXT)
        os.rename(storepath, objpath)

    def dataframe(self, hash_list):
        """
        Creates a DataFrame from a set of objects (identified by hashes).
        """
        assert len(hash_list) == 1, "Multi-file DFs not supported yet."
        filehash = hash_list[0]
        pfile = fastparquet.ParquetFile(self._object_path(filehash))
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

    def dataframe(self, hash_list):
        """
        Creates a DataFrame from a set of objects (identified by hashes).
        """
        spark = SparkSession.builder.getOrCreate()
        assert len(hash_list) == 1, "Multi-file DFs not supported yet."
        filehash = hash_list[0]
        df = spark.read.parquet(self._object_path(filehash))
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
