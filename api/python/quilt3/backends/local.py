import operator
import os
import shutil
from datetime import datetime

from quilt3.data_transfer import delete_url

from .base import PackageRegistryV1, PackageRegistryV2


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

    def list_package_pointers(self, pkg_name: str):
        pointers_dir_path = self.pointers_dir(pkg_name).path
        for path in safe_listdir(pointers_dir_path):
            with open(os.path.join(pointers_dir_path, path), encoding='utf-8') as f:
                yield path, f.read()

    def delete_package(self, pkg_name: str):
        shutil.rmtree(self._pointers_usr_dir(pkg_name).path)

    def delete_package_version(self, pkg_name: str, top_hash: str):
        super().delete_package_version(pkg_name, top_hash)
        delete_url(self.pointers_dir(pkg_name))
        delete_url(self._pointers_usr_dir(pkg_name))


class LocalPackageRegistryV2(PackageRegistryV2):
    _from_path_to_package_name = operator.methodcaller('replace', '@', '/')

    def list_packages(self):
        return map(self._from_path_to_package_name, safe_listdir(self.manifests_global_dir.path))

    list_package_pointers = LocalPackageRegistryV1.list_package_pointers

    def list_package_versions_with_timestamps(self, pkg_name: str):
        try:
            scanner = os.scandir(self.manifests_package_dir(pkg_name).path)
        except FileNotFoundError:
            return
        with scanner as entries:
            for entry in entries:
                yield datetime.fromtimestamp(entry.stat().st_mtime), entry.name

    def delete_package(self, pkg_name: str):
        shutil.rmtree(self.manifests_package_dir(pkg_name).path)
        shutil.rmtree(self.pointers_dir(pkg_name).path)

    def delete_package_version(self, pkg_name: str, top_hash: str):
        shutil.rmtree(self._manifest_parent_pk(pkg_name, top_hash).path)
        super().delete_package_version(pkg_name, top_hash)
        delete_url(self.pointers_dir(pkg_name))
        delete_url(self.manifests_package_dir(pkg_name))


def get_package_registry(version: int):
    if version == 1:
        return LocalPackageRegistryV1
    if version == 2:
        return LocalPackageRegistryV2
    raise ValueError()
