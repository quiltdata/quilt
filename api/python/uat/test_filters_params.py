#!/usr/bin/env python3
"""
Test filters and parameter variations for quilt3.search_packages()
Tests order, size, latest_only, filter, and user_meta_filters parameters.
"""

import quilt3
from datetime import datetime, timedelta

def test_ordering():
    """Test different ordering options."""
    print("=== ORDERING TESTS ===\n")
    
    orders = ["BEST_MATCH", "NEWEST", "OLDEST", "LEX_ASC", "LEX_DESC"]
    
    for order in orders:
        print(f"Testing order: {order}")
        try:
            results = quilt3.search_packages(search_string="data", order=order, size=3)
            print(f"   Found {len(results.hits)} results")
            for i, hit in enumerate(results.hits[:2]):
                modified = hit.modified.strftime('%Y-%m-%d') if hasattr(hit.modified, 'strftime') else str(hit.modified)
                print(f"   {i+1}. {hit.name} (modified: {modified})")
        except Exception as e:
            print(f"   Error: {e}")
        print()

def test_size_parameter():
    """Test size parameter."""
    print("=== SIZE PARAMETER TESTS ===\n")
    
    sizes = [1, 5, 10, 20]
    
    for size in sizes:
        print(f"Testing size: {size}")
        try:
            results = quilt3.search_packages(search_string="", size=size)
            print(f"   Requested: {size}, Got: {len(results.hits)}")
        except Exception as e:
            print(f"   Error: {e}")
        print()

def test_latest_only():
    """Test latest_only parameter."""
    print("=== LATEST_ONLY TESTS ===\n")
    
    print("1. All versions:")
    try:
        results_all = quilt3.search_packages(search_string="data", latest_only=False, size=5)
        print(f"   Found {len(results_all.hits)} results (all versions)")
        
        # Group by package name to see versions
        packages = {}
        for hit in results_all.hits:
            key = f"{hit.bucket}/{hit.name}"
            if key not in packages:
                packages[key] = []
            packages[key].append(hit)
        
        for pkg_name, versions in list(packages.items())[:3]:
            print(f"   {pkg_name}: {len(versions)} version(s)")
            
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n2. Latest only:")
    try:
        results_latest = quilt3.search_packages(search_string="data", latest_only=True, size=5)
        print(f"   Found {len(results_latest.hits)} results (latest only)")
        for hit in results_latest.hits[:3]:
            print(f"   - {hit.bucket}/{hit.name}")
    except Exception as e:
        print(f"   Error: {e}")

def test_date_filters():
    """Test date-based filters."""
    print("\n=== DATE FILTER TESTS ===\n")
    
    # Test recent packages (last 30 days)
    print("1. Packages modified in last 30 days:")
    try:
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        results = quilt3.search_packages(
            search_string="",
            filter={"modified": {"gte": thirty_days_ago}},
            size=5
        )
        print(f"   Found {len(results.hits)} recent packages")
        for hit in results.hits[:3]:
            modified = hit.modified.strftime('%Y-%m-%d') if hasattr(hit.modified, 'strftime') else str(hit.modified)
            print(f"   - {hit.bucket}/{hit.name} (modified: {modified})")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test older packages (before last year)
    print("\n2. Packages modified before last year:")
    try:
        one_year_ago = (datetime.now() - timedelta(days=365)).isoformat()
        results = quilt3.search_packages(
            search_string="",
            filter={"modified": {"lt": one_year_ago}},
            size=5
        )
        print(f"   Found {len(results.hits)} older packages")
        for hit in results.hits[:3]:
            modified = hit.modified.strftime('%Y-%m-%d') if hasattr(hit.modified, 'strftime') else str(hit.modified)
            print(f"   - {hit.bucket}/{hit.name} (modified: {modified})")
    except Exception as e:
        print(f"   Error: {e}")

def test_combined_filters():
    """Test combining multiple parameters."""
    print("\n=== COMBINED FILTER TESTS ===\n")
    
    print("1. Combine search_string + buckets + size + order:")
    try:
        # First get some buckets
        all_results = quilt3.search_packages(search_string="", size=10)
        if all_results.hits:
            test_bucket = all_results.hits[0].bucket
            
            results = quilt3.search_packages(
                search_string="data",
                buckets=[test_bucket],
                size=3,
                order="NEWEST"
            )
            print(f"   Found {len(results.hits)} results in {test_bucket} for 'data'")
            for hit in results.hits:
                modified = hit.modified.strftime('%Y-%m-%d') if hasattr(hit.modified, 'strftime') else str(hit.modified)
                print(f"   - {hit.name} (modified: {modified})")
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    test_ordering()
    test_size_parameter()
    test_latest_only()
    test_date_filters()
    test_combined_filters()