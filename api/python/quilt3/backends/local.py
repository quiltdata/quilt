import os
import shutil

from quilt3.data_transfer import delete_url

from .base import PackageRegistryV1


def safe_listdir(path):
    try:
        return os.listdir(path)
    except FileNotFoundError:
        return ()


class LocalPackageRegistryV1(PackageRegistryV1):
    def list_packages(self):
        pointers_dir_path = self.pointers_global_dir.path
        for usr in safe_listdir(pointers_dir_path):
            for pkg in safe_listdir(os.path.join(pointers_dir_path, usr)):
                yield f'{usr}/{pkg}'

    def list_package_versions(self, pkg_name: str):
        pointers_dir_path = self.pointers_dir(pkg_name).path
        for path in safe_listdir(pointers_dir_path):
            with open(os.path.join(pointers_dir_path, path)) as f:
                yield path, f.read()

    def delete_package(self, pkg_name: str, top_hash: str = None):
        package_path = self.pointers_dir(pkg_name)
        if top_hash is None:
            shutil.rmtree(package_path.path)
        else:
            super().delete_package(pkg_name, top_hash)
            delete_url(package_path)
        usr = pkg_name.partition('/')[0]
        delete_url(self.pointers_global_dir.join(usr))
