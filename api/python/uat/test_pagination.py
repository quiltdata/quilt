#!/usr/bin/env python3
"""
Pagination functionality tests for search_more_packages()
Tests the complete pagination workflow.
"""

import sys

from test_utils import (
    exit_with_test_results,
    format_result,
    load_config,
    reset_test_state,
    setup_logging,
    test_failed,
    test_passed,
    validate_result_structure,
)

import quilt3


def test_pagination_workflow(config):
    """Test complete pagination workflow from start to finish."""
    print("=== PAGINATION WORKFLOW TESTS ===\n")
    
    pagination_config = config.get('pagination', {})
    small_page_size = pagination_config.get('small_page_size', 2)
    test_query = pagination_config.get('test_query', "")
    
    print("1. Multi-step pagination workflow:")
    print(f"   Using small page size ({small_page_size}) to force pagination")
    
    try:
        # Step 1: Initial search with small page size
        print("   Step 1: Initial search_packages() call...")
        initial_results = quilt3.search_packages(
            search_string=test_query, 
            size=small_page_size
        )
        
        if not validate_result_structure(initial_results, "Initial search"):
            return False
            
        print(f"   ✅ Initial search returned {len(initial_results.hits)} results")
        print(f"      has_next: {initial_results.has_next}")
        
        if not initial_results.has_next:
            test_warning("No additional pages available for pagination testing")
            return True
        
        # Step 2: Get next page using search_more_packages
        print("   Step 2: Calling search_more_packages()...")
        next_results = quilt3.search_more_packages(
            after=initial_results.next_cursor,
            size=small_page_size
        )
        
        if not validate_result_structure(next_results, "Next page"):
            return False
            
        print(f"   ✅ Next page returned {len(next_results.hits)} results")
        print(f"      has_next: {next_results.has_next}")
        
        # Step 3: Verify no duplicate results
        initial_keys = set((hit.bucket, hit.key) for hit in initial_results.hits)
        next_keys = set((hit.bucket, hit.key) for hit in next_results.hits)
        
        duplicates = initial_keys.intersection(next_keys)
        if duplicates:
            test_failed(f"Found duplicate results across pages: {duplicates}")
            return False
        else:
            test_passed("No duplicate results across pages")
        
        # Step 4: Continue pagination if more pages available
        all_results = list(initial_results.hits) + list(next_results.hits)
        current_results = next_results
        page_count = 2
        max_pages = 5  # Limit to prevent infinite loops
        
        while current_results.has_next and page_count < max_pages:
            print(f"   Step {page_count + 1}: Getting page {page_count + 1}...")
            
            current_results = quilt3.search_more_packages(
                after=current_results.next_cursor,
                size=small_page_size
            )
            
            if not validate_result_structure(current_results, f"Page {page_count + 1}"):
                return False
                
            all_results.extend(current_results.hits)
            page_count += 1
            
            print(f"   ✅ Page {page_count} returned {len(current_results.hits)} results")
        
        print(f"   ✅ Paginated through {page_count} pages, total {len(all_results)} results")
        
        # Verify all results are unique
        all_keys = [(hit.bucket, hit.key) for hit in all_results]
        unique_keys = set(all_keys)
        
        if len(all_keys) != len(unique_keys):
            test_failed(f"Duplicate results found: {len(all_keys)} total, {len(unique_keys)} unique")
            return False
        else:
            test_passed(f"All {len(all_results)} results are unique across all pages")
        
        return True
        
    except Exception as e:
        test_failed(f"Pagination workflow failed: {e}")
        return False

def test_pagination_edge_cases(config):
    """Test pagination edge cases and error conditions."""
    print("\n=== PAGINATION EDGE CASES ===\n")
    
    # Test 1: search_more_packages with invalid cursor
    print("1. Invalid cursor handling:")
    try:
        results = quilt3.search_more_packages(after="invalid-cursor-12345", size=5)
        test_failed("search_more_packages should fail with invalid cursor")
    except Exception as e:
        test_passed(f"Correctly handled invalid cursor: {type(e).__name__}")
    
    # Test 2: search_more_packages with empty cursor
    print("\n2. Empty cursor handling:")
    try:
        results = quilt3.search_more_packages(after="", size=5)
        test_failed("search_more_packages should fail with empty cursor")
    except Exception as e:
        test_passed(f"Correctly handled empty cursor: {type(e).__name__}")
    
    # Test 3: search_more_packages with None cursor
    print("\n3. None cursor handling:")
    try:
        results = quilt3.search_more_packages(after=None, size=5)
        test_failed("search_more_packages should fail with None cursor")
    except Exception as e:
        test_passed(f"Correctly handled None cursor: {type(e).__name__}")
    
    # Test 4: Different page sizes in pagination
    print("\n4. Mixed page sizes in pagination:")
    try:
        # Start with small page
        initial = quilt3.search_packages(search_string="", size=2)
        
        if initial.has_next:
            # Continue with larger page
            next_page = quilt3.search_more_packages(after=initial.next_cursor, size=5)
            test_passed(f"Mixed page sizes work: {len(initial.hits)} -> {len(next_page.hits)}")
        else:
            test_warning("Not enough results to test mixed page sizes")
            
    except Exception as e:
        test_failed(f"Mixed page sizes failed: {e}")

def test_pagination_consistency(config):
    """Test pagination consistency and repeatability."""
    print("\n=== PAGINATION CONSISTENCY TESTS ===\n")
    
    # Test 1: Repeated pagination calls return same results
    print("1. Pagination consistency:")
    try:
        # First pagination sequence
        initial1 = quilt3.search_packages(search_string="", size=3)
        
        if initial1.has_next:
            next1 = quilt3.search_more_packages(after=initial1.next_cursor, size=3)
            
            # Second pagination sequence with same parameters
            initial2 = quilt3.search_packages(search_string="", size=3)
            next2 = quilt3.search_more_packages(after=initial2.next_cursor, size=3)
            
            # Compare results
            keys1 = [(hit.bucket, hit.key) for hit in initial1.hits + next1.hits]
            keys2 = [(hit.bucket, hit.key) for hit in initial2.hits + next2.hits]
            
            if keys1 == keys2:
                test_passed("Pagination returns consistent results across calls")
            else:
                test_warning("Pagination results differ between calls (may be due to data changes)")
                
        else:
            test_warning("Not enough results to test pagination consistency")
            
    except Exception as e:
        test_failed(f"Pagination consistency test failed: {e}")

def test_pagination_with_different_parameters(config):
    """Test pagination combined with different search parameters.""" 
    print("\n=== PAGINATION WITH PARAMETERS ===\n")
    
    buckets_config = config.get('buckets', {})
    public_buckets = [b['name'] for b in buckets_config.get('public', [])]
    
    # Test 1: Pagination with bucket filtering
    if public_buckets:
        test_bucket = public_buckets[0]
        print(f"1. Pagination with bucket filtering (bucket: {test_bucket}):")
        try:
            initial = quilt3.search_packages(buckets=[test_bucket], size=2)
            
            if initial.has_next:
                next_page = quilt3.search_more_packages(after=initial.next_cursor, size=2)
                
                # Verify all results are from the correct bucket
                all_results = initial.hits + next_page.hits
                wrong_bucket = [hit for hit in all_results if hit.bucket != test_bucket]
                
                if wrong_bucket:
                    test_failed(f"Found results from wrong buckets: {[hit.bucket for hit in wrong_bucket]}")
                else:
                    test_passed(f"All paginated results are from bucket '{test_bucket}'")
            else:
                test_warning(f"Not enough results in bucket '{test_bucket}' for pagination test")
                
        except Exception as e:
            test_failed(f"Pagination with bucket filtering failed: {e}")
    
    # Test 2: Pagination with search query
    print("\n2. Pagination with search query:")
    try:
        initial = quilt3.search_packages(search_string="data", size=2)
        
        if initial.has_next:
            next_page = quilt3.search_more_packages(after=initial.next_cursor, size=2)
            test_passed(f"Pagination with search query returned {len(initial.hits) + len(next_page.hits)} results")
        else:
            test_warning("Not enough results for search query pagination test")
            
    except Exception as e:
        test_failed(f"Pagination with search query failed: {e}")
    
    # Test 3: Pagination with different sort orders
    print("\n3. Pagination with sort orders:")
    for order in ["NEWEST", "OLDEST"]:
        try:
            initial = quilt3.search_packages(search_string="", order=order, size=2)
            
            if initial.has_next:
                next_page = quilt3.search_more_packages(after=initial.next_cursor, size=2)
                test_passed(f"Pagination with order='{order}' works")
            else:
                test_warning(f"Not enough results for order='{order}' pagination test")
                
        except Exception as e:
            test_failed(f"Pagination with order='{order}' failed: {e}")

def test_warning(message):
    """Print a test warning message."""
    print(f"   ⚠️  {message}")

def main():
    """Run pagination functionality tests."""
    reset_test_state()
    setup_logging()
    config = load_config()
    
    print("=== PAGINATION FUNCTIONALITY TESTS ===")
    print("Testing search_more_packages() and complete pagination workflow\n")
    
    try:
        success = True
        
        success &= test_pagination_workflow(config)
        test_pagination_edge_cases(config)
        test_pagination_consistency(config) 
        test_pagination_with_different_parameters(config)
        
        print("\n" + "="*60)
        if success:
            print("✅ Pagination tests completed successfully")
        else:
            print("❌ Some pagination tests had issues")
        exit_with_test_results()
        
    except Exception as e:
        print(f"\n✗ Pagination tests failed: {e}")
        exit_with_test_results()

if __name__ == "__main__":
    main()