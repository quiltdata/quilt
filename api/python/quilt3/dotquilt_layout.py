from .util import PhysicalKey

class DotQuiltLayout:
    latest_tag = "latest"

    @classmethod
    def manifest_pk(cls, registry: PhysicalKey, package_name: str, top_hash: str):
        assert isinstance(registry, PhysicalKey)
        assert len(top_hash) ==
        user, pkg = package_name.split("/")
        hash_prefix = top_hash[:2]
        return registry.join(f".quilt/v2/manifests/usr={user}/pkg={pkg}/hash_prefix={hash_prefix}/{top_hash}.jsonl")

    @classmethod
    def latest_pointer_pk(cls, registry: PhysicalKey, package_name: str) -> PhysicalKey:
        assert isinstance(registry, PhysicalKey)
        user, pkg = package_name.split("/")
        return registry.join(f".quilt/v2/pointers/usr={user}/pkg={pkg}/{cls.latest_tag}")



    @classmethod
    def get_package_manifest_dir(cls, package_name):
        """ Beware bugs around packages name "mypackage" and "mypackagelonger" """
        user, pkg = package_name.split("/")
        return f".quilt/v2/manifests/user={user}/package={pkg}"

    @classmethod
    def get_global_manifest_dir(cls):
        return f".quilt/v2/manifests"