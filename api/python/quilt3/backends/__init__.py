from quilt3.util import PhysicalKey, get_from_config, fix_url

from .base import PackageRegistry
from .local import LocalPackageRegistryV1
from .s3 import S3PackageRegistryV1


def get_package_registry(path=None) -> PackageRegistry:
    """ Returns the package registry for a given path """
    # TODO: Don't check if it's PackageRegistry? Then we need better separation
    #       to external functions that receive string and internal that receive
    #       PackageRegistry.
    if isinstance(path, PackageRegistry):
        return path
    if not isinstance(path, PhysicalKey):
        path = PhysicalKey.from_url(
            get_from_config('default_local_registry') if path is None else fix_url(path)
        )
    return (LocalPackageRegistryV1 if path.is_local() else S3PackageRegistryV1)(path)
