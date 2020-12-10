import operator
import os
import pathlib
import shutil
from datetime import datetime
from urllib.parse import urlunparse
from urllib.request import pathname2url

from quilt3.util import PhysicalKey

from .base import PackageRegistryV1, PackageRegistryV2


class LocalPhysicalKey(PhysicalKey):
    __slots__ = ('path',)
    bucket = None
    version_id = None

    def __init__(self, path):
        assert isinstance(path, str)
        if os.name == 'nt':
            assert '\\' not in path, "Paths must use / as a separator"

        self.path = path

    @classmethod
    def from_path(cls, path):
        path = os.fspath(path)
        new_path = os.path.realpath(path)
        # Use '/' as the path separator.
        if os.path.sep != '/':
            new_path = new_path.replace(os.path.sep, '/')
        # Add back a trailing '/' if the original path has it.
        if (path.endswith(os.path.sep) or
           (os.path.altsep is not None and path.endswith(os.path.altsep))):
            new_path += '/'
        return cls(new_path)

    def __eq__(self, other):
        return (
            isinstance(other, self.__class__) and
            self.path == other.path
        )

    def __repr__(self):
        return f'{self.__class__.__name__}({self.path!r})'

    def __str__(self):
        if self.bucket is None:
            return urlunparse(('file', '', pathname2url(self.path.replace('/', os.path.sep)), None, None, None))

    def __fspath__(self):
        return self.path

    def join(self, rel_path):
        if os.name == 'nt' and '\\' in rel_path:
            raise ValueError("Paths must use / as a separator")

        new_path = self.path.rstrip('/') + '/' + rel_path.lstrip('/')
        return self.__class__(new_path)

    def is_local(self):
        return True

    def _put_bytes(self, data):
        dest_file = pathlib.Path(self)
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        dest_file.write_bytes(data)

    def get_bytes(self):
        return pathlib.Path(self).read_bytes()

    def list_url(self):
        src_file = pathlib.Path(self)

        for f in src_file.rglob('*'):
            try:
                if f.is_file():
                    size = f.stat().st_size
                    yield f.relative_to(src_file).as_posix(), size
            except FileNotFoundError:
                # If a file does not exist, is it really a file?
                pass

    def delete_url(self):
        """Deletes the given URL.
        Follows S3 semantics even for local files:
        - If the URL does not exist, it's a no-op.
        - If it's a non-empty directory, it's also a no-op.
        """
        src_file = pathlib.Path(self)

        try:
            if src_file.is_dir():
                try:
                    src_file.rmdir()
                except OSError:
                    # Ignore non-empty directories, for consistency with S3
                    pass
            else:
                src_file.unlink()
        except FileNotFoundError:
            pass


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
            with open(os.path.join(pointers_dir_path, path)) as f:
                yield path, f.read()

    def delete_package(self, pkg_name: str):
        shutil.rmtree(self._pointers_usr_dir(pkg_name).path)

    def delete_package_version(self, pkg_name: str, top_hash: str):
        super().delete_package_version(pkg_name, top_hash)
        self.pointers_dir(pkg_name).delete_url()
        self._pointers_usr_dir(pkg_name).delete_url()


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
        self.pointers_dir(pkg_name).delete_url()
        self.manifests_package_dir(pkg_name).delete_url()


def get_package_registry(version: int):
    if version == 1:
        return LocalPackageRegistryV1
    if version == 2:
        return LocalPackageRegistryV2
    raise ValueError()
