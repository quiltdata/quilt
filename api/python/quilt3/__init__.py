"""Quilt API"""

# Suppress numpy warnings
import warnings

warnings.filterwarnings("ignore", message="numpy.dtype size changed")  # noqa: E402

import importlib.metadata

__version__ = importlib.metadata.version(__name__)

from . import admin, api_keys, hooks
from .api import (
    config,
    copy,
    delete_package,
    disable_telemetry,
    list_package_versions,
    list_packages,
    search,
)
from .bucket import Bucket
from .imports import start_data_package_loader
from .packages import Package
from .session import get_boto3_session, logged_in, login, logout

start_data_package_loader()
