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
        if pkghash is not None:
            assert self.get_hash() == pkghash

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

    def save_cached_df(self, hashes, node_path, target, source_path, transform, custom_meta):
        """
        Save a DataFrame to the store.
        """
        metahash = self._store.save_metadata(custom_meta)
        self._add_to_contents(node_path, hashes, target, source_path, transform, metahash)

    def save_df(self, dataframe, node_path, target, source_path, transform, custom_meta):
        """
        Save a DataFrame to the store.
        """
        hashes = self._store.save_dataframe(dataframe)
        metahash = self._store.save_metadata(custom_meta)
        self._add_to_contents(node_path, hashes, target, source_path, transform, metahash)
        return hashes

    def save_numpy(self, ndarray, node_path, target, source_path, transform, custom_meta):
        """
        Save a Numpy array to the store.
        """
        filehash = self._store.save_numpy(ndarray)
        metahash = self._store.save_metadata(custom_meta)
        self._add_to_contents(node_path, [filehash], target, source_path, transform, metahash)

    def save_file(self, srcfile, node_path, target, source_path, transform, custom_meta):
        """
        Save a (raw) file to the store.
        """
        filehash = self._store.save_file(srcfile)
        metahash = self._store.save_metadata(custom_meta)
        self._add_to_contents(node_path, [filehash], target, source_path, transform, metahash)

    def save_group(self, node_path, custom_meta):
        """
        Save a group to the store.
        """
        metahash = self._store.save_metadata(custom_meta)
        self._add_to_contents(node_path, None, TargetType.GROUP, None, None, metahash)

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

    def _add_to_contents(self, node_path, hashes, target, source_path, transform, user_meta_hash):
        """
        Adds an object (name-hash mapping) or group to package contents.
        """
        assert isinstance(node_path, list)
        assert user_meta_hash is None or isinstance(user_meta_hash, str)

        contents = self.get_contents()

        if not node_path:
            # Allow setting metadata on the root node, but that's it.
            assert target is TargetType.GROUP
            contents.metadata_hash = user_meta_hash
            return

        ptr = contents
        for node in node_path[:-1]:
            ptr = ptr.children[node]

        if target is TargetType.GROUP:
            node = GroupNode(dict())
        else:
            node = FileNode(
                hashes=hashes,
                metadata=dict(
                    q_ext=transform,
                    q_path=source_path,
                    q_target=target.value
                ),
                metadata_hash=user_meta_hash
            )

        ptr.children[node_path[-1]] = node
