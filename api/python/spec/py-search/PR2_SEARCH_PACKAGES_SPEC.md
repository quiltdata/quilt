# PR 2: Package Search Implementation

## Overview

Add `quilt3.search_packages()` functionality to the main quilt3 Python client using
the shared GraphQL infrastructure established in PR 1.

## Prerequisites

- PR 1 (GraphQL Infrastructure Refactoring) must be merged
- Shared GraphQL infrastructure available at `/api/python/quilt3/_graphql_client/`

## Goals

- **User-Friendly API**: Simple `quilt3.search_packages()` function
- **TDD Approach**: Test-driven development with comprehensive coverage
- **Consistent Patterns**: Leverage established GraphQL infrastructure
- **Production Ready**: Proper error handling, pagination, performance

## Target API

```python
import quilt3

# Basic search
results = quilt3.search_packages(
    buckets=["my-bucket"],
    search_string="machine learning"
)

# Advanced search with filters
results = quilt3.search_packages(
    buckets=["bucket1", "bucket2"],
    search_string="covid data",
    filter={
        "modified": {"gte": "2023-01-01"},
        "size": {"gte": 1000000}
    },
    latest_only=True,
    size=50,
    order="MODIFIED_DESC"
)

# Pagination
more_results = quilt3.search_more_packages(
    after=results.next_cursor,
    size=50
)
```

## TDD Implementation Approach

### Phase 1: Test-First API Design

**File**: `/api/python/tests/test_search_packages.py`

Create comprehensive test suite:

- Basic search scenarios with mocked GraphQL responses
- Filter combinations and parameter validation
- Pagination behavior and cursor handling
- Error conditions (network, auth, invalid input)
- Integration test patterns

**File**: `/api/python/tests/fixtures/search_responses.py`

Mock GraphQL response fixtures for testing

### Phase 2: Infrastructure Integration

**File**: `/api/python/quilt3-graphql/queries.graphql`

Add search queries to existing admin queries:

```graphql
# Package search fragments
fragment SearchHitPackageSelection on SearchHitPackage {
  key
  bucketName
  score
  modified
  size
  hash
  comment
  # ... all search result fields
}

# Main package search query
query searchPackages(
  $buckets: [String!], 
  $searchString: String, 
  $filter: PackagesSearchFilter, 
  $userMetaFilters: [PackageUserMetaPredicate!], 
  $latestOnly: Boolean = false,
  $size: Int = 30,
  $order: SearchResultOrder = RELEVANCE
) {
  searchPackages(
    buckets: $buckets,
    searchString: $searchString,
    filter: $filter,
    userMetaFilters: $userMetaFilters,
    latestOnly: $latestOnly,
    size: $size,
    order: $order
  ) {
    __typename
    ...PackagesSearchResultSetSelection
    ...InvalidInputSelection
  }
}

# Pagination query
query searchMorePackages($after: String!, $size: Int = 30) {
  searchMorePackages(after: $after, size: $size) {
    __typename
    hasNext
    hits {
      ...SearchHitPackageSelection
    }
    ...InvalidInputSelection
  }
}
```

**Regenerate GraphQL Client**:

```bash
cd api/python/quilt3-graphql
ariadne-codegen
```

### Phase 3: Feature Implementation

**File**: `/api/python/quilt3/_search.py`

Internal search implementation using generated GraphQL client:

```python
from typing import List, Optional, Dict, Any, Union
from ._graphql_client import Client, SearchPackages, SearchMorePackages
from .exceptions import QuiltException


def _get_search_client() -> Client:
    """Get configured GraphQL client for search operations."""
    # Reuse existing quilt3 authentication and endpoint configuration
    pass

def _search_packages(...) -> SearchResult:
    """Internal search implementation."""
    pass

def _search_more_packages(...) -> SearchResult:
    """Internal pagination implementation.""" 
    pass
```

**File**: `/api/python/quilt3/__init__.py`

Public API functions:

```python
from ._search import _search_packages, _search_more_packages

def search_packages(
    buckets: Optional[List[str]] = None,
    search_string: Optional[str] = None,
    filter: Optional[Dict[str, Any]] = None,
    user_meta_filters: Optional[List[Dict[str, Any]]] = None,
    latest_only: bool = False,
    size: int = 30,
    order: str = "RELEVANCE"
) -> SearchResult:
    """Search for packages across accessible buckets."""
    return _search_packages(...)
```

## Implementation Details

### Authentication & Configuration

- Reuse existing `quilt3` registry endpoint discovery
- Leverage existing credential management
- Consistent with current authentication patterns

### Error Handling

- Convert GraphQL errors to appropriate `QuiltException` subclasses
- Provide clear, actionable error messages
- Handle network failures gracefully

### Type Safety

- Use generated GraphQL types for internal operations
- Provide user-friendly types for public API
- Comprehensive type hints throughout

### Performance Considerations

- Efficient GraphQL queries with proper field selection
- Reasonable timeout values
- Connection pooling and reuse

## Testing Strategy

### Unit Tests

- Parameter validation and conversion
- Error handling and exception mapping
- Type conversions and data transformations
- Pagination logic

### Integration Tests

- Actual GraphQL endpoint communication
- Authentication flow
- Real search queries and responses
- Performance and timeout handling

### Mock Tests

- Simulated GraphQL responses using fixtures
- Network failure scenarios
- Authentication errors
- Invalid server responses

## Files Changed

```tree
# Extended shared GraphQL
api/python/quilt3-graphql/queries.graphql         # Add search queries
api/python/quilt3/_graphql_client/                # Regenerated with search

# New search implementation
api/python/quilt3/_search.py                      # Internal implementation
api/python/quilt3/__init__.py                     # Public API functions

# Tests
api/python/tests/test_search_packages.py          # Comprehensive tests
api/python/tests/fixtures/search_responses.py     # Mock responses

# Documentation
docs/api-reference/                               # Updated API docs
```

## Success Criteria

1. **API Usability**: Simple, intuitive interface matching user expectations
2. **Test Coverage**: Comprehensive test suite with >90% coverage  
3. **Performance**: Efficient queries, proper pagination, reasonable timeouts
4. **Error Handling**: Clear, actionable error messages
5. **Documentation**: Complete API documentation and examples
6. **Integration**: Seamless authentication with existing quilt3 setup

## Resolved Design Decisions

### Authentication & Configuration ✅

**Decision**: Reuse existing catalog config and authentication, same as admin module

- No new configuration needed
- Consistent with existing patterns

### Error Handling ✅

**Decision**: Use `PackageException` (existing main package pattern)

- Current search uses simple exceptions, follow that pattern
- Consistent with main quilt3 package exception hierarchy

### Pagination UX ✅

**Decision**: Use `size` parameter consistent with GraphQL schema

- GraphQL schema uses `size` parameter for consistency
- Aligns with backend GraphQL API naming
- Start simple, can add pagination later if needed

### Dependencies ✅

**Decision**: Minimal runtime dependencies

- `ariadne-codegen` is build-time only (not shipped)
- Runtime: just HTTP client (already in quilt3)
- No package size concerns

## Component Changes

This PR introduces a new search component to the quilt3 Python package:

- **New API Surface**: `quilt3.search_packages()` function added to main package
- **GraphQL Integration**: Leverages shared GraphQL client infrastructure from
  PR1  
- **Authentication**: Reuses existing quilt3 authentication mechanisms
- **Error Handling**: Integrates with existing `QuiltException` hierarchy
- **Dependencies**: No new runtime dependencies, builds on existing infrastructure

## Dependencies

- PR 0 (GraphQL Mock) merged - testing infrastructure in place
- PR 1 (GraphQL Infrastructure Refactoring) merged
- Shared GraphQL infrastructure at `/api/python/quilt3/_graphql_client/`
- GraphQL schema at `/shared/graphql/schema.graphql`
- Existing quilt3 authentication and configuration systems
