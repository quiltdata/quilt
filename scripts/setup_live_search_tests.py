#!/usr/bin/env python3
"""
Setup script for live search testing.
Validates environment and prepares test data.
"""

import os
import sys
import subprocess
import quilt3
from quilt3.exceptions import QuiltException


def validate_quilt_login():
    """Check if user is logged into quilt3."""
    try:
        # Try to get the current user to check if logged in
        from quilt3.api import get_user
        user = get_user()
        if user:
            print(f"✓ Logged in as: {user}")
            return True
        else:
            print("✗ Not logged in to quilt3")
            return False
    except Exception as e:
        print(f"✗ Login check failed: {e}")
        print("Please run 'quilt3 login' to authenticate")
        return False


def discover_test_buckets():
    """Find accessible buckets with searchable content."""
    print("\nDiscovering accessible buckets...")
    
    # Check environment variables for test buckets
    test_buckets = {
        'public': os.getenv('QUILT_LIVE_TEST_BUCKET_PUBLIC', 'quilt-example'),
        'private': os.getenv('QUILT_LIVE_TEST_BUCKET_PRIVATE', 'private-test-bucket'),
        'large': os.getenv('QUILT_LIVE_TEST_BUCKET_LARGE', 'large-dataset-bucket')
    }
    
    accessible_buckets = []
    
    for bucket_type, bucket_name in test_buckets.items():
        try:
            # Try to list packages in the bucket to test access
            results = quilt3.search_packages("", bucket=bucket_name, limit=1)
            print(f"✓ {bucket_type.capitalize()} bucket '{bucket_name}' is accessible")
            accessible_buckets.append((bucket_type, bucket_name))
        except QuiltException as e:
            print(f"✗ {bucket_type.capitalize()} bucket '{bucket_name}' not accessible: {e}")
    
    if not accessible_buckets:
        print("✗ No test buckets are accessible")
        return False
    
    print(f"✓ Found {len(accessible_buckets)} accessible test buckets")
    return accessible_buckets


def validate_search_api_availability():
    """Check if search API is accessible."""
    print("\nValidating search API availability...")
    
    try:
        # Try a basic search to ensure API is working
        results = quilt3.search_packages("test", limit=1)
        print(f"✓ Search API is available (returned {len(results)} results)")
        return True
    except QuiltException as e:
        print(f"✗ Search API not available: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error testing search API: {e}")
        return False


def setup_test_data_if_needed():
    """Create test packages if none exist."""
    print("\nChecking for existing test data...")
    
    try:
        # Check if there's any searchable content
        results = quilt3.search_packages("", limit=5)
        if results:
            print(f"✓ Found {len(results)} existing packages for testing")
            return True
        else:
            print("! No existing packages found - tests may have limited data")
            # Could potentially create test packages here if needed
            return True
    except Exception as e:
        print(f"✗ Error checking test data: {e}")
        return False


def check_environment_variables():
    """Check required environment variables."""
    print("\nChecking environment configuration...")
    
    env_vars = {
        'QUILT_REGISTRY_URL': 'Registry URL',
        'QUILT_LIVE_TEST_BUCKET_PUBLIC': 'Public test bucket',
        'QUILT_LIVE_TEST_PERFORMANCE_ITERATIONS': 'Performance test iterations',
        'QUILT_LIVE_TEST_TIMEOUT': 'Test timeout'
    }
    
    for var, description in env_vars.items():
        value = os.getenv(var)
        if value:
            print(f"✓ {description}: {value}")
        else:
            print(f"! {description} not set (will use defaults)")
    
    return True


def main():
    """Main setup validation."""
    print("Quilt3 Live Search Test Setup")
    print("=" * 40)
    
    all_checks_passed = True
    
    # Run all validation checks
    if not validate_quilt_login():
        all_checks_passed = False
    
    if not validate_search_api_availability():
        all_checks_passed = False
    
    accessible_buckets = discover_test_buckets()
    if not accessible_buckets:
        all_checks_passed = False
    
    if not setup_test_data_if_needed():
        all_checks_passed = False
    
    check_environment_variables()
    
    print("\n" + "=" * 40)
    if all_checks_passed:
        print("✓ Setup validation completed successfully")
        print("Ready to run live search tests!")
        
        print("\nTo run tests:")
        print("  python -m pytest tests/integration/test_live_search_*.py -v")
        
        if accessible_buckets:
            print(f"\nAccessible buckets for testing:")
            for bucket_type, bucket_name in accessible_buckets:
                print(f"  {bucket_type}: {bucket_name}")
        
        return 0
    else:
        print("✗ Setup validation failed")
        print("Please resolve the issues above before running tests")
        return 1


if __name__ == "__main__":
    sys.exit(main())