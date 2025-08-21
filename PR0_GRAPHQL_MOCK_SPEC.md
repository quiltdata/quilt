# PR 0: GraphQL Mock and Testing Infrastructure

## Overview

Add comprehensive GraphQL mock testing infrastructure for the existing
`quilt3.admin` package. This establishes a safety net before any refactoring
and creates testing patterns for future GraphQL development.

## Goals

- **Safety First**: Test existing admin functionality before any changes
- **Zero Risk**: Only adding tests, no changes to admin code  
- **Foundation**: Establish GraphQL testing patterns for future PRs
- **Documentation**: Tests serve as specification for current behavior
- **Confidence**: Verify baseline works before refactoring

## Current State

- Basic admin tests exist but with limited mocking
- Generated GraphQL client handles all admin operations
- Tests may use real endpoints or simple mocks

## Target State

Create comprehensive testing infrastructure:

- GraphQL operation router for lightweight mocking
- Complete response fixtures for all admin operations
- Schema validation helpers
- Enhanced pytest fixtures for easy test setup
- Comprehensive test coverage for all admin functionality
- No changes to existing admin code

## Implementation Plan

### 1. Create GraphQL Operation Router

**File**: `tests/graphql_operation_router.py`

Create a lightweight GraphQL operation router that:

- Routes GraphQL operations to predefined mock responses
- Tracks call history for test assertions
- Supports dynamic response configuration
- Extracts operation names from GraphQL queries
- Provides utilities for test verification

**Why Operation Router vs Full Mock Server:**

- **Performance**: No network overhead, direct function calls
- **Simplicity**: Easier to debug and maintain
- **Integration**: Works seamlessly with existing pytest infrastructure
- **Reliability**: No port conflicts or server startup issues
- **Speed**: Tests run faster without server bootstrap time

### 2. Create Response Fixtures

**File**: `tests/fixtures/admin_graphql_responses.py`

Build comprehensive fixtures covering:

- All user operations (list, get, create, delete, mutations)
- Role operations (list)
- SSO configuration operations (get, set)
- Tabulator operations (list tables, set table, rename table, open query)
- Error responses (validation errors, operation errors, not found)
- Helper functions for dynamic response generation

### 3. Create Schema Validation Helpers

**File**: `tests/fixtures/graphql_schema_fragments.py`

Implement validation utilities that:

- Validate GraphQL response structures
- Handle both GraphQL camelCase and dataclass snake_case formats
- Support nested object validation (roles, users)
- Provide clear validation error messages

### 4. Enhanced Pytest Fixtures

**File**: `tests/conftest.py`

Add pytest fixtures that:

- Configure GraphQL operation router with common responses
- Mock admin client GraphQL calls seamlessly
- Integrate with existing test infrastructure
- Support easy test setup and teardown

### 5. Comprehensive Test Coverage

**File**: `tests/test_admin_api.py`

Implement comprehensive test classes covering:

- All user operations with success and error scenarios
- Role operations testing
- SSO configuration testing
- Tabulator operations testing
- Error handling and edge cases
- Mock infrastructure verification

## Testing Strategy

### Coverage Areas

1. **All Admin Operations**:
   - Users: list, get, create, delete, update (email, admin, active, role)
   - Roles: list
   - SSO Config: get, set
   - Tabulator: list tables, set table, rename table, open query

2. **Error Scenarios**:
   - Invalid input validation
   - Operation failures
   - Not found errors
   - Malformed GraphQL responses

3. **Edge Cases**:
   - Empty responses
   - Null values
   - Different data formats

### Test Categories

- **Unit Tests**: Individual admin functions with mocked responses
- **Integration Tests**: Full admin workflows using operation router
- **Error Tests**: Comprehensive error handling validation
- **Infrastructure Tests**: Mock router functionality verification

## Benefits

1. **Safety Net**: Comprehensive tests before any refactoring
2. **Documentation**: Tests serve as living documentation of admin behavior
3. **Regression Prevention**: Catch any changes to existing functionality
4. **Development Speed**: Fast, reliable tests with no external dependencies
5. **Foundation**: Testing patterns ready for future GraphQL features

## Success Criteria

1. **Complete Admin Coverage**: All existing admin operations tested
2. **Error Handling**: All error scenarios covered
3. **Fast Tests**: Test suite runs quickly with no external dependencies
4. **Reliable**: Deterministic results, no flaky tests
5. **Maintainable**: Clear test structure and good documentation

## Files Created/Modified

### New Files

- `tests/graphql_operation_router.py` - Operation router implementation
- `tests/fixtures/admin_graphql_responses.py` - Response fixtures
- `tests/fixtures/graphql_schema_fragments.py` - Validation helpers

### Modified Files

- `tests/conftest.py` - Enhanced with GraphQL fixtures
- `tests/test_admin_api.py` - Enhanced with comprehensive coverage

### Unchanged

- `quilt3/admin/` - No changes to admin code

## Dependencies

- Existing admin package (unchanged)
- pytest and mock libraries (already available)
- Current GraphQL schema for response validation

## Design Decisions

### Testing Infrastructure

**Decision**: Operation router approach

- Lightweight routing without full server overhead
- Fast, reliable, deterministic tests
- Easy integration with existing test infrastructure
- No external dependencies

### Error Handling

**Decision**: Follow existing patterns

- Use existing `Quilt3AdminError` hierarchy
- Maintain compatibility with current error handling

## Next Steps

After PR0 completion:

- **PR1**: Refactor GraphQL infrastructure (with safety net in place)
- **PR2**: Implement package search (using established testing patterns)
