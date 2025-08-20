# PR 1: GraphQL Infrastructure Refactoring

## Overview

Extract GraphQL code generation infrastructure from `quilt3-admin` to parent level, making it shared infrastructure for both admin and main quilt3 APIs.

## Goals

- **Low Risk**: Pure refactoring with no functional changes
- **Clean Foundation**: Establish shared GraphQL infrastructure
- **Prepare for Search**: Set up architecture for `quilt3.search_packages()`
- **Maintain Compatibility**: Ensure admin package continues working unchanged

## Current State

```
api/python/quilt3-admin/
├── pyproject.toml              # ariadne-codegen config
├── queries.graphql             # Admin GraphQL queries
└── requirements.txt            # GraphQL dependencies

api/python/quilt3/admin/_graphql_client/
├── *.py                        # Generated GraphQL code
└── __init__.py                 # Exports
```

## Target State

```
api/python/quilt3-graphql/
├── pyproject.toml              # Moved ariadne-codegen config
├── queries.graphql             # Admin queries (unchanged)
├── requirements.txt            # GraphQL dependencies
└── README.md                   # Code generation instructions

api/python/quilt3/_graphql_client/
├── *.py                        # Generated GraphQL code (moved here)
└── __init__.py                 # Updated exports

api/python/quilt3/admin/
└── *.py                        # Updated imports only
```

## Implementation Steps

### 1. Create Shared GraphQL Package

**File**: `/api/python/quilt3-graphql/pyproject.toml`
```toml
[tool.ariadne-codegen]
schema_path = "../../../shared/graphql/schema.graphql"
queries_path = "queries.graphql"
target_package_path = "../quilt3/"
target_package_name = "_graphql_client"
# ... rest of config copied from quilt3-admin
```

**File**: `/api/python/quilt3-graphql/queries.graphql`
- Copy existing admin queries unchanged

**File**: `/api/python/quilt3-graphql/requirements.txt`
- Move GraphQL dependencies from admin package

### 2. Update Code Generation

**Command**:
```bash
cd api/python/quilt3-graphql
ariadne-codegen
```

**Result**: Generated code now lives in `/api/python/quilt3/_graphql_client/`

### 3. Update Admin Package Imports

**Files**: `/api/python/quilt3/admin/*.py`

Update all imports:
```python
# Before
from ._graphql_client import Client, UsersList, etc.

# After  
from .._graphql_client import Client, UsersList, etc.
```

### 4. Clean Up Old Locations

- Remove `/api/python/quilt3-admin/pyproject.toml`
- Remove `/api/python/quilt3-admin/queries.graphql`
- Remove `/api/python/quilt3/admin/_graphql_client/` directory
- Update `/api/python/quilt3-admin/README.md` to reference new location

### 5. Update CI/CD

**File**: `.github/workflows/test-quilt3-admin-codegen.yaml`

Update working directory and paths:
```yaml
defaults:
  run:
    working-directory: ./api/python/quilt3-graphql  # Changed
```

## Testing Strategy

### 1. Admin Functionality Tests
- Run existing admin test suite
- Verify all admin operations work unchanged
- Test code generation pipeline

### 2. Import Verification
- Verify all admin imports resolve correctly
- Check no circular import issues
- Validate generated client exports

### 3. CI/CD Validation
- Ensure code generation workflow passes
- Verify admin package tests pass
- Check no regression in functionality

## Success Criteria

1. **No Functional Changes**: Admin package works exactly as before
2. **Clean Architecture**: GraphQL infrastructure is now shared
3. **Working CI/CD**: All existing workflows pass
4. **Ready for Search**: Foundation prepared for adding search functionality

## Risks & Mitigations

**Risk**: Breaking admin package imports
**Mitigation**: Careful testing of all admin modules and comprehensive test suite

**Risk**: CI/CD pipeline failures  
**Mitigation**: Update workflows incrementally and test thoroughly

**Risk**: Code generation issues
**Mitigation**: Verify generated code matches previous output exactly

## Files Changed

```
# New files
api/python/quilt3-graphql/pyproject.toml          # New
api/python/quilt3-graphql/queries.graphql         # Moved
api/python/quilt3-graphql/requirements.txt        # Moved
api/python/quilt3-graphql/README.md               # New
api/python/quilt3/_graphql_client/                # Generated (new location)

# Modified files  
api/python/quilt3/admin/*.py                      # Updated imports
.github/workflows/test-quilt3-admin-codegen.yaml  # Updated paths

# Removed files
api/python/quilt3-admin/pyproject.toml            # Removed
api/python/quilt3-admin/queries.graphql           # Moved
api/python/quilt3/admin/_graphql_client/          # Moved
```

## Dependencies

- Existing `ariadne-codegen` setup
- GraphQL schema at `/shared/graphql/schema.graphql`
- Existing admin test suite for validation