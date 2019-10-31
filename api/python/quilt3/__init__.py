"""Quilt API"""

# Suppress numpy warnings
import warnings
warnings.filterwarnings("ignore", message="numpy.dtype size changed")

from pathlib import Path

__version__ = Path(Path(__file__).parent, "VERSION").read_text()

from .api import (
    copy,
    list_packages,
    list_package_versions,
    config,
    disable_telemetry,
    delete_package,
    search
)

from .session import login, logout

from .packages import Package

from .bucket import Bucket

from . import admin

from .imports import start_data_package_loader
start_data_package_loader()
