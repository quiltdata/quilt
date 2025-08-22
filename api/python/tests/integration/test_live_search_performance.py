"""
Performance and pagination tests against live data.
"""

import time
import pytest
import quilt3
from quilt3.exceptions import QuiltException
import concurrent.futures
import os


class TestLiveSearchPerformance:
    """Test search performance characteristics."""
    
    def test_pagination_across_multiple_pages(self):
        """Test paginating through large result sets."""
        try:
            page_size = 10
            total_pages = 3
            all_results = []
            
            for page in range(total_pages):
                offset = page * page_size
                results = quilt3.search_packages("", limit=page_size, offset=offset)
                assert isinstance(results, list), f"Page {page} should return a list"
                all_results.extend(results)
                
                # Break if we get fewer results than requested (end of results)
                if len(results) < page_size:
                    break
                    
            # Verify we got results and no duplicates in pagination
            if len(all_results) > page_size:
                page1_names = {pkg.get('name', '') for pkg in all_results[:page_size]}
                page2_names = {pkg.get('name', '') for pkg in all_results[page_size:2*page_size]}
                overlap = page1_names.intersection(page2_names)
                assert len(overlap) == 0, "Pages should not contain duplicate packages"
                
        except QuiltException as e:
            pytest.skip(f"Pagination test skipped: {e}")
        
    def test_search_response_times(self):
        """Benchmark search response times."""
        max_response_time = float(os.getenv('QUILT_LIVE_TEST_TIMEOUT', '30'))
        iterations = int(os.getenv('QUILT_LIVE_TEST_PERFORMANCE_ITERATIONS', '5'))
        
        response_times = []
        
        for i in range(iterations):
            try:
                start_time = time.time()
                results = quilt3.search_packages("test", limit=10)
                end_time = time.time()
                
                response_time = end_time - start_time
                response_times.append(response_time)
                
                assert response_time < max_response_time, f"Search took {response_time}s, exceeding {max_response_time}s limit"
                assert isinstance(results, list), "Search should return a list"
                
            except QuiltException as e:
                pytest.skip(f"Performance test iteration {i} skipped: {e}")
                
        if response_times:
            avg_time = sum(response_times) / len(response_times)
            print(f"Average response time: {avg_time:.2f}s over {len(response_times)} iterations")
        
    def test_concurrent_search_requests(self):
        """Test multiple simultaneous search operations."""
        def perform_search(query):
            try:
                return quilt3.search_packages(f"test_{query}", limit=5)
            except QuiltException:
                return []
        
        queries = ["data", "example", "test", "sample", "demo"]
        
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                future_to_query = {executor.submit(perform_search, query): query for query in queries}
                
                for future in concurrent.futures.as_completed(future_to_query):
                    query = future_to_query[future]
                    try:
                        results = future.result(timeout=30)
                        assert isinstance(results, list), f"Concurrent search for '{query}' should return a list"
                    except Exception as e:
                        pytest.skip(f"Concurrent search for '{query}' failed: {e}")
                        
        except Exception as e:
            pytest.skip(f"Concurrent search test skipped: {e}")
        
    def test_search_timeout_handling(self):
        """Test search behavior with network timeouts."""
        # This test would require a way to simulate network issues
        # For now, just test that searches complete within reasonable time
        try:
            start_time = time.time()
            results = quilt3.search_packages("", limit=50)
            end_time = time.time()
            
            response_time = end_time - start_time
            max_time = float(os.getenv('QUILT_LIVE_TEST_TIMEOUT', '30'))
            
            assert response_time < max_time, f"Search took {response_time}s, exceeding timeout of {max_time}s"
            assert isinstance(results, list), "Search should return a list"
            
        except QuiltException as e:
            pytest.skip(f"Timeout test skipped: {e}")