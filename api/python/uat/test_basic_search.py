#!/usr/bin/env python3
"""
Basic search functionality tests for quilt3.search_packages()
Tests core search_string and buckets parameters.
"""

import quilt3

def test_basic_search():
    """Test basic search functionality."""
    print("=== BASIC SEARCH TESTS ===\n")
    
    # Test 1: Empty search (get all packages)
    print("1. Empty search (get all packages):")
    try:
        results = quilt3.search_packages(search_string="", size=5)
        print(f"   Found {len(results.hits)} results")
        for hit in results.hits[:3]:
            print(f"   - {hit.bucket}/{hit.name}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 2: Search for common term
    print("\n2. Search for 'data':")
    try:
        results = quilt3.search_packages(search_string="data", size=5)
        print(f"   Found {len(results.hits)} results")
        for hit in results.hits[:3]:
            print(f"   - {hit.bucket}/{hit.name} (score: {hit.score:.2f})")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 3: Search for specific term
    print("\n3. Search for 'example':")
    try:
        results = quilt3.search_packages(search_string="example", size=5)
        print(f"   Found {len(results.hits)} results")
        for hit in results.hits[:3]:
            print(f"   - {hit.bucket}/{hit.name} (score: {hit.score:.2f})")
    except Exception as e:
        print(f"   Error: {e}")

def test_bucket_filtering():
    """Test bucket filtering functionality."""
    print("\n=== BUCKET FILTERING TESTS ===\n")
    
    # First discover some buckets
    print("Discovering available buckets...")
    try:
        results = quilt3.search_packages(search_string="", size=10)
        buckets = list(set(hit.bucket for hit in results.hits))
        print(f"Found buckets: {buckets[:5]}")
        
        if buckets:
            # Test single bucket filter
            test_bucket = buckets[0]
            print(f"\n1. Search within bucket '{test_bucket}':")
            bucket_results = quilt3.search_packages(buckets=[test_bucket], size=5)
            print(f"   Found {len(bucket_results.hits)} results in {test_bucket}")
            for hit in bucket_results.hits[:3]:
                print(f"   - {hit.name}")
            
            # Test multiple bucket filter
            if len(buckets) > 1:
                test_buckets = buckets[:2]
                print(f"\n2. Search within multiple buckets {test_buckets}:")
                multi_results = quilt3.search_packages(buckets=test_buckets, size=5)
                print(f"   Found {len(multi_results.hits)} results")
                for hit in multi_results.hits[:3]:
                    print(f"   - {hit.bucket}/{hit.name}")
        
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    test_basic_search()
    test_bucket_filtering()