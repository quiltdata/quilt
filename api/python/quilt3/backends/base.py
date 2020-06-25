import abc
import time

from quilt3.data_transfer import list_url, delete_url, copy_file, put_bytes, get_bytes
from quilt3.util import PhysicalKey, QuiltException


class PackageRegistry(abc.ABC):
    latest_tag_name = 'latest'

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

    @abc.abstractmethod
    def pointer_latest_pk(self, pkg_name: str) -> PhysicalKey:
        pass

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
    def list_package_versions(self, pkg_name: str):
        pass

    @abc.abstractmethod
    def delete_package(self, pkg_name: str, top_hash: str = None):
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


class PackageRegistryV1(PackageRegistry):
    root_path = '.quilt'

    @property
    def pointers_global_dir(self) -> PhysicalKey:
        return self.root.join('named_packages/')

    def pointers_dir(self, pkg_name: str) -> PhysicalKey:
        return self.root.join(f'named_packages/{pkg_name}/')

    def pointer_pk(self, pkg_name: str, pointer_name: str) -> PhysicalKey:
        return self.root.join(f'named_packages/{pkg_name}/{pointer_name}')

    def pointer_latest_pk(self, pkg_name: str) -> PhysicalKey:
        return self.pointer_pk(pkg_name, self.latest_tag_name)

    @property
    def manifests_global_dir(self) -> PhysicalKey:
        return self.root.join('packages/')

    def manifests_package_dir(self, pkg_name: str) -> PhysicalKey:
        return self.manifests_global_dir  # TODO: does this make sense?

    def manifest_pk(self, pkg_name: str, top_hash: str) -> PhysicalKey:
        return self.root.join(f'packages/{top_hash}')

    def delete_package(self, pkg_name: str, top_hash: str = None):
        package_path = self.pointers_dir(pkg_name)
        paths = list(list_url(package_path))
        if not paths:
            raise QuiltException("No such package exists in the given directory.")

        if top_hash is not None:
            top_hash = self.resolve_top_hash(pkg_name, top_hash)
            deleted = []
            remaining = []
            for path, _ in paths:
                pkg_hash = get_bytes(self.pointer_pk(pkg_name, path)).decode()
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
        else:
            for path, _ in paths:
                delete_url(self.pointer_pk(pkg_name, path))

    def push_manifest(self, pkg_name: str, top_hash: str, manifest_data: bytes):
        put_bytes(manifest_data, self.manifest_pk(pkg_name, top_hash))
        hash_bytes = top_hash.encode()
        # TODO: use a float to string formatter instead of double casting
        put_bytes(hash_bytes, self.pointer_pk(pkg_name, str(int(time.time()))))
        put_bytes(hash_bytes, self.pointer_latest_pk(pkg_name))

    def resolve_top_hash(self, pkg_name: str, hash_prefix: str) -> str:
        if len(hash_prefix) == 64:
            top_hash = hash_prefix
        elif 6 <= len(hash_prefix) < 64:
            matching_hashes = [h for h, _
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

    def shorten_top_hash(self, pkg_name: str, top_hash: str) -> str:
        min_shorthash_len = 7

        matches = [h for h, _ in list_url(self.manifests_package_dir(pkg_name))
                   if h.startswith(top_hash[:min_shorthash_len])]
        if len(matches) == 0:
            raise ValueError(f"Tophash {top_hash} was not found in registry {self.base}")
        for prefix_length in range(min_shorthash_len, 64):
            potential_shorthash = top_hash[:prefix_length]
            matches = [h for h in matches if h.startswith(potential_shorthash)]
            if len(matches) == 1:
                return potential_shorthash
