from quilt3.data_transfer import list_url, get_bytes

from .base import PackageRegistryV1


class S3PackageRegistryV1(PackageRegistryV1):
    def list_packages(self):
        prev_pkg = None
        for path, _ in list_url(self.pointers_global_dir):
            pkg = path.rpartition('/')[0]
            # A package can have multiple versions, but we should only return the name once.
            if pkg != prev_pkg:
                prev_pkg = pkg
                yield pkg

    def list_package_versions(self, pkg_name: str):
        package_dir = self.pointers_dir(pkg_name)
        for path, _ in list_url(package_dir):
            pkg_hash = get_bytes(package_dir.join(path))
            yield path, pkg_hash.decode().strip()
