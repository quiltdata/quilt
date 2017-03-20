import json
import os
import requests
from shutil import copyfile
import tempfile
import time
import zlib

import pandas as pd

try:
    import fastparquet
except ImportError:
    fastparquet = None

try:
    import pyarrow as pa
    from pyarrow import parquet
except ImportError:
    pa = None

try:
    from pyspark.sql import SparkSession
except ImportError:
    SparkSession = None

from .const import NodeType, TargetType, PackageFormat, TYPE_KEY
from .hashing import digest_file, hash_contents

ZLIB_LEVEL = 2  # Maximum level.
ZLIB_METHOD = zlib.DEFLATED  # The only supported one.
ZLIB_WBITS = zlib.MAX_WBITS | 16  # Add a gzip header and checksum.
CHUNK_SIZE = 4096

class PackageException(Exception):
    """
    Exception class for Package handling
    """
    pass


class Package(object):
    BUILD_DIR = 'build'
    OBJ_DIR = 'objs'

    def __init__(self, user, package, mode, path, pkg_dir):
        self._user = user
        self._package = package
        self._mode = mode
        self._pkg_dir = pkg_dir
        self._path = path
    
    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        pass

    def file(self, hash_list):
        """
        Returns the path to an object file that matches the given hash.
        """
        assert isinstance(hash_list, list)
        assert len(hash_list) == 1, "File objects must be contained in one file."
        filehash = hash_list[0]
        objpath = os.path.join(self._pkg_dir, self.OBJ_DIR, filehash)
        return objpath

    def dataframe(self, hash_list):
        """
        Creates a DataFrame from a set of objects (identified by hashes).
        """
        raise NotImplementedError()

    def save_df(self, df, name, path, ext, target):
        """
        Save a DataFrame to the store.
        """
        raise NotImplementedError()

    def save_file(self, srcfile, name, path, target):
        """
        Save a (raw) file to the store.
        """
        filehash = digest_file(srcfile)
        fullname = name.lstrip('/').replace('/', '.')
        self._add_to_contents(fullname, filehash, '', path, target)
        objpath = os.path.join(self._pkg_dir, self.OBJ_DIR, filehash)
        if not os.path.exists(objpath):
            copyfile(srcfile, objpath)

    def get_contents(self):
        """
        Returns a dictionary with the contents of the package.
        """
        try:
            with open(self._path, 'r') as contents_file:
                contents = json.load(contents_file)
        except IOError:
            contents = {}

        # Make sure the top-level a valid node (GROUP by default)
        contents.setdefault(TYPE_KEY, NodeType.GROUP.value)

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
            json.dump(contents, contents_file, indent=2, sort_keys=True)

    def get(self, path):
        """
        Read a group or object from the store.
        """
        if not self.exists():
            raise PackageException("Package not found")

        key = path.lstrip('/')
        ipath = key.split('/') if key else []
        ptr = self.get_contents()
        path_so_far = []
        for node in ipath:
            path_so_far += [node]
            if not node in ptr:
                raise PackageException("Key {path} Not Found in Package {owner}/{pkg}".format(
                    path="/".join(path_so_far),
                    owner=self._user,
                    pkg=self._package))
            ptr = ptr[node]
        node = ptr

        node_type = NodeType(node[TYPE_KEY])
        if node_type is NodeType.GROUP:
            return node
        elif node_type is NodeType.TABLE:
            return self.dataframe(node['hashes'])
        elif node_type is NodeType.FILE:
            return self.file(node['hashes'])
        else:
            assert False, "Unhandled NodeType {nt}".format(nt=node_type)

    def get_hash(self):
        """
        Returns the hash digest of the package data.
        """
        raise PackageException("Not Implemented")

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
                    raise PackageException(msg.format(hash=download_hash, code=response.status_code))

                local_filename = os.path.join(self._pkg_dir,
                                              self.OBJ_DIR,
                                              download_hash)

                with open(local_filename, 'wb') as output_file:
                    # `requests` will automatically un-gzip the content, as long as
                    # the 'Content-Encoding: gzip' header is set.
                    for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                        if chunk: # filter out keep-alive new chunks
                            output_file.write(chunk)

                file_hash = digest_file(local_filename)
                if file_hash != download_hash:
                    os.remove(local_filename)
                    raise PackageException("Mismatched hash! Expected %s, got %s." %
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
        return os.path.join(self._pkg_dir, self.OBJ_DIR, objhash)

    def _add_to_contents(self, fullname, objhash, ext, path, target):
        """
        Adds an object (name-hash mapping) to the package's contents.
        """
        contents = self.get_contents()
        ipath = fullname.split('.')
        leaf = ipath.pop()

        ptr = contents
        ptr.setdefault(TYPE_KEY, NodeType.GROUP.value)
        for node in ipath:
            ptr = ptr.setdefault(node, {TYPE_KEY: NodeType.GROUP.value})

        try:
            target_type = TargetType(target)
            if target_type is TargetType.PANDAS:
                node_type = NodeType.TABLE
            elif target_type is TargetType.FILE:
                node_type = NodeType.FILE
            else:
                assert False, "Unhandled TargetType {tt}".format(tt=target_type)
        except ValueError:
            raise PackageException("Unrecognized target {tgt}".format(tgt=target))

        ptr[leaf] = dict({TYPE_KEY: node_type.value},
                         hashes=[objhash],
                         metadata=dict(q_ext=ext,
                                       q_path=path,
                                       q_target=target)
                        )

        self.save_contents(contents)


class HDF5Package(Package):
    """
    HDF5 Implementation of Package.
    """
    DF_NAME = 'df'

    def __init__(self, user, package, mode, path, pkg_dir):
        super(HDF5Package, self).__init__(user, package, mode, path, pkg_dir)
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

    def save_df(self, df, name, path, ext, target):
        """
        Save a DataFrame to the store.
        """
        buildfile = name.lstrip('/').replace('/', '.')
        storepath = os.path.join(self._pkg_dir, buildfile)
        with pd.HDFStore(storepath, mode=self._mode) as store:
            store[self.DF_NAME] = df
        filehash = digest_file(storepath)
        self._add_to_contents(buildfile, filehash, ext, path, target)
        objpath = os.path.join(self._pkg_dir, self.OBJ_DIR, filehash)
        os.rename(storepath, objpath)


class FastParquetPackage(Package):
    """
    Parquet Implementation of Package.
    """
    def __init__(self, user, package, mode):
        if fastparquet is None:
            raise PackageException("Module fastparquet is required for FastParquetPackage.")
        super(FastParquetPackage, self).__init__(user, package, mode)

    def save_df(self, df, name, path, ext, target):
        """
        Save a DataFrame to the store.
        """
        buildfile = name.lstrip('/').replace('/', '.')
        storepath = os.path.join(self._pkg_dir, buildfile)
        fastparquet.write(storepath, df)

        filehash = digest_file(storepath)
        self._add_to_contents(buildfile, filehash, ext, path, target)
        objpath = os.path.join(self._pkg_dir, self.OBJ_DIR, filehash)
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
        raise PackageException("Not Implemented")


class SparkPackage(FastParquetPackage):
    """
    Spark Implementation of Package.
    """
    def __init__(self, user, package, mode):
        super(SparkPackage, self).__init__(user, package, mode)

        if SparkSession is None:
            raise PackageException("Module SparkSession from pyspark.sql is required for " +
                                 "SparkPackage.")

    def dataframe(self, hash_list):
        """
        Creates a DataFrame from a set of objects (identified by hashes).
        """
        spark = SparkSession.builder.getOrCreate()
        assert len(hash_list) == 1, "Multi-file DFs not supported yet."
        filehash = hash_list[0]
        df = spark.read.parquet(self._object_path(filehash))
        return df


class ArrowPackage(Package):
    """
    Parquet Implementation of Package.
    """

    PACKAGE_FILE_EXT = '.parq'

    def __init__(self, user, package, mode):
        if pa is None:
            raise PackageException("Module pyarrow is required for ArrowPackage.")
        super(ArrowPackage, self).__init__(user, package, mode)

    def save_df(self, df, name, path, ext, target):
        """
        Save a DataFrame to the store.
        """
        # Save the dataframe to a local build file
        buildfile = name.lstrip('/').replace('/', '.')
        storepath = os.path.join(self._pkg_dir, buildfile)
        table = pa.Table.from_pandas(df)
        parquet.write_table(table, storepath)

        # Calculate the file hash and add it to the package contents
        filehash = digest_file(storepath)
        self._add_to_contents(buildfile, filehash, ext, path, target)

        # Move the build file to the object store and rename it to
        # its hash
        objpath = self._object_path(filehash)
        os.rename(storepath, objpath)

    def dataframe(self, hash_list):
        """
        Creates a DataFrame from a set of objects (identified by hashes).
        """
        assert len(hash_list) == 1, "Multi-file DFs not supported in HDF5."
        filehash = hash_list[0]

        nt = 8
        fpath = self._object_path(filehash)
        starttime = time.time()
        table = parquet.read_table(fpath, nthreads=nt)
        finishtime = time.time()
        elapsed = finishtime - starttime
        print("Read {path} in {time}s with {nt} threads".format(path=fpath, time=elapsed, nt=nt))

        starttime = time.time()
        df = table.to_pandas()
        finishtime = time.time()
        elapsed = finishtime - starttime
        print("Converted to pandas in {time}s".format(time=elapsed))
        return df
