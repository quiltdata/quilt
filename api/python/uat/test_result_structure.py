#!/usr/bin/env python3
"""
Result structure validation tests for quilt3.search_packages()
Tests return object structure and properties.
"""

import sys
import quilt3
from test_utils import setup_logging, load_config, test_passed, test_failed, validate_result_structure, validate_hit_structure, reset_test_state, exit_with_test_results

def test_search_result_structure(config):
    """Test SearchResult object structure."""
    print("=== SEARCHRESULT OBJECT STRUCTURE TESTS ===\n")
    
    # Test 1: Basic SearchResult structure
    print("1. Basic SearchResult attributes:")
    try:
        result = quilt3.search_packages(size=3)
        
        expected_attrs = config.get('result_structure', {}).get('search_result_attributes', [])
        if not expected_attrs:
            expected_attrs = ['hits', 'has_next', 'next_cursor']
        
        missing_attrs = []
        present_attrs = []
        
        for attr in expected_attrs:
            if hasattr(result, attr):
                present_attrs.append(attr)
            else:
                missing_attrs.append(attr)
        
        if not missing_attrs:
            test_passed(f"All required attributes present: {present_attrs}")
        else:
            test_failed(f"Missing required attributes: {missing_attrs}")
        
        # Test attribute types
        if hasattr(result, 'hits'):
            if isinstance(result.hits, list):
                test_passed(f"hits is list with {len(result.hits)} items")
            else:
                test_failed(f"hits is not a list: {type(result.hits)}")
        
        if hasattr(result, 'has_next'):
            if isinstance(result.has_next, bool):
                test_passed(f"has_next is boolean: {result.has_next}")
            else:
                test_failed(f"has_next is not boolean: {type(result.has_next)}")
        
        if hasattr(result, 'next_cursor'):
            cursor = result.next_cursor
            if cursor is None or isinstance(cursor, str):
                test_passed(f"next_cursor is None or string: {type(cursor).__name__}")
            else:
                test_failed(f"next_cursor is not None or string: {type(cursor)}")
                
    except Exception as e:
        test_failed(f"SearchResult structure test failed: {e}")

def test_hit_object_structure(config):
    """Test individual hit object structure."""
    print("\n=== HIT OBJECT STRUCTURE TESTS ===\n")
    
    # Test 1: Hit object attributes
    print("1. Hit object attributes:")
    try:
        result = quilt3.search_packages(size=5)
        
        if not result.hits:
            print("   ⚠️  No hits available for structure testing")
            return
        
        expected_attrs = config.get('result_structure', {}).get('hit_attributes', [])
        if not expected_attrs:
            expected_attrs = ['bucket', 'key', 'name', 'score']
        
        # Test first few hits
        for i, hit in enumerate(result.hits[:3], 1):
            print(f"   Testing hit {i}:")
            
            missing_attrs = []
            present_attrs = []
            
            for attr in expected_attrs:
                if hasattr(hit, attr):
                    present_attrs.append(attr)
                else:
                    missing_attrs.append(attr)
            
            if not missing_attrs:
                test_passed(f"Hit {i} has all attributes: {present_attrs}")
            else:
                test_failed(f"Hit {i} missing attributes: {missing_attrs}")
            
            # Test specific attribute types and values
            if hasattr(hit, 'bucket') and hit.bucket:
                if isinstance(hit.bucket, str) and len(hit.bucket) > 0:
                    test_passed(f"Hit {i} bucket is non-empty string: '{hit.bucket}'")
                else:
                    test_failed(f"Hit {i} bucket invalid: {repr(hit.bucket)}")
            
            if hasattr(hit, 'key') and hit.key:
                if isinstance(hit.key, str) and len(hit.key) > 0:
                    test_passed(f"Hit {i} key is non-empty string: '{hit.key[:30]}...'")
                else:
                    test_failed(f"Hit {i} key invalid: {repr(hit.key)}")
            
            if hasattr(hit, 'name') and hit.name:
                if isinstance(hit.name, str) and len(hit.name) > 0:
                    test_passed(f"Hit {i} name is non-empty string: '{hit.name}'")
                else:
                    test_failed(f"Hit {i} name invalid: {repr(hit.name)}")
            
            if hasattr(hit, 'score'):
                if isinstance(hit.score, (int, float)) and hit.score >= 0:
                    test_passed(f"Hit {i} score is non-negative number: {hit.score}")
                else:
                    test_failed(f"Hit {i} score invalid: {repr(hit.score)}")
                    
    except Exception as e:
        test_failed(f"Hit object structure test failed: {e}")

def test_empty_results_structure(config):
    """Test structure when no results are found."""
    print("\n=== EMPTY RESULTS STRUCTURE TESTS ===\n")
    
    # Test 1: Empty results still return valid structure
    print("1. Empty results structure:")
    try:
        # Use a query that should return no results
        result = quilt3.search_packages(search_string="nonexistent-query-12345", size=10)
        
        # Should still have proper structure
        if hasattr(result, 'hits') and isinstance(result.hits, list) and len(result.hits) == 0:
            test_passed("Empty results return valid list")
        else:
            test_failed(f"Empty results structure invalid: hits={getattr(result, 'hits', 'missing')}")
        
        if hasattr(result, 'has_next') and isinstance(result.has_next, bool):
            test_passed(f"Empty results has_next is boolean: {result.has_next}")
            
            # has_next should be False for empty results
            if result.has_next == False:
                test_passed("Empty results has_next is False (correct)")
            else:
                test_failed(f"Empty results has_next should be False: {result.has_next}")
        else:
            test_failed("Empty results missing or invalid has_next")
        
        if hasattr(result, 'next_cursor'):
            # next_cursor should be None for empty results
            if result.next_cursor is None:
                test_passed("Empty results next_cursor is None (correct)")
            else:
                test_failed(f"Empty results next_cursor should be None: {result.next_cursor}")
        else:
            test_failed("Empty results missing next_cursor")
            
    except Exception as e:
        test_failed(f"Empty results structure test failed: {e}")

def test_pagination_metadata(config):
    """Test pagination-related metadata in results."""
    print("\n=== PAGINATION METADATA TESTS ===\n")
    
    # Test 1: has_next consistency
    print("1. has_next metadata consistency:")
    try:
        # Get results with small page size to likely trigger pagination
        result = quilt3.search_packages(search_string="", size=2)
        
        if hasattr(result, 'has_next') and hasattr(result, 'next_cursor'):
            if result.has_next:
                # If has_next is True, next_cursor should be present
                if result.next_cursor and isinstance(result.next_cursor, str):
                    test_passed("has_next=True with valid next_cursor")
                else:
                    test_failed(f"has_next=True but invalid next_cursor: {result.next_cursor}")
            else:
                # If has_next is False, next_cursor might be None
                test_passed(f"has_next=False, next_cursor: {result.next_cursor}")
        else:
            test_failed("Missing pagination metadata attributes")
            
    except Exception as e:
        test_failed(f"Pagination metadata test failed: {e}")
    
    # Test 2: Cursor format validation
    print("\n2. Cursor format validation:")
    try:
        result = quilt3.search_packages(search_string="", size=2)
        
        if result.has_next and result.next_cursor:
            cursor = result.next_cursor
            
            # Cursor should be a non-empty string
            if isinstance(cursor, str) and len(cursor) > 0:
                test_passed(f"Cursor is non-empty string: {len(cursor)} characters")
            else:
                test_failed(f"Invalid cursor format: {repr(cursor)}")
            
            # Cursor should not contain obvious invalid characters
            if '\n' not in cursor and '\r' not in cursor:
                test_passed("Cursor contains no newlines")
            else:
                test_failed("Cursor contains newline characters")
                
        else:
            print("   ⚠️  No pagination cursor available for format testing")
            
    except Exception as e:
        test_failed(f"Cursor format validation failed: {e}")

def test_result_ordering_consistency(config):
    """Test that result ordering is consistent with parameters."""
    print("\n=== RESULT ORDERING CONSISTENCY TESTS ===\n")
    
    sort_orders = config.get('sort_orders', [])
    test_query = "data"  # Consistent query for comparison
    
    # Test 1: Different sort orders produce different orderings
    print("1. Sort order affects result ordering:")
    try:
        results_by_order = {}
        
        for order_config in sort_orders[:3]:  # Test first 3 sort orders
            order = order_config['order']
            result = quilt3.search_packages(search_string=test_query, order=order, size=5)
            
            if result.hits:
                results_by_order[order] = [hit.name for hit in result.hits]
                test_passed(f"order='{order}' returned {len(result.hits)} results")
            else:
                print(f"   ⚠️  order='{order}' returned no results")
        
        # Compare different orderings
        if len(results_by_order) >= 2:
            orders = list(results_by_order.keys())
            first_order = orders[0]
            second_order = orders[1]
            
            if results_by_order[first_order] != results_by_order[second_order]:
                test_passed(f"Different sort orders produce different results: {first_order} vs {second_order}")
            else:
                print(f"   ⚠️  Sort orders '{first_order}' and '{second_order}' produced identical results")
        else:
            print("   ⚠️  Not enough results to compare different sort orders")
            
    except Exception as e:
        test_failed(f"Sort order consistency test failed: {e}")

def test_score_values(config):
    """Test score values in search results."""
    print("\n=== SCORE VALUES TESTS ===\n")
    
    # Test 1: Score value validity
    print("1. Score value validity:")
    try:
        result = quilt3.search_packages(search_string="data", size=5)
        
        if result.hits:
            valid_scores = 0
            invalid_scores = 0
            
            for hit in result.hits:
                if hasattr(hit, 'score'):
                    score = hit.score
                    if isinstance(score, (int, float)) and score >= 0:
                        valid_scores += 1
                    else:
                        invalid_scores += 1
                        print(f"   ❌ Invalid score: {score} (type: {type(score)})")
                else:
                    invalid_scores += 1
                    print(f"   ❌ Hit missing score attribute")
            
            if invalid_scores == 0:
                test_passed(f"All {valid_scores} hits have valid scores")
            else:
                test_failed(f"{invalid_scores} hits have invalid scores out of {len(result.hits)}")
        else:
            print("   ⚠️  No hits available for score validation")
            
    except Exception as e:
        test_failed(f"Score value validation failed: {e}")
    
    # Test 2: Score ordering for BEST_MATCH
    print("\n2. Score ordering for BEST_MATCH:")
    try:
        result = quilt3.search_packages(search_string="data", order="BEST_MATCH", size=5)
        
        if len(result.hits) >= 2:
            scores = [hit.score for hit in result.hits if hasattr(hit, 'score')]
            
            # For BEST_MATCH, scores should generally be in descending order
            is_descending = all(scores[i] >= scores[i+1] for i in range(len(scores)-1))
            
            if is_descending:
                test_passed("BEST_MATCH scores are in descending order")
            else:
                print(f"   ⚠️  BEST_MATCH scores not in perfect descending order: {scores}")
                print("      (This may be acceptable depending on tie-breaking rules)")
        else:
            print("   ⚠️  Not enough results to test score ordering")
            
    except Exception as e:
        test_failed(f"Score ordering test failed: {e}")

def main():
    """Run result structure validation tests."""
    reset_test_state()
    setup_logging()
    config = load_config()
    
    print("=== RESULT STRUCTURE VALIDATION TESTS ===")
    print("Testing return object structure and properties\n")
    
    try:
        test_search_result_structure(config)
        test_hit_object_structure(config)
        test_empty_results_structure(config)
        test_pagination_metadata(config)
        test_result_ordering_consistency(config)
        test_score_values(config)
        
        print("\n" + "="*60)
        print("✅ Result structure validation tests completed")
        exit_with_test_results()
        
    except Exception as e:
        print(f"\n✗ Result structure validation tests failed: {e}")
        exit_with_test_results()

if __name__ == "__main__":
    main()