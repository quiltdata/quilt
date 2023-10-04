import abc
import operator
import time

from quilt3.data_transfer import (
    copy_file,
    delete_url,
    get_bytes,
    list_url,
    put_bytes,
)
from quilt3.util import PhysicalKey, QuiltException


class PackageRegistry(abc.ABC):
    latest_tag_name = 'latest'
    top_hash_len = 64
    revision_pointers = False
    workflow_conf_path = '.quilt/workflows/config.yml'

    def __init__(self, base: PhysicalKey):
        self.base = base
        self.root = self.base.join(self.root_path)

    def __repr__(self):
        return f'<{self.__class__.__name__}({self.base})>'

    def __eq__(self, other):
        return other.__class__ == self.__class__ and other.base == self.base

    @property
    def is_local(self) -> bool:
        return self.base.is_local()

    @property
    @abc.abstractmethod
    def root_path(self):
        pass

    @property
    @abc.abstractmethod
    def pointers_global_dir(self) -> PhysicalKey:
        pass

    @abc.abstractmethod
    def pointers_dir(self, pkg_name: str) -> PhysicalKey:
        pass

    @abc.abstractmethod
    def pointer_pk(self, pkg_name: str, pointer_name: str) -> PhysicalKey:
        pass

    def pointer_latest_pk(self, pkg_name: str) -> PhysicalKey:
        return self.pointer_pk(pkg_name, self.latest_tag_name)

    @property
    @abc.abstractmethod
    def manifests_global_dir(self) -> PhysicalKey:
        pass

    @abc.abstractmethod
    def manifests_package_dir(self, pkg_name: str) -> PhysicalKey:
        pass

    @abc.abstractmethod
    def manifest_pk(self, pkg_name: str, top_hash: str) -> PhysicalKey:
        pass

    @abc.abstractmethod
    def list_packages(self):
        pass

    @abc.abstractmethod
    def list_package_pointers(self, pkg_name: str):
        pass

    @abc.abstractmethod
    def list_package_versions(self, pkg_name: str):
        pass

    @abc.abstractmethod
    def delete_package(self, pkg_name: str):
        pass

    @abc.abstractmethod
    def delete_package_version(self, pkg_name: str, top_hash: str):
        pass

    @abc.abstractmethod
    def push_manifest(self, pkg_name: str, top_hash: str, manifest_data: bytes):
        pass

    @abc.abstractmethod
    def resolve_top_hash(self, pkg_name: str, hash_prefix: str) -> str:
        pass

    @abc.abstractmethod
    def shorten_top_hash(self, pkg_name: str, top_hash: str) -> str:
        pass

    @property
    def workflow_conf_pk(self) -> PhysicalKey:
        return self.base.join(self.workflow_conf_path)

    def get_workflow_config(self):
        from quilt3.workflows import WorkflowConfig
        return WorkflowConfig.load(self.workflow_conf_pk)


class PackageRegistryV1(PackageRegistry):
    root_path = '.quilt'
    revision_pointers = True

    @property
    def pointers_global_dir(self) -> PhysicalKey:
        return self.root.join('named_packages/')

    def pointers_dir(self, pkg_name: str) -> PhysicalKey:
        return self.root.join(f'named_packages/{pkg_name}/')

    def _pointers_usr_dir(self, pkg_name: str) -> PhysicalKey:
        return self.root.join(f'named_packages/{pkg_name.partition("/")[0]}/')

    def pointer_pk(self, pkg_name: str, pointer_name: str) -> PhysicalKey:
        return self.root.join(f'named_packages/{pkg_name}/{pointer_name}')

    @property
    def manifests_global_dir(self) -> PhysicalKey:
        return self.root.join('packages/')

    def manifests_package_dir(self, pkg_name: str) -> PhysicalKey:
        return self.manifests_global_dir  # TODO: does this make sense?

    def manifest_pk(self, pkg_name: str, top_hash: str) -> PhysicalKey:
        return self.root.join(f'packages/{top_hash}')

    def push_manifest(self, pkg_name: str, top_hash: str, manifest_data: bytes):
        """returns: timestamp to support catalog drag-and-drop => browse"""
        put_bytes(manifest_data, self.manifest_pk(pkg_name, top_hash))
        hash_bytes = top_hash.encode()
        # TODO: use a float to string formatter instead of double casting
        timestamp_str = str(int(time.time()))
        put_bytes(hash_bytes, self.pointer_pk(pkg_name, timestamp_str))
        put_bytes(hash_bytes, self.pointer_latest_pk(pkg_name))
        return timestamp_str

    @staticmethod
    def _top_hash_from_path(path: str) -> str:
        return path

    def resolve_top_hash(self, pkg_name: str, hash_prefix: str) -> str:
        if len(hash_prefix) == 64:
            top_hash = hash_prefix
        elif 6 <= len(hash_prefix) < 64:
            matching_hashes = [self._top_hash_from_path(h) for h, _
                               in list_url(self.manifests_package_dir(pkg_name))
                               if h.startswith(hash_prefix)]
            if not matching_hashes:
                raise QuiltException("Found zero matches for %r" % hash_prefix)
            elif len(matching_hashes) > 1:
                raise QuiltException("Found multiple matches: %r" % hash_prefix)
            else:
                top_hash = matching_hashes[0]
        else:
            raise QuiltException("Invalid hash: %r" % hash_prefix)
        # TODO: verify that name is correct with respect to this top_hash
        return top_hash

    resolve_top_hash_requires_pkg_name = False

    def shorten_top_hash(self, pkg_name: str, top_hash: str) -> str:
        min_shorthash_len = 7

        matches = [self._top_hash_from_path(h) for h, _ in list_url(self.manifests_package_dir(pkg_name))
                   if h.startswith(top_hash[:min_shorthash_len])]
        if len(matches) == 0:
            raise ValueError(f"Tophash {top_hash} was not found in registry {self.base}")
        for prefix_length in range(min_shorthash_len, 64):
            potential_shorthash = top_hash[:prefix_length]
            matches = [h for h in matches if h.startswith(potential_shorthash)]
            if len(matches) == 1:
                return potential_shorthash

    def list_package_versions(self, pkg_name: str):
        return self.list_package_pointers(pkg_name)

    def delete_package_version(self, pkg_name: str, top_hash: str):
        deleted = []
        remaining = []
        for path, pkg_hash in self.list_package_versions(pkg_name):
            (deleted if pkg_hash == top_hash else remaining).append(path)
        if not deleted:
            raise QuiltException("No such package version exists in the given directory.")
        for path in deleted:
            delete_url(self.pointer_pk(pkg_name, path))
        if 'latest' in deleted and remaining:
            # Create a new "latest". Technically, we need to compare numerically,
            # but string comparisons will be fine till year 2286.
            new_latest = max(remaining)
            copy_file(self.pointer_pk(pkg_name, new_latest), self.pointer_latest_pk(pkg_name))


class PackageRegistryV2(PackageRegistry):
    """
    All metadata files live under `.quilt/v2`:
    * the manifests use `.quilt/v2/manifests/<usr>@<pkg>/<top_hash>/manifest.jsonl` format for path
    * the tag files (or pointers) live under `.quilt/v2/tags/<usr>@<pkg>/<tag_name>`, each of these files
      contains the top hash of one of package manifests.
    """

    root_path = '.quilt/v2'

    _package_name_to_path = operator.methodcaller('replace', '/', '@')

    @property
    def pointers_global_dir(self) -> PhysicalKey:
        return self.root.join('tags/')

    def pointers_dir(self, pkg_name: str) -> PhysicalKey:
        return self.root.join(f'tags/{self._package_name_to_path(pkg_name)}/')

    def pointer_pk(self, pkg_name: str, pointer_name: str) -> PhysicalKey:
        return self.root.join(f'tags/{self._package_name_to_path(pkg_name)}/{pointer_name}')

    @property
    def manifests_global_dir(self) -> PhysicalKey:
        return self.root.join('manifests/')

    def manifests_package_dir(self, pkg_name: str) -> PhysicalKey:
        return self.root.join(f'manifests/{self._package_name_to_path(pkg_name)}/')

    def manifest_pk(self, pkg_name: str, top_hash: str) -> PhysicalKey:
        return self.root.join(f'manifests/{self._package_name_to_path(pkg_name)}/{top_hash}/manifest.jsonl')

    def _manifest_parent_pk(self, pkg_name: str, top_hash: str) -> PhysicalKey:
        return self.root.join(f'manifests/{self._package_name_to_path(pkg_name)}/{top_hash}/')

    @abc.abstractmethod
    def list_package_versions_with_timestamps(self, pkg_name: str):
        """
        Returns:
            An iterable of tuples containing the datetime and hash for the package.
        """

    def list_package_versions(self, pkg_name: str):
        for dt, top_hash in self.list_package_versions_with_timestamps(pkg_name):
            yield str(int(dt.timestamp())), top_hash

    def push_manifest(self, pkg_name: str, top_hash: str, manifest_data: bytes):
        put_bytes(manifest_data, self.manifest_pk(pkg_name, top_hash))
        put_bytes(top_hash.encode(), self.pointer_latest_pk(pkg_name))

    @staticmethod
    def _top_hash_from_path(path: str) -> str:
        return path.rsplit('/', 2)[-2]

    resolve_top_hash = PackageRegistryV1.resolve_top_hash
    resolve_top_hash_requires_pkg_name = True
    shorten_top_hash = PackageRegistryV1.shorten_top_hash

    def delete_package_version(self, pkg_name: str, top_hash: str):
        delete_url(self.manifest_pk(pkg_name, top_hash))
        if get_bytes(self.pointer_latest_pk(pkg_name)).decode() == top_hash:
            delete_url(self.pointer_latest_pk(pkg_name))
            timestamp, new_latest = max(self.list_package_versions_with_timestamps(pkg_name), default=(None, None))
            if new_latest:
                put_bytes(new_latest.encode(), self.pointer_latest_pk(pkg_name))
        for pointer, pointer_top_hash in self.list_package_pointers(pkg_name):
            if pointer_top_hash == top_hash:
                delete_url(self.pointer_pk(pkg_name, pointer))
