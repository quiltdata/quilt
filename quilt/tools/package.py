from enum import Enum
import json
import os
from shutil import copyfile, rmtree
import tempfile
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
    from pyspark import sql as sparksql
except ImportError:
    sparksql = None

from .const import TargetType
from .core import (decode_node, encode_node, hash_contents,
                   FileNode, RootNode, GroupNode, TableNode,
                   PackageFormat)
from .hashing import digest_file

ZLIB_LEVEL = 2
ZLIB_METHOD = zlib.DEFLATED  # The only supported one.
ZLIB_WBITS = zlib.MAX_WBITS | 16  # Add a gzip header and checksum.
CHUNK_SIZE = 4096


class ParquetLib(Enum):
    ARROW = 'pyarrow'
    FASTPARQUET = 'fastparquet'
    SPARK = 'pyspark'


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

    __parquet_lib = None

    @classmethod
    def get_parquet_lib(cls):
        """
        Find/choose a library to read and write Parquet files
        based on installed options.
        """
        if not cls.__parquet_lib:
            parq_env = os.environ.get('QUILT_PARQUET_LIBRARY')
            if parq_env:
                cls.__parquet_lib = ParquetLib(parq_env)
            else:
                if sparksql is not None:
                    cls.__parquet_lib = ParquetLib.SPARK
                elif pa is not None:
                    cls.__parquet_lib = ParquetLib.ARROW
                elif fastparquet is not None:
                    cls.__parquet_lib = ParquetLib.FASTPARQUET
                else:
                    msg = "One of the following libraries is requried to read"
                    msg += " Parquet packages: %s" % [l.value for l in ParquetLib]
                    raise PackageException(msg)
        return cls.__parquet_lib

    @classmethod
    def reset_parquet_lib(cls):
        cls.__parquet_lib = None

    @classmethod
    def set_parquet_lib(cls, parqlib):
        cls.__parquet_lib = ParquetLib(parqlib)

    def __init__(self, user, package, path, pkg_dir, contents=None):
        self._user = user
        self._package = package
        self._pkg_dir = pkg_dir
        self._path = path

        if contents is None:
            contents = self._load_contents()

        self._contents = contents

    def _load_contents(self):
        with open(self._path, 'r') as contents_file:
            contents = json.load(contents_file, object_hook=decode_node)
            if not isinstance(contents, RootNode):
                contents = RootNode(contents.children, PackageFormat.default.value)
            return contents

    def file(self, hash_list):
        """
        Returns the path to an object file that matches the given hash.
        """
        assert isinstance(hash_list, list)
        assert len(hash_list) == 1, "File objects must be contained in one file."
        filehash = hash_list[0]
        return self.object_path(filehash)

    def _read_hdf5(self, hash_list):
        assert len(hash_list) == 1, "Multi-file DFs not supported in HDF5."
        filehash = hash_list[0]
        with pd.HDFStore(self.object_path(filehash), 'r') as store:
            return store.get(self.DF_NAME)

    def _read_parquet_arrow(self, hash_list):
        if pa is None:
            raise PackageException("Module pyarrow is required for ArrowPackage.")

        objfiles = [self.object_path(h) for h in hash_list]
        table = parquet.read_multiple_files(paths=objfiles, nthreads=4)
        df = table.to_pandas()
        return df

    def _read_parquet_fastparquet(self, hash_list):
        # As of 3/25/2017, fastparquet on GH supports passing a list
        # of paths, but the latest version on conda and pip (0.0.5) does
        # not.
        # TODO: Update this method to pass the list of objectfile paths
        # like _read_parquet_arrow (above).
        assert len(hash_list) == 1, "Multi-file DFs not supported yet using fastparquet."
        filehash = hash_list[0]
        pfile = fastparquet.ParquetFile(self.object_path(filehash))
        return pfile.to_pandas()

    def _read_parquet_spark(self, hash_list):
        if sparksql is None:
            raise PackageException("Module SparkSession from pyspark.sql is required for " +
                                   "SparkPackage.")

        spark = sparksql.SparkSession.builder.getOrCreate()
        objfiles = [self.object_path(h) for h in hash_list]
        df = spark.read.parquet(*objfiles)
        return df

    def _dataframe(self, hash_list, pkgformat):
        """
        Creates a DataFrame from a set of objects (identified by hashes).
        """
        enumformat = PackageFormat(pkgformat)
        if enumformat is PackageFormat.HDF5:
            return self._read_hdf5(hash_list)
        elif enumformat is PackageFormat.PARQUET:
            parqlib = self.get_parquet_lib()
            if parqlib is ParquetLib.SPARK:
                return self._read_parquet_spark(hash_list)
            elif parqlib is ParquetLib.ARROW:
                return self._read_parquet_arrow(hash_list)
            elif parqlib is ParquetLib.FASTPARQUET:
                return self._read_parquet_fastparquet(hash_list)
            else:
                assert False, "Unimplemented Parquet Library %s" % parqlib
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
            # HACK: Force the use of old pickle to ensure Python 2/3 compatibility.
            from pandas.compat import cPickle
            old_protocol = cPickle.HIGHEST_PROTOCOL
            try:
                cPickle.HIGHEST_PROTOCOL = 2
                with pd.HDFStore(storepath, mode='w') as store:
                    store[self.DF_NAME] = df
            finally:
                cPickle.HIGHEST_PROTOCOL = old_protocol

        elif enumformat is PackageFormat.PARQUET:
            # switch parquet lib
            parqlib = self.get_parquet_lib()
            if parqlib is ParquetLib.FASTPARQUET:
                fastparquet.write(storepath, df)
            elif parqlib is ParquetLib.ARROW:
                table = pa.Table.from_pandas(df)
                parquet.write_table(table, storepath)
            elif parqlib is ParquetLib.SPARK:
                assert isinstance(df, sparksql.DataFrame)
                df.write.parquet(storepath)
            else:
                assert False, "Unimplemented ParquetLib %s" % parqlib
        else:
            assert False, "Unimplemented PackageFormat %s" % enumformat

        # Move serialized DataFrame to object store
        if os.path.isdir(storepath): # Pyspark
            hashes = []
            files = [ofile for ofile in os.listdir(storepath) if ofile.endswith(".parquet")]
            for obj in files:
                path = os.path.join(storepath, obj)
                objhash = digest_file(path)
                os.rename(path, self.object_path(objhash))
                hashes.append(objhash)
            self._add_to_contents(buildfile, hashes, ext, path, target)
            rmtree(storepath)
        else:
            filehash = digest_file(storepath)
            self._add_to_contents(buildfile, [filehash], ext, path, target)
            os.rename(storepath, self.object_path(filehash))

    def save_file(self, srcfile, name, path):
        """
        Save a (raw) file to the store.
        """
        filehash = digest_file(srcfile)
        fullname = name.lstrip('/').replace('/', '.')
        self._add_to_contents(fullname, [filehash], '', path, 'file')
        objpath = self.object_path(filehash)
        if not os.path.exists(objpath):
            copyfile(srcfile, objpath)

    def get_contents(self):
        """
        Returns a dictionary with the contents of the package.
        """
        return self._contents

    def save_contents(self):
        """
        Saves the in-memory contents to the package file.
        """
        with open(self._path, 'w') as contents_file:
            json.dump(self._contents, contents_file, default=encode_node, indent=2, sort_keys=True)

    def get(self, path):
        """
        Traverse the package tree and return node corresponding to
        the given path.
        """
        key = path.lstrip('/')
        ipath = key.split('/') if key else []
        ptr = self.get_contents()
        path_so_far = []
        for node_name in ipath:
            if not isinstance(ptr, GroupNode):
                raise PackageException("Key {path} in package {owner}/{pkg} is a leaf node".format(
                    path="/".join(path_so_far),
                    owner=self._user,
                    pkg=self._package))

            path_so_far += [node_name]
            ptr = ptr.children.get(node_name)
            if ptr is None:
                raise PackageException("Key {path} not found in package {owner}/{pkg}".format(
                    path="/".join(path_so_far),
                    owner=self._user,
                    pkg=self._package))
        return ptr

    def get_obj(self, node):
        """
        Read an object from the package given a node from the
        package tree.
        """
        ptr = self.get_contents()
        pkgformat = ptr.format

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

    class UploadFile(object):
        """
        Helper class to manage temporary package files uploaded by push.
        """
        def __init__(self, package, objhash):
            self._package = package
            self._hash = objhash
            self._temp_file = None

        def __enter__(self):
            self._temp_file = tempfile.TemporaryFile()
            with open(self._package.object_path(self._hash), 'rb') as input_file:
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

    def object_path(self, objhash):
        """
        Returns the path to an object file based on its hash.
        """
        return os.path.join(self._pkg_dir, self.OBJ_DIR, objhash)

    def _temporary_object_path(self, name):
        """
        Returns the path to a temporary object, before we know its hash.
        """
        return os.path.join(self._pkg_dir, self.TMP_OBJ_DIR, name)

    def _add_to_contents(self, fullname, hashes, ext, path, target):
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
            hashes=hashes,
            metadata=dict(
                q_ext=ext,
                q_path=path,
                q_target=target
            )
        )
