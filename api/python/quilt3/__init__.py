"""Quilt API"""

# Suppress numpy warnings
import warnings

warnings.filterwarnings("ignore", message="numpy.dtype size changed")  # noqa: E402

from pathlib import Path

__version__ = Path(Path(__file__).parent, "VERSION").read_text().strip()

from . import admin, hooks
from ._search import _search_more_packages, _search_packages
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
from .exceptions import PackageException
from .imports import start_data_package_loader
from .packages import Package
from .session import get_boto3_session, logged_in, login, logout

start_data_package_loader()


def search_packages(
    buckets=None,
    search_string=None,
    filter=None,
    user_meta_filters=None,
    latest_only=False,
    size=30,
    order="BEST_MATCH"
):
    """
    Search for packages across accessible buckets.

    Args:
        buckets: List of bucket names to search within. If None, searches all accessible buckets.
        search_string: Search query string. If None, returns all packages (subject to filters).
        filter: Dictionary of filters to apply (e.g., {"modified": {"gte": "2023-01-01"}}).
        user_meta_filters: List of user metadata filters to apply.
        latest_only: If True, only return the latest version of each package.
        size: Maximum number of results to return per page (default: 30).
        order: Sort order for results. One of "BEST_MATCH", "NEWEST", "OLDEST", "LEX_ASC", "LEX_DESC".

    Returns:
        SearchResult: Object containing search hits and pagination information.

    Raises:
        ValueError: If parameters are invalid (e.g., negative size, invalid order).
        PackageException: If search operation fails due to network, authentication, or server errors.

    Example:
        >>> import quilt3
        >>> results = quilt3.search_packages(
        ...     buckets=["my-bucket"],
        ...     search_string="machine learning",
        ...     size=50
        ... )
        >>> for hit in results.hits:
        ...     print(f"{hit.bucket_name}/{hit.key} (score: {hit.score})")

        >>> # Search with filters
        >>> results = quilt3.search_packages(
        ...     filter={"modified": {"gte": "2023-01-01"}},
        ...     latest_only=True
        ... )

        >>> # Pagination
        >>> if results.has_next:
        ...     more_results = quilt3.search_more_packages(
        ...         after=results.next_cursor
        ...     )
    """
    # Input validation
    if buckets is not None and not isinstance(buckets, list):
        raise ValueError("buckets must be a list or None")

    if size is not None and (not isinstance(size, int) or size < 0 or size > 1000):
        raise ValueError("size must be a non-negative integer between 0 and 1000")

    valid_orders = ["BEST_MATCH", "NEWEST", "OLDEST", "LEX_ASC", "LEX_DESC"]
    if order not in valid_orders:
        raise ValueError(f"order must be one of {valid_orders}")

    # Basic filter validation
    if filter is not None and not isinstance(filter, dict):
        raise ValueError("filter must be a dictionary or None")

    # Basic validation for filter structure
    if filter is not None:
        valid_filter_keys = ["modified", "size", "hash"]
        for key in filter.keys():
            if key not in valid_filter_keys:
                raise ValueError(f"Invalid filter key '{key}'. Valid keys are: {valid_filter_keys}")

            
            # Validate filter operations for each key
            if isinstance(filter[key], dict):
                valid_ops = ["eq", "ne", "lt", "lte", "gt", "gte"]
                for op in filter[key].keys():
                    if op not in valid_ops:
                        raise ValueError(f"Invalid filter operation '{op}' for key '{key}'. Valid operations are: {valid_ops}")

    # Basic search string validation
    if search_string is not None and not isinstance(search_string, str):
        raise ValueError("search_string must be a string or None")

    return _search_packages(
        buckets=buckets,
        search_string=search_string,
        filter=filter,
        user_meta_filters=user_meta_filters,
        latest_only=latest_only,
        size=size,
        order=order
    )


def search_more_packages(after, size=30):
    """
    Get more search results using pagination.

    Args:
        after: Cursor string from previous search results indicating where to continue.
        size: Maximum number of results to return (default: 30).

    Returns:
        SearchResult: Object containing additional search hits and pagination information.

    Raises:
        ValueError: If parameters are invalid (e.g., empty after cursor, negative size).
        PackageException: If pagination operation fails due to network, authentication, or server errors.

    Example:
        >>> import quilt3
        >>> initial_results = quilt3.search_packages(buckets=["my-bucket"])
        >>> if initial_results.has_next:
        ...     more_results = quilt3.search_more_packages(
        ...         after=initial_results.next_cursor
        ...     )
    """
    # Input validation
    if not after or not isinstance(after, str):
        raise ValueError("after cursor is required and must be a non-empty string")

    if size is not None and (not isinstance(size, int) or size < 0):
        raise ValueError("size must be a non-negative integer")

    return _search_more_packages(after=after, size=size)

