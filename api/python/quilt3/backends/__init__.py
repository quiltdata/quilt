from quilt3.util import PhysicalKey, fix_url, get_from_config

from . import local, s3
from .base import PackageRegistry


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
    return (local if path.is_local() else s3).get_package_registry(
        version=int(get_from_config('default_registry_version')),
    )(path)
