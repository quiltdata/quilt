<!-- markdownlint-disable line-length -->
# PR 3: Live Search API Demonstration & Validation

## Overview

This PR is to demonstrate HOW the new `search_packages` API works in practice and proves
its functionality through comprehensive live testing. The goal is to showcase the
API's capabilities against real Quilt infrastructure and validate that it delivers
the expected search experience.

## Prerequisites

- PR 2 (Package Search Implementation) must be merged
- Working `quilt3.search_packages()` API implementation
- Live Quilt stack with searchable content
- Valid `quilt3` login credentials for test environments

## Key Demonstrations Required

The live tests, implemented as scripts in the `uat` folder,
must **accomplish** and **prove** the following core Python API capabilities. It should do this via:

- a shell script that runs the tests, and can display both the actual results of each test, as well as their success or failure.
- helper Python script(s) to simplify the shell script
- a config file that provides environment-specific buckets, packages, search terms, and expectations

The shell script should have an option to "debug" a specific test, by enabling logging of the search_packages API and running just that one test.

### 1. **Parameter Coverage - All API Functionality**

**Bucket Selection:**

- `buckets=None` - Search across all accessible buckets  
- `buckets=["single-bucket"]` - Search within specific bucket
- `buckets=["bucket1", "bucket2"]` - Multi-bucket search

**Search Query Variations:**

- `search_string=None` - Return all packages (no text filter)
- `search_string=""` - Empty string behavior  
- `search_string="keyword"` - Basic text search
- `search_string="complex query with spaces"` - Multi-word queries

**Filter Parameter Usage:**

- `filter=None` - No additional filters
- `filter={"modified": {"gte": "2023-01-01"}}` - Date filtering
- `filter={"size": {"lt": 1000000}}` - Size filtering
- Complex filter combinations

**User Metadata Filtering:**

- `user_meta_filters=None` - No metadata filters
- `user_meta_filters=[{"key": "department", "value": "engineering"}]` - Single metadata filter
- `user_meta_filters=[multiple filters]` - Combined metadata filtering

**Version Control:**

- `latest_only=False` - All package versions
- `latest_only=True` - Only latest versions

**Result Sizing:**

- `size=30` - Default pagination size
- `size=1` - Minimal results for testing
- `size=100` - Large result sets

**Sort Order Options:**

- `order="BEST_MATCH"` - Relevance-based sorting (default)
- `order="NEWEST"` - Most recent first
- `order="OLDEST"` - Oldest first  
- `order="LEX_ASC"` - Alphabetical ascending
- `order="LEX_DESC"` - Alphabetical descending

**Pagination Functionality:**

- Initial `search_packages()` call returns `SearchResult` with pagination info
- `search_more_packages(after=cursor, size=30)` - Continuation pagination
- `has_next` and `next_cursor` properties for pagination control

### 2. **Python API Integration**

- Works immediately after `quilt3.login()` without additional setup
- Returns proper Python objects (`SearchResult` with `.hits` array)
- Handles Python exceptions appropriately (authentication, validation, network)
- Integrates with existing `quilt3` session management

### 3. **Edge Case Handling**

- Empty result sets return valid `SearchResult` objects
- Invalid parameter types raise appropriate Python exceptions
- Network/authentication failures propagate meaningful error messages
- Graceful handling of permission boundaries

### 4. **Result Structure Validation**

- `SearchResult` object structure and properties
- Individual hit objects with proper attributes (`bucket`, `key`, `score`)
- Pagination metadata (`has_next`, `next_cursor`)
- Result ranking and scoring behavior

## What the Tests Must Accomplish

### 1. **Comprehensive Parameter Testing**

The tests must demonstrate every parameter combination works:

- **All bucket selection patterns:** None, single bucket, multiple buckets
- **All search_string variations:** None, empty, simple, complex queries
- **All filter types:** None, date filters, size filters, combined filters  
- **All user_meta_filters:** None, single filter, multiple filters
- **Both latest_only values:** True and False behavior
- **Various size values:** Small (1), default (30), large (100+)
- **All order options:** Each of the 5 sort orders with real data
- **Pagination flow:** Initial search → `search_more_packages()` → completion

### 2. **Python Integration Validation**

The tests must confirm Python-specific functionality:

- **Import and call pattern:** `import quilt3; quilt3.search_packages()`
- **Session integration:** Works with existing `quilt3.login()` session
- **Return type validation:** `SearchResult` objects with proper structure
- **Exception handling:** Python exceptions for invalid inputs and auth failures
- **Object properties:** Access to `.hits`, `.has_next`, `.next_cursor` attributes

### 3. **Result Structure Verification**

The tests must validate the complete result structure:

- **SearchResult properties:** All expected attributes present and typed correctly
- **Hit object structure:** Each result contains proper `bucket`, `key`, `score` fields
- **Pagination metadata:** `has_next` and `next_cursor` work for continuation
- **Empty results handling:** Valid objects returned even with zero hits
- **Result ordering:** Verify sort orders actually change result sequence

### 4. **Error Condition Coverage**

The tests must prove error handling works correctly:

- **Parameter validation:** Invalid types raise appropriate Python exceptions
- **Authentication errors:** Meaningful messages when auth fails
- **Permission boundaries:** Graceful handling of inaccessible buckets
- **Network issues:** Proper exception propagation for connectivity problems
- **Invalid filter syntax:** Clear errors for malformed filter dictionaries

### 5. **Real Usage Pattern Validation**

The tests must show common developer workflows function:

- **Progressive filtering:** Start broad, add filters, refine results
- **Multi-step pagination:** Navigate through large result sets completely  
- **Parameter experimentation:** Change sort orders, sizes, filters dynamically
- **Integration workflows:** Search → select → access package pattern

## Test Approach

Rather than traditional unit tests, these tests will focus on **demonstrating real usage patterns**:

- **User Story Tests**: "As a data scientist, I want to find all CSV files in my team's buckets from the last month"
- **Workflow Validation**: Complete end-to-end scenarios from login to search to package access
- **Performance Benchmarks**: Measure real response times against representative data
- **Usability Validation**: Confirm the API behaves as developers would expect

## Success Criteria

The tests succeed when they prove:

1. **Complete API Coverage**: Every parameter and parameter combination works as documented
2. **Python Integration**: Seamless integration with existing `quilt3` session and import patterns
3. **Proper Return Types**: All methods return correctly structured Python objects with expected attributes
4. **Error Handling**: Appropriate Python exceptions for invalid inputs, auth failures, and permission issues  
5. **Pagination Functionality**: The ability to efficiently and elegantly page through multi-page results.

## Test Data Requirements

To accomplish these demonstrations, tests need access to:

- **Public test bucket** with well-known, searchable packages
- **Private test bucket** to validate access control behavior  
- **Large test dataset** to verify performance with realistic data volumes
- **Diverse package types** to show search works across different content formats
- **Rich metadata** to demonstrate filtering and search capabilities

## Example Test Scenarios

The tests will validate comprehensive API parameter usage:

### **Scenario 1: Complete Parameter Matrix**

"Demonstrate every parameter combination works correctly"

```python
# Bucket variations
results_all = search_packages()  # buckets=None
results_single = search_packages(buckets=["my-bucket"])
results_multi = search_packages(buckets=["bucket1", "bucket2"])

# Search string variations  
results_no_query = search_packages(search_string=None)
results_empty = search_packages(search_string="")
results_simple = search_packages(search_string="data")
results_complex = search_packages(search_string="machine learning model")

# All sort orders
for order in ["BEST_MATCH", "NEWEST", "OLDEST", "LEX_ASC", "LEX_DESC"]:
    results = search_packages(search_string="test", order=order, size=5)
    # Validate: Order actually affects result sequence

# Filter combinations
results_date = search_packages(filter={"modified": {"gte": "2023-01-01"}})
results_size = search_packages(filter={"size": {"lt": 1000000}})
results_combined = search_packages(filter={
    "modified": {"gte": "2023-01-01"},
    "size": {"lt": 1000000}
})

# Version control
results_all_versions = search_packages(latest_only=False, size=10)
results_latest_only = search_packages(latest_only=True, size=10)

# User metadata filtering
results_meta = search_packages(user_meta_filters=[
    {"key": "department", "value": "engineering"}
])
```

### **Scenario 2: Pagination Flow Validation**

"Complete pagination workflow from start to finish"

```python
# Initial search
initial = search_packages(search_string="", size=5)
all_results = list(initial.hits)

# Paginate through all results
current = initial
while current.has_next:
    current = search_more_packages(after=current.next_cursor, size=5)
    all_results.extend(current.hits)
    
# Validate: Complete result set retrieved, no duplicates
```

### **Scenario 3: Python Integration Verification**

"Confirm Python-specific functionality works"

```python
import quilt3

# After login, search works immediately
quilt3.login()
results = quilt3.search_packages(buckets=["test-bucket"])

# Result objects have proper structure
assert hasattr(results, 'hits')
assert hasattr(results, 'has_next') 
assert hasattr(results, 'next_cursor')

# Individual hits have required properties
for hit in results.hits:
    assert hasattr(hit, 'bucket')
    assert hasattr(hit, 'key')
    assert hasattr(hit, 'score')
```

### **Scenario 4: Error Handling Coverage**

"Validate exception handling for all error conditions"

```python
# Parameter validation errors
try:
    search_packages(buckets="not-a-list")  # Should raise TypeError
except TypeError:
    pass

try:
    search_packages(size=-1)  # Should raise ValueError
except ValueError:
    pass

try:
    search_packages(order="INVALID")  # Should raise ValueError  
except ValueError:
    pass

# Authentication/permission errors
try:
    search_packages(buckets=["inaccessible-bucket"])
except Exception as e:
    # Should provide meaningful error message
    assert "permission" in str(e).lower() or "access" in str(e).lower()
```

### **Scenario 5: Result Structure Validation**

"Verify all return values meet API contract"

```python
# Empty results still return valid objects
empty_results = search_packages(search_string="nonexistent-query-12345")
assert isinstance(empty_results.hits, list)
assert len(empty_results.hits) == 0
assert isinstance(empty_results.has_next, bool)

# Non-empty results have proper structure
results = search_packages(size=3)
assert len(results.hits) <= 3
for hit in results.hits:
    assert isinstance(hit.bucket, str)
    assert isinstance(hit.key, str)
    assert isinstance(hit.score, (int, float))
```

## Testing Environment Requirements

To accomplish these demonstrations, the test environment must include:

- **Live Quilt registry** with real authentication
- **Test buckets** with known, searchable content
- **Performance baselines** for response time validation  
- **Access control scenarios** to test permission boundaries
- **Diverse data types** to validate search across different content

## Measuring Success

The tests prove the Python API wrapper works when they demonstrate:

1. **Parameter Completeness**: Every documented parameter works correctly with real data
2. **Python Object Structure**: Return types match API contract with proper attributes and methods
3. **Exception Handling**: Python-appropriate errors for all failure modes  
4. **Integration Simplicity**: Works immediately after `quilt3.login()` without additional configuration
5. **Pagination Workflow**: Complete multi-step pagination using `search_more_packages()` functions correctly

## Risk Considerations

**Live Testing Dependencies**: Tests require external infrastructure and data

- *Mitigation*: Clear environment validation and graceful failure handling

**Data Consistency**: Live data may change, affecting test repeatability  

- *Mitigation*: Focus on capability validation rather than exact result matching

**Performance Variability**: Network conditions affect response times

- *Mitigation*: Statistical analysis across multiple test runs

**Access Control Complexity**: Permission scenarios may be difficult to reproduce

- *Mitigation*: Use dedicated test accounts with known permission boundaries
