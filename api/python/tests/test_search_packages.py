"""
Tests for quilt3.search_packages functionality.

Test-driven development approach for the new GraphQL-based package search API.
"""

import datetime
from unittest import mock

import quilt3
from quilt3 import PackageException

from .fixtures.search_responses import (
    SEARCH_HIT_PACKAGE, SEARCH_MORE_PACKAGES_EMPTY_RESPONSE,
    SEARCH_MORE_PACKAGES_SUCCESS_RESPONSE,
    SEARCH_MORE_PACKAGES_VALIDATION_ERROR_RESPONSE,
    SEARCH_PACKAGES_SUCCESS_RESPONSE)
from .utils import QuiltTestCase


class TestSearchPackages(QuiltTestCase):
    """Test the search_packages API functionality."""

    def setUp(self):
        super().setUp()
        # Mock the GraphQL client to avoid actual network calls
        self.mock_client_patcher = mock.patch('quilt3._search._get_search_client')
        self.mock_client = self.mock_client_patcher.start()
        self.mock_graphql_client = mock.MagicMock()
        self.mock_client.return_value = self.mock_graphql_client

    def tearDown(self):
        self.mock_client_patcher.stop()
        super().tearDown()

    def test_basic_search_success(self):
        """Test basic search with buckets and search string."""
        # Arrange
        self.mock_graphql_client.search_packages.return_value = SEARCH_PACKAGES_SUCCESS_RESPONSE

        # Act
        results = quilt3.search_packages(
            buckets=["test-bucket"],
            search_string="machine learning"
        )

        # Assert
        from quilt3._graphql_client import SearchResultOrder
        self.mock_graphql_client.search_packages.assert_called_once_with(
            buckets=["test-bucket"],
            search_string="machine learning",
            filter=None,
            user_meta_filters=None,
            latest_only=False,
            size=30,
            order=SearchResultOrder.BEST_MATCH
        )

        # Verify result structure
        self.assertEqual(len(results.hits), 2)
        self.assertEqual(results.hits[0].key, SEARCH_HIT_PACKAGE["name"])
        self.assertEqual(results.hits[0].bucket_name, SEARCH_HIT_PACKAGE["bucket"])
        self.assertEqual(results.hits[0].score, SEARCH_HIT_PACKAGE["score"])
        self.assertTrue(results.has_next)
        self.assertIsNotNone(results.next_cursor)

    def test_advanced_search_with_filters(self):
        """Test advanced search with filters and options."""
        # Arrange
        self.mock_graphql_client.search_packages.return_value = SEARCH_PACKAGES_SUCCESS_RESPONSE

        # Act
        results = quilt3.search_packages(
            buckets=["bucket1", "bucket2"],
            search_string="covid data",
            filter={
                "modified": {"gte": "2023-01-01"},
                "size": {"gte": 1000000}
            },
            user_meta_filters=[
                {"path": "project", "keyword": {"terms": ["research"]}}
            ],
            latest_only=True,
            size=50,
            order="NEWEST"
        )

        # Assert
        from quilt3._graphql_client import (PackagesSearchFilter,
                                            PackageUserMetaPredicate,
                                            SearchResultOrder)

        # The mock should be called with the converted GraphQL objects
        expected_filter = PackagesSearchFilter(**{
            "modified": {"gte": "2023-01-01"},
            "size": {"gte": 1000000}
        })
        expected_user_meta_filters = [
            PackageUserMetaPredicate(**{"path": "project", "keyword": {"terms": ["research"]}})
        ]

        self.mock_graphql_client.search_packages.assert_called_once_with(
            buckets=["bucket1", "bucket2"],
            search_string="covid data",
            filter=expected_filter,
            user_meta_filters=expected_user_meta_filters,
            latest_only=True,
            size=50,
            order=SearchResultOrder.NEWEST
        )

        self.assertEqual(len(results.hits), 2)

    def test_empty_search_results(self):
        """Test handling of empty search results."""
        # Arrange
        from unittest.mock import Mock
        empty_mock = Mock()
        empty_mock.first_page = Mock()
        empty_mock.first_page.hits = []
        empty_mock.first_page.cursor = None
        self.mock_graphql_client.search_packages.return_value = empty_mock

        # Act
        results = quilt3.search_packages(
            buckets=["empty-bucket"],
            search_string="nonexistent"
        )

        # Assert
        self.assertEqual(len(results.hits), 0)
        self.assertFalse(results.has_next)
        self.assertIsNone(results.next_cursor)

    def test_search_more_packages_success(self):
        """Test pagination with search_more_packages."""
        # Arrange
        # SEARCH_MORE_PACKAGES_SUCCESS_RESPONSE is actually a first_page mock
        # but search_more_packages returns the page directly, not wrapped
        self.mock_graphql_client.search_more_packages.return_value = SEARCH_MORE_PACKAGES_SUCCESS_RESPONSE

        # Act
        results = quilt3.search_more_packages(
            after=(
                "eyJzb3J0IjpbeyJtb2RpZmllZCI6eyJvcmRlciI6ImRlc2MifX1dLCJzZWFyY2hfYWZ0ZXIiOlsxNjE4NDEzNzQ3ODU3LCJhYmMxMjNkZWY0NTYiXX0"
            ),
            size=50
        )

        # Assert
        self.mock_graphql_client.search_more_packages.assert_called_once_with(
            after=(
                "eyJzb3J0IjpbeyJtb2RpZmllZCI6eyJvcmRlciI6ImRlc2MifX1dLCJzZWFyY2hfYWZ0ZXIiOlsxNjE4NDEzNzQ3ODU3LCJhYmMxMjNkZWY0NTYiXX0"
            ),
            size=50
        )

        self.assertEqual(len(results.hits), 1)
        self.assertFalse(results.has_next)

    def test_search_more_packages_empty(self):
        """Test pagination when no more results available."""
        # Arrange
        self.mock_graphql_client.search_more_packages.return_value = SEARCH_MORE_PACKAGES_EMPTY_RESPONSE

        # Act
        results = quilt3.search_more_packages(
            after="invalid_cursor",
            size=30
        )

        # Assert
        self.assertEqual(len(results.hits), 0)
        self.assertFalse(results.has_next)

    def test_search_packages_validation_error(self):
        """Test handling of validation errors from GraphQL."""
        # Arrange
        from unittest.mock import Mock
        invalid_input_mock = Mock()
        invalid_input_mock.__class__.__name__ = (
            'SearchPackagesSearchPackagesInvalidInput'
        )
        invalid_input_mock.errors = [Mock()]
        invalid_input_mock.errors[0].message = "Search failed: validation error"

        # Mock the isinstance check by setting the actual class
        with mock.patch(
            'quilt3._search._graphql_client.SearchPackagesSearchPackagesInvalidInput',
            invalid_input_mock.__class__
        ):
            self.mock_graphql_client.search_packages.return_value = invalid_input_mock

            # Act & Assert
            with self.assertRaises(PackageException) as context:
                quilt3.search_packages(buckets=[])

            self.assertIn("Search failed", str(context.exception))

    def test_search_packages_operation_error(self):
        """Test handling of operation errors from GraphQL."""
        # Arrange - create a mock that will pass the isinstance check for InvalidInput
        from unittest.mock import Mock
        mock_error = Mock()
        mock_error.__class__.__name__ = 'SearchPackagesSearchPackagesInvalidInput'
        mock_error.errors = [Mock()]
        mock_error.errors[0].message = "Search service unavailable"

        # Mock the isinstance check
        with mock.patch(
            'quilt3._search._graphql_client.SearchPackagesSearchPackagesInvalidInput',
            mock_error.__class__
        ):
            self.mock_graphql_client.search_packages.return_value = mock_error

            # Act & Assert
            with self.assertRaises(PackageException) as context:
                quilt3.search_packages(buckets=["test-bucket"])

            self.assertIn("Search service unavailable", str(context.exception))

    def test_search_more_packages_validation_error(self):
        """Test handling of validation errors in pagination."""
        # This test is moved to test_search_more_packages_parameter_validation
        # to test the actual parameter validation logic
        pass

    def test_search_more_packages_operation_error(self):
        """Test handling of operation errors in pagination."""
        # Arrange - create a mock that will pass the isinstance check for InvalidInput
        from unittest.mock import Mock
        mock_error = Mock()
        mock_error.__class__.__name__ = (
            'SearchMorePackagesSearchMorePackagesInvalidInput'
        )
        mock_error.errors = [Mock()]
        mock_error.errors[0].message = "Search service unavailable"

        # Mock the isinstance check
        with mock.patch(
            'quilt3._search._graphql_client.SearchMorePackagesSearchMorePackagesInvalidInput',
            mock_error.__class__
        ):
            self.mock_graphql_client.search_more_packages.return_value = mock_error

            # Act & Assert
            with self.assertRaises(PackageException) as context:
                quilt3.search_more_packages(after="valid_cursor")

            self.assertIn("Search service unavailable", str(context.exception))

    def test_network_error_handling(self):
        """Test handling of network errors."""
        # Arrange
        from quilt3._graphql_client.exceptions import GraphQLClientError
        self.mock_graphql_client.search_packages.side_effect = GraphQLClientError("Network error")

        # Act & Assert
        with self.assertRaises(PackageException) as context:
            quilt3.search_packages(buckets=["test-bucket"])

        self.assertIn("Network error", str(context.exception))

    def test_authentication_error_handling(self):
        """Test handling of authentication errors."""
        # Arrange
        from quilt3._graphql_client.exceptions import GraphQLClientError
        self.mock_graphql_client.search_packages.side_effect = GraphQLClientError("Authentication failed")

        # Act & Assert
        with self.assertRaises(PackageException) as context:
            quilt3.search_packages(buckets=["test-bucket"])

        self.assertIn("Authentication failed", str(context.exception))

    def test_parameter_validation(self):
        """Test parameter validation for search_packages."""
        # Test invalid buckets parameter
        with self.assertRaises(ValueError) as context:
            quilt3.search_packages(buckets="not-a-list")
        self.assertIn("buckets must be a list or None", str(context.exception))

        # Test invalid size parameter (negative)
        with self.assertRaises(ValueError) as context:
            quilt3.search_packages(buckets=["test"], size=-1)
        self.assertIn("size must be a non-negative integer", str(context.exception))

        # Test invalid size parameter (non-integer)
        with self.assertRaises(ValueError) as context:
            quilt3.search_packages(buckets=["test"], size="invalid")
        self.assertIn("size must be a non-negative integer", str(context.exception))

        # Test invalid order parameter
        with self.assertRaises(ValueError) as context:
            quilt3.search_packages(buckets=["test"], order="INVALID_ORDER")
        self.assertIn("order must be one of", str(context.exception))

    def test_search_more_packages_parameter_validation(self):
        """Test parameter validation for search_more_packages."""
        # Test empty after cursor
        with self.assertRaises(ValueError) as context:
            quilt3.search_more_packages(after="")
        self.assertIn("after cursor is required", str(context.exception))

        # Test None after cursor
        with self.assertRaises(ValueError) as context:
            quilt3.search_more_packages(after=None)
        self.assertIn("after cursor is required", str(context.exception))

        # Test non-string after cursor
        with self.assertRaises(ValueError) as context:
            quilt3.search_more_packages(after=123)
        self.assertIn("after cursor is required", str(context.exception))

        # Test invalid size parameter
        with self.assertRaises(ValueError) as context:
            quilt3.search_more_packages(after="valid_cursor", size=-1)
        self.assertIn("size must be a non-negative integer", str(context.exception))

    def test_search_result_data_types(self):
        """Test that search results have correct data types."""
        # Arrange
        self.mock_graphql_client.search_packages.return_value = SEARCH_PACKAGES_SUCCESS_RESPONSE

        # Act
        results = quilt3.search_packages(buckets=["test-bucket"])

        # Assert data types
        hit = results.hits[0]
        self.assertIsInstance(hit.key, str)
        self.assertIsInstance(hit.bucket_name, str)
        self.assertIsInstance(hit.score, float)
        self.assertIsInstance(hit.modified, datetime.datetime)
        self.assertIsInstance(hit.size, int)
        self.assertIsInstance(hit.hash, str)

    def test_search_with_defaults(self):
        """Test search with default parameters."""
        # Arrange
        self.mock_graphql_client.search_packages.return_value = SEARCH_PACKAGES_SUCCESS_RESPONSE

        # Act - call with minimal parameters
        results = quilt3.search_packages()

        # Assert default values are used
        from quilt3._graphql_client import SearchResultOrder
        self.mock_graphql_client.search_packages.assert_called_once_with(
            buckets=None,
            search_string=None,
            filter=None,
            user_meta_filters=None,
            latest_only=False,
            size=30,
            order=SearchResultOrder.BEST_MATCH
        )

    def test_graphql_filter_conversion_error(self):
        """Test handling of GraphQL filter conversion errors."""
        # Mock the PackagesSearchFilter constructor to raise an exception
        with mock.patch('quilt3._search._graphql_client.PackagesSearchFilter') as mock_filter:
            mock_filter.side_effect = TypeError("Unknown filter field: invalid_field")

            with self.assertRaises(PackageException) as context:
                quilt3.search_packages(
                    buckets=["test-bucket"],
                    filter={"invalid_field": "invalid_value"}
                )
            self.assertIn("Unexpected error during search", str(context.exception))

    def test_graphql_user_meta_filter_conversion_error(self):
        """Test handling of GraphQL user meta filter conversion errors."""
        # Test case where user meta filter conversion fails
        with self.assertRaises(PackageException) as context:
            quilt3.search_packages(
                buckets=["test-bucket"],
                user_meta_filters=[{"invalid": "structure"}]
            )
        self.assertIn("Unexpected error during search", str(context.exception))

    def test_empty_search_result_set_handling(self):
        """Test handling of EmptySearchResultSet response type."""
        # Arrange
        from unittest.mock import Mock
        empty_result_mock = Mock()
        empty_result_mock.__class__.__name__ = 'SearchPackagesSearchPackagesEmptySearchResultSet'

        with mock.patch(
            'quilt3._search._graphql_client.SearchPackagesSearchPackagesEmptySearchResultSet',
            empty_result_mock.__class__
        ):
            self.mock_graphql_client.search_packages.return_value = empty_result_mock

            # Act
            results = quilt3.search_packages(buckets=["test-bucket"])

            # Assert
            self.assertEqual(len(results.hits), 0)
            self.assertFalse(results.has_next)
            self.assertIsNone(results.next_cursor)

    def test_real_graphql_result_set_handling(self):
        """Test handling of actual PackagesSearchResultSet response type."""
        # Arrange
        from unittest.mock import Mock
        result_set_mock = Mock()
        result_set_mock.__class__.__name__ = 'SearchPackagesSearchPackagesPackagesSearchResultSet'
        result_set_mock.first_page = Mock()
        result_set_mock.first_page.hits = [Mock(), Mock()]
        result_set_mock.first_page.cursor = "test-cursor"

        with mock.patch(
            'quilt3._search._graphql_client.SearchPackagesSearchPackagesPackagesSearchResultSet',
            result_set_mock.__class__
        ):
            self.mock_graphql_client.search_packages.return_value = result_set_mock

            # Act
            results = quilt3.search_packages(buckets=["test-bucket"])

            # Assert
            self.assertEqual(len(results.hits), 2)
            self.assertTrue(results.has_next)
            self.assertEqual(results.next_cursor, "test-cursor")

    def test_search_more_packages_with_graphql_types(self):
        """Test search_more_packages with actual GraphQL response types."""
        # Arrange
        from unittest.mock import Mock
        page_mock = Mock()
        page_mock.__class__.__name__ = 'SearchMorePackagesSearchMorePackagesPackagesSearchResultSetPage'
        page_mock.hits = [Mock()]
        page_mock.cursor = None

        with mock.patch(
            'quilt3._search._graphql_client.SearchMorePackagesSearchMorePackagesPackagesSearchResultSetPage',
            page_mock.__class__
        ):
            self.mock_graphql_client.search_more_packages.return_value = page_mock

            # Act
            results = quilt3.search_more_packages(after="test-cursor")

            # Assert
            self.assertEqual(len(results.hits), 1)
            self.assertFalse(results.has_next)

    def test_search_more_packages_validation_error_with_graphql_types(self):
        """Test search_more_packages validation error with GraphQL types."""
        # Arrange
        from unittest.mock import Mock
        invalid_input_mock = Mock()
        invalid_input_mock.__class__.__name__ = 'SearchMorePackagesSearchMorePackagesInvalidInput'

        with mock.patch(
            'quilt3._search._graphql_client.SearchMorePackagesSearchMorePackagesInvalidInput',
            invalid_input_mock.__class__
        ):
            self.mock_graphql_client.search_more_packages.return_value = invalid_input_mock

            # Act & Assert
            with self.assertRaises(PackageException) as context:
                quilt3.search_more_packages(after="test-cursor")

            self.assertIn("Unexpected error during search pagination", str(context.exception))

    def test_search_hit_attribute_handling(self):
        """Test SearchHit constructor with various attribute scenarios."""
        from unittest.mock import Mock

        from quilt3._search import SearchHit

        # Test 1: Mock hit with all standard attributes
        mock_hit = Mock()
        mock_hit.id = "test-id"
        mock_hit.score = 0.5
        mock_hit.bucket = "test-bucket"
        mock_hit.name = "test-package"
        mock_hit.modified = "2024-01-01"
        mock_hit.size = 1000
        mock_hit.hash = "test-hash"
        mock_hit.comment = "test comment"

        search_hit = SearchHit(mock_hit)
        self.assertEqual(search_hit.bucket_name, "test-bucket")
        self.assertEqual(search_hit.key, "test-package")
        self.assertEqual(search_hit.bucket, "test-bucket")
        self.assertEqual(search_hit.name, "test-package")

        # Test 2: Mock hit with bucket_name and key instead of bucket/name
        mock_hit2 = Mock()
        mock_hit2.id = "test-id-2"
        mock_hit2.score = 0.8
        mock_hit2.bucket_name = "test-bucket-2"
        mock_hit2.key = "test-package-2"
        mock_hit2.modified = "2024-02-01"
        mock_hit2.size = 2000
        mock_hit2.hash = "test-hash-2"
        mock_hit2.comment = "test comment 2"

        search_hit2 = SearchHit(mock_hit2)
        self.assertEqual(search_hit2.bucket_name, "test-bucket-2")
        self.assertEqual(search_hit2.key, "test-package-2")
        self.assertEqual(search_hit2.bucket, "test-bucket-2")
        self.assertEqual(search_hit2.name, "test-package-2")

        # Test 3: Mock hit with missing optional attributes
        mock_hit3 = Mock()
        # Remove optional attributes to test getattr fallbacks
        for attr in ['id', 'score', 'bucket', 'name', 'modified', 'size', 'hash', 'comment']:
            if hasattr(mock_hit3, attr):
                delattr(mock_hit3, attr)

        search_hit3 = SearchHit(mock_hit3)
        self.assertIsNone(search_hit3.id)
        self.assertEqual(search_hit3.score, 0.0)  # Default value
        self.assertIsNone(search_hit3.bucket_name)
        self.assertIsNone(search_hit3.key)
        self.assertEqual(search_hit3.size, 0)  # Default value

    def test_error_handling_with_malformed_errors(self):
        """Test error handling when errors object is malformed."""
        from unittest.mock import Mock

        from quilt3._search import _handle_search_errors

        # Create a mock result with malformed errors (not iterable)
        mock_result = Mock()
        mock_result.errors = "not_iterable"

        with self.assertRaises(PackageException) as context:
            _handle_search_errors(mock_result)

        self.assertIn("Search operation failed", str(context.exception))

    def test_search_more_packages_fallback_case(self):
        """Test search_more_packages fallback when response doesn't match expected types."""
        # Arrange - return a mock that doesn't match any expected GraphQL types
        from unittest.mock import Mock
        unrecognized_mock = Mock()
        unrecognized_mock.__class__.__name__ = 'UnrecognizedResponseType'
        # Make sure it doesn't have hits/cursor attributes
        del unrecognized_mock.hits
        del unrecognized_mock.cursor

        self.mock_graphql_client.search_more_packages.return_value = unrecognized_mock

        # Act
        results = quilt3.search_more_packages(after="test-cursor")

        # Assert - should return empty fallback result
        self.assertEqual(len(results.hits), 0)
        self.assertFalse(results.has_next)
        self.assertIsNone(results.next_cursor)

    def test_search_packages_graphql_client_exception(self):
        """Test handling of GraphQLClientError during search."""
        # Arrange
        from quilt3._graphql_client.exceptions import GraphQLClientError
        self.mock_graphql_client.search_packages.side_effect = GraphQLClientError("Network timeout")

        # Act & Assert
        with self.assertRaises(PackageException) as context:
            quilt3.search_packages(buckets=["test-bucket"])

        self.assertIn("Search failed: Network timeout", str(context.exception))

    def test_search_more_packages_graphql_client_exception(self):
        """Test handling of GraphQLClientError during search_more_packages."""
        # Arrange
        from quilt3._graphql_client.exceptions import GraphQLClientError
        self.mock_graphql_client.search_more_packages.side_effect = GraphQLClientError("Connection error")

        # Act & Assert
        with self.assertRaises(PackageException) as context:
            quilt3.search_more_packages(after="test-cursor")

        self.assertIn("Search pagination failed: Connection error", str(context.exception))


class TestSearchPackagesIntegration(QuiltTestCase):
    """Integration tests for search_packages with real GraphQL client."""

    @mock.patch('quilt3._search._get_search_client')
    def test_integration_with_mock_server(self, mock_get_client):
        """Test integration with mocked GraphQL server responses."""
        # This test would be expanded with actual GraphQL server mocking
        # For now, it's a placeholder for integration testing
        pass

    def test_authentication_integration(self):
        """Test that search uses existing quilt3 authentication."""
        # This test would verify that search operations reuse
        # the existing quilt3 authentication and configuration
        pass

    def test_performance_with_large_results(self):
        """Test performance characteristics with large result sets."""
        # This test would verify that the search handles large
        # result sets efficiently
        pass
