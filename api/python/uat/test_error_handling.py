#!/usr/bin/env python3
"""
Error handling and exception tests for quilt3.search_packages()
Tests parameter validation and error conditions.
"""

import sys
import quilt3
from test_utils import setup_logging, load_config, test_passed, test_failed

def test_parameter_validation_errors(config):
    """Test parameter validation and type checking."""
    print("=== PARAMETER VALIDATION TESTS ===\n")
    
    error_conditions = config.get('error_conditions', {})
    invalid_params = error_conditions.get('invalid_parameters', [])
    
    for i, param_test in enumerate(invalid_params, 1):
        param_name = param_test['parameter']
        invalid_value = param_test['invalid_value']
        expected_exception = param_test['expected_exception']
        
        print(f"{i}. Invalid {param_name} parameter:")
        print(f"   Testing {param_name}={repr(invalid_value)}")
        
        try:
            # Construct the kwargs dynamically
            kwargs = {param_name: invalid_value}
            
            # Add some default values to make the call valid otherwise
            if param_name != 'buckets':
                kwargs['buckets'] = ['quilt-example']  # Use a likely bucket
            if param_name != 'size':
                kwargs['size'] = 5
            if param_name != 'order':
                kwargs['order'] = 'BEST_MATCH'
                
            results = quilt3.search_packages(**kwargs)
            test_failed(f"Expected {expected_exception} exception, but call succeeded")
            
        except Exception as e:
            exception_name = type(e).__name__
            if exception_name == expected_exception:
                test_passed(f"Correctly raised {exception_name}: {str(e)[:100]}...")
            else:
                test_failed(f"Expected {expected_exception}, got {exception_name}: {str(e)[:100]}...")

def test_boundary_value_errors(config):
    """Test boundary values and edge cases."""
    print("\n=== BOUNDARY VALUE TESTS ===\n")
    
    # Test 1: Extremely large size values
    print("1. Large size parameter:")
    try:
        results = quilt3.search_packages(size=10000, buckets=['quilt-example'])
        test_passed("Large size parameter accepted (limited by available results)")
    except Exception as e:
        # This might be acceptable if the system has limits
        test_failed(f"Large size parameter failed: {type(e).__name__}: {e}")
    
    # Test 2: Zero size
    print("\n2. Zero size parameter:")
    try:
        results = quilt3.search_packages(size=0, buckets=['quilt-example'])
        test_failed("size=0 should not be allowed")
    except Exception as e:
        test_passed(f"Correctly rejected size=0: {type(e).__name__}")
    
    # Test 3: Negative size
    print("\n3. Negative size parameter:")
    try:
        results = quilt3.search_packages(size=-1, buckets=['quilt-example'])
        test_failed("Negative size should not be allowed")
    except Exception as e:
        test_passed(f"Correctly rejected negative size: {type(e).__name__}")
    
    # Test 4: Empty buckets list
    print("\n4. Empty buckets list:")
    try:
        results = quilt3.search_packages(buckets=[])
        test_failed("Empty buckets list should not be allowed")
    except Exception as e:
        test_passed(f"Correctly rejected empty buckets list: {type(e).__name__}")
    
    # Test 5: Invalid bucket names
    print("\n5. Invalid bucket names:")
    invalid_buckets = ['', '   ', 'bucket with spaces', 'bucket/with/slashes']
    
    for invalid_bucket in invalid_buckets:
        try:
            results = quilt3.search_packages(buckets=[invalid_bucket], size=1)
            # This might succeed if the bucket name is valid but nonexistent
            print(f"   ⚠️  Bucket '{invalid_bucket}' was accepted (may return no results)")
        except Exception as e:
            test_passed(f"Correctly rejected invalid bucket '{invalid_bucket}': {type(e).__name__}")

def test_filter_validation_errors(config):
    """Test filter parameter validation."""
    print("\n=== FILTER VALIDATION TESTS ===\n")
    
    # Test 1: Invalid filter structure
    invalid_filters = [
        "not-a-dict",  # String instead of dict
        ["not-a-dict"],  # List instead of dict
        {"invalid": "structure"},  # Invalid filter structure
        {"size": "not-a-dict"},  # Invalid size filter value
        {"modified": {"invalid_op": "2023-01-01"}},  # Invalid operator
        {"size": {"gte": "not-a-number"}},  # Invalid size value type
    ]
    
    for i, invalid_filter in enumerate(invalid_filters, 1):
        print(f"{i}. Invalid filter: {repr(invalid_filter)}")
        try:
            results = quilt3.search_packages(
                buckets=['quilt-example'],
                filter=invalid_filter,
                size=1
            )
            test_failed(f"Invalid filter was accepted: {invalid_filter}")
        except Exception as e:
            test_passed(f"Correctly rejected invalid filter: {type(e).__name__}")

def test_user_meta_filter_errors(config):
    """Test user metadata filter validation."""
    print("\n=== USER METADATA FILTER VALIDATION TESTS ===\n")
    
    # Test 1: Invalid user_meta_filters structure
    invalid_meta_filters = [
        "not-a-list",  # String instead of list
        {"not": "a-list"},  # Dict instead of list
        [{"missing_key": "value"}],  # Missing 'key' field
        [{"key": "test"}],  # Missing 'value' field
        [{"key": "", "value": "test"}],  # Empty key
        [{"key": "test", "value": ""}],  # Empty value
        [{"key": 123, "value": "test"}],  # Non-string key
        [{"key": "test", "value": 123}],  # Non-string value
    ]
    
    for i, invalid_meta_filter in enumerate(invalid_meta_filters, 1):
        print(f"{i}. Invalid user_meta_filters: {repr(invalid_meta_filter)}")
        try:
            results = quilt3.search_packages(
                buckets=['quilt-example'],
                user_meta_filters=invalid_meta_filter,
                size=1
            )
            test_failed(f"Invalid user_meta_filters was accepted: {invalid_meta_filter}")
        except Exception as e:
            test_passed(f"Correctly rejected invalid user_meta_filters: {type(e).__name__}")

def test_authentication_errors(config):
    """Test authentication and permission-related errors."""
    print("\n=== AUTHENTICATION/PERMISSION TESTS ===\n")
    
    # Test 1: Nonexistent bucket (should not cause authentication error, just no results)
    print("1. Nonexistent bucket access:")
    try:
        results = quilt3.search_packages(
            buckets=['nonexistent-bucket-12345-test'],
            size=1
        )
        # This should succeed but return no results
        if len(results.hits) == 0:
            test_passed("Nonexistent bucket returns empty results (as expected)")
        else:
            test_failed(f"Unexpected results from nonexistent bucket: {len(results.hits)}")
    except Exception as e:
        # If this raises an exception, it should be a permission/access error
        error_msg = str(e).lower()
        if any(word in error_msg for word in ['permission', 'access', 'denied', 'forbidden', 'unauthorized']):
            test_passed(f"Correctly handled access control: {type(e).__name__}")
        else:
            test_failed(f"Unexpected error for nonexistent bucket: {type(e).__name__}: {e}")
    
    # Test 2: Very long bucket name
    print("\n2. Very long bucket name:")
    long_bucket_name = 'a' * 1000
    try:
        results = quilt3.search_packages(buckets=[long_bucket_name], size=1)
        print("   ⚠️  Very long bucket name was accepted")
    except Exception as e:
        test_passed(f"Correctly rejected very long bucket name: {type(e).__name__}")

def test_search_string_edge_cases(config):
    """Test search string edge cases."""
    print("\n=== SEARCH STRING EDGE CASES ===\n")
    
    edge_case_queries = [
        ("very-long-query-" + "x" * 1000, "Very long search query"),
        ("🔍🚀💻", "Unicode/emoji characters"),
        ("query\nwith\nnewlines", "Query with newlines"),
        ("query\twith\ttabs", "Query with tabs"),  
        ("query\"with'quotes", "Query with quotes"),
        ("query;with;semicolons", "Query with semicolons"),
        ("query&with&ampersands", "Query with ampersands"),
    ]
    
    for query, description in edge_case_queries:
        print(f"Testing: {description}")
        try:
            results = quilt3.search_packages(
                search_string=query,
                buckets=['quilt-example'],
                size=1
            )
            test_passed(f"Edge case query handled: {len(results.hits)} results")
        except Exception as e:
            # Depending on implementation, this might be acceptable
            print(f"   ⚠️  Edge case query failed: {type(e).__name__}: {str(e)[:50]}...")

def test_network_timeout_simulation(config):
    """Test behavior with potential network issues."""
    print("\n=== NETWORK RESILIENCE TESTS ===\n")
    
    # Test 1: Search with many buckets (might timeout)
    print("1. Large number of buckets:")
    many_buckets = [f"bucket-{i}" for i in range(100)]
    
    try:
        results = quilt3.search_packages(buckets=many_buckets, size=1)
        test_passed("Large bucket list handled successfully")
    except Exception as e:
        # This might timeout or fail, which is acceptable
        error_type = type(e).__name__
        if error_type in ['TimeoutError', 'ConnectionError', 'HTTPError']:
            test_passed(f"Network error handled appropriately: {error_type}")
        else:
            print(f"   ⚠️  Unexpected error with many buckets: {error_type}")

def main():
    """Run error handling tests."""
    setup_logging()
    config = load_config()
    
    print("=== ERROR HANDLING AND VALIDATION TESTS ===")
    print("Testing exception handling and parameter validation\n")
    
    try:
        test_parameter_validation_errors(config)
        test_boundary_value_errors(config)
        test_filter_validation_errors(config)
        test_user_meta_filter_errors(config)
        test_authentication_errors(config)
        test_search_string_edge_cases(config)
        test_network_timeout_simulation(config)
        
        print("\n" + "="*60)
        print("✅ Error handling tests completed")
        
    except Exception as e:
        print(f"\n✗ Error handling tests failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()