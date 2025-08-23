"""
GraphQL response fixtures for search operations.

Contains comprehensive mock responses for package search GraphQL operations,
including success cases, validation errors, and other error scenarios.
"""

import datetime

# Base fixture data for search hits
SEARCH_HIT_PACKAGE = {
    "__typename": "SearchHitPackage",
    "id": "1",
    "name": "namespace/package-name",
    "bucket": "test-bucket",
    "score": 1.0,
    "modified": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "size": 1048576,
    "hash": "abc123def456",
    "comment": "Test package for search",
}

SEARCH_HIT_PACKAGE_2 = {
    "__typename": "SearchHitPackage",
    "id": "2",
    "name": "another/package",
    "bucket": "test-bucket-2",
    "score": 0.8,
    "modified": datetime.datetime(2024, 5, 10, 10, 30, 15, 123456, tzinfo=datetime.timezone.utc),
    "size": 2097152,
    "hash": "def456ghi789",
    "comment": "Another test package",
}

# Search result sets
PACKAGES_SEARCH_RESULT_SET = {
    "__typename": "PackagesSearchResultSet",
    "hasNext": True,
    "nextCursor": (
        "eyJzb3J0IjpbeyJtb2RpZmllZCI6eyJvcmRlciI6ImRlc2MifX1dLCJzZWFyY2hfYWZ0ZXIiOlsxNjE4NDEzNzQ3ODU3LCJhYmMxMjNkZWY0NTYiXX0"
    ),
    "hits": [SEARCH_HIT_PACKAGE, SEARCH_HIT_PACKAGE_2],
}

PACKAGES_SEARCH_RESULT_SET_EMPTY = {
    "__typename": "PackagesSearchResultSet",
    "hasNext": False,
    "nextCursor": None,
    "hits": [],
}

PACKAGES_SEARCH_RESULT_SET_LAST_PAGE = {
    "__typename": "PackagesSearchResultSet",
    "hasNext": False,
    "nextCursor": None,
    "hits": [SEARCH_HIT_PACKAGE],
}

# Mock objects that match the GraphQL client structure


def create_mock_search_hit(hit_data):
    """Create mock search hit object."""
    from unittest.mock import Mock
    mock_hit = Mock()
    for key, value in hit_data.items():
        setattr(mock_hit, key, value)
    return mock_hit


def create_mock_first_page(hits, cursor):
    """Create mock first page object."""
    from unittest.mock import Mock
    mock_page = Mock()
    mock_page.hits = [create_mock_search_hit(hit) for hit in hits]
    mock_page.cursor = cursor
    return mock_page


def create_mock_search_result_set(has_next=True, cursor=None, hits=None):
    """Create mock search result set."""
    from unittest.mock import Mock
    mock_result = Mock()
    if hits is None:
        hits = [SEARCH_HIT_PACKAGE, SEARCH_HIT_PACKAGE_2]
    mock_result.first_page = create_mock_first_page(hits, cursor)
    return mock_result


def create_mock_empty_result():
    """Create mock empty search result."""
    from unittest.mock import Mock
    return Mock()


def create_mock_invalid_input():
    """Create mock invalid input error."""
    from unittest.mock import Mock
    mock_error = Mock()
    mock_error.errors = [Mock()]
    mock_error.errors[0].message = "At least one bucket must be specified"
    # Make the mock look like it can be iterated for error handling
    mock_error.__iter__ = lambda self: iter([mock_error.errors[0]])
    return mock_error

# Main search operation responses


SEARCH_PACKAGES_SUCCESS_RESPONSE = create_mock_search_result_set(
    cursor=(
        "eyJzb3J0IjpbeyJtb2RpZmllZCI6eyJvcmRlciI6ImRlc2MifX1dLCJzZWFyY2hfYWZ0ZXIiOlsxNjE4NDEzNzQ3ODU3LCJhYmMxMjNkZWY0NTYiXX0"
    )
)

SEARCH_PACKAGES_EMPTY_RESPONSE = create_mock_empty_result()

SEARCH_MORE_PACKAGES_SUCCESS_RESPONSE = create_mock_first_page(
    hits=[SEARCH_HIT_PACKAGE],
    cursor=None
)

SEARCH_MORE_PACKAGES_EMPTY_RESPONSE = create_mock_first_page(
    hits=[],
    cursor=None
)

# Error responses
INVALID_INPUT_ERROR = {
    "__typename": "InvalidInput",
    "errors": [
        {
            "path": "buckets",
            "message": "At least one bucket must be specified",
            "name": "ValidationError",
            "context": {},
        }
    ],
}

OPERATION_ERROR = {
    "__typename": "OperationError",
    "message": "Search service unavailable",
    "name": "SearchError",
    "context": {},
}

SEARCH_PACKAGES_VALIDATION_ERROR_RESPONSE = create_mock_invalid_input()


def create_mock_operation_error():
    """Create mock operation error."""
    from unittest.mock import Mock
    mock_error = Mock()
    mock_error.errors = [Mock()]
    mock_error.errors[0].message = "Search service unavailable"
    # Make the mock look like it can be iterated for error handling
    mock_error.__iter__ = lambda self: iter([mock_error.errors[0]])
    return mock_error

SEARCH_PACKAGES_OPERATION_ERROR_RESPONSE = create_mock_operation_error()

SEARCH_MORE_PACKAGES_VALIDATION_ERROR_RESPONSE = create_mock_invalid_input()

SEARCH_MORE_PACKAGES_OPERATION_ERROR_RESPONSE = create_mock_operation_error()

# Network error simulation


NETWORK_ERROR_RESPONSE = {
    "errors": [
        {
            "message": "Network error: Unable to connect to GraphQL endpoint",
            "extensions": {
                "code": "NETWORK_ERROR"
            }
        }
    ]
}

# Authentication error simulation
AUTHENTICATION_ERROR_RESPONSE = {
    "errors": [
        {
            "message": "Authentication failed: Invalid token",
            "extensions": {
                "code": "UNAUTHENTICATED"
            }
        }
    ]
}
