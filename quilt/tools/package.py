import json
import os
from shutil import copyfile
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
    import pyarrow as pa
    from pyarrow import parquet
except ImportError:
    pa = None

try:
    from pyspark.sql import SparkSession
except ImportError:
    SparkSession = None

from .const import TargetType, PackageFormat
from .core import decode_node, encode_node, hash_contents, FileNode, RootNode, GroupNode, TableNode
from .hashing import digest_file

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
    TMP_OBJ_DIR = 'objs/tmp'
    DF_NAME = 'df'

    def __init__(self, user, package, path, pkg_dir):
        self._user = user
        self._package = package
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

    def _dataframe(self, hash_list, pkgformat):
        """
        Creates a DataFrame from a set of objects (identified by hashes).
        """
        enumformat = PackageFormat(pkgformat)
        if enumformat is PackageFormat.HDF5:
            assert len(hash_list) == 1, "Multi-file DFs not supported in HDF5."
            filehash = hash_list[0]
            with pd.HDFStore(self._object_path(filehash), 'r') as store:
                return store.get(self.DF_NAME)
        elif enumformat is PackageFormat.ARROW:
            if pa is None:
                raise PackageException("Module pyarrow is required for ArrowPackage.")

            assert len(hash_list) == 1, "Multi-file DFs not supported for Arrow Packages (yet)."
            filehash = hash_list[0]

            nt = 8
            fpath = self._object_path(filehash)
            starttime = time.time()
            table = parquet.read_table(fpath, nthreads=nt)
            finishtime = time.time()
            #elapsed = finishtime - starttime
            #print("Read {path} in {time}s with {nt} threads".format(path=fpath,
            #                                                        time=elapsed,
            #                                                        nt=nt))

            starttime = time.time()
            df = table.to_pandas()
            finishtime = time.time()
            #elapsed = finishtime - starttime
            #print("Converted to pandas in {time}s".format(time=elapsed))
            return df
        elif enumformat is PackageFormat.FASTPARQUET:
            assert len(hash_list) == 1, "Multi-file DFs not supported yet."
            filehash = hash_list[0]
            pfile = fastparquet.ParquetFile(self._object_path(filehash))
            return pfile.to_pandas()
        elif enumformat is PackageFormat.SPARK:
            if SparkSession is None:
                raise PackageException("Module SparkSession from pyspark.sql is required for " +
                                       "SparkPackage.")

            spark = SparkSession.builder.getOrCreate()
            assert len(hash_list) == 1, "Multi-file DFs not supported yet."
            filehash = hash_list[0]
            df = spark.read.parquet(self._object_path(filehash))
            return df
        else:
            assert False, "Unimplemented package format: %s" % enumformat

    def save_df(self, df, name, path, ext, target):
        """
        Save a DataFrame to the store.
        """
        enumformat = PackageFormat(self.get_contents().format)
        buildfile = name.lstrip('/').replace('/', '.')
        storepath = self._temporary_object_path(buildfile)

        # Serialize DataFrame to chosen format
        if enumformat is PackageFormat.HDF5:
            with pd.HDFStore(storepath, mode='w') as store:
                store[self.DF_NAME] = df
        elif enumformat is PackageFormat.FASTPARQUET:
            buildfile = name.lstrip('/').replace('/', '.')
            storepath = os.path.join(self._pkg_dir, buildfile)
            fastparquet.write(storepath, df)
        elif enumformat is PackageFormat.ARROW:
            if pa is None:
                raise PackageException("Module pyarrow is required for ArrowPackage.")

            table = pa.Table.from_pandas(df)
            parquet.write_table(table, storepath)
        else:
            assert False, "Unimplemented PackageFormat %s" % enumformat

        # Move serialized DataFrame to object store
        filehash = digest_file(storepath)
        self._add_to_contents(buildfile, filehash, ext, path, target)
        os.rename(storepath, self._object_path(filehash))

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
                contents = json.load(contents_file, object_hook=decode_node)
        except IOError:
            contents = GroupNode(dict())

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
            json.dump(contents, contents_file, default=encode_node, indent=2, sort_keys=True)

    def init_contents(self, pkgformat):
        # Verify the format is recognized
        enumformat = PackageFormat(pkgformat)
        contents = RootNode(dict(), enumformat.value)
        self.save_contents(contents)

    def get(self, path):
        """
        Read a group or object from the store.
        """
        if not self.exists():
            raise PackageException("Package not found")

        key = path.lstrip('/')
        ipath = key.split('/') if key else []
        ptr = self.get_contents()
        pkgformat = ptr.format
        path_so_far = []
        for node_name in ipath:
            path_so_far += [node_name]
            ptr = ptr.children.get(node_name)
            if ptr is None:
                raise PackageException("Key {path} Not Found in Package {owner}/{pkg}".format(
                    path="/".join(path_so_far),
                    owner=self._user,
                    pkg=self._package))
        node = ptr

        if isinstance(node, GroupNode):
            return node
        elif isinstance(node, TableNode):
            return self._dataframe(node.hashes, pkgformat)
        elif isinstance(node, FileNode):
            return self.file(node.hashes)
        else:
            assert False, "Unhandled Node {node}".format(node=node)

    def get_hash(self):
        """
        Returns the hash digest of the package data.
        """
        return hash_contents(self.get_contents())

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
            json.dump(contents, contents_file, default=encode_node)

        # Download individual object files and store
        # in object dir. Verify individual file hashes.
        # Verify global hash?

        def install_table(node, urls):
            """
            Downloads and installs the set of objects for one table.
            """
            for download_hash in node.hashes:
                url = urls[download_hash]

                # download and install
                response = requests.get(url, stream=True)
                if not response.ok:
                    msg = "Download {hash} failed: error {code}"
                    raise PackageException(msg.format(hash=download_hash,
                                                      code=response.status_code))

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
            for node in contents.children.values():
                if isinstance(node, GroupNode):
                    install_tables(node, urls)
                else:
                    install_table(node, urls)

        return install_tables(contents, urls)

    class UploadFile(object):
        """
        Helper class to manage temporary package files uploaded by push.
        """
        def __init__(self, store, objhash):
            self._store = store
            self._hash = objhash
            self._temp_file = None

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

    def _object_path(self, objhash):
        """
        Returns the path to an object file based on its hash.
        """
        return os.path.join(self._pkg_dir, self.OBJ_DIR, objhash)

    def _temporary_object_path(self, name):
        """
        Returns the path to a temporary object, before we know its hash.
        """
        return os.path.join(self._pkg_dir, self.TMP_OBJ_DIR, name)

    def _add_to_contents(self, fullname, objhash, ext, path, target):
        """
        Adds an object (name-hash mapping) to the package's contents.
        """
        contents = self.get_contents()
        ipath = fullname.split('.')
        leaf = ipath.pop()

        ptr = contents
        for node in ipath:
            ptr = ptr.children.setdefault(node, GroupNode(dict()))

        try:
            target_type = TargetType(target)
            if target_type is TargetType.PANDAS:
                node_cls = TableNode
            elif target_type is TargetType.FILE:
                node_cls = FileNode
            else:
                assert False, "Unhandled TargetType {tt}".format(tt=target_type)
        except ValueError:
            raise PackageException("Unrecognized target {tgt}".format(tgt=target))

        ptr.children[leaf] = node_cls(
            hashes=[objhash],
            metadata=dict(
                q_ext=ext,
                q_path=path,
                q_target=target
            )
        )

        self.save_contents(contents)
