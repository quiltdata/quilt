"""T4 API"""

# Suppress numpy warnings
import warnings
warnings.filterwarnings("ignore", message="numpy.dtype size changed")

from .api import (
    copy,
    put,
    get,
    list_packages,
    config,
    delete_package
)

from .session import login, logout

from .packages import Package

from .bucket import Bucket

from . import admin

from .imports import start_data_package_loader
start_data_package_loader()
