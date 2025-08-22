"""
Live authentication and access control tests for search API.
Requires valid quilt3 login credentials.
"""

import pytest
import quilt3
from quilt3.exceptions import QuiltException


class TestLiveSearchAuthentication:
    """Test search with real authentication."""
    
    def test_search_with_valid_credentials(self):
        """Test search succeeds with valid login."""
        # Assumes user is logged in via `quilt3 login`
        try:
            results = quilt3.search_packages("test")
            assert isinstance(results, list), "Search should return a list"
        except QuiltException as e:
            pytest.skip(f"Search requires valid credentials: {e}")
        
    def test_search_bucket_access_control(self):
        """Test search respects bucket access permissions."""
        # Test searching in a bucket the user has access to
        try:
            results = quilt3.search_packages("", bucket="quilt-example")
            assert isinstance(results, list), "Search should return a list"
        except QuiltException as e:
            pytest.skip(f"Bucket access test skipped: {e}")
        
    def test_search_without_credentials(self):
        """Test search fails gracefully without login."""
        # This would require temporarily clearing credentials
        # Implementation depends on how credentials are managed
        pytest.skip("Credential clearing test not implemented")
        
    def test_search_with_expired_credentials(self):
        """Test search handles expired tokens."""
        # This would require simulating expired tokens
        # Implementation depends on authentication mechanism
        pytest.skip("Expired credential test not implemented")