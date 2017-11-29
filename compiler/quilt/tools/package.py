from enum import Enum
import gzip
import json
import os
from shutil import copyfile, copyfileobj, move, rmtree
import tempfile

import pandas as pd
from six import itervalues

from .const import TargetType
from .core import (decode_node, encode_node, hash_contents,
                   FileNode, RootNode, GroupNode, TableNode,
                   PackageFormat)
from .hashing import digest_file

ZLIB_LEVEL = 2
CHUNK_SIZE = 4096


class ParquetLib(Enum):
    SPARK = 'pyspark'
    ARROW = 'pyarrow'


class PackageException(Exception):
    """
    Exception class for Package handling
    """
    pass


class Package(object):
    DF_NAME = 'df'
    CONTENTS_DIR = 'contents'
    TAGS_DIR = 'tags'
    VERSIONS_DIR = 'versions'
    LATEST = 'latest'

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

    def __init__(self, store, user, package, path, contents=None, pkghash=None):
        self._store = store
        self._user = user
        self._package = package
        self._path = path

        if not os.path.isdir(self._path):
            os.makedirs(self._path)
            os.mkdir(os.path.join(self._path, self.CONTENTS_DIR))
            os.mkdir(os.path.join(self._path, self.TAGS_DIR))
            os.mkdir(os.path.join(self._path, self.VERSIONS_DIR))

        if contents is None:
            contents = self._load_contents(pkghash)

        self._contents = contents

    def _load_contents(self, instance_hash=None):
        if instance_hash is None:
            latest_tag = os.path.join(self._path, self.TAGS_DIR, self.LATEST)
            if not os.path.exists(latest_tag):
                msg = "Could not find latest tag for package {0}/{1}"
                raise PackageException(msg.format(self._user, self._package))

            with open (latest_tag, 'r') as tagfile:
                instance_hash = tagfile.read()

        contents_path = os.path.join(self._path, self.CONTENTS_DIR, instance_hash)
        if not os.path.isfile(contents_path):
            msg = "Invalid hash for package {owner}/{pkg}: {hash}"
            raise PackageException(msg.format(hash=instance_hash, owner=self._user, pkg=self._package))
        
        with open(contents_path, 'r') as contents_file:
            contents = json.load(contents_file, object_hook=decode_node)
            if not isinstance(contents, RootNode):
                # Really old package: no root node.
                contents = RootNode(contents.children)
            # Fix packages with no format in data nodes.
            pkg_format = contents.format or PackageFormat.HDF5
            self._fix_format(contents, pkg_format)
            return contents

    @classmethod
    def _fix_format(cls, contents, pkg_format):
        for child in itervalues(contents.children):
            if isinstance(child, GroupNode):
                cls._fix_format(child, pkg_format)
            elif isinstance(child, TableNode):
                if child.format is None:
                    child.format = pkg_format

    def file(self, hash_list):
        """
        Returns the path to an object file that matches the given hash.
        """
        assert isinstance(hash_list, list)
        assert len(hash_list) == 1, "File objects must be contained in one file."
        filehash = hash_list[0]
        return self._store.object_path(filehash)

    def _read_hdf5(self, hash_list):
        assert len(hash_list) == 1, "Multi-file DFs not supported in HDF5."
        filehash = hash_list[0]
        with pd.HDFStore(self._store.object_path(filehash), 'r') as store:
            return store.get(self.DF_NAME)

    def _read_parquet_arrow(self, hash_list):
        from pyarrow.parquet import ParquetDataset

        objfiles = [self._store.object_path(h) for h in hash_list]
        dataset = ParquetDataset(objfiles)
        table = dataset.read(nthreads=4)
        dataframe = table.to_pandas()
        return dataframe

    def _read_parquet_spark(self, hash_list):
        from pyspark import sql as sparksql

        spark = sparksql.SparkSession.builder.getOrCreate()
        objfiles = [self._store.object_path(h) for h in hash_list]
        dataframe = spark.read.parquet(*objfiles)
        return dataframe

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
                try:
                    return self._read_parquet_arrow(hash_list)
                except ValueError as err:
                    raise PackageException(str(err))
            else:
                assert False, "Unimplemented Parquet Library %s" % parqlib
        else:
            assert False, "Unimplemented package format: %s" % enumformat

    def _check_hashes(self, hash_list):
        for objhash in hash_list:
            path = self._store.object_path(objhash)
            if not os.path.exists(path):
                raise PackageException("Missing object fragments; re-install the package")

    def save_cached_df(self, hashes, name, path, ext, target, fmt):
        """
        Save a DataFrame to the store.
        """
        buildfile = name.lstrip('/').replace('/', '.')
        self._add_to_contents(buildfile, hashes, ext, path, target, fmt)

    def save_df(self, dataframe, name, path, ext, target, fmt):
        """
        Save a DataFrame to the store.
        """
        enumformat = PackageFormat(fmt)
        buildfile = name.lstrip('/').replace('/', '.')
        storepath = self._store.temporary_object_path(buildfile)

        # Serialize DataFrame to chosen format
        if enumformat is PackageFormat.PARQUET:
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
        else:
            assert False, "Unimplemented PackageFormat %s" % enumformat

        # Move serialized DataFrame to object store
        if os.path.isdir(storepath): # Pyspark
            hashes = []
            files = [ofile for ofile in os.listdir(storepath) if ofile.endswith(".parquet")]
            for obj in files:
                path = os.path.join(storepath, obj)
                objhash = digest_file(path)
                move(path, self._store.object_path(objhash))
                hashes.append(objhash)
            self._add_to_contents(buildfile, hashes, ext, path, target, fmt)
            rmtree(storepath)
            return hashes
        else:
            filehash = digest_file(storepath)
            self._add_to_contents(buildfile, [filehash], ext, path, target, fmt)
            move(storepath, self._store.object_path(filehash))
            return [filehash]

    def save_file(self, srcfile, name, path):
        """
        Save a (raw) file to the store.
        """
        filehash = digest_file(srcfile)
        fullname = name.lstrip('/').replace('/', '.')
        self._add_to_contents(fullname, [filehash], '', path, 'file', None)
        objpath = self._store.object_path(filehash)
        if not os.path.exists(objpath):
            copyfile(srcfile, objpath)

    def get_contents(self):
        """
        Returns a dictionary with the contents of the package.
        """
        return self._contents

    def set_contents(self, contents):
        """
        Sets a new contents.
        """
        self._contents = contents

    def save_contents(self):
        """
        Saves the in-memory contents to a file in the local
        package repository.
        """
        instance_hash = self.get_hash()
        dest = os.path.join(self._path, self.CONTENTS_DIR, instance_hash)
        with open(dest, 'w') as contents_file:
            json.dump(self._contents, contents_file, default=encode_node, indent=2, sort_keys=True)

        tag_dir = os.path.join(self._path, self.TAGS_DIR)
        if not os.path.isdir(tag_dir):
            os.mkdir(tag_dir)
            
        latest_tag = os.path.join(self._path, self.TAGS_DIR, self.LATEST)
        with open (latest_tag, 'w') as tagfile:
            tagfile.write("{hsh}".format(hsh=instance_hash))

    def get_obj(self, node):
        """
        Read an object from the package given a node from the
        package tree.
        """
        if isinstance(node, TableNode):
            self._check_hashes(node.hashes)
            return self._dataframe(node.hashes, node.format)
        elif isinstance(node, GroupNode):
            hash_list = [hsh for child in node.preorder() if isinstance(child, TableNode)
                         for hsh in child.hashes]
            self._check_hashes(hash_list)
            return self._dataframe(hash_list, PackageFormat.PARQUET)
        elif isinstance(node, FileNode):
            self._check_hashes(node.hashes)
            return self.file(node.hashes)
        else:
            assert False, "Unhandled Node {node}".format(node=node)

    # WIP: doesn't work quite right yet.
    def find_node_by_name(self, findstr, node=None, prefix=''):
        return None
#        """use / to separate levels"""
#        if node is None:
#            node = self.get_contents()
#        if isinstance(node, GroupNode) or isinstance(node, RootNode):
#            for child_name, child in node.children.items():
#                full_child_name = prefix + child_name
#                #print('findstr={}  prefix={}  child={}'.format(findstr, prefix, child_name))
#                if findstr == full_child_name:
#                    return child
#                if isinstance(child, GroupNode):
#                    res = self.find_node_by_name(findstr, child, full_child_name + "/")
#                    if res is not None:
#                        return res
#            return None
#        #print('non-group node?')
#        return None

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

    def get_store(self):
        """
        Returns the store containing this package.
        """
        return self._store

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
            with open(self._package.get_store().object_path(self._hash), 'rb') as input_file:
                with gzip.GzipFile(fileobj=self._temp_file, mode='wb',
                                   compresslevel=ZLIB_LEVEL) as gzip_file:
                    copyfileobj(input_file, gzip_file, CHUNK_SIZE)
            self._temp_file.seek(0)
            return self._temp_file

        def __exit__(self, type, value, traceback):
            self._temp_file.close()

    def tempfile(self, hash):
        """
        Create and return a temporary file for uploading to a registry.
        """
        return self.UploadFile(self, hash)

    def _add_to_contents(self, fullname, hashes, ext, path, target, fmt):
        """
        Adds an object (name-hash mapping) to the package's contents.
        """
        contents = self.get_contents()
        ipath = fullname.split('.')
        leaf = ipath.pop()

        ptr = contents
        for node in ipath:
            ptr = ptr.children.setdefault(node, GroupNode(dict()))

        metadata = dict(
            q_ext=ext,
            q_path=path,
            q_target=target
        )

        try:
            target_type = TargetType(target)
            if target_type is TargetType.PANDAS:
                assert fmt is not None
                node = TableNode(
                    hashes=hashes,
                    format=fmt.value,
                    metadata=metadata
                )
            elif target_type is TargetType.FILE:
                node = FileNode(
                    hashes=hashes,
                    metadata=metadata
                )
            else:
                assert False, "Unhandled TargetType {tt}".format(tt=target_type)
        except ValueError:
            raise PackageException("Unrecognized target {tgt}".format(tgt=target))

        ptr.children[leaf] = node
