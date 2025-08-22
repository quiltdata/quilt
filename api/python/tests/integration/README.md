# Integration Tests for Quilt3 Search API

This directory contains comprehensive integration tests for the Quilt3 search functionality that test against live Quilt infrastructure with real data and authentication.

## Overview

The integration tests validate:
- Authentication and access control
- Real data search accuracy
- Performance characteristics
- Multi-bucket search capabilities
- Error handling and edge cases

## Prerequisites

Before running these tests, ensure:

1. **Authentication**: You must be logged in to Quilt3
   ```bash
   quilt3 login
   ```

2. **Network Access**: Tests require access to live Quilt infrastructure

3. **Test Data**: Access to buckets with searchable content

4. **Environment Setup**: Run the setup script to validate your environment
   ```bash
   python scripts/setup_live_search_tests.py
   ```

## Test Categories

### Authentication Tests (`test_live_search_auth.py`)
- Valid credential verification
- Bucket access control
- Authentication failure handling
- Expired credential scenarios

### Data Search Tests (`test_live_search_data.py`)
- Basic text search
- Metadata filtering
- Size and date filters
- User metadata search
- Empty result handling
- Large result set pagination

### Performance Tests (`test_live_search_performance.py`)
- Response time benchmarking
- Pagination performance
- Concurrent request handling
- Timeout behavior

### Multi-Bucket Tests (`test_live_search_multi_bucket.py`)
- Cross-bucket search
- Access permission validation
- Global vs bucket-specific search
- Mixed access scenarios

## Environment Configuration

### Required Environment Variables

```bash
# Test configuration
export QUILT_LIVE_TEST_BUCKET_PUBLIC="quilt-example"
export QUILT_LIVE_TEST_BUCKET_PRIVATE="private-test-bucket"
export QUILT_LIVE_TEST_BUCKET_LARGE="large-dataset-bucket"
export QUILT_LIVE_TEST_PERFORMANCE_ITERATIONS=10
export QUILT_LIVE_TEST_TIMEOUT=30

# Authentication
export QUILT_REGISTRY_URL="https://your-registry.quiltdata.io"
```

### Default Values
If environment variables are not set, tests will use sensible defaults:
- Public bucket: `quilt-example`
- Performance iterations: `10`
- Timeout: `30` seconds

## Running Tests

### Quick Smoke Test
```bash
# Basic functionality check
python -m pytest api/python/tests/integration/test_live_search_auth.py::TestLiveSearchAuthentication::test_search_with_valid_credentials -v
```

### Full Integration Suite
```bash
# All integration tests
python -m pytest api/python/tests/integration/test_live_search_*.py -v

# Specific test category
python -m pytest api/python/tests/integration/test_live_search_data.py -v
```

### Performance-focused Testing
```bash
# Run performance tests with detailed output
python -m pytest api/python/tests/integration/test_live_search_performance.py -v -s
```

## Test Scripts

In addition to pytest tests, several standalone scripts are available:

### Setup and Validation
```bash
# Validate environment setup
python scripts/setup_live_search_tests.py

# Validate search functionality
python scripts/validate_search_functionality.py --quick
```

### Performance Analysis
```bash
# Basic performance benchmark
python scripts/benchmark_live_search.py

# Detailed performance analysis
python scripts/benchmark_live_search.py --detailed --output performance_report.json
```

### Regression Testing
```bash
# Run regression tests
python scripts/search_regression_tests.py

# Save current results as baseline
python scripts/search_regression_tests.py --save-baseline

# Compare against baseline
python scripts/search_regression_tests.py --output regression_report.json
```

### Interactive Exploration
```bash
# Interactive search explorer
python scripts/interactive_search_explorer.py
```

## Test Data Requirements

### Recommended Test Buckets

1. **Public Bucket**: Well-known public bucket with diverse packages
   - Example: `quilt-example`
   - Should contain packages with various file types and metadata

2. **Private Bucket**: Controlled access bucket for permission testing
   - Used to test access control mechanisms
   - Should be accessible to test user

3. **Large Bucket**: Bucket with many packages for performance testing
   - Used for pagination and performance benchmarks
   - Should contain 100+ packages

### Test Package Characteristics

Test packages should include:
- Various file types (CSV, Parquet, images, etc.)
- Rich metadata (descriptions, tags, user metadata)
- Different sizes (small, medium, large)
- Different modification dates
- Special characters in names/metadata

## Interpreting Results

### Test Status
- **PASS**: Test completed successfully
- **FAIL**: Test failed - indicates potential issues
- **SKIP**: Test was skipped (usually due to missing prerequisites)
- **ERROR**: Test encountered an unexpected error

### Common Skip Reasons
Tests may be skipped due to:
- Missing authentication credentials
- Inaccessible test buckets
- Network connectivity issues
- Missing test data

### Performance Benchmarks
Performance tests establish baselines for:
- Search response times (typically < 5 seconds)
- Pagination performance
- Concurrent request handling
- Large result set processing

## Logging and Debugging

### Enable Search Logging

The search implementation includes comprehensive logging for debugging and monitoring:

```python
# Enable debug logging for all search operations
import quilt3.search_logging
quilt3.search_logging.enable_debug_logging('search_debug.log')

# Run tests with detailed logging
python -m pytest api/python/tests/integration/ -v
```

### Custom Logging Configuration

```python
import logging
import quilt3.search_logging

# Configure specific logging levels and outputs
quilt3.search_logging.configure_search_logging(
    level=logging.DEBUG,
    include_console=True,
    log_file='integration_test_logs.log'
)
```

### Performance Monitoring

```python
# Use the performance decorator for custom search functions
@quilt3.search_logging.log_search_performance
def my_search_test():
    return quilt3.search_packages("test data")
```

### Test Logging with Scripts

```bash
# Run the logging test suite
python scripts/test_search_logging.py

# Run setup validation with detailed logging
python scripts/setup_live_search_tests.py --log-level DEBUG
```

## Troubleshooting

### Authentication Issues
```bash
# Check login status
quilt3 config

# Re-authenticate
quilt3 login
```

### Bucket Access Issues
```bash
# Verify bucket access with logging
python -c "
import quilt3.search_logging
quilt3.search_logging.enable_debug_logging()
import quilt3
print(quilt3.search_packages('', bucket='your-bucket', limit=1))
"
```

### Network Issues
- Ensure stable internet connection
- Check firewall settings  
- Verify Quilt registry URL
- Enable debug logging to see detailed network traces

### Performance Issues
- Tests may be slower on poor network connections
- Adjust timeout values via environment variables
- Consider reducing iteration counts for faster runs
- Use performance logging to identify bottlenecks

### Debug Search Issues
```bash
# Enable comprehensive logging and run a single test
python -c "
import quilt3.search_logging
quilt3.search_logging.enable_debug_logging('search_debug.log')
import quilt3
results = quilt3.search_packages('your-query')
print(f'Results: {len(results.hits)} hits')
"

# Check the debug log for detailed execution traces
tail -f search_debug.log
```

## Contributing

When adding new integration tests:

1. Follow the existing test structure and naming conventions
2. Include proper error handling and skip conditions
3. Add environment variable configuration where appropriate
4. Update this README with new test descriptions
5. Ensure tests work with various bucket configurations

## Test Isolation

These integration tests are designed to:
- Not modify existing data (read-only operations)
- Handle missing or changing data gracefully
- Work across different Quilt environments
- Provide consistent results across runs

## Reporting Issues

If integration tests reveal issues:

1. Check environment configuration first
2. Verify network connectivity and authentication
3. Run individual test files to isolate problems
4. Save detailed test outputs and performance reports
5. Include environment details in issue reports