from enum import Enum
import json
import os
from shutil import copyfile, move, rmtree

import pandas as pd

from .compat import pathlib
from .const import TargetType, QuiltException
from .core import (decode_node, encode_node, find_object_hashes, hash_contents,
                   FileNode, GroupNode, TableNode,
                   PackageFormat)
from .hashing import digest_file
from .util import is_nodename


class ParquetLib(Enum):
    SPARK = 'pyspark'
    ARROW = 'pyarrow'


class PackageException(QuiltException):
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

    def __getitem__(self, item):
        """Get a (core) node from this package.

        Usage:
            p['item']
            p['path/item']

        :param item: Node name or path, as in "node" or "node/subnode".
        """
        node = self.get_contents()
        path = pathlib.PurePosixPath(item)

        # checks
        if not item:    # No blank node names.
            raise TypeError("Invalid node reference: Blank node names not permitted.")
        if path.anchor:
            raise TypeError("Invalid node reference: Absolute path.  Remove prefix {!r}".format(path.anchor))

        try:
            count = 0
            for part in path.parts:
                if not is_nodename(part):
                    raise TypeError("Invalid node name: {!r}".format(part))
                node = node.children[part]
                count += 1
            return node
        except KeyError:
            traversed = '/'.join(path.parts[:count])
            raise KeyError(traversed, path.parts[count])
        except AttributeError:
            traversed = '/'.join(path.parts[:count])
            raise TypeError("Not a GroupNode: Node at {!r}".format(traversed))

    def __contains__(self, item):
        """Check package contains a specific node name or node path.

        Usage:
            'item' in p
            'path/item' in p

        :param item: Node name or path, as in "node" or "node/subnode".
        """
        try:
            self[item]  #pylint: disable=W0104
            return True
        except (KeyError, TypeError):
            return False

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
            return json.load(contents_file, object_hook=decode_node)

    def file(self, hash_list):
        """
        Returns the path to an object file that matches the given hash.
        """
        assert isinstance(hash_list, list)
        assert len(hash_list) == 1, "File objects must be contained in one file."
        filehash = hash_list[0]
        return self._store.object_path(filehash)

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

    def _dataframe(self, hash_list):
        """
        Creates a DataFrame from a set of objects (identified by hashes).
        """
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

    def _check_hashes(self, hash_list):
        for objhash in hash_list:
            path = self._store.object_path(objhash)
            if not os.path.exists(path):
                raise PackageException("Missing object fragments; re-install the package")

    def save_package_tree(self, node_path, pkgnode):
        """
        Adds a package or sub-package tree from an existing package to this package's
        contents.
        """
        contents = self.get_contents()
        if node_path:
            ptr = contents
            for node in node_path[:-1]:
                ptr = ptr.children.setdefault(node, GroupNode(dict()))
            ptr.children[node_path[-1]] = pkgnode
        else:
            if contents.children:
                raise PackageException("Attempting to overwrite root node of a non-empty package.")
            contents.children = pkgnode.children.copy()

    def save_cached_df(self, hashes, node_path, source_path, ext, target):
        """
        Save a DataFrame to the store.
        """
        self._add_to_contents(node_path, hashes, ext, source_path, target)

    def save_df(self, dataframe, node_path, source_path, ext, target):
        """
        Save a DataFrame to the store.
        """
        storepath = self._store.temporary_object_path('.'.join(node_path))

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
                move(path, self._store.object_path(objhash))
                hashes.append(objhash)
            self._add_to_contents(node_path, hashes, ext, source_path, target)
            rmtree(storepath)
            return hashes
        else:
            filehash = digest_file(storepath)
            self._add_to_contents(node_path, [filehash], ext, source_path, target)
            move(storepath, self._store.object_path(filehash))
            return [filehash]

    def save_file(self, srcfile, node_path, source_path, target):
        """
        Save a (raw) file to the store.
        """
        filehash = digest_file(srcfile)
        self._add_to_contents(node_path, [filehash], '', source_path, target)
        objpath = self._store.object_path(filehash)
        if not os.path.exists(objpath):
            # Copy the file to a temporary location first, then move, to make sure we don't end up with
            # truncated contents if the build gets interrupted.
            tmppath = self._store.temporary_object_path(filehash)
            copyfile(srcfile, tmppath)
            move(tmppath, objpath)

    def save_group(self, node_path):
        """
        Save a group to the store.
        """
        if node_path:
            self._add_to_contents(node_path, None, '', None, TargetType.GROUP)

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
            if node.format is PackageFormat.HDF5:
                raise PackageException("HDF5 format is no longer supported")
            return self._dataframe(node.hashes)
        elif isinstance(node, GroupNode):
            hash_list = list(find_object_hashes(node, sort=True))
            self._check_hashes(hash_list)
            return self._dataframe(hash_list)
        elif isinstance(node, FileNode):
            self._check_hashes(node.hashes)
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

    def get_store(self):
        """
        Returns the store containing this package.
        """
        return self._store

    def _add_to_contents(self, node_path, hashes, ext, source_path, target):
        """
        Adds an object (name-hash mapping) or group to package contents.
        """
        assert isinstance(node_path, list)

        contents = self.get_contents()

        ptr = contents
        for node in node_path[:-1]:
            ptr = ptr.children.setdefault(node, GroupNode(dict()))

        metadata = dict(
            q_ext=ext,
            q_path=source_path,
            q_target=target.value
        )

        if target is TargetType.GROUP:
            node = GroupNode(dict())
        elif target is TargetType.PANDAS:
            node = TableNode(
                hashes=hashes,
                format=PackageFormat.default.value,
                metadata=metadata
            )
        elif target is TargetType.FILE:
            node = FileNode(
                hashes=hashes,
                metadata=metadata
            )
        else:
            assert False, "Unhandled TargetType {tt}".format(tt=target)

        ptr.children[node_path[-1]] = node
