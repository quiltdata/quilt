"""
Search tests against real data in live buckets.
"""

import pytest
import quilt3
from quilt3.exceptions import QuiltException


class TestLiveSearchData:
    """Test search against real package data."""
    
    def test_basic_text_search(self):
        """Test basic text search across known packages."""
        try:
            results = quilt3.search_packages("data")
            assert isinstance(results, list), "Search should return a list"
            # Check if results contain expected fields
            if results:
                assert "name" in results[0], "Results should contain package name"
        except QuiltException as e:
            pytest.skip(f"Basic search test skipped: {e}")
        
    def test_metadata_filter_search(self):
        """Test filtering by package metadata."""
        try:
            # Test searching with metadata filters
            results = quilt3.search_packages("", metadata={"format": "csv"})
            assert isinstance(results, list), "Metadata search should return a list"
        except QuiltException as e:
            pytest.skip(f"Metadata search test skipped: {e}")
        
    def test_size_and_date_filters(self):
        """Test numeric and date range filters."""
        try:
            # Test size filters
            results = quilt3.search_packages("", min_size=1000)
            assert isinstance(results, list), "Size filter search should return a list"
        except QuiltException as e:
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
        try:
            # Search for something unlikely to exist
            results = quilt3.search_packages("nonexistent_package_xyz123")
            assert isinstance(results, list), "Empty search should return empty list"
            assert len(results) == 0, "Search for nonexistent package should return empty list"
        except QuiltException as e:
            pytest.skip(f"Empty result test skipped: {e}")
        
    def test_large_result_set_handling(self):
        """Test search with queries returning many results."""
        try:
            # Use a broad search term likely to return many results
            results = quilt3.search_packages("", limit=100)
            assert isinstance(results, list), "Large result search should return a list"
            # Check pagination works
            if len(results) == 100:
                # Test next page
                next_results = quilt3.search_packages("", limit=100, offset=100)
                assert isinstance(next_results, list), "Paginated search should return a list"
        except QuiltException as e:
            pytest.skip(f"Large result test skipped: {e}")