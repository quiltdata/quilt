"""Quilt API"""

# Suppress numpy warnings
import warnings

warnings.filterwarnings("ignore", message="numpy.dtype size changed")  # noqa: E402

from pathlib import Path

__version__ = Path(Path(__file__).parent, "VERSION").read_text().strip()

from . import admin, hooks
from ._search import _search_more_packages, _search_packages
from .api import (config, copy, delete_package, disable_telemetry,
                  list_package_versions, list_packages, search)
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
    Example:
        >>> import quilt3
        >>> results = quilt3.search_packages(
        ...     buckets=["my-bucket"],
        ...     search_string="machine learning",
        ...     size=50
        ... )
        >>> for hit in results.hits:
        ...     print(f"{hit.bucket}/{hit.key} (score: {hit.score})")
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Public API search_packages called with parameters: buckets={buckets}, "
                f"search_string='{search_string}', filter={filter}, user_meta_filters={user_meta_filters}, "
                f"latest_only={latest_only}, size={size}, order={order}")
    
    try:
        result = _search_packages(
            buckets=buckets,
            search_string=search_string,
            filter=filter,
            user_meta_filters=user_meta_filters,
            latest_only=latest_only,
            size=size,
            order=order
        )
        
        logger.info(f"Public API search_packages completed successfully with {len(result.hits)} hits")
        return result
        
    except Exception as e:
        logger.error(f"Public API search_packages failed: {e}")
        raise


def search_more_packages(after, size=30):
    """
    Get more search results using pagination.
    
    Args:
        after: Cursor string from previous search results indicating where to continue.
        size: Maximum number of results to return (default: 30).
    Returns:
        SearchResult: Object containing additional search hits and pagination information.
    Example:
        >>> import quilt3
        >>> initial_results = quilt3.search_packages(buckets=["my-bucket"])
        >>> if initial_results.has_next:
        ...     more_results = quilt3.search_more_packages(
        ...         after=initial_results.next_cursor
        ...     )
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Public API search_more_packages called with parameters: after='{after[:16] if after else None}...', size={size}")
    
    try:
        result = _search_more_packages(after=after, size=size)
        
        logger.info(f"Public API search_more_packages completed successfully with {len(result.hits)} hits")
        return result
        
    except Exception as e:
        logger.error(f"Public API search_more_packages failed: {e}")
        raise
