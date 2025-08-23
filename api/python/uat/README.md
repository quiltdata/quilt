# Quilt Package Search UAT

Comprehensive testing suite for `quilt3.search_packages()` API functionality demonstrating ALL parameter combinations and Python integration patterns.

## Quick Start

Run all tests:
```bash
./run_tests.sh
```

Run specific test with debug logging:
```bash
./run_tests.sh --debug --test parameter_coverage
```

## API Under Test

```python
def search_packages(
    buckets=None,                    # List of bucket names to search (or None for all)
    search_string=None,              # Search query string (or None for all packages)
    filter=None,                     # Dict of filters (date, size, etc.)
    user_meta_filters=None,          # List of user metadata filters
    latest_only=False,               # If True, only latest version of each package
    size=30,                         # Max results per page
    order="BEST_MATCH"               # Sort: BEST_MATCH, NEWEST, OLDEST, LEX_ASC, LEX_DESC
):

def search_more_packages(
    after,                           # Cursor from previous search results
    size=30                          # Max results per page
):
```

## Test Coverage

### Comprehensive Parameter Testing (`test_parameter_coverage.py`)
- **All bucket variations**: None, single bucket, multiple buckets
- **All search_string options**: None, empty, simple queries, complex multi-word
- **All filter types**: None, date filters, size filters, combined filters
- **User metadata filtering**: None, single filters, multiple filters  
- **Version control**: latest_only True/False
- **Result sizing**: Various page sizes (1, 30, 50, 100+)
- **All sort orders**: All 5 ordering options with real data validation

### Pagination Testing (`test_pagination.py`)
- **Complete workflow**: search_packages() → search_more_packages() → completion
- **Edge cases**: Invalid cursors, mixed page sizes, error handling
- **Consistency**: Repeated calls, no duplicate results
- **Parameter combinations**: Pagination with filtering, sorting, bucket selection

### Error Handling Testing (`test_error_handling.py`)
- **Parameter validation**: TypeError/ValueError for invalid inputs
- **Boundary conditions**: Zero/negative sizes, empty lists, invalid formats
- **Filter validation**: Malformed filter dictionaries, invalid operators
- **Authentication**: Permission boundaries, nonexistent buckets
- **Edge cases**: Special characters, very long inputs, network resilience

### Python Integration Testing (`test_python_integration.py`)
- **Import patterns**: Standard import, from import, aliases
- **Function introspection**: Signature inspection, docstrings, availability
- **Return types**: Object structure, attribute validation, type checking
- **Session integration**: Works with quilt3.login(), namespace integration
- **Exception handling**: Proper Python exception hierarchy
- **Memory/resources**: Large result sets, sequential calls, basic thread safety

### Result Structure Testing (`test_result_structure.py`)
- **SearchResult objects**: All required attributes, correct types
- **Hit objects**: bucket, key, name, score attributes with validation
- **Empty results**: Proper structure even with no hits
- **Pagination metadata**: has_next/next_cursor consistency
- **Ordering validation**: Sort orders actually change result sequence  
- **Score values**: Valid numeric scores, BEST_MATCH ordering

## Configuration

Tests use `test_config.yaml` for environment-specific settings:

- **Test buckets**: Public/private buckets with known content
- **Search terms**: Queries with expected result counts
- **Filter examples**: Date ranges, size limits, metadata filters
- **Sort validation**: Expected ordering behaviors
- **Error conditions**: Invalid parameters to test

## Usage Examples

### Run All Tests
```bash
./run_tests.sh
```

### Debug Specific Test
```bash
./run_tests.sh --debug --test parameter_coverage
```

### Use Different Environment
```bash
./run_tests.sh --config staging_config.yaml
```

### Enable Detailed Logging
```bash
./run_tests.sh --logging --verbose
```

## Test Results

Each test validates:

1. **API Completeness**: Every parameter works as documented
2. **Python Integration**: Proper import patterns, return types, exceptions  
3. **Result Structure**: SearchResult and Hit objects have expected attributes
4. **Pagination**: Full workflow from initial search through completion
5. **Error Handling**: Appropriate exceptions for all error conditions

## Legacy Tests

Original test files remain for compatibility:
- `test_basic_search.py` - Basic functionality examples
- `test_filters_params.py` - Parameter variations 
- `test_performance.py` - Performance characteristics

## Prerequisites

- Python environment with `quilt3` installed
- Valid Quilt credentials (via `quilt3.login()` or environment)
- Network access to Quilt registries
- Configuration file with environment-specific test data