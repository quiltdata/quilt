#!/usr/bin/env python3
"""
Utility functions for UAT tests.
"""

import logging
import os
import sys
import time
from typing import Any, Dict, Optional

import yaml

# Global test state tracking
_test_state: Dict[str, int] = {
    'total_tests': 0,
    'passed_tests': 0,
    'failed_tests': 0,
    'warnings': 0
}

def reset_test_state() -> None:
    """Reset global test state."""
    global _test_state
    _test_state = {
        'total_tests': 0,
        'passed_tests': 0,
        'failed_tests': 0,
        'warnings': 0
    }

def get_test_state() -> Dict[str, int]:
    """Get current test state."""
    return _test_state.copy()

def setup_logging() -> None:
    """Set up logging based on environment variables."""
    enable_logging = os.getenv('UAT_ENABLE_LOGGING', 'false').lower() == 'true'
    debug_mode = os.getenv('UAT_DEBUG_MODE', 'false').lower() == 'true' 
    
    if enable_logging or debug_mode:
        # Enable search_packages logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # Enable quilt3 search logging specifically
        quilt_logger = logging.getLogger('quilt3')
        quilt_logger.setLevel(logging.INFO)
        
        print("🔍 API logging enabled")
        if debug_mode:
            print("🐛 Debug mode enabled")

def load_config() -> Dict[str, Any]:
    """Load test configuration from YAML file."""
    config_file = os.getenv('UAT_CONFIG_FILE', 'test_config.yaml')
    
    try:
        with open(config_file, 'r') as f:
            config = yaml.safe_load(f)
            
        print(f"📁 Loaded config: {config_file}")
        env_name = config.get('environment', {}).get('name', 'unknown')
        print(f"🌍 Environment: {env_name}")
        
        return config
        
    except FileNotFoundError:
        print(f"❌ Config file not found: {config_file}")
        sys.exit(1)
    except yaml.YAMLError as e:
        print(f"❌ Invalid YAML in config file: {e}")
        sys.exit(1)

def format_result(result: Any) -> str:
    """Format a search result for display."""
    if hasattr(result, 'hits'):
        hit_count = len(result.hits)
        has_next = getattr(result, 'has_next', False)
        next_cursor = getattr(result, 'next_cursor', None)
        
        info = f"{hit_count} hits"
        if has_next:
            info += f", has_next: {has_next}"
        if next_cursor:
            info += f", cursor: {next_cursor[:8]}..."
            
        return info
    else:
        return str(result)

def test_passed(message):
    """Print a test passed message and track the result."""
    global _test_state
    print(f"   ✅ {message}")
    _test_state['passed_tests'] += 1
    _test_state['total_tests'] += 1

def test_failed(message: str) -> None:
    """Print a test failed message and track the result."""
    global _test_state
    print(f"   ❌ {message}")
    _test_state['failed_tests'] += 1
    _test_state['total_tests'] += 1

def test_warning(message: str) -> None:
    """Print a test warning message and track the result."""
    global _test_state
    print(f"   ⚠️  {message}")
    _test_state['warnings'] += 1

def validate_result_structure(result: Any, test_name: str = "") -> bool:
    """Validate that a search result has the expected structure."""
    errors = []
    
    # Check SearchResult attributes
    required_attrs = ['hits', 'has_next', 'next_cursor']
    for attr in required_attrs:
        if not hasattr(result, attr):
            errors.append(f"Missing attribute: {attr}")
    
    # Check hits is a list
    if hasattr(result, 'hits'):
        if not isinstance(result.hits, list):
            errors.append(f"hits is not a list: {type(result.hits)}")
        else:
            # Check individual hit structure
            for i, hit in enumerate(result.hits[:3]):  # Check first 3 hits
                hit_errors = validate_hit_structure(hit)
                if hit_errors:
                    errors.extend([f"Hit {i}: {err}" for err in hit_errors])
    
    # Check pagination attributes
    if hasattr(result, 'has_next'):
        if not isinstance(result.has_next, bool):
            errors.append(f"has_next is not a boolean: {type(result.has_next)}")
    
    if hasattr(result, 'next_cursor'):
        if result.next_cursor is not None and not isinstance(result.next_cursor, str):
            errors.append(f"next_cursor is not a string: {type(result.next_cursor)}")
    
    if errors:
        test_failed(f"{test_name} - Result structure validation failed:")
        for error in errors:
            print(f"     • {error}")
        return False
    else:
        test_passed(f"{test_name} - Result structure valid")
        return True

def validate_hit_structure(hit):
    """Validate that a search hit has the expected structure."""
    errors = []
    
    # Required attributes for a hit
    required_attrs = ['bucket', 'key', 'name', 'score']
    for attr in required_attrs:
        if not hasattr(hit, attr):
            errors.append(f"Missing hit attribute: {attr}")
    
    # Type checks
    if hasattr(hit, 'bucket') and not isinstance(hit.bucket, str):
        errors.append(f"bucket is not a string: {type(hit.bucket)}")
        
    if hasattr(hit, 'key') and not isinstance(hit.key, str):
        errors.append(f"key is not a string: {type(hit.key)}")
        
    if hasattr(hit, 'name') and not isinstance(hit.name, str):
        errors.append(f"name is not a string: {type(hit.name)}")
        
    if hasattr(hit, 'score') and not isinstance(hit.score, (int, float)):
        errors.append(f"score is not a number: {type(hit.score)}")
    
    return errors

def compare_result_ordering(results1, results2, comparison_type):
    """Compare ordering between two result sets."""
    if not results1.hits or not results2.hits:
        return False, "One or both result sets are empty"
    
    if comparison_type == "alphabetical_ascending":
        # Check if first result set is alphabetically before second
        name1 = results1.hits[0].name.lower()
        name2 = results2.hits[0].name.lower() 
        return name1 <= name2, f"'{name1}' vs '{name2}'"
        
    elif comparison_type == "alphabetical_descending":
        # Check if first result set is alphabetically after second
        name1 = results1.hits[0].name.lower()
        name2 = results2.hits[0].name.lower()
        return name1 >= name2, f"'{name1}' vs '{name2}'"
        
    elif comparison_type == "newest_first":
        # Check if first result is newer than last (if modified dates available)
        if hasattr(results1.hits[0], 'modified') and hasattr(results1.hits[-1], 'modified'):
            first_modified = results1.hits[0].modified
            last_modified = results1.hits[-1].modified
            return first_modified >= last_modified, f"{first_modified} vs {last_modified}"
        else:
            return True, "Modified dates not available for comparison"
            
    elif comparison_type == "oldest_first":
        # Check if first result is older than last
        if hasattr(results1.hits[0], 'modified') and hasattr(results1.hits[-1], 'modified'):
            first_modified = results1.hits[0].modified
            last_modified = results1.hits[-1].modified  
            return first_modified <= last_modified, f"{first_modified} vs {last_modified}"
        else:
            return True, "Modified dates not available for comparison"
    
    return False, f"Unknown comparison type: {comparison_type}"

def print_summary(test_name, passed_count=None, failed_count=None, total_count=None):
    """Print a test summary using global state or provided counts."""
    global _test_state
    
    # Use global state if no specific counts provided
    if passed_count is None:
        passed_count = _test_state['passed_tests']
    if failed_count is None:
        failed_count = _test_state['failed_tests']
    if total_count is None:
        total_count = _test_state['total_tests']
    
    print(f"\n============================================================")
    if failed_count == 0:
        print(f"✅ {test_name} tests completed successfully")
    else:
        print(f"❌ {test_name} tests completed with {failed_count} failures")
    
    # Return True if all tests passed, False otherwise
    return failed_count == 0

def exit_with_test_results():
    """Exit the script with appropriate code based on test results."""
    global _test_state
    
    failed_count = _test_state['failed_tests']
    passed_count = _test_state['passed_tests']
    total_count = _test_state['total_tests']
    warnings_count = _test_state['warnings']
    
    # Output structured data for shell script parsing
    print(f"\n========== TEST_CASE_SUMMARY ==========")
    print(f"PASSED_TEST_CASES={passed_count}")
    print(f"FAILED_TEST_CASES={failed_count}")
    print(f"TOTAL_TEST_CASES={total_count}")
    print(f"TOTAL_WARNINGS={warnings_count}")
    print(f"========== END_TEST_CASE_SUMMARY ==========")
    
    if total_count == 0:
        print("⚠️  No tests were executed")
        sys.exit(1)
    
    if failed_count == 0:
        print(f"✅ All {total_count} tests passed")
        sys.exit(0)
    else:
        print(f"❌ {failed_count} out of {total_count} tests failed")
        sys.exit(1)