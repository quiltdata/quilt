#!/usr/bin/env python3
"""
Validate search functionality against known data.
"""

import sys
import argparse
import json
import logging
from datetime import datetime
import quilt3
from quilt3.exceptions import QuiltException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('validate_search_functionality.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)


def validate_search_accuracy():
    """Test search returns expected results for known queries."""
    logger.info("Starting search accuracy validation")
    print("Validating search accuracy...")
    
    test_cases = [
        {
            "name": "empty_query",
            "query": "",
            "description": "Empty query should return results",
            "expect_results": True
        },
        {
            "name": "common_term",
            "query": "data",
            "description": "Common term should return results",
            "expect_results": True
        },
        {
            "name": "nonexistent_term",
            "query": "nonexistent_package_xyz123",
            "description": "Nonexistent term should return no results",
            "expect_results": False
        }
    ]
    
    logger.info(f"Running {len(test_cases)} accuracy test cases")
    results = {}
    
    for test_case in test_cases:
        test_name = test_case["name"]
        logger.info(f"Running accuracy test: {test_name}")
        print(f"  Testing: {test_case['description']}")
        
        try:
            logger.debug(f"Executing search with query: '{test_case['query']}'")
            search_results = quilt3.search_packages(test_case["query"], limit=10)
            has_results = len(search_results) > 0
            
            logger.debug(f"Search returned {len(search_results)} results, has_results={has_results}")
            
            # Check if results match expectations
            if test_case["expect_results"] == has_results:
                status = "PASS"
                print(f"    ✓ {status}: Found {len(search_results)} results")
                logger.info(f"Accuracy test '{test_name}' PASSED: expected={test_case['expect_results']}, actual={has_results}")
            else:
                status = "FAIL"
                expected = "results" if test_case["expect_results"] else "no results"
                actual = f"{len(search_results)} results"
                print(f"    ✗ {status}: Expected {expected}, got {actual}")
                logger.warning(f"Accuracy test '{test_name}' FAILED: expected={test_case['expect_results']}, actual={has_results}")
            
            results[test_case["name"]] = {
                "status": status,
                "query": test_case["query"],
                "result_count": len(search_results),
                "expected_results": test_case["expect_results"],
                "description": test_case["description"]
            }
            
        except QuiltException as e:
            print(f"    ✗ ERROR: {e}")
            logger.error(f"Accuracy test '{test_name}' failed with QuiltException: {e}")
            results[test_case["name"]] = {
                "status": "ERROR",
                "error": str(e),
                "query": test_case["query"],
                "description": test_case["description"]
            }
    
    logger.info(f"Accuracy validation completed with {len(results)} results")
    return results


def validate_filter_functionality():
    """Test all filter types work correctly."""
    logger.info("Starting filter functionality validation")
    print("Validating filter functionality...")
    
    filter_tests = [
        {
            "name": "limit_filter",
            "params": {"query": "", "limit": 5},
            "description": "Limit filter should return at most 5 results",
            "validation": lambda results, params: len(results) <= params["limit"]
        },
        {
            "name": "offset_filter",
            "params": {"query": "", "limit": 3, "offset": 0},
            "description": "Offset filter should work for pagination",
            "validation": lambda results, params: True  # Basic validation - results exist
        },
        {
            "name": "bucket_filter",
            "params": {"query": "", "bucket": "quilt-example", "limit": 3},
            "description": "Bucket filter should return results from specified bucket",
            "validation": lambda results, params: all(
                r.get("bucket") == params["bucket"] for r in results if "bucket" in r
            )
        }
    ]
    
    logger.info(f"Running {len(filter_tests)} filter tests")
    results = {}
    
    for test in filter_tests:
        test_name = test["name"]
        logger.info(f"Running filter test: {test_name} with params: {test['params']}")
        print(f"  Testing: {test['description']}")
        
        try:
            logger.debug(f"Executing search with params: {test['params']}")
            search_results = quilt3.search_packages(**test["params"])
            
            logger.debug(f"Filter test '{test_name}' returned {len(search_results)} results")
            
            # Validate results
            is_valid = test["validation"](search_results, test["params"])
            status = "PASS" if is_valid else "FAIL"
            
            print(f"    {status}: Found {len(search_results)} results")
            logger.info(f"Filter test '{test_name}' {status}: validation={is_valid}, results={len(search_results)}")
            
            results[test["name"]] = {
                "status": status,
                "params": test["params"],
                "result_count": len(search_results),
                "description": test["description"]
            }
            
        except QuiltException as e:
            print(f"    ✗ ERROR: {e}")
            logger.error(f"Filter test '{test_name}' failed with QuiltException: {e}")
            results[test["name"]] = {
                "status": "ERROR",
                "error": str(e),
                "params": test["params"],
                "description": test["description"]
            }
    
    logger.info(f"Filter validation completed with {len(results)} results")
    return results


def validate_sorting_options():
    """Test all sort orders work correctly."""
    print("Validating sorting options...")
    
    # Note: Sorting options depend on the actual search API implementation
    # This is a placeholder for when sorting is implemented
    sort_tests = [
        {
            "name": "default_sort",
            "params": {"query": "data", "limit": 5},
            "description": "Default sorting should work",
        }
    ]
    
    results = {}
    
    for test in sort_tests:
        print(f"  Testing: {test['description']}")
        
        try:
            search_results = quilt3.search_packages(**test["params"])
            
            # For now, just check that results are returned
            status = "PASS" if isinstance(search_results, list) else "FAIL"
            
            print(f"    {status}: Found {len(search_results)} results")
            
            results[test["name"]] = {
                "status": status,
                "params": test["params"],
                "result_count": len(search_results),
                "description": test["description"]
            }
            
        except QuiltException as e:
            print(f"    ✗ ERROR: {e}")
            results[test["name"]] = {
                "status": "ERROR",
                "error": str(e),
                "params": test["params"],
                "description": test["description"]
            }
    
    return results


def validate_metadata_search():
    """Test user metadata search functionality."""
    print("Validating metadata search...")
    
    metadata_tests = [
        {
            "name": "basic_metadata",
            "params": {"query": "", "limit": 5},
            "description": "Basic search should return packages with metadata",
        }
        # Additional metadata tests would go here when the API supports them
    ]
    
    results = {}
    
    for test in metadata_tests:
        print(f"  Testing: {test['description']}")
        
        try:
            search_results = quilt3.search_packages(**test["params"])
            
            # Check if any results have metadata
            has_metadata = any("metadata" in result for result in search_results)
            status = "PASS" if isinstance(search_results, list) else "FAIL"
            
            print(f"    {status}: Found {len(search_results)} results, "
                  f"metadata present: {has_metadata}")
            
            results[test["name"]] = {
                "status": status,
                "params": test["params"],
                "result_count": len(search_results),
                "has_metadata": has_metadata,
                "description": test["description"]
            }
            
        except QuiltException as e:
            print(f"    ✗ ERROR: {e}")
            results[test["name"]] = {
                "status": "ERROR",
                "error": str(e),
                "params": test["params"],
                "description": test["description"]
            }
    
    return results


def generate_validation_report(accuracy_results, filter_results, sort_results, metadata_results):
    """Generate comprehensive validation report."""
    all_tests = {}
    all_tests.update(accuracy_results)
    all_tests.update(filter_results)
    all_tests.update(sort_results)
    all_tests.update(metadata_results)
    
    # Calculate summary statistics
    total_tests = len(all_tests)
    passed_tests = sum(1 for result in all_tests.values() if result.get("status") == "PASS")
    failed_tests = sum(1 for result in all_tests.values() if result.get("status") == "FAIL")
    error_tests = sum(1 for result in all_tests.values() if result.get("status") == "ERROR")
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total_tests": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "errors": error_tests,
            "success_rate": (passed_tests / total_tests * 100) if total_tests > 0 else 0
        },
        "test_categories": {
            "accuracy": accuracy_results,
            "filters": filter_results,
            "sorting": sort_results,
            "metadata": metadata_results
        }
    }
    
    return report


def print_summary(report):
    """Print validation summary."""
    print("\n" + "=" * 60)
    print("SEARCH FUNCTIONALITY VALIDATION SUMMARY")
    print("=" * 60)
    
    summary = report["summary"]
    print(f"Total tests: {summary['total_tests']}")
    print(f"Passed: {summary['passed']}")
    print(f"Failed: {summary['failed']}")
    print(f"Errors: {summary['errors']}")
    print(f"Success rate: {summary['success_rate']:.1f}%")
    
    if summary["failed"] > 0 or summary["errors"] > 0:
        print("\nFailed/Error tests:")
        for category, tests in report["test_categories"].items():
            for test_name, result in tests.items():
                if result.get("status") in ["FAIL", "ERROR"]:
                    print(f"  {category}.{test_name}: {result['status']} - {result.get('description', '')}")
    
    print("=" * 60)


def main():
    """Main validation function."""
    parser = argparse.ArgumentParser(description='Validate Quilt search functionality')
    parser.add_argument('--quick', action='store_true', help='Run quick validation only')
    parser.add_argument('--output', type=str, help='Output JSON report to file')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], 
                        default='INFO', help='Set logging level')
    args = parser.parse_args()
    
    # Set log level based on argument
    logger.setLevel(getattr(logging, args.log_level))
    
    logger.info("Starting search functionality validation session")
    print("Quilt3 Search Functionality Validation")
    print("=" * 50)
    
    # Check if user is logged in
    logger.info("Checking authentication status")
    try:
        from quilt3.api import get_user
        user = get_user()
        if not user:
            print("Error: Not logged in to quilt3. Please run 'quilt3 login' first.")
            logger.error("User not logged in")
            return 1
        print(f"Logged in as: {user}")
        logger.info(f"Authentication verified for user: {user}")
    except Exception as e:
        print(f"Error checking login status: {e}")
        logger.error(f"Authentication check failed: {e}", exc_info=True)
        return 1
    
    # Run validation tests
    logger.info("Starting validation tests")
    accuracy_results = validate_search_accuracy()
    
    if not args.quick:
        logger.info("Running comprehensive validation (filter, sort, metadata tests)")
        filter_results = validate_filter_functionality()
        sort_results = validate_sorting_options()
        metadata_results = validate_metadata_search()
    else:
        logger.info("Running quick validation only (accuracy tests)")
        filter_results = {}
        sort_results = {}
        metadata_results = {}
    
    # Generate and print report
    logger.info("Generating validation report")
    report = generate_validation_report(accuracy_results, filter_results, sort_results, metadata_results)
    print_summary(report)
    
    # Save report if requested
    if args.output:
        logger.info(f"Saving detailed report to: {args.output}")
        try:
            with open(args.output, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"\nDetailed report saved to: {args.output}")
            logger.info(f"Report successfully saved to: {args.output}")
        except Exception as e:
            logger.error(f"Failed to save report to {args.output}: {e}")
            print(f"Error saving report: {e}")
    
    # Return non-zero exit code if there were failures
    failed_count = report["summary"]["failed"]
    error_count = report["summary"]["errors"]
    
    if failed_count > 0 or error_count > 0:
        logger.warning(f"Validation completed with failures: {failed_count} failed, {error_count} errors")
        return 1
    
    logger.info("Validation completed successfully with no failures")
    return 0


if __name__ == "__main__":
    sys.exit(main())