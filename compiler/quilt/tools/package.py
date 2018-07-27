import json
import os

from .compat import pathlib
from .const import TargetType, QuiltException
from .core import (decode_node, encode_node, hash_contents,
                   FileNode, GroupNode)
from .util import is_nodename


class PackageException(QuiltException):
    """
    Exception class for Package handling
    """
    pass


class Package(object):
    CONTENTS_DIR = 'contents'
    TAGS_DIR = 'tags'
    VERSIONS_DIR = 'versions'
    LATEST = 'latest'

    def __init__(self, store, path, contents=None, pkghash=None):
        self._store = store
        self._path = path

        if not os.path.isdir(self._path):
            os.makedirs(self._path)
            os.mkdir(os.path.join(self._path, self.CONTENTS_DIR))
            os.mkdir(os.path.join(self._path, self.TAGS_DIR))
            os.mkdir(os.path.join(self._path, self.VERSIONS_DIR))

        if contents is None:
            contents = self._load_contents(pkghash)

        self._contents = contents
        if pkghash is not None:
            assert self.get_hash() == pkghash

    def _load_contents(self, instance_hash=None):
        if instance_hash is None:
            latest_tag = os.path.join(self._path, self.TAGS_DIR, self.LATEST)
            if not os.path.exists(latest_tag):
                msg = "Could not find latest tag for package at {0}"
                raise PackageException(msg.format(self._path))

            with open (latest_tag, 'r') as tagfile:
                instance_hash = tagfile.read()

        contents_path = os.path.join(self._path, self.CONTENTS_DIR, instance_hash)
        if not os.path.isfile(contents_path):
            msg = "Invalid hash for package at {path}: {hash}"
            raise PackageException(msg.format(hash=instance_hash, path=self._path))

        with open(contents_path, 'r') as contents_file:
            return json.load(contents_file, object_hook=decode_node)
        
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

    
