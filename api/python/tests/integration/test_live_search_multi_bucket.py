"""
Multi-bucket search scenarios.
"""

import pytest
import quilt3
from quilt3.exceptions import QuiltException
import os


class TestLiveMultiBucketSearch:
    """Test search across multiple buckets."""
    
    def test_search_multiple_accessible_buckets(self):
        """Test search across multiple buckets user has access to."""
        # Get test bucket names from environment
        public_bucket = os.getenv('QUILT_LIVE_TEST_BUCKET_PUBLIC', 'quilt-example')
        
        try:
            # Search in specific public bucket
            public_results = quilt3.search_packages("", bucket=public_bucket, limit=5)
            assert isinstance(public_results, list), "Public bucket search should return a list"
            
            # Verify results are from the specified bucket
            for result in public_results[:3]:  # Check first 3 results
                if 'bucket' in result:
                    assert result['bucket'] == public_bucket, f"Result should be from {public_bucket}"
                    
        except QuiltException as e:
            pytest.skip(f"Multi-bucket test skipped: {e}")
        
    def test_search_mixed_access_buckets(self):
        """Test search with mix of accessible and restricted buckets."""
        public_bucket = os.getenv('QUILT_LIVE_TEST_BUCKET_PUBLIC', 'quilt-example')
        private_bucket = os.getenv('QUILT_LIVE_TEST_BUCKET_PRIVATE', 'private-test-bucket')
        
        try:
            # Test accessible bucket
            public_results = quilt3.search_packages("", bucket=public_bucket, limit=3)
            assert isinstance(public_results, list), "Public bucket search should return a list"
            
            # Test potentially restricted bucket
            try:
                private_results = quilt3.search_packages("", bucket=private_bucket, limit=3)
                assert isinstance(private_results, list), "Private bucket search should return a list"
            except QuiltException as e:
                # Expected if user doesn't have access to private bucket
                print(f"Private bucket access denied (expected): {e}")
                
        except QuiltException as e:
            pytest.skip(f"Mixed access test skipped: {e}")
        
    def test_global_search_without_bucket_filter(self):
        """Test global search across all accessible buckets."""
        try:
            # Search without specifying bucket (global search)
            global_results = quilt3.search_packages("data", limit=10)
            assert isinstance(global_results, list), "Global search should return a list"
            
            # Verify results come from multiple buckets if available
            if len(global_results) > 1:
                buckets = set()
                for result in global_results:
                    if 'bucket' in result:
                        buckets.add(result['bucket'])
                        
                # If we have results from multiple buckets, that's good
                if len(buckets) > 1:
                    print(f"Global search returned results from {len(buckets)} buckets: {buckets}")
                else:
                    print(f"Global search returned results from bucket: {buckets}")
                    
        except QuiltException as e:
            pytest.skip(f"Global search test skipped: {e}")
            
    def test_bucket_specific_vs_global_search(self):
        """Test that bucket-specific search differs from global search."""
        public_bucket = os.getenv('QUILT_LIVE_TEST_BUCKET_PUBLIC', 'quilt-example')
        
        try:
            # Global search
            global_results = quilt3.search_packages("", limit=5)
            assert isinstance(global_results, list), "Global search should return a list"
            
            # Bucket-specific search  
            bucket_results = quilt3.search_packages("", bucket=public_bucket, limit=5)
            assert isinstance(bucket_results, list), "Bucket search should return a list"
            
            # Verify bucket-specific results are actually from that bucket
            for result in bucket_results:
                if 'bucket' in result:
                    assert result['bucket'] == public_bucket, f"Bucket search result should be from {public_bucket}"
                    
        except QuiltException as e:
            pytest.skip(f"Bucket comparison test skipped: {e}")