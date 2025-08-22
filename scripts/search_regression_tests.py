#!/usr/bin/env python3
"""
Regression test suite for search API.
"""

import sys
import json
import os
import hashlib
import logging
from datetime import datetime
import argparse
import quilt3
from quilt3.exceptions import QuiltException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('search_regression_tests.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)


def test_search_result_consistency():
    """Ensure search results are consistent across runs."""
    logger.info("Starting search result consistency tests")
    print("Testing search result consistency...")
    
    test_queries = [
        {"query": "data", "limit": 10},
        {"query": "", "limit": 5},
        {"query": "example", "limit": 3}
    ]
    
    logger.info(f"Running consistency tests for {len(test_queries)} queries")
    results = {}
    
    for i, test_query in enumerate(test_queries):
        query_name = f"query_{i}_{test_query['query'] or 'empty'}"
        logger.info(f"Testing consistency for query: {query_name} with params: {test_query}")
        print(f"  Testing query: {test_query}")
        
        try:
            # Run the same query multiple times
            runs = []
            logger.debug(f"Running 3 iterations for consistency test: {query_name}")
            for run in range(3):
                logger.debug(f"Consistency test '{query_name}' iteration {run+1}/3")
                search_results = quilt3.search_packages(**test_query)
                
                # Create a deterministic representation of results
                result_signature = create_result_signature(search_results)
                runs.append(result_signature)
                logger.debug(f"Iteration {run+1} signature: {result_signature[:16]}...")
            
            # Check if all runs produced the same results
            all_same = all(sig == runs[0] for sig in runs)
            logger.info(f"Consistency test '{query_name}': all_same={all_same}, signatures={len(set(runs))} unique")
            
            results[query_name] = {
                "status": "PASS" if all_same else "FAIL",
                "query": test_query,
                "consistent": all_same,
                "run_signatures": runs,
                "description": f"Consistency test for query: {test_query}"
            }
            
            status = "✓ CONSISTENT" if all_same else "✗ INCONSISTENT"
            print(f"    {status}")
            
        except QuiltException as e:
            print(f"    ✗ ERROR: {e}")
            logger.error(f"Consistency test '{query_name}' failed with QuiltException: {e}")
            results[query_name] = {
                "status": "ERROR",
                "error": str(e),
                "query": test_query,
                "description": f"Consistency test for query: {test_query}"
            }
    
    return results


def test_backwards_compatibility():
    """Ensure search API maintains compatibility."""
    print("Testing backwards compatibility...")
    
    compatibility_tests = [
        {
            "name": "basic_search",
            "description": "Basic search with string query",
            "test": lambda: quilt3.search_packages("test"),
            "expected_type": list
        },
        {
            "name": "search_with_limit",
            "description": "Search with limit parameter",
            "test": lambda: quilt3.search_packages("", limit=5),
            "expected_type": list
        },
        {
            "name": "search_with_bucket",
            "description": "Search with bucket parameter",
            "test": lambda: quilt3.search_packages("", bucket="quilt-example"),
            "expected_type": list
        }
    ]
    
    results = {}
    
    for test in compatibility_tests:
        print(f"  Testing: {test['description']}")
        
        try:
            result = test["test"]()
            
            # Check if result type matches expected
            type_match = isinstance(result, test["expected_type"])
            
            # Check if results have expected structure
            structure_valid = True
            if isinstance(result, list) and result:
                # Check first result has expected fields
                first_result = result[0]
                if not isinstance(first_result, dict):
                    structure_valid = False
            
            status = "PASS" if type_match and structure_valid else "FAIL"
            
            results[test["name"]] = {
                "status": status,
                "description": test["description"],
                "type_match": type_match,
                "structure_valid": structure_valid,
                "result_count": len(result) if isinstance(result, list) else None
            }
            
            print(f"    ✓ {status}: Type={type_match}, Structure={structure_valid}")
            
        except Exception as e:
            print(f"    ✗ ERROR: {e}")
            results[test["name"]] = {
                "status": "ERROR",
                "error": str(e),
                "description": test["description"]
            }
    
    return results


def test_error_handling_consistency():
    """Ensure error cases are handled consistently."""
    print("Testing error handling consistency...")
    
    error_tests = [
        {
            "name": "invalid_bucket",
            "description": "Search with non-existent bucket",
            "test": lambda: quilt3.search_packages("", bucket="non-existent-bucket-xyz123"),
            "expect_error": True
        },
        {
            "name": "very_large_limit",
            "description": "Search with very large limit",
            "test": lambda: quilt3.search_packages("", limit=10000),
            "expect_error": False  # Should handle gracefully
        }
    ]
    
    results = {}
    
    for test in error_tests:
        print(f"  Testing: {test['description']}")
        
        error_occurred = False
        error_type = None
        
        try:
            result = test["test"]()
            # If we expected an error but didn't get one
            if test["expect_error"]:
                status = "FAIL"
                print(f"    ✗ FAIL: Expected error but got {len(result) if isinstance(result, list) else 'result'}")
            else:
                status = "PASS"
                print(f"    ✓ PASS: Handled gracefully")
                
        except QuiltException as e:
            error_occurred = True
            error_type = "QuiltException"
            if test["expect_error"]:
                status = "PASS"
                print(f"    ✓ PASS: Expected error occurred - {e}")
            else:
                status = "FAIL" 
                print(f"    ✗ FAIL: Unexpected error - {e}")
                
        except Exception as e:
            error_occurred = True
            error_type = type(e).__name__
            status = "FAIL"
            print(f"    ✗ FAIL: Unexpected exception type - {e}")
        
        results[test["name"]] = {
            "status": status,
            "description": test["description"],
            "expected_error": test["expect_error"],
            "error_occurred": error_occurred,
            "error_type": error_type
        }
    
    return results


def create_result_signature(results):
    """Create a deterministic signature for search results."""
    if not results:
        return "empty"
    
    # Sort results by a consistent field to ensure deterministic ordering
    try:
        sorted_results = sorted(results, key=lambda x: x.get('name', '') + str(x.get('last_modified', '')))
    except:
        # Fallback if sorting fails
        sorted_results = results
    
    # Create signature based on result structure
    signature_data = []
    for result in sorted_results:
        item_sig = {
            'name': result.get('name'),
            'bucket': result.get('bucket'),
            'size': result.get('size')
        }
        signature_data.append(item_sig)
    
    # Hash the signature data
    signature_str = json.dumps(signature_data, sort_keys=True)
    signature_hash = hashlib.md5(signature_str.encode()).hexdigest()
    
    return signature_hash


def load_baseline_results(baseline_file):
    """Load baseline results from previous run."""
    logger.info(f"Attempting to load baseline from: {baseline_file}")
    if os.path.exists(baseline_file):
        try:
            with open(baseline_file, 'r') as f:
                baseline_data = json.load(f)
            logger.info(f"Successfully loaded baseline with {len(baseline_data.get('test_results', {}))} test results")
            return baseline_data
        except Exception as e:
            print(f"Warning: Could not load baseline from {baseline_file}: {e}")
            logger.warning(f"Failed to load baseline from {baseline_file}: {e}")
    else:
        logger.info(f"Baseline file {baseline_file} does not exist")
    return None


def save_baseline_results(results, baseline_file):
    """Save current results as baseline."""
    logger.info(f"Saving baseline results to: {baseline_file}")
    try:
        with open(baseline_file, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"Baseline results saved to {baseline_file}")
        logger.info(f"Successfully saved baseline with {len(results.get('test_results', {}))} test results")
    except Exception as e:
        print(f"Warning: Could not save baseline to {baseline_file}: {e}")
        logger.error(f"Failed to save baseline to {baseline_file}: {e}")


def compare_with_baseline(current_results, baseline_results):
    """Compare current results with baseline."""
    logger.info("Starting baseline comparison")
    
    if not baseline_results:
        logger.warning("No baseline available for comparison")
        return {"status": "NO_BASELINE", "message": "No baseline available for comparison"}
    
    # Compare test counts and results
    current_tests = set(current_results.keys())
    baseline_tests = set(baseline_results.get("test_results", {}).keys())
    
    logger.info(f"Comparing tests: current={len(current_tests)}, baseline={len(baseline_tests)}")
    
    added_tests = current_tests - baseline_tests
    removed_tests = baseline_tests - current_tests
    common_tests = current_tests & baseline_tests
    
    logger.debug(f"Test changes: added={len(added_tests)}, removed={len(removed_tests)}, common={len(common_tests)}")
    
    regressions = []
    improvements = []
    
    for test_name in common_tests:
        current_status = current_results[test_name].get("status")
        baseline_status = baseline_results["test_results"][test_name].get("status")
        
        logger.debug(f"Test '{test_name}': baseline={baseline_status}, current={current_status}")
        
        if baseline_status == "PASS" and current_status != "PASS":
            regressions.append(test_name)
            logger.warning(f"Regression detected in test '{test_name}': {baseline_status} -> {current_status}")
        elif baseline_status != "PASS" and current_status == "PASS":
            improvements.append(test_name)
            logger.info(f"Improvement detected in test '{test_name}': {baseline_status} -> {current_status}")
    
    comparison_result = {
        "status": "COMPARED",
        "added_tests": list(added_tests),
        "removed_tests": list(removed_tests),
        "regressions": regressions,
        "improvements": improvements
    }
    
    logger.info(f"Baseline comparison completed: {len(regressions)} regressions, {len(improvements)} improvements")
    return comparison_result


def generate_regression_report(consistency_results, compatibility_results, error_results, baseline_comparison):
    """Generate comprehensive regression test report."""
    all_results = {}
    all_results.update(consistency_results)
    all_results.update(compatibility_results)
    all_results.update(error_results)
    
    # Calculate summary
    total_tests = len(all_results)
    passed_tests = sum(1 for r in all_results.values() if r.get("status") == "PASS")
    failed_tests = sum(1 for r in all_results.values() if r.get("status") == "FAIL")
    error_tests = sum(1 for r in all_results.values() if r.get("status") == "ERROR")
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total_tests": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "errors": error_tests,
            "success_rate": (passed_tests / total_tests * 100) if total_tests > 0 else 0
        },
        "test_results": all_results,
        "baseline_comparison": baseline_comparison
    }
    
    return report


def print_regression_summary(report):
    """Print regression test summary."""
    print("\n" + "=" * 60)
    print("SEARCH REGRESSION TEST SUMMARY")
    print("=" * 60)
    
    summary = report["summary"]
    print(f"Total tests: {summary['total_tests']}")
    print(f"Passed: {summary['passed']}")
    print(f"Failed: {summary['failed']}")
    print(f"Errors: {summary['errors']}")
    print(f"Success rate: {summary['success_rate']:.1f}%")
    
    # Baseline comparison
    baseline = report.get("baseline_comparison", {})
    if baseline.get("status") == "COMPARED":
        print(f"\nBaseline Comparison:")
        print(f"  Regressions: {len(baseline.get('regressions', []))}")
        print(f"  Improvements: {len(baseline.get('improvements', []))}")
        print(f"  New tests: {len(baseline.get('added_tests', []))}")
        
        if baseline.get('regressions'):
            print(f"  ⚠️  Regression detected in: {', '.join(baseline['regressions'])}")
    
    print("=" * 60)


def main():
    """Main regression testing function."""
    parser = argparse.ArgumentParser(description='Run search API regression tests')
    parser.add_argument('--baseline', type=str, default='search_regression_baseline.json',
                        help='Baseline file for comparison')
    parser.add_argument('--save-baseline', action='store_true',
                        help='Save current results as new baseline')
    parser.add_argument('--output', type=str, help='Output detailed report to file')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], 
                        default='INFO', help='Set logging level')
    args = parser.parse_args()
    
    # Set log level based on argument
    logger.setLevel(getattr(logging, args.log_level))
    
    logger.info("Starting regression testing session")
    print("Quilt3 Search API Regression Tests")
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
    
    # Load baseline if available
    baseline_results = load_baseline_results(args.baseline)
    
    # Run regression tests
    logger.info("Running regression test suite")
    consistency_results = test_search_result_consistency()
    compatibility_results = test_backwards_compatibility()
    error_results = test_error_handling_consistency()
    
    # Compare with baseline
    all_current_results = {}
    all_current_results.update(consistency_results)
    all_current_results.update(compatibility_results)
    all_current_results.update(error_results)
    
    logger.info(f"Collected {len(all_current_results)} test results for baseline comparison")
    baseline_comparison = compare_with_baseline(all_current_results, baseline_results)
    
    # Generate report
    logger.info("Generating regression test report")
    report = generate_regression_report(consistency_results, compatibility_results, error_results, baseline_comparison)
    
    # Print summary
    print_regression_summary(report)
    
    # Save as new baseline if requested
    if args.save_baseline:
        logger.info("Saving current results as new baseline")
        save_baseline_results(report, args.baseline)
    
    # Save detailed report if requested
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
    
    # Return non-zero exit code if there were failures or regressions
    has_failures = report["summary"]["failed"] > 0 or report["summary"]["errors"] > 0
    has_regressions = len(baseline_comparison.get("regressions", [])) > 0
    
    logger.info(f"Regression testing completed: failures={has_failures}, regressions={has_regressions}")
    
    if has_failures or has_regressions:
        logger.warning("Regression testing failed - returning non-zero exit code")
        return 1
    
    logger.info("Regression testing completed successfully")
    return 0


if __name__ == "__main__":
    sys.exit(main())