#!/usr/bin/env python3
"""
Benchmark search API performance against live stack.
"""

import time
import statistics
import json
import sys
import os
import argparse
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
        logging.FileHandler('benchmark_live_search.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)


def benchmark_basic_search():
    """Measure basic search operation performance."""
    logger.info("Starting basic search benchmarking")
    print("Benchmarking basic search operations...")
    
    test_queries = ["data", "test", "example", "sample", ""]
    iterations = int(os.getenv('QUILT_LIVE_TEST_PERFORMANCE_ITERATIONS', '10'))
    
    logger.info(f"Running {iterations} iterations for queries: {test_queries}")
    results = {}
    
    for query in test_queries:
        query_name = query or "empty"
        logger.info(f"Benchmarking query: '{query_name}'")
        print(f"  Testing query: '{query}'")
        times = []
        
        for i in range(iterations):
            logger.debug(f"Running iteration {i+1}/{iterations} for query '{query_name}'")
            try:
                start_time = time.time()
                search_results = quilt3.search_packages(query, limit=10)
                end_time = time.time()
                
                response_time = end_time - start_time
                times.append(response_time)
                logger.debug(f"Iteration {i+1} completed in {response_time:.3f}s")
                
                if i == 0:  # Store result count for first iteration
                    result_count = len(search_results)
                    logger.debug(f"Query '{query_name}' returned {result_count} results")
                
            except QuiltException as e:
                print(f"    Iteration {i+1} failed: {e}")
                logger.warning(f"Iteration {i+1} failed for query '{query_name}': {e}")
                continue
        
        if times:
            query_key = query or "empty"
            avg_time = statistics.mean(times)
            results[query_key] = {
                'iterations': len(times),
                'avg_time': avg_time,
                'min_time': min(times),
                'max_time': max(times),
                'median_time': statistics.median(times),
                'std_dev': statistics.stdev(times) if len(times) > 1 else 0,
                'result_count': result_count
            }
            
            logger.info(f"Query '{query_key}' completed: avg={avg_time:.3f}s, results={result_count}, iterations={len(times)}")
            print(f"    Avg: {avg_time:.3f}s, Results: {result_count}")
        else:
            logger.warning(f"No successful iterations for query '{query or 'empty'}'")
    
    return results


def benchmark_filtered_search():
    """Measure performance with various filters applied."""
    logger.info("Starting filtered search benchmarking")
    print("Benchmarking filtered search operations...")
    
    filter_tests = [
        {"name": "size_filter", "params": {"min_size": 1000}},
        {"name": "limit_small", "params": {"limit": 5}},
        {"name": "limit_large", "params": {"limit": 50}},
        {"name": "bucket_filter", "params": {"bucket": os.getenv('QUILT_LIVE_TEST_BUCKET_PUBLIC', 'quilt-example')}},
    ]
    
    iterations = int(os.getenv('QUILT_LIVE_TEST_PERFORMANCE_ITERATIONS', '5'))
    logger.info(f"Running {iterations} iterations for filter tests: {[t['name'] for t in filter_tests]}")
    results = {}
    
    for test in filter_tests:
        test_name = test['name']
        logger.info(f"Benchmarking filter test: {test_name} with params: {test['params']}")
        print(f"  Testing {test_name}...")
        times = []
        
        for i in range(iterations):
            logger.debug(f"Running iteration {i+1}/{iterations} for filter test '{test_name}'")
            try:
                start_time = time.time()
                search_results = quilt3.search_packages("", **test['params'])
                end_time = time.time()
                
                response_time = end_time - start_time
                times.append(response_time)
                logger.debug(f"Filter test '{test_name}' iteration {i+1} completed in {response_time:.3f}s")
                
                if i == 0:
                    result_count = len(search_results)
                    logger.debug(f"Filter test '{test_name}' returned {result_count} results")
                
            except QuiltException as e:
                print(f"    Iteration {i+1} failed: {e}")
                logger.warning(f"Filter test '{test_name}' iteration {i+1} failed: {e}")
                continue
        
        if times:
            avg_time = statistics.mean(times)
            results[test_name] = {
                'iterations': len(times),
                'avg_time': avg_time,
                'min_time': min(times),
                'max_time': max(times),
                'median_time': statistics.median(times),
                'std_dev': statistics.stdev(times) if len(times) > 1 else 0,
                'result_count': result_count,
                'params': test['params']
            }
            
            logger.info(f"Filter test '{test_name}' completed: avg={avg_time:.3f}s, results={result_count}, iterations={len(times)}")
            print(f"    Avg: {avg_time:.3f}s, Results: {result_count}")
        else:
            logger.warning(f"No successful iterations for filter test '{test_name}'")
    
    return results


def benchmark_pagination():
    """Measure pagination performance."""
    logger.info("Starting pagination benchmarking")
    print("Benchmarking pagination performance...")
    
    page_size = 10
    max_pages = 5
    results = {}
    
    logger.info(f"Testing pagination with page_size={page_size}, max_pages={max_pages}")
    
    try:
        # Test pagination through multiple pages
        page_times = []
        total_results = 0
        
        for page in range(max_pages):
            offset = page * page_size
            logger.debug(f"Testing page {page+1} with offset={offset}, limit={page_size}")
            
            start_time = time.time()
            search_results = quilt3.search_packages("", limit=page_size, offset=offset)
            end_time = time.time()
            
            response_time = end_time - start_time
            page_times.append(response_time)
            total_results += len(search_results)
            
            logger.debug(f"Page {page+1} completed in {response_time:.3f}s with {len(search_results)} results")
            print(f"  Page {page+1}: {response_time:.3f}s, {len(search_results)} results")
            
            # Stop if we get fewer results than requested
            if len(search_results) < page_size:
                logger.info(f"Stopping pagination at page {page+1} - fewer results than page size")
                break
        
        if page_times:
            avg_page_time = statistics.mean(page_times)
            total_time = sum(page_times)
            results['pagination'] = {
                'pages_tested': len(page_times),
                'avg_page_time': avg_page_time,
                'total_time': total_time,
                'total_results': total_results,
                'page_size': page_size
            }
            logger.info(f"Pagination benchmark completed: {len(page_times)} pages, avg_time={avg_page_time:.3f}s, total_results={total_results}")
    
    except QuiltException as e:
        print(f"  Pagination benchmark failed: {e}")
        logger.error(f"Pagination benchmark failed: {e}")
    
    return results


def generate_performance_report(basic_results, filtered_results, pagination_results):
    """Create performance report with metrics."""
    logger.info("Generating performance report")
    
    report = {
        'timestamp': datetime.now().isoformat(),
        'environment': {
            'iterations': os.getenv('QUILT_LIVE_TEST_PERFORMANCE_ITERATIONS', '10'),
            'timeout': os.getenv('QUILT_LIVE_TEST_TIMEOUT', '30'),
            'registry_url': os.getenv('QUILT_REGISTRY_URL', 'not_set')
        },
        'basic_search': basic_results,
        'filtered_search': filtered_results,
        'pagination': pagination_results
    }
    
    # Log summary statistics
    total_tests = len(basic_results) + len(filtered_results) + (1 if pagination_results else 0)
    logger.info(f"Report generated with {total_tests} test categories: "
                f"basic_search={len(basic_results)}, filtered_search={len(filtered_results)}, "
                f"pagination={'yes' if pagination_results else 'no'}")
    
    return report


def print_summary(report):
    """Print a summary of benchmark results."""
    logger.info("Printing benchmark summary")
    print("\n" + "=" * 60)
    print("PERFORMANCE BENCHMARK SUMMARY")
    print("=" * 60)
    
    # Basic search summary
    if report['basic_search']:
        print("\nBasic Search Performance:")
        logger.debug(f"Summarizing {len(report['basic_search'])} basic search results")
        for query, stats in report['basic_search'].items():
            print(f"  Query '{query}': {stats['avg_time']:.3f}s avg "
                  f"({stats['min_time']:.3f}-{stats['max_time']:.3f}s range)")
    
    # Filtered search summary
    if report['filtered_search']:
        print("\nFiltered Search Performance:")
        for test_name, stats in report['filtered_search'].items():
            print(f"  {test_name}: {stats['avg_time']:.3f}s avg "
                  f"({stats['result_count']} results)")
    
    # Pagination summary
    if report['pagination']:
        page_stats = report['pagination']
        print(f"\nPagination Performance:")
        print(f"  {page_stats['pages_tested']} pages tested")
        print(f"  {page_stats['avg_page_time']:.3f}s avg per page")
        print(f"  {page_stats['total_time']:.3f}s total time")
    
    print("\n" + "=" * 60)


def main():
    """Main benchmarking function."""
    parser = argparse.ArgumentParser(description='Benchmark Quilt search API performance')
    parser.add_argument('--detailed', action='store_true', help='Run detailed benchmarks')
    parser.add_argument('--output', type=str, help='Output JSON report to file')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], 
                        default='INFO', help='Set logging level')
    args = parser.parse_args()
    
    # Set log level based on argument
    logger.setLevel(getattr(logging, args.log_level))
    
    logger.info("Starting benchmark session")
    print("Quilt3 Search API Performance Benchmark")
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
    
    # Run benchmarks
    logger.info("Starting basic search benchmarks")
    basic_results = benchmark_basic_search()
    
    filtered_results = {}
    pagination_results = {}
    
    if args.detailed:
        logger.info("Running detailed benchmarks (filtered search and pagination)")
        filtered_results = benchmark_filtered_search()
        pagination_results = benchmark_pagination()
    else:
        logger.info("Skipping detailed benchmarks (use --detailed to enable)")
    
    # Generate report
    logger.info("Generating final report")
    report = generate_performance_report(basic_results, filtered_results, pagination_results)
    
    # Print summary
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
    
    logger.info("Benchmark session completed successfully")
    return 0


if __name__ == "__main__":
    sys.exit(main())