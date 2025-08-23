#!/bin/bash
# Generate test_config.yaml by discovering live Quilt infrastructure
# Simple discovery script that mirrors the hardcoded defaults

set -e

echo "Generating test_config.yaml from live Quilt infrastructure..."

python3 << 'EOF'
import quilt3
import yaml
from datetime import datetime, timedelta

# Discover available buckets and packages
print("Discovering buckets and packages...")
try:
    results = quilt3.search_packages(search_string="", size=20)
    
    # Extract unique buckets
    buckets = list(set(hit.bucket for hit in results.hits))
    print(f"Found {len(buckets)} buckets: {buckets[:5]}...")
    
    # Generate config based on discoveries
    config = {
        'environment': {
            'name': 'live',
            'description': 'Live Quilt infrastructure testing'
        },
        
        'buckets': {
            'public': []
        },
        
        'search_terms': {
            'common': [
                {'query': 'data', 'description': 'Common term that should return multiple results', 'min_results': 5},
                {'query': 'example', 'description': 'Specific term for testing relevance ranking', 'min_results': 3}
            ],
            'complex': [
                {'query': 'machine learning', 'description': 'Multi-word query', 'min_results': 0}
            ],
            'edge_cases': [
                {'query': '', 'description': 'Empty search string', 'behavior': 'returns_all_packages'},
                {'query': 'nonexistent-query-12345', 'description': 'Query that should return no results', 'expected_results': 0}
            ]
        },
        
        'filters': {
            'date_filters': [
                {'filter': {'modified': {'gte': '2023-01-01'}}, 'description': 'Packages modified since 2023'},
                {'filter': {'modified': {'lte': '2022-12-31'}}, 'description': 'Packages modified before 2023'}
            ],
            'size_filters': [
                {'filter': {'size': {'lt': 1000000}}, 'description': 'Packages smaller than 1MB'},
                {'filter': {'size': {'gte': 10000000}}, 'description': 'Packages larger than 10MB'}
            ]
        },
        
        'user_meta_filters': [
            {'filters': [{'key': 'department', 'value': 'engineering'}], 'description': 'Engineering department packages', 'expected_behavior': 'may_return_zero_results'}
        ],
        
        'sort_orders': [
            {'order': 'BEST_MATCH', 'description': 'Default relevance-based sorting'},
            {'order': 'NEWEST', 'description': 'Most recent first', 'validation': 'first_result_newer_than_last'},
            {'order': 'OLDEST', 'description': 'Oldest first', 'validation': 'first_result_older_than_last'},
            {'order': 'LEX_ASC', 'description': 'Alphabetical ascending', 'validation': 'alphabetical_order_ascending'},
            {'order': 'LEX_DESC', 'description': 'Alphabetical descending', 'validation': 'alphabetical_order_descending'}
        ],
        
        'pagination': {
            'small_page_size': 1,
            'default_page_size': 30,
            'large_page_size': 50,
            'test_query': '',
            'min_total_results': 10
        },
        
        'result_expectations': {
            'all_packages_query': {'min_results': 10, 'description': 'Empty search should return substantial results'},
            'no_results_query': {'query': 'nonexistent-query-12345', 'expected_results': 0, 'description': 'Nonsense query should return zero results'}
        },
        
        'error_conditions': {
            'invalid_parameters': [
                {'parameter': 'buckets', 'invalid_value': 'not-a-list', 'expected_exception': 'TypeError'},
                {'parameter': 'size', 'invalid_value': -1, 'expected_exception': 'ValueError'},
                {'parameter': 'order', 'invalid_value': 'INVALID_ORDER', 'expected_exception': 'ValueError'}
            ]
        },
        
        'result_structure': {
            'search_result_attributes': ['hits', 'has_next', 'next_cursor'],
            'hit_attributes': ['bucket', 'key', 'name', 'score', 'modified']
        }
    }
    
    # Add discovered buckets to config
    for bucket in buckets[:5]:  # Use first 5 buckets
        # Try to find packages in this bucket
        bucket_results = quilt3.search_packages(buckets=[bucket], size=3)
        expected_packages = [hit.name for hit in bucket_results.hits]
        
        config['buckets']['public'].append({
            'name': bucket,
            'description': f'Discovered bucket with {len(expected_packages)} packages',
            'expected_packages': expected_packages
        })
    
    # Add bucket-specific test
    if buckets:
        config['result_expectations']['bucket_specific_query'] = {
            'bucket': buckets[0],
            'min_results': 1,
            'description': f'{buckets[0]} should have packages'
        }
    
    # Write config file
    with open('test_config.yaml', 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)
    
    print(f"✅ Generated test_config.yaml with {len(buckets)} discovered buckets")
    print(f"   Buckets: {[b['name'] for b in config['buckets']['public']]}")
    
except Exception as e:
    print(f"❌ Failed to generate config: {e}")
    print("Make sure you're logged in with 'quilt3.login()' and have network access")
    exit(1)

EOF

echo "test_config.yaml generated successfully!"