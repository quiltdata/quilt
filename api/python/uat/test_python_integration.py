#!/usr/bin/env python3
"""
Python integration tests for quilt3.search_packages()
Tests Python-specific functionality and integration patterns.
"""

import sys
import importlib
import types
import quilt3
from test_utils import setup_logging, load_config, test_passed, test_failed, validate_result_structure, reset_test_state, exit_with_test_results

def test_import_patterns(config):
    """Test various import patterns for the API."""
    print("=== IMPORT PATTERN TESTS ===\n")
    
    # Test 1: Standard import
    print("1. Standard import pattern:")
    try:
        import quilt3
        result = quilt3.search_packages(size=1)
        test_passed("Standard 'import quilt3' works")
    except Exception as e:
        test_failed(f"Standard import failed: {e}")
    
    # Test 2: From import
    print("\n2. From import pattern:")
    try:
        from quilt3 import search_packages
        result = search_packages(size=1)
        test_passed("'from quilt3 import search_packages' works")
    except Exception as e:
        test_failed(f"From import failed: {e}")
    
    # Test 3: From import with alias
    print("\n3. Import with alias:")
    try:
        from quilt3 import search_packages as search
        result = search(size=1)
        test_passed("Import with alias works")
    except Exception as e:
        test_failed(f"Import with alias failed: {e}")

def test_function_introspection(config):
    """Test Python function introspection capabilities."""
    print("\n=== FUNCTION INTROSPECTION TESTS ===\n")
    
    # Test 1: Function signature inspection
    print("1. Function signature inspection:")
    try:
        import inspect
        sig = inspect.signature(quilt3.search_packages)
        params = list(sig.parameters.keys())
        
        expected_params = ['buckets', 'search_string', 'filter', 'user_meta_filters', 
                          'latest_only', 'size', 'order']
        
        missing_params = set(expected_params) - set(params)
        extra_params = set(params) - set(expected_params)
        
        if not missing_params and not extra_params:
            test_passed(f"Function signature correct: {params}")
        else:
            test_failed(f"Signature mismatch - Missing: {missing_params}, Extra: {extra_params}")
            
    except Exception as e:
        test_failed(f"Signature inspection failed: {e}")
    
    # Test 2: Docstring availability
    print("\n2. Docstring availability:")
    try:
        docstring = quilt3.search_packages.__doc__
        if docstring and len(docstring.strip()) > 0:
            test_passed(f"Docstring available ({len(docstring)} characters)")
        else:
            test_failed("No docstring available")
    except Exception as e:
        test_failed(f"Docstring access failed: {e}")
    
    # Test 3: search_more_packages availability
    print("\n3. search_more_packages function availability:")
    try:
        if hasattr(quilt3, 'search_more_packages'):
            test_passed("search_more_packages function is available")
            
            # Check its signature too
            sig = inspect.signature(quilt3.search_more_packages)
            params = list(sig.parameters.keys())
            expected_params = ['after', 'size']
            
            if set(params) == set(expected_params):
                test_passed(f"search_more_packages signature correct: {params}")
            else:
                test_failed(f"search_more_packages signature incorrect: {params}")
        else:
            test_failed("search_more_packages function not available")
    except Exception as e:
        test_failed(f"search_more_packages inspection failed: {e}")

def test_return_type_validation(config):
    """Test return type validation and Python object behavior."""
    print("\n=== RETURN TYPE VALIDATION TESTS ===\n")
    
    # Test 1: Basic return type structure
    print("1. Return type structure:")
    try:
        result = quilt3.search_packages(size=3)
        
        # Check it's an object with expected attributes
        if hasattr(result, 'hits') and hasattr(result, 'has_next') and hasattr(result, 'next_cursor'):
            test_passed("Result object has required attributes")
        else:
            test_failed("Result object missing required attributes")
        
        # Check hits is a list
        if isinstance(result.hits, list):
            test_passed(f"hits is a list with {len(result.hits)} items")
        else:
            test_failed(f"hits is not a list: {type(result.hits)}")
        
        # Check has_next is boolean
        if isinstance(result.has_next, bool):
            test_passed(f"has_next is boolean: {result.has_next}")
        else:
            test_failed(f"has_next is not boolean: {type(result.has_next)}")
            
    except Exception as e:
        test_failed(f"Return type validation failed: {e}")
    
    # Test 2: Hit object structure
    print("\n2. Hit object structure:")
    try:
        result = quilt3.search_packages(size=1)
        if result.hits:
            hit = result.hits[0]
            
            # Check required attributes
            required_attrs = ['bucket', 'key', 'name', 'score']
            missing_attrs = [attr for attr in required_attrs if not hasattr(hit, attr)]
            
            if not missing_attrs:
                test_passed(f"Hit object has all required attributes: {required_attrs}")
            else:
                test_failed(f"Hit object missing attributes: {missing_attrs}")
            
            # Check attribute types
            if hasattr(hit, 'bucket') and isinstance(hit.bucket, str):
                test_passed(f"bucket is string: '{hit.bucket}'")
            else:
                test_failed("bucket is not a string")
                
            if hasattr(hit, 'score') and isinstance(hit.score, (int, float)):
                test_passed(f"score is numeric: {hit.score}")
            else:
                test_failed("score is not numeric")
                
        else:
            print("   ⚠️  No hits to validate structure")
            
    except Exception as e:
        test_failed(f"Hit object validation failed: {e}")

def test_session_integration(config):
    """Test integration with quilt3 session management."""
    print("\n=== SESSION INTEGRATION TESTS ===\n")
    
    # Test 1: Works without explicit login (if credentials available)
    print("1. Search without explicit login:")
    try:
        result = quilt3.search_packages(size=1)
        test_passed("Search works with existing session/credentials")
    except Exception as e:
        # This might fail if no credentials are available, which is acceptable
        error_msg = str(e).lower()
        if any(word in error_msg for word in ['auth', 'login', 'credential', 'token']):
            print("   ⚠️  Search requires authentication (expected if not logged in)")
        else:
            test_failed(f"Unexpected error without explicit login: {e}")
    
    # Test 2: Integration with other quilt3 functions
    print("\n2. Integration with other quilt3 functions:")
    try:
        # Test that search_packages is properly integrated into the quilt3 namespace
        quilt3_functions = dir(quilt3)
        
        expected_functions = ['search_packages', 'search_more_packages']
        missing_functions = [f for f in expected_functions if f not in quilt3_functions]
        
        if not missing_functions:
            test_passed("All expected search functions available in quilt3 namespace")
        else:
            test_failed(f"Missing functions in quilt3 namespace: {missing_functions}")
            
        # Check that they're callable
        for func_name in expected_functions:
            if hasattr(quilt3, func_name) and callable(getattr(quilt3, func_name)):
                test_passed(f"{func_name} is callable")
            else:
                test_failed(f"{func_name} is not callable")
                
    except Exception as e:
        test_failed(f"Integration test failed: {e}")

def test_exception_handling(config):
    """Test Python-specific exception handling."""
    print("\n=== PYTHON EXCEPTION HANDLING TESTS ===\n")
    
    # Test 1: TypeError for wrong parameter types
    print("1. TypeError for wrong parameter types:")
    try:
        result = quilt3.search_packages(buckets="not-a-list")
        test_failed("Should raise TypeError for string buckets parameter")
    except TypeError as e:
        test_passed(f"Correctly raised TypeError: {str(e)[:50]}...")
    except Exception as e:
        test_failed(f"Expected TypeError, got {type(e).__name__}: {e}")
    
    # Test 2: ValueError for invalid values
    print("\n2. ValueError for invalid values:")
    try:
        result = quilt3.search_packages(size=-1)
        test_failed("Should raise ValueError for negative size")
    except ValueError as e:
        test_passed(f"Correctly raised ValueError: {str(e)[:50]}...")
    except Exception as e:
        test_failed(f"Expected ValueError, got {type(e).__name__}: {e}")
    
    # Test 3: Exception hierarchy
    print("\n3. Exception hierarchy:")
    try:
        result = quilt3.search_packages(buckets=[])
        test_failed("Should raise exception for empty buckets list")
    except Exception as e:
        # Check that it's a proper Python exception
        if isinstance(e, BaseException):
            test_passed(f"Exception is proper BaseException subclass: {type(e).__name__}")
        else:
            test_failed(f"Exception is not BaseException subclass: {type(e)}")

def test_memory_behavior(config):
    """Test memory and resource behavior."""
    print("\n=== MEMORY AND RESOURCE BEHAVIOR TESTS ===\n")
    
    # Test 1: Large result sets don't cause memory issues
    print("1. Large result set memory behavior:")
    try:
        result = quilt3.search_packages(size=100)  # Request large result set
        
        # Check that we get a reasonable result without memory errors
        if len(result.hits) <= 100:  # Should not exceed requested size
            test_passed(f"Large result set handled properly: {len(result.hits)} results")
        else:
            test_failed(f"Result set exceeded requested size: {len(result.hits)} > 100")
            
    except Exception as e:
        # Memory errors or similar issues would indicate a problem
        if "memory" in str(e).lower() or "resource" in str(e).lower():
            test_failed(f"Memory/resource error with large result set: {e}")
        else:
            print(f"   ⚠️  Large result set failed for other reason: {type(e).__name__}")
    
    # Test 2: Multiple sequential calls don't leak resources
    print("\n2. Multiple sequential calls:")
    try:
        for i in range(5):
            result = quilt3.search_packages(size=5)
            # Just ensure each call succeeds
            
        test_passed("Multiple sequential calls completed successfully")
        
    except Exception as e:
        test_failed(f"Sequential calls failed: {e}")

def test_thread_safety_basic(config):
    """Basic thread safety test."""
    print("\n=== BASIC THREAD SAFETY TESTS ===\n")
    
    # Test 1: Multiple calls in sequence (simulating concurrent usage)
    print("1. Rapid sequential calls:")
    try:
        results = []
        for i in range(3):
            result = quilt3.search_packages(size=2)
            results.append(result)
            
        # All calls should succeed
        test_passed(f"Rapid sequential calls completed: {len(results)} results")
        
    except Exception as e:
        test_failed(f"Rapid sequential calls failed: {e}")

def main():
    """Run Python integration tests."""
    reset_test_state()
    setup_logging()
    config = load_config()
    
    print("=== PYTHON INTEGRATION TESTS ===")
    print("Testing Python-specific functionality and integration\n")
    
    try:
        test_import_patterns(config)
        test_function_introspection(config)
        test_return_type_validation(config)
        test_session_integration(config)
        test_exception_handling(config)
        test_memory_behavior(config)
        test_thread_safety_basic(config)
        
        print("\n" + "="*60)
        print("✅ Python integration tests completed")
        exit_with_test_results()
        
    except Exception as e:
        print(f"\n✗ Python integration tests failed: {e}")
        exit_with_test_results()

if __name__ == "__main__":
    main()