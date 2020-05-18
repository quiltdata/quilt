from .util import PhysicalKey


class DotQuiltLayout:
    latest_tag = "latest"

    @classmethod
    def manifest_pk(cls, registry: PhysicalKey, package_name: str, top_hash: str) -> PhysicalKey:
        assert isinstance(registry, PhysicalKey)
        assert str(registry).rstrip("/").endswith(".quilt/v2")
        length = len(top_hash)
        assert length == 64, f"Must pass in the full 64 character tophash but received a length {length} tophash"

        user, pkg = package_name.split("/")
        hash_prefix = top_hash[:2]
        return registry.join(f"manifests/usr={user}/pkg={pkg}/hash_prefix={hash_prefix}/{top_hash}.jsonl")

    @classmethod
    def latest_pointer_pk(cls, registry: PhysicalKey, package_name: str) -> PhysicalKey:
        assert isinstance(registry, PhysicalKey)
        assert str(registry).rstrip("/").endswith(".quilt/v2")

        user, pkg = package_name.split("/")
        return registry.join(f"pointers/usr={user}/pkg={pkg}/{cls.latest_tag}")

    @classmethod
    def package_manifest_dir(cls, registry: PhysicalKey, package_name) -> PhysicalKey:
        """ Beware bugs around packages name "mypackage" and "mypackagelonger" """
        assert isinstance(registry, PhysicalKey)
        assert str(registry).rstrip("/").endswith(".quilt/v2")

        user, pkg = package_name.split("/")
        return registry.join(f"manifests/usr={user}/pkg={pkg}/")

    @classmethod
    def global_manifest_dir(cls, registry: PhysicalKey):
        assert isinstance(registry, PhysicalKey)
        assert str(registry).rstrip("/").endswith(".quilt/v2")

        return registry.join("manifests")

    @classmethod
    def extract_tophash(cls, path_str: str):
        """
        Extract the tophash from a path or url (any string that follows the pattern '.../${TOP_HASH}.jsonl'
        """
        return path_str.split("/")[-1].rstrip(".jsonl")
