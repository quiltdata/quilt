class DotQuiltLayout:
    latest_tag = "latest"

    @classmethod
    def get_manifest_key_by_tophash(cls, package_name, top_hash):
        user, pkg = package_name.split("/")
        hash_prefix = top_hash[:2]
        return f".quilt/v2/manifests/user={user}/package={pkg}/hash_prefix={hash_prefix}/{top_hash}.jsonl"

    @classmethod
    def get_latest_key(cls, package_name):
        user, pkg = package_name.split("/")
        return f".quilt/v2/manifests/user={user}/package={pkg}/{cls.latest_tag}"



    @classmethod
    def get_package_manifest_dir(cls, package_name):
        """ Beware bugs around packages name "mypackage" and "mypackagelonger" """
        user, pkg = package_name.split("/")
        return f".quilt/v2/manifests/user={user}/package={pkg}"

    @classmethod
    def get_global_manifest_dir(cls):
        return f".quilt/v2/manifests"