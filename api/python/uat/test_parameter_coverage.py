#!/usr/bin/env python3
"""
Comprehensive parameter testing for quilt3.search_packages()
Tests all parameters and parameter combinations.
"""

import os
import sys
import yaml
import quilt3
from test_utils import setup_logging, load_config, format_result, test_passed, test_failed

def test_bucket_parameters(config):
    """Test all bucket parameter variations."""
    print("=== BUCKET PARAMETER TESTS ===\n")
    
    buckets_config = config.get('buckets', {})
    public_buckets = [b['name'] for b in buckets_config.get('public', [])]
    
    # Test 1: buckets=None (search all accessible buckets)
    print("1. buckets=None - Search all accessible buckets:")
    try:
        results = quilt3.search_packages(buckets=None, size=5)
        if results.hits:
            test_passed(f"Found {len(results.hits)} results across all buckets")
            for hit in results.hits[:2]:
                print(f"   - {hit.bucket}/{hit.name}")
        else:
            test_failed("No results found for buckets=None")
    except Exception as e:
        test_failed(f"buckets=None failed: {e}")
    
    # Test 2: Single bucket
    if public_buckets:
        test_bucket = public_buckets[0]
        print(f"\n2. buckets=['{test_bucket}'] - Single bucket search:")
        try:
            results = quilt3.search_packages(buckets=[test_bucket], size=5)
            test_passed(f"Found {len(results.hits)} results in {test_bucket}")
            for hit in results.hits[:2]:
                print(f"   - {hit.name}")
                assert hit.bucket == test_bucket, f"Wrong bucket: {hit.bucket}"
        except Exception as e:
            test_failed(f"Single bucket search failed: {e}")
    
    # Test 3: Multiple buckets
    if len(public_buckets) >= 2:
        test_buckets = public_buckets[:2]
        print(f"\n3. buckets={test_buckets} - Multi-bucket search:")
        try:
            results = quilt3.search_packages(buckets=test_buckets, size=5)
            test_passed(f"Found {len(results.hits)} results in {test_buckets}")
            found_buckets = set(hit.bucket for hit in results.hits)
            print(f"   Results from buckets: {list(found_buckets)}")
        except Exception as e:
            test_failed(f"Multi-bucket search failed: {e}")

def test_search_string_parameters(config):
    """Test all search_string parameter variations."""
    print("\n=== SEARCH STRING PARAMETER TESTS ===\n")
    
    search_terms = config.get('search_terms', {})
    
    # Test 1: search_string=None
    print("1. search_string=None - Return all packages:")
    try:
        results = quilt3.search_packages(search_string=None, size=5)
        test_passed(f"Found {len(results.hits)} results with search_string=None")
        for hit in results.hits[:2]:
            print(f"   - {hit.bucket}/{hit.name}")
    except Exception as e:
        test_failed(f"search_string=None failed: {e}")
    
    # Test 2: search_string=""
    print("\n2. search_string='' - Empty string behavior:")
    try:
        results = quilt3.search_packages(search_string="", size=5)
        test_passed(f"Found {len(results.hits)} results with empty search string")
        for hit in results.hits[:2]:
            print(f"   - {hit.bucket}/{hit.name}")
    except Exception as e:
        test_failed(f"Empty search string failed: {e}")
    
    # Test 3: Simple keyword search
    common_terms = search_terms.get('common', [])
    for term_config in common_terms[:2]:  # Test first 2 common terms
        query = term_config['query']
        min_results = term_config.get('min_results', 0)
        
        print(f"\n3. search_string='{query}' - Keyword search:")
        try:
            results = quilt3.search_packages(search_string=query, size=5)
            if len(results.hits) >= min_results:
                test_passed(f"Found {len(results.hits)} results for '{query}' (min: {min_results})")
            else:
                test_failed(f"Found only {len(results.hits)} results for '{query}' (min: {min_results})")
            
            for hit in results.hits[:2]:
                print(f"   - {hit.bucket}/{hit.name} (score: {hit.score:.2f})")
        except Exception as e:
            test_failed(f"Keyword search '{query}' failed: {e}")
    
    # Test 4: Complex multi-word query
    complex_terms = search_terms.get('complex', [])
    if complex_terms:
        query = complex_terms[0]['query']
        print(f"\n4. search_string='{query}' - Multi-word query:")
        try:
            results = quilt3.search_packages(search_string=query, size=5)
            test_passed(f"Multi-word query '{query}' returned {len(results.hits)} results")
            for hit in results.hits[:2]:
                print(f"   - {hit.bucket}/{hit.name} (score: {hit.score:.2f})")
        except Exception as e:
            test_failed(f"Multi-word query '{query}' failed: {e}")

def test_filter_parameters(config):
    """Test filter parameter variations."""
    print("\n=== FILTER PARAMETER TESTS ===\n")
    
    filters_config = config.get('filters', {})
    
    # Test 1: filter=None
    print("1. filter=None - No additional filters:")
    try:
        results = quilt3.search_packages(filter=None, size=3)
        test_passed(f"filter=None returned {len(results.hits)} results")
    except Exception as e:
        test_failed(f"filter=None failed: {e}")
    
    # Test 2: Date filters
    date_filters = filters_config.get('date_filters', [])
    for i, filter_config in enumerate(date_filters[:2], 1):
        filter_dict = filter_config['filter']
        description = filter_config['description']
        
        print(f"\n2.{i} Date filter - {description}:")
        try:
            results = quilt3.search_packages(filter=filter_dict, size=3)
            test_passed(f"Date filter returned {len(results.hits)} results")
            print(f"   Filter: {filter_dict}")
        except Exception as e:
            test_failed(f"Date filter failed: {e}")
    
    # Test 3: Size filters  
    size_filters = filters_config.get('size_filters', [])
    for i, filter_config in enumerate(size_filters[:2], 1):
        filter_dict = filter_config['filter']
        description = filter_config['description']
        
        print(f"\n3.{i} Size filter - {description}:")
        try:
            results = quilt3.search_packages(filter=filter_dict, size=3)
            test_passed(f"Size filter returned {len(results.hits)} results")
            print(f"   Filter: {filter_dict}")
        except Exception as e:
            test_failed(f"Size filter failed: {e}")
    
    # Test 4: Combined filters
    combined_filters = filters_config.get('combined_filters', [])
    if combined_filters:
        filter_config = combined_filters[0]
        filter_dict = filter_config['filter'] 
        description = filter_config['description']
        
        print(f"\n4. Combined filter - {description}:")
        try:
            results = quilt3.search_packages(filter=filter_dict, size=3)
            test_passed(f"Combined filter returned {len(results.hits)} results")
            print(f"   Filter: {filter_dict}")
        except Exception as e:
            test_failed(f"Combined filter failed: {e}")

def test_version_control_parameters(config):
    """Test latest_only parameter."""
    print("\n=== VERSION CONTROL PARAMETER TESTS ===\n")
    
    # Test 1: latest_only=False
    print("1. latest_only=False - All package versions:")
    try:
        results = quilt3.search_packages(latest_only=False, size=5)
        test_passed(f"latest_only=False returned {len(results.hits)} results")
        for hit in results.hits[:2]:
            print(f"   - {hit.bucket}/{hit.name}")
    except Exception as e:
        test_failed(f"latest_only=False failed: {e}")
    
    # Test 2: latest_only=True
    print("\n2. latest_only=True - Only latest versions:")
    try:
        results = quilt3.search_packages(latest_only=True, size=5)
        test_passed(f"latest_only=True returned {len(results.hits)} results") 
        for hit in results.hits[:2]:
            print(f"   - {hit.bucket}/{hit.name}")
    except Exception as e:
        test_failed(f"latest_only=True failed: {e}")

def test_size_parameters(config):
    """Test size parameter variations."""
    print("\n=== SIZE PARAMETER TESTS ===\n")
    
    pagination_config = config.get('pagination', {})
    
    # Test different sizes
    test_sizes = [
        (1, "Minimal results"),
        (pagination_config.get('default_page_size', 30), "Default pagination size"),  
        (5, "Small result set"),
        (50, "Large result set")
    ]
    
    for i, (size, description) in enumerate(test_sizes, 1):
        print(f"{i}. size={size} - {description}:")
        try:
            results = quilt3.search_packages(search_string="", size=size)
            actual_size = len(results.hits)
            if actual_size <= size:
                test_passed(f"Requested {size}, got {actual_size} results")
            else:
                test_failed(f"Requested {size}, got {actual_size} results (too many)")
        except Exception as e:
            test_failed(f"size={size} failed: {e}")

def test_order_parameters(config):
    """Test all order parameter variations.""" 
    print("\n=== ORDER PARAMETER TESTS ===\n")
    
    sort_orders = config.get('sort_orders', [])
    test_query = "data"  # Use consistent query for comparison
    
    for i, order_config in enumerate(sort_orders, 1):
        order = order_config['order']
        description = order_config['description']
        
        print(f"{i}. order='{order}' - {description}:")
        try:
            results = quilt3.search_packages(search_string=test_query, order=order, size=5)
            test_passed(f"order='{order}' returned {len(results.hits)} results")
            
            # Show first few results to demonstrate ordering
            for j, hit in enumerate(results.hits[:3], 1):
                print(f"   {j}. {hit.bucket}/{hit.name} (score: {hit.score:.2f})")
                
        except Exception as e:
            test_failed(f"order='{order}' failed: {e}")

def main():
    """Run comprehensive parameter coverage tests."""
    setup_logging()
    config = load_config()
    
    print("=== COMPREHENSIVE PARAMETER COVERAGE TESTS ===")
    print("Testing ALL search_packages() parameters and combinations\n")
    
    try:
        test_bucket_parameters(config)
        test_search_string_parameters(config)  
        test_filter_parameters(config)
        test_version_control_parameters(config)
        test_size_parameters(config)
        test_order_parameters(config)
        
        print("\n" + "="*60)
        print("✓ Parameter coverage tests completed")
        
    except Exception as e:
        print(f"\n✗ Parameter coverage tests failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()