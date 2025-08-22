"""
Tests for quilt3.search_packages functionality.

Test-driven development approach for the new GraphQL-based package search API.
"""

import datetime
import pytest
from unittest import mock

import quilt3
from quilt3 import PackageException
from .fixtures.search_responses import (
    SEARCH_PACKAGES_SUCCESS_RESPONSE,
    SEARCH_PACKAGES_EMPTY_RESPONSE,
    SEARCH_MORE_PACKAGES_SUCCESS_RESPONSE,
    SEARCH_MORE_PACKAGES_EMPTY_RESPONSE,
    SEARCH_PACKAGES_VALIDATION_ERROR_RESPONSE,
    SEARCH_PACKAGES_OPERATION_ERROR_RESPONSE,
    SEARCH_MORE_PACKAGES_VALIDATION_ERROR_RESPONSE,
    SEARCH_MORE_PACKAGES_OPERATION_ERROR_RESPONSE,
    NETWORK_ERROR_RESPONSE,
    AUTHENTICATION_ERROR_RESPONSE,
    SEARCH_HIT_PACKAGE,
    SEARCH_HIT_PACKAGE_2,
)
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
                {"key": "project", "value": "research"}
            ],
            latest_only=True,
            size=50,
            order="NEWEST"
        )

        # Assert
        from quilt3._graphql_client import SearchResultOrder, PackagesSearchFilter, PackageUserMetaPredicate
        
        # The mock should be called with the converted GraphQL objects
        expected_filter = PackagesSearchFilter(**{
            "modified": {"gte": "2023-01-01"},
            "size": {"gte": 1000000}
        })
        expected_user_meta_filters = [PackageUserMetaPredicate(**{"key": "project", "value": "research"})]
        
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
            after="eyJzb3J0IjpbeyJtb2RpZmllZCI6eyJvcmRlciI6ImRlc2MifX1dLCJzZWFyY2hfYWZ0ZXIiOlsxNjE4NDEzNzQ3ODU3LCJhYmMxMjNkZWY0NTYiXX0",
            size=50
        )

        # Assert
        self.mock_graphql_client.search_more_packages.assert_called_once_with(
            after="eyJzb3J0IjpbeyJtb2RpZmllZCI6eyJvcmRlciI6ImRlc2MifX1dLCJzZWFyY2hfYWZ0ZXIiOlsxNjE4NDEzNzQ3ODU3LCJhYmMxMjNkZWY0NTYiXX0",
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
        self.mock_graphql_client.search_packages.return_value = SEARCH_PACKAGES_VALIDATION_ERROR_RESPONSE

        # Act & Assert
        with self.assertRaises(PackageException) as context:
            quilt3.search_packages(buckets=[])

        self.assertIn("At least one bucket must be specified", str(context.exception))

    def test_search_packages_operation_error(self):
        """Test handling of operation errors from GraphQL."""
        # Arrange
        self.mock_graphql_client.search_packages.return_value = SEARCH_PACKAGES_OPERATION_ERROR_RESPONSE

        # Act & Assert
        with self.assertRaises(PackageException) as context:
            quilt3.search_packages(buckets=["test-bucket"])

        self.assertIn("Search service unavailable", str(context.exception))

    def test_search_more_packages_validation_error(self):
        """Test handling of validation errors in pagination."""
        # Arrange
        self.mock_graphql_client.search_more_packages.return_value = SEARCH_MORE_PACKAGES_VALIDATION_ERROR_RESPONSE

        # Act & Assert
        with self.assertRaises(PackageException) as context:
            quilt3.search_more_packages(after="")

        self.assertIn("At least one bucket must be specified", str(context.exception))

    def test_search_more_packages_operation_error(self):
        """Test handling of operation errors in pagination."""
        # Arrange
        self.mock_graphql_client.search_more_packages.return_value = SEARCH_MORE_PACKAGES_OPERATION_ERROR_RESPONSE

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
        with self.assertRaises(ValueError):
            quilt3.search_packages(buckets="not-a-list")

        # Test invalid size parameter
        with self.assertRaises(ValueError):
            quilt3.search_packages(buckets=["test"], size=-1)

        # Test invalid order parameter
        with self.assertRaises(ValueError):
            quilt3.search_packages(buckets=["test"], order="INVALID_ORDER")

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