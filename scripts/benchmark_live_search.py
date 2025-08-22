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
from datetime import datetime
import quilt3
from quilt3.exceptions import QuiltException


def benchmark_basic_search():
    """Measure basic search operation performance."""
    print("Benchmarking basic search operations...")
    
    test_queries = ["data", "test", "example", "sample", ""]
    iterations = int(os.getenv('QUILT_LIVE_TEST_PERFORMANCE_ITERATIONS', '10'))
    
    results = {}
    
    for query in test_queries:
        print(f"  Testing query: '{query}'")
        times = []
        
        for i in range(iterations):
            try:
                start_time = time.time()
                search_results = quilt3.search_packages(query, limit=10)
                end_time = time.time()
                
                response_time = end_time - start_time
                times.append(response_time)
                
                if i == 0:  # Store result count for first iteration
                    result_count = len(search_results)
                
            except QuiltException as e:
                print(f"    Iteration {i+1} failed: {e}")
                continue
        
        if times:
            results[query or "empty"] = {
                'iterations': len(times),
                'avg_time': statistics.mean(times),
                'min_time': min(times),
                'max_time': max(times),
                'median_time': statistics.median(times),
                'std_dev': statistics.stdev(times) if len(times) > 1 else 0,
                'result_count': result_count
            }
            
            print(f"    Avg: {results[query or 'empty']['avg_time']:.3f}s, "
                  f"Results: {result_count}")
    
    return results


def benchmark_filtered_search():
    """Measure performance with various filters applied."""
    print("Benchmarking filtered search operations...")
    
    filter_tests = [
        {"name": "size_filter", "params": {"min_size": 1000}},
        {"name": "limit_small", "params": {"limit": 5}},
        {"name": "limit_large", "params": {"limit": 50}},
        {"name": "bucket_filter", "params": {"bucket": os.getenv('QUILT_LIVE_TEST_BUCKET_PUBLIC', 'quilt-example')}},
    ]
    
    iterations = int(os.getenv('QUILT_LIVE_TEST_PERFORMANCE_ITERATIONS', '5'))
    results = {}
    
    for test in filter_tests:
        print(f"  Testing {test['name']}...")
        times = []
        
        for i in range(iterations):
            try:
                start_time = time.time()
                search_results = quilt3.search_packages("", **test['params'])
                end_time = time.time()
                
                response_time = end_time - start_time
                times.append(response_time)
                
                if i == 0:
                    result_count = len(search_results)
                
            except QuiltException as e:
                print(f"    Iteration {i+1} failed: {e}")
                continue
        
        if times:
            results[test['name']] = {
                'iterations': len(times),
                'avg_time': statistics.mean(times),
                'min_time': min(times),
                'max_time': max(times),
                'median_time': statistics.median(times),
                'std_dev': statistics.stdev(times) if len(times) > 1 else 0,
                'result_count': result_count,
                'params': test['params']
            }
            
            print(f"    Avg: {results[test['name']]['avg_time']:.3f}s, "
                  f"Results: {result_count}")
    
    return results


def benchmark_pagination():
    """Measure pagination performance."""
    print("Benchmarking pagination performance...")
    
    page_size = 10
    max_pages = 5
    results = {}
    
    try:
        # Test pagination through multiple pages
        page_times = []
        total_results = 0
        
        for page in range(max_pages):
            offset = page * page_size
            
            start_time = time.time()
            search_results = quilt3.search_packages("", limit=page_size, offset=offset)
            end_time = time.time()
            
            response_time = end_time - start_time
            page_times.append(response_time)
            total_results += len(search_results)
            
            print(f"  Page {page+1}: {response_time:.3f}s, {len(search_results)} results")
            
            # Stop if we get fewer results than requested
            if len(search_results) < page_size:
                break
        
        if page_times:
            results['pagination'] = {
                'pages_tested': len(page_times),
                'avg_page_time': statistics.mean(page_times),
                'total_time': sum(page_times),
                'total_results': total_results,
                'page_size': page_size
            }
    
    except QuiltException as e:
        print(f"  Pagination benchmark failed: {e}")
    
    return results


def generate_performance_report(basic_results, filtered_results, pagination_results):
    """Create performance report with metrics."""
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
    
    return report


def print_summary(report):
    """Print a summary of benchmark results."""
    print("\n" + "=" * 60)
    print("PERFORMANCE BENCHMARK SUMMARY")
    print("=" * 60)
    
    # Basic search summary
    if report['basic_search']:
        print("\nBasic Search Performance:")
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
    args = parser.parse_args()
    
    print("Quilt3 Search API Performance Benchmark")
    print("=" * 50)
    
    # Check if user is logged in
    try:
        from quilt3.api import get_user
        user = get_user()
        if not user:
            print("Error: Not logged in to quilt3. Please run 'quilt3 login' first.")
            return 1
        print(f"Logged in as: {user}")
    except Exception as e:
        print(f"Error checking login status: {e}")
        return 1
    
    # Run benchmarks
    basic_results = benchmark_basic_search()
    
    filtered_results = {}
    pagination_results = {}
    
    if args.detailed:
        filtered_results = benchmark_filtered_search()
        pagination_results = benchmark_pagination()
    
    # Generate report
    report = generate_performance_report(basic_results, filtered_results, pagination_results)
    
    # Print summary
    print_summary(report)
    
    # Save report if requested
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\nDetailed report saved to: {args.output}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())