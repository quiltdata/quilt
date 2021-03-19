"""Quilt API"""

# Suppress numpy warnings
import warnings

warnings.filterwarnings("ignore", message="numpy.dtype size changed")  # noqa: E402

from pathlib import Path

__version__ = Path(Path(__file__).parent, "VERSION").read_text().strip()

from . import admin
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
from .session import logged_in, login, logout

start_data_package_loader()
