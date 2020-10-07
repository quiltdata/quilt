from quilt3.data_transfer import S3Api, S3ClientProvider, get_bytes, list_url
from quilt3.util import PhysicalKey

from .base import PackageRegistryV1, PackageRegistryV2


def s3_list_objects(**kwargs):
    s3_client = S3ClientProvider().find_correct_client(S3Api.LIST_OBJECTS_V2, kwargs['Bucket'], kwargs)
    return s3_client.get_paginator('list_objects_v2').paginate(**kwargs)


def delete_url_recursively(src: PhysicalKey):
    s3_client = S3ClientProvider().standard_client
    for resp in s3_list_objects(Bucket=src.bucket, Prefix=src.path):
        for key in resp.get('Contents', ()):
            s3_client.delete_object(Bucket=src.bucket, Key=key['Key'])


class S3PackageRegistryV1(PackageRegistryV1):
    def list_packages(self):
        prev_pkg = None
        for path, _ in list_url(self.pointers_global_dir):
            pkg = path.rpartition('/')[0]
            # A package can have multiple versions, but we should only return the name once.
            if pkg != prev_pkg:
                prev_pkg = pkg
                yield pkg

    def list_package_pointers(self, pkg_name: str):
        package_dir = self.pointers_dir(pkg_name)
        for path, _ in list_url(package_dir):
            pkg_hash = get_bytes(package_dir.join(path))
            yield path, pkg_hash.decode().strip()

    def delete_package(self, pkg_name: str):
        delete_url_recursively(self.pointers_dir(pkg_name))


class S3PackageRegistryV2(PackageRegistryV2):
    def list_packages(self):
        prefix = self.manifests_global_dir.path
        prefix_len = len(prefix)
        for resp in s3_list_objects(
            Bucket=self.manifests_global_dir.bucket,
            Prefix=prefix,
            Delimiter='/',
        ):
            for obj in resp.get('CommonPrefixes', ()):
                yield obj['Prefix'][prefix_len:-1].replace('@', '/')

    list_package_pointers = S3PackageRegistryV1.list_package_pointers

    def list_package_versions_with_timestamps(self, pkg_name: str):
        manifest_dir_pk = self.manifests_package_dir(pkg_name)
        prefix = manifest_dir_pk.path
        s = slice(len(prefix), None)
        for response in s3_list_objects(Bucket=manifest_dir_pk.bucket, Prefix=prefix):
            for obj in response.get('Contents', ()):
                yield obj['LastModified'], self._top_hash_from_path(obj['Key'][s])

    def delete_package(self, pkg_name: str):
        delete_url_recursively(self.manifests_package_dir(pkg_name))
        delete_url_recursively(self.pointers_dir(pkg_name))


def get_package_registry(version: int):
    if version == 1:
        return S3PackageRegistryV1
    if version == 2:
        return S3PackageRegistryV2
    raise ValueError()
