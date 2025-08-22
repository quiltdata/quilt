"""
Search tests against real data in live buckets.
"""

import pytest
import logging
import quilt3
from quilt3.exceptions import QuiltException

# Configure logging for tests
logger = logging.getLogger(__name__)


class TestLiveSearchData:
    """Test search against real package data."""
    
    def test_basic_text_search(self):
        """Test basic text search across known packages."""
        logger.info("Testing basic text search")
        try:
            logger.debug("Executing search with query 'data'")
            results = quilt3.search_packages("data")
            logger.info(f"Basic text search completed with {len(results)} results")
            assert isinstance(results, list), "Search should return a list"
            # Check if results contain expected fields
            if results:
                logger.debug(f"Validating result structure, first result keys: {list(results[0].keys())}")
                assert "name" in results[0], "Results should contain package name"
            else:
                logger.warning("No results returned for basic text search")
        except QuiltException as e:
            logger.warning(f"Basic search test failed, skipping: {e}")
            pytest.skip(f"Basic search test skipped: {e}")
        
    def test_metadata_filter_search(self):
        """Test filtering by package metadata."""
        logger.info("Testing metadata filter search")
        try:
            # Test searching with metadata filters
            metadata_filter = {"format": "csv"}
            logger.debug(f"Executing search with metadata filter: {metadata_filter}")
            results = quilt3.search_packages("", metadata=metadata_filter)
            logger.info(f"Metadata filter search completed with {len(results)} results")
            assert isinstance(results, list), "Metadata search should return a list"
        except QuiltException as e:
            logger.warning(f"Metadata search test failed, skipping: {e}")
            pytest.skip(f"Metadata search test skipped: {e}")
        
    def test_size_and_date_filters(self):
        """Test numeric and date range filters."""
        logger.info("Testing size and date filters")
        try:
            # Test size filters
            min_size = 1000
            logger.debug(f"Executing search with min_size filter: {min_size}")
            results = quilt3.search_packages("", min_size=min_size)
            logger.info(f"Size filter search completed with {len(results)} results")
            assert isinstance(results, list), "Size filter search should return a list"
        except QuiltException as e:
            logger.warning(f"Size filter test failed, skipping: {e}")
            pytest.skip(f"Size filter test skipped: {e}")
        
    def test_user_metadata_search(self):
        """Test searching within user-defined metadata."""
        try:
            results = quilt3.search_packages("", user_meta={"tag": "example"})
            assert isinstance(results, list), "User metadata search should return a list"
        except QuiltException as e:
            pytest.skip(f"User metadata search test skipped: {e}")
        
    def test_empty_result_handling(self):
        """Test search with queries that return no results."""
        logger.info("Testing empty result handling")
        try:
            # Search for something unlikely to exist
            nonexistent_query = "nonexistent_package_xyz123"
            logger.debug(f"Executing search with nonexistent query: '{nonexistent_query}'")
            results = quilt3.search_packages(nonexistent_query)
            logger.info(f"Empty result test completed with {len(results)} results")
            assert isinstance(results, list), "Empty search should return empty list"
            assert len(results) == 0, "Search for nonexistent package should return empty list"
        except QuiltException as e:
            logger.warning(f"Empty result test failed, skipping: {e}")
            pytest.skip(f"Empty result test skipped: {e}")
        
    def test_large_result_set_handling(self):
        """Test search with queries returning many results."""
        logger.info("Testing large result set handling")
        try:
            # Use a broad search term likely to return many results
            limit = 100
            logger.debug(f"Executing search with limit: {limit}")
            results = quilt3.search_packages("", limit=limit)
            logger.info(f"Large result search completed with {len(results)} results")
            assert isinstance(results, list), "Large result search should return a list"
            # Check pagination works
            if len(results) == limit:
                logger.debug("Testing pagination with next page")
                # Test next page
                next_results = quilt3.search_packages("", limit=limit, offset=limit)
                logger.info(f"Pagination test completed with {len(next_results)} results on page 2")
                assert isinstance(next_results, list), "Paginated search should return a list"
            else:
                logger.info(f"Pagination test skipped - only {len(results)} results available")
        except QuiltException as e:
            logger.warning(f"Large result test failed, skipping: {e}")
            pytest.skip(f"Large result test skipped: {e}")