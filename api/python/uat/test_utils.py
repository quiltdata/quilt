#!/usr/bin/env python3
"""
Utility functions for UAT tests.
"""

import os
import sys
import yaml
import logging

def setup_logging():
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

def load_config():
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

def format_result(result):
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
    """Print a test passed message."""
    print(f"   ✅ {message}")

def test_failed(message):
    """Print a test failed message."""
    print(f"   ❌ {message}")

def test_warning(message):
    """Print a test warning message."""
    print(f"   ⚠️  {message}")

def validate_result_structure(result, test_name=""):
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

def print_summary(test_name, passed_count, failed_count, total_count):
    """Print a test summary."""
    print(f"\n--- {test_name} Summary ---")
    print(f"Total tests: {total_count}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {failed_count}")
    
    if failed_count == 0:
        print("✅ All tests passed!")
        return True
    else:
        print("❌ Some tests failed!")
        return False