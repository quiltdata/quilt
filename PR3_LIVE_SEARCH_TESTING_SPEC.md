# PR 3: Live Stack Search API Testing

## Overview

Create a comprehensive test suite for the search API that exercises real functionality
against a live Quilt stack using authenticated `quilt3` credentials. This PR
focuses on integration testing and validation of the search implementation in
production-like environments.

## Prerequisites

- PR 2 (Package Search Implementation) must be merged
- Working `quilt3.search_packages()` API implementation
- Live Quilt stack with searchable content
- Valid `quilt3` login credentials for test environments

## Goals

- **Live Integration Testing**: Test search API against real Quilt infrastructure
- **Authentication Validation**: Verify search works with real authentication flows
- **Performance Benchmarking**: Measure search performance under realistic conditions
- **End-to-End Validation**: Ensure search functionality works across different scenarios
- **Regression Prevention**: Establish baseline for future search improvements

## Test Categories

### 1. Authentication & Access Tests

**File**: `/api/python/tests/integration/test_live_search_auth.py`

```python
"""
Live authentication and access control tests for search API.
Requires valid quilt3 login credentials.
"""

class TestLiveSearchAuthentication:
    """Test search with real authentication."""
    
    def test_search_with_valid_credentials(self):
        """Test search succeeds with valid login."""
        # Assumes user is logged in via `quilt3 login`
        
    def test_search_bucket_access_control(self):
        """Test search respects bucket access permissions."""
        
    def test_search_without_credentials(self):
        """Test search fails gracefully without login."""
        
    def test_search_with_expired_credentials(self):
        """Test search handles expired tokens."""
```

### 2. Real Data Search Tests

**File**: `/api/python/tests/integration/test_live_search_data.py`

```python
"""
Search tests against real data in live buckets.
"""

class TestLiveSearchData:
    """Test search against real package data."""
    
    def test_basic_text_search(self):
        """Test basic text search across known packages."""
        
    def test_metadata_filter_search(self):
        """Test filtering by package metadata."""
        
    def test_size_and_date_filters(self):
        """Test numeric and date range filters."""
        
    def test_user_metadata_search(self):
        """Test searching within user-defined metadata."""
        
    def test_empty_result_handling(self):
        """Test search with queries that return no results."""
        
    def test_large_result_set_handling(self):
        """Test search with queries returning many results."""
```

### 3. Pagination & Performance Tests

**File**: `/api/python/tests/integration/test_live_search_performance.py`

```python
"""
Performance and pagination tests against live data.
"""

class TestLiveSearchPerformance:
    """Test search performance characteristics."""
    
    def test_pagination_across_multiple_pages(self):
        """Test paginating through large result sets."""
        
    def test_search_response_times(self):
        """Benchmark search response times."""
        
    def test_concurrent_search_requests(self):
        """Test multiple simultaneous search operations."""
        
    def test_search_timeout_handling(self):
        """Test search behavior with network timeouts."""
```

### 4. Cross-Bucket Search Tests

**File**: `/api/python/tests/integration/test_live_search_multi_bucket.py`

```python
"""
Multi-bucket search scenarios.
"""

class TestLiveMultiBucketSearch:
    """Test search across multiple buckets."""
    
    def test_search_multiple_accessible_buckets(self):
        """Test search across multiple buckets user has access to."""
        
    def test_search_mixed_access_buckets(self):
        """Test search with mix of accessible and restricted buckets."""
        
    def test_global_search_without_bucket_filter(self):
        """Test global search across all accessible buckets."""
```

## Suggested Test Scripts

### Environment Setup Script

**File**: `/scripts/setup_live_search_tests.py`

```python
#!/usr/bin/env python3
"""
Setup script for live search testing.
Validates environment and prepares test data.
"""

def validate_quilt_login():
    """Check if user is logged into quilt3."""
    
def discover_test_buckets():
    """Find accessible buckets with searchable content."""
    
def validate_search_api_availability():
    """Check if search API is accessible."""
    
def setup_test_data_if_needed():
    """Create test packages if none exist."""
```

### Performance Benchmarking Script

**File**: `/scripts/benchmark_live_search.py`

```python
#!/usr/bin/env python3
"""
Benchmark search API performance against live stack.
"""

def benchmark_basic_search():
    """Measure basic search operation performance."""
    
def benchmark_filtered_search():
    """Measure performance with various filters applied."""
    
def benchmark_pagination():
    """Measure pagination performance."""
    
def generate_performance_report():
    """Create performance report with metrics."""
```

### Search Validation Script

**File**: `/scripts/validate_search_functionality.py`

```python
#!/usr/bin/env python3
"""
Validate search functionality against known data.
"""

def validate_search_accuracy():
    """Test search returns expected results for known queries."""
    
def validate_filter_functionality():
    """Test all filter types work correctly."""
    
def validate_sorting_options():
    """Test all sort orders work correctly."""
    
def validate_metadata_search():
    """Test user metadata search functionality."""
```

### Regression Testing Script

**File**: `/scripts/search_regression_tests.py`

```python
#!/usr/bin/env python3
"""
Regression test suite for search API.
"""

def test_search_result_consistency():
    """Ensure search results are consistent across runs."""
    
def test_backwards_compatibility():
    """Ensure search API maintains compatibility."""
    
def test_error_handling_consistency():
    """Ensure error cases are handled consistently."""
```

### Interactive Search Explorer

**File**: `/scripts/interactive_search_explorer.py`

```python
#!/usr/bin/env python3
"""
Interactive tool for exploring search capabilities.
"""

def interactive_search_session():
    """Interactive CLI for testing search queries."""
    
def save_search_results():
    """Save interesting search results for analysis."""
    
def compare_search_results():
    """Compare results across different query variations."""
```

## Test Data Requirements

### Test Buckets

- **Public bucket** with well-known packages for basic testing
- **Private bucket** with controlled access for permission testing  
- **Large bucket** with many packages for performance testing
- **Metadata-rich bucket** with varied user metadata for filter testing

### Test Packages

- Packages with various **file types** (CSV, Parquet, images, etc.)
- Packages with **rich metadata** (descriptions, tags, user metadata)
- Packages of different **sizes** (small, medium, large)
- Packages with different **modification dates** for temporal filtering
- Packages with **special characters** in names/metadata for edge case testing

## Environment Variables for Testing

```bash
# Test configuration
QUILT_LIVE_TEST_BUCKET_PUBLIC="quilt-example"
QUILT_LIVE_TEST_BUCKET_PRIVATE="private-test-bucket"  
QUILT_LIVE_TEST_BUCKET_LARGE="large-dataset-bucket"
QUILT_LIVE_TEST_PERFORMANCE_ITERATIONS=10
QUILT_LIVE_TEST_TIMEOUT=30

# Authentication
QUILT_REGISTRY_URL="https://your-registry.quiltdata.io"
```

## Test Execution Patterns

### 1. Quick Smoke Tests

```bash
# Basic functionality check
python -m pytest \
  tests/integration/test_live_search_auth.py::\
    TestLiveSearchAuthentication::test_search_with_valid_credentials \
  -v

# Data validation  
python scripts/validate_search_functionality.py --quick
```

### 2. Full Integration Suite

```bash  
# Complete integration test suite
python -m pytest tests/integration/test_live_search_*.py -v

# Performance benchmarking
python scripts/benchmark_live_search.py --detailed
```

### 3. Regression Testing

```bash
# Automated regression checks
python scripts/search_regression_tests.py

# Interactive exploration
python scripts/interactive_search_explorer.py
```

## Success Criteria

1. **Authentication Integration**: Search works seamlessly with `quilt3 login` flow
2. **Real Data Accuracy**: Search returns accurate results against live data
3. **Performance Standards**: Search responds within acceptable time limits
4. **Error Handling**: Graceful handling of network issues, auth failures, etc.
5. **Cross-Bucket Functionality**: Search works across multiple accessible buckets
6. **Pagination Reliability**: Pagination works correctly with large result sets
7. **Filter Accuracy**: All filter types work correctly with real data

## Risk Mitigation

**Risk**: Tests depend on external live stack availability  
**Mitigation**: Include offline fallback tests and clear environment validation

**Risk**: Tests may expose sensitive data or credentials  
**Mitigation**: Use test-specific buckets and validate credential handling

**Risk**: Performance tests may be inconsistent due to network conditions  
**Mitigation**: Include multiple test runs and statistical analysis

**Risk**: Tests may fail due to data changes in live buckets  
**Mitigation**: Use well-established public datasets and version pinning where possible

## Files Created

```tree
# Live integration tests
api/python/tests/integration/test_live_search_auth.py
# Authentication tests
api/python/tests/integration/test_live_search_data.py
# Real data tests  
api/python/tests/integration/test_live_search_performance.py    # Performance tests
api/python/tests/integration/test_live_search_multi_bucket.py   # Multi-bucket tests

# Test utilities and scripts
scripts/setup_live_search_tests.py                             # Environment setup
scripts/benchmark_live_search.py                               # Performance benchmarking
scripts/validate_search_functionality.py                       # Functional validation
scripts/search_regression_tests.py                             # Regression testing
scripts/interactive_search_explorer.py                         # Interactive exploration

# Configuration and documentation  
tests/integration/README.md
# Integration test guide
tests/integration/pytest.ini                                   # Test configuration
.github/workflows/test-search-integration.yml                  # CI integration
```

## CI/CD Integration

**File**: `.github/workflows/test-search-integration.yml`

```yaml
name: Search API Integration Tests

on:
  push:
    branches: [master]
  pull_request:
    paths: 
      - 'api/python/quilt3/_search.py'
      - 'api/python/tests/integration/test_live_search_*.py'

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    environment: integration-testing
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
        
    - name: Install dependencies
      run: |
        cd api/python
        pip install -e .
        pip install pytest
        
    - name: Setup Quilt credentials
      env:
        QUILT_AUTH_TOKEN: ${{ secrets.QUILT_TEST_TOKEN }}
        QUILT_REGISTRY_URL: ${{ secrets.QUILT_TEST_REGISTRY }}
      run: |
        quilt3 login --token $QUILT_AUTH_TOKEN $QUILT_REGISTRY_URL
        
    - name: Run integration tests
      run: |
        cd api/python
        python scripts/setup_live_search_tests.py
        pytest tests/integration/test_live_search_*.py -v
        
    - name: Performance benchmarking
      run: |
        cd api/python  
        python scripts/benchmark_live_search.py --ci-mode
```

## Component Integration

This PR extends the search functionality with real-world validation:

- **Authentication**: Validates search works with existing `quilt3.login()` flow
- **Live Data**: Tests against real packages and buckets  
- **Performance**: Establishes baseline performance characteristics
- **Reliability**: Ensures robust error handling and edge case coverage
- **Documentation**: Provides examples and validation of search capabilities

## Dependencies

- PR 2 (Package Search Implementation) merged and functional
- Access to live Quilt stack with test data
- Valid authentication credentials for testing
- CI/CD environment configured with test secrets
- Performance benchmarking infrastructure
