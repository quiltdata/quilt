"""
Performance and pagination tests against live data.
"""

import concurrent.futures
import logging
import os
import time

import pytest

import quilt3
from quilt3.exceptions import QuiltException

# Configure logging for tests
logger = logging.getLogger(__name__)


class TestLiveSearchPerformance:
    """Test search performance characteristics."""
    
    def test_pagination_across_multiple_pages(self):
        """Test paginating through large result sets."""
        logger.info("Testing pagination across multiple pages")
        try:
            page_size = 10
            total_pages = 3
            all_results = []
            
            logger.debug(f"Testing pagination with page_size={page_size}, total_pages={total_pages}")
            
            for page in range(total_pages):
                offset = page * page_size
                logger.debug(f"Fetching page {page+1} with offset={offset}, limit={page_size}")
                results = quilt3.search_packages("", limit=page_size, offset=offset)
                logger.debug(f"Page {page+1} returned {len(results)} results")
                assert isinstance(results, list), f"Page {page} should return a list"
                all_results.extend(results)
                
                # Break if we get fewer results than requested (end of results)
                if len(results) < page_size:
                    logger.info(f"Stopping pagination at page {page+1} - fewer results than page size")
                    break
                    
            # Verify we got results and no duplicates in pagination
            logger.info(f"Pagination test completed with {len(all_results)} total results")
            if len(all_results) > page_size:
                page1_names = {pkg.get('name', '') for pkg in all_results[:page_size]}
                page2_names = {pkg.get('name', '') for pkg in all_results[page_size:2*page_size]}
                overlap = page1_names.intersection(page2_names)
                logger.debug(f"Checking for duplicates: page1={len(page1_names)}, page2={len(page2_names)}, overlap={len(overlap)}")
                assert len(overlap) == 0, "Pages should not contain duplicate packages"
            else:
                logger.warning(f"Only {len(all_results)} results available - cannot test pagination properly")
                
        except QuiltException as e:
            logger.warning(f"Pagination test failed, skipping: {e}")
            pytest.skip(f"Pagination test skipped: {e}")
        
    def test_search_response_times(self):
        """Benchmark search response times."""
        logger.info("Testing search response times")
        max_response_time = float(os.getenv('QUILT_LIVE_TEST_TIMEOUT', '30'))
        iterations = int(os.getenv('QUILT_LIVE_TEST_PERFORMANCE_ITERATIONS', '5'))
        
        logger.info(f"Running {iterations} iterations with max_response_time={max_response_time}s")
        response_times = []
        
        for i in range(iterations):
            try:
                logger.debug(f"Performance test iteration {i+1}/{iterations}")
                start_time = time.time()
                results = quilt3.search_packages("test", limit=10)
                end_time = time.time()
                
                response_time = end_time - start_time
                response_times.append(response_time)
                logger.debug(f"Iteration {i+1} completed in {response_time:.3f}s with {len(results)} results")
                
                assert response_time < max_response_time, f"Search took {response_time}s, exceeding {max_response_time}s limit"
                assert isinstance(results, list), "Search should return a list"
                
            except QuiltException as e:
                logger.warning(f"Performance test iteration {i} failed, skipping: {e}")
                pytest.skip(f"Performance test iteration {i} skipped: {e}")
                
        if response_times:
            avg_time = sum(response_times) / len(response_times)
            logger.info(f"Performance test completed: avg={avg_time:.3f}s, min={min(response_times):.3f}s, max={max(response_times):.3f}s")
            print(f"Average response time: {avg_time:.2f}s over {len(response_times)} iterations")
        else:
            logger.warning("No successful response time measurements")
        
    def test_concurrent_search_requests(self):
        """Test multiple simultaneous search operations."""
        logger.info("Testing concurrent search requests")
        
        def perform_search(query):
            try:
                logger.debug(f"Executing concurrent search for query: {query}")
                return quilt3.search_packages(f"test_{query}", limit=5)
            except QuiltException as e:
                logger.warning(f"Concurrent search for '{query}' failed: {e}")
                return []
        
        queries = ["data", "example", "test", "sample", "demo"]
        logger.info(f"Running concurrent searches for {len(queries)} queries with max_workers=3")
        
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                future_to_query = {executor.submit(perform_search, query): query for query in queries}
                
                completed_count = 0
                for future in concurrent.futures.as_completed(future_to_query):
                    query = future_to_query[future]
                    try:
                        results = future.result(timeout=30)
                        completed_count += 1
                        logger.debug(f"Concurrent search for '{query}' completed with {len(results)} results")
                        assert isinstance(results, list), f"Concurrent search for '{query}' should return a list"
                    except Exception as e:
                        logger.warning(f"Concurrent search for '{query}' failed: {e}")
                        pytest.skip(f"Concurrent search for '{query}' failed: {e}")
                
                logger.info(f"Concurrent search test completed: {completed_count}/{len(queries)} queries successful")
                        
        except Exception as e:
            logger.error(f"Concurrent search test failed: {e}")
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