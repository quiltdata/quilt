#!/usr/bin/env python3
"""
Setup script for live search testing.
Validates environment and prepares test data.
"""

import os
import sys
import subprocess
import logging
import quilt3
from quilt3.exceptions import QuiltException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('setup_live_search_tests.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)


def validate_quilt_login():
    """Check if user is logged into quilt3."""
    logger.info("Starting quilt3 login validation")
    try:
        # Try to get the current user to check if logged in
        from quilt3.api import get_user
        logger.debug("Attempting to get current user")
        user = get_user()
        if user:
            print(f"✓ Logged in as: {user}")
            logger.info(f"Successfully validated login for user: {user}")
            return True
        else:
            print("✗ Not logged in to quilt3")
            logger.warning("No user found - not logged in")
            return False
    except Exception as e:
        print(f"✗ Login check failed: {e}")
        print("Please run 'quilt3 login' to authenticate")
        logger.error(f"Login validation failed: {e}", exc_info=True)
        return False


def discover_test_buckets():
    """Find accessible buckets with searchable content."""
    logger.info("Starting bucket discovery")
    print("\nDiscovering accessible buckets...")
    
    # Check environment variables for test buckets
    test_buckets = {
        'public': os.getenv('QUILT_LIVE_TEST_BUCKET_PUBLIC', 'quilt-example'),
        'private': os.getenv('QUILT_LIVE_TEST_BUCKET_PRIVATE', 'private-test-bucket'),
        'large': os.getenv('QUILT_LIVE_TEST_BUCKET_LARGE', 'large-dataset-bucket')
    }
    
    logger.info(f"Testing access to buckets: {test_buckets}")
    accessible_buckets = []
    
    for bucket_type, bucket_name in test_buckets.items():
        logger.debug(f"Testing access to {bucket_type} bucket: {bucket_name}")
        try:
            # Try to list packages in the bucket to test access
            results = quilt3.search_packages("", bucket=bucket_name, limit=1)
            print(f"✓ {bucket_type.capitalize()} bucket '{bucket_name}' is accessible")
            logger.info(f"Successfully accessed {bucket_type} bucket '{bucket_name}' with {len(results)} results")
            accessible_buckets.append((bucket_type, bucket_name))
        except QuiltException as e:
            print(f"✗ {bucket_type.capitalize()} bucket '{bucket_name}' not accessible: {e}")
            logger.warning(f"Cannot access {bucket_type} bucket '{bucket_name}': {e}")
    
    if not accessible_buckets:
        print("✗ No test buckets are accessible")
        logger.error("No test buckets are accessible")
        return False
    
    print(f"✓ Found {len(accessible_buckets)} accessible test buckets")
    logger.info(f"Found {len(accessible_buckets)} accessible buckets: {[b[1] for b in accessible_buckets]}")
    return accessible_buckets


def validate_search_api_availability():
    """Check if search API is accessible."""
    logger.info("Starting search API validation")
    print("\nValidating search API availability...")
    
    try:
        # Try a basic search to ensure API is working
        logger.debug("Attempting basic search with query 'test'")
        results = quilt3.search_packages("test", limit=1)
        print(f"✓ Search API is available (returned {len(results)} results)")
        logger.info(f"Search API validation successful - returned {len(results)} results")
        return True
    except QuiltException as e:
        print(f"✗ Search API not available: {e}")
        logger.error(f"Search API validation failed with QuiltException: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error testing search API: {e}")
        logger.error(f"Search API validation failed with unexpected error: {e}", exc_info=True)
        return False


def setup_test_data_if_needed():
    """Create test packages if none exist."""
    logger.info("Starting test data validation")
    print("\nChecking for existing test data...")
    
    try:
        # Check if there's any searchable content
        logger.debug("Searching for existing packages")
        results = quilt3.search_packages("", limit=5)
        if results:
            print(f"✓ Found {len(results)} existing packages for testing")
            logger.info(f"Found {len(results)} existing packages for testing")
            return True
        else:
            print("! No existing packages found - tests may have limited data")
            logger.warning("No existing packages found - tests may have limited data")
            # Could potentially create test packages here if needed
            return True
    except Exception as e:
        print(f"✗ Error checking test data: {e}")
        logger.error(f"Error checking test data: {e}", exc_info=True)
        return False


def check_environment_variables():
    """Check required environment variables."""
    logger.info("Starting environment variable check")
    print("\nChecking environment configuration...")
    
    env_vars = {
        'QUILT_REGISTRY_URL': 'Registry URL',
        'QUILT_LIVE_TEST_BUCKET_PUBLIC': 'Public test bucket',
        'QUILT_LIVE_TEST_PERFORMANCE_ITERATIONS': 'Performance test iterations',
        'QUILT_LIVE_TEST_TIMEOUT': 'Test timeout'
    }
    
    env_status = {}
    for var, description in env_vars.items():
        value = os.getenv(var)
        env_status[var] = value
        if value:
            print(f"✓ {description}: {value}")
            logger.debug(f"Environment variable {var} set to: {value}")
        else:
            print(f"! {description} not set (will use defaults)")
            logger.info(f"Environment variable {var} not set - will use defaults")
    
    logger.info(f"Environment variable check completed: {env_status}")
    return True


def main():
    """Main setup validation."""
    logger.info("Starting live search test setup validation")
    print("Quilt3 Live Search Test Setup")
    print("=" * 40)
    
    all_checks_passed = True
    validation_results = {}
    
    # Run all validation checks
    logger.info("Running validation checks")
    
    login_valid = validate_quilt_login()
    validation_results['login'] = login_valid
    if not login_valid:
        all_checks_passed = False
    
    api_valid = validate_search_api_availability()
    validation_results['api'] = api_valid
    if not api_valid:
        all_checks_passed = False
    
    accessible_buckets = discover_test_buckets()
    validation_results['buckets'] = accessible_buckets
    if not accessible_buckets:
        all_checks_passed = False
    
    data_valid = setup_test_data_if_needed()
    validation_results['test_data'] = data_valid
    if not data_valid:
        all_checks_passed = False
    
    env_valid = check_environment_variables()
    validation_results['environment'] = env_valid
    
    logger.info(f"Validation results: {validation_results}")
    
    print("\n" + "=" * 40)
    if all_checks_passed:
        print("✓ Setup validation completed successfully")
        print("Ready to run live search tests!")
        logger.info("Setup validation completed successfully")
        
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
        logger.error("Setup validation failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())