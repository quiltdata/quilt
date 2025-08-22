#!/usr/bin/env python3
"""
Performance tests for quilt3.search_packages()
Tests response times and pagination functionality.
"""

import time
import quilt3

def measure_search_time(search_func, description):
    """Measure time taken for a search operation."""
    print(f"Testing: {description}")
    start_time = time.time()
    try:
        result = search_func()
        end_time = time.time()
        duration = end_time - start_time
        print(f"   Time: {duration:.2f}s")
        print(f"   Results: {len(result.hits)}")
        return result, duration
    except Exception as e:
        end_time = time.time()
        duration = end_time - start_time
        print(f"   Time: {duration:.2f}s (failed)")
        print(f"   Error: {e}")
        return None, duration

def test_search_performance():
    """Test search performance with different query types."""
    print("=== SEARCH PERFORMANCE TESTS ===\n")
    
    # Test 1: Empty search (broadest)
    measure_search_time(
        lambda: quilt3.search_packages(search_string="", size=10),
        "Empty search (size=10)"
    )
    print()
    
    # Test 2: Common term search
    measure_search_time(
        lambda: quilt3.search_packages(search_string="data", size=10),
        "Search for 'data' (size=10)"
    )
    print()
    
    # Test 3: Specific term search
    measure_search_time(
        lambda: quilt3.search_packages(search_string="example", size=10),
        "Search for 'example' (size=10)"
    )
    print()
    
    # Test 4: Large result set
    measure_search_time(
        lambda: quilt3.search_packages(search_string="", size=50),
        "Empty search (size=50)"
    )
    print()

def test_pagination():
    """Test pagination functionality."""
    print("=== PAGINATION TESTS ===\n")
    
    print("1. Initial search with small page size:")
    try:
        initial_results = quilt3.search_packages(search_string="", size=5)
        print(f"   Got {len(initial_results.hits)} results")
        print(f"   Has more pages: {hasattr(initial_results, 'next_cursor') and initial_results.next_cursor is not None}")
        
        if hasattr(initial_results, 'next_cursor') and initial_results.next_cursor:
            print(f"   Next cursor available: {bool(initial_results.next_cursor)}")
            
            print("\n2. Getting next page:")
            start_time = time.time()
            more_results = quilt3.search_more_packages(
                after=initial_results.next_cursor,
                size=5
            )
            end_time = time.time()
            print(f"   Time: {end_time - start_time:.2f}s")
            print(f"   Got {len(more_results.hits)} more results")
            
            # Check if we got different results
            initial_names = {f"{hit.bucket}/{hit.name}" for hit in initial_results.hits}
            more_names = {f"{hit.bucket}/{hit.name}" for hit in more_results.hits}
            overlap = initial_names & more_names
            print(f"   Overlap with first page: {len(overlap)} packages")
            
    except Exception as e:
        print(f"   Error: {e}")

def test_concurrent_searches():
    """Test multiple searches in sequence to check consistency."""
    print("\n=== CONSISTENCY TESTS ===\n")
    
    print("Running same search 3 times to check consistency:")
    
    results_list = []
    times = []
    
    for i in range(3):
        result, duration = measure_search_time(
            lambda: quilt3.search_packages(search_string="data", size=5),
            f"Search iteration {i+1}"
        )
        if result:
            results_list.append(result)
            times.append(duration)
        print()
    
    # Analyze consistency
    if len(results_list) >= 2:
        print("Consistency analysis:")
        first_results = {f"{hit.bucket}/{hit.name}" for hit in results_list[0].hits}
        
        for i, result in enumerate(results_list[1:], 2):
            current_results = {f"{hit.bucket}/{hit.name}" for hit in result.hits}
            overlap = first_results & current_results
            print(f"   Run {i} vs Run 1: {len(overlap)}/{len(first_results)} packages match")
        
        print(f"   Average response time: {sum(times)/len(times):.2f}s")
        print(f"   Min/Max response time: {min(times):.2f}s / {max(times):.2f}s")

def test_size_scaling():
    """Test how performance scales with result size."""
    print("\n=== SIZE SCALING TESTS ===\n")
    
    sizes = [1, 5, 10, 20, 30]
    
    for size in sizes:
        result, duration = measure_search_time(
            lambda s=size: quilt3.search_packages(search_string="", size=s),
            f"Size {size}"
        )
        if result:
            print(f"   Rate: {len(result.hits)/duration:.1f} results/second")
        print()

if __name__ == "__main__":
    test_search_performance()
    test_pagination()
    test_concurrent_searches()
    test_size_scaling()