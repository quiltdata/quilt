"""
GraphQL response fixtures for search operations.

Contains comprehensive mock responses for package search GraphQL operations,
including success cases, validation errors, and other error scenarios.
"""

import datetime

# Base fixture data for search hits
SEARCH_HIT_PACKAGE = {
    "__typename": "SearchHitPackage",
    "key": "namespace/package-name",
    "bucketName": "test-bucket",
    "score": 1.0,
    "modified": datetime.datetime(2024, 6, 14, 11, 42, 27, 857128, tzinfo=datetime.timezone.utc),
    "size": 1048576,
    "hash": "abc123def456",
    "comment": "Test package for search",
}

SEARCH_HIT_PACKAGE_2 = {
    "__typename": "SearchHitPackage", 
    "key": "another/package",
    "bucketName": "test-bucket-2",
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
    "nextCursor": "eyJzb3J0IjpbeyJtb2RpZmllZCI6eyJvcmRlciI6ImRlc2MifX1dLCJzZWFyY2hfYWZ0ZXIiOlsxNjE4NDEzNzQ3ODU3LCJhYmMxMjNkZWY0NTYiXX0",
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

# Main search operation responses
SEARCH_PACKAGES_SUCCESS_RESPONSE = {
    "searchPackages": PACKAGES_SEARCH_RESULT_SET
}

SEARCH_PACKAGES_EMPTY_RESPONSE = {
    "searchPackages": PACKAGES_SEARCH_RESULT_SET_EMPTY
}

SEARCH_MORE_PACKAGES_SUCCESS_RESPONSE = {
    "searchMorePackages": PACKAGES_SEARCH_RESULT_SET_LAST_PAGE
}

SEARCH_MORE_PACKAGES_EMPTY_RESPONSE = {
    "searchMorePackages": PACKAGES_SEARCH_RESULT_SET_EMPTY
}

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

SEARCH_PACKAGES_VALIDATION_ERROR_RESPONSE = {
    "searchPackages": INVALID_INPUT_ERROR
}

SEARCH_PACKAGES_OPERATION_ERROR_RESPONSE = {
    "searchPackages": OPERATION_ERROR
}

SEARCH_MORE_PACKAGES_VALIDATION_ERROR_RESPONSE = {
    "searchMorePackages": INVALID_INPUT_ERROR
}

SEARCH_MORE_PACKAGES_OPERATION_ERROR_RESPONSE = {
    "searchMorePackages": OPERATION_ERROR
}

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