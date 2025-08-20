# PR 0: GraphQL Mock and Testing Infrastructure

## Overview

Add comprehensive GraphQL mock server and testing infrastructure for the existing `quilt3.admin` package. This establishes a safety net before any refactoring and creates testing patterns for future GraphQL development.

## Goals

- **Safety First**: Test existing admin functionality before any changes
- **Zero Risk**: Only adding tests, no changes to admin code
- **Foundation**: Establish GraphQL testing patterns for future PRs
- **Documentation**: Tests serve as specification for current behavior
- **Confidence**: Verify baseline works before refactoring

## Current State

```
api/python/tests/test_admin_api.py              # Basic admin tests
api/python/quilt3/admin/_graphql_client/        # Generated GraphQL client
```

**Current Testing**: Limited mocking, likely uses real GraphQL endpoints or simple mocks

## Target State

```
api/python/tests/
├── test_admin_api.py                           # Enhanced with mock server
├── graphql_mock_server.py                      # Mock GraphQL server
├── fixtures/
│   ├── admin_graphql_responses.py              # Admin response fixtures
│   └── graphql_schema_fragments.py             # Schema validation helpers
└── conftest.py                                 # Pytest fixtures

api/python/quilt3/admin/                        # No changes to admin code
```

## Implementation Plan

### 1. Create GraphQL Mock Server

**File**: `/api/python/tests/graphql_mock_server.py`

Mock server that can handle GraphQL requests and return predefined responses:
```python
import json
from typing import Dict, Any
from unittest.mock import Mock

class GraphQLMockServer:
    def __init__(self):
        self.responses = {}
        self.call_history = []
    
    def add_response(self, operation_name: str, response: Dict[str, Any]):
        """Add a mock response for a GraphQL operation."""
        pass
        
    def handle_request(self, query: str, variables: Dict[str, Any] = None):
        """Handle a GraphQL request and return mock response."""
        pass
```

### 2. Create Response Fixtures

**File**: `/api/python/tests/fixtures/admin_graphql_responses.py`

Comprehensive fixtures for all admin operations:
```python
# User operations
USERS_LIST_RESPONSE = {
    "data": {
        "admin": {
            "user": {
                "list": [
                    {
                        "name": "testuser",
                        "email": "test@example.com",
                        "dateJoined": "2024-01-01T00:00:00Z",
                        # ... all user fields
                    }
                ]
            }
        }
    }
}

USER_CREATE_SUCCESS = {
    "data": {
        "admin": {
            "user": {
                "create": {
                    "__typename": "User",
                    "name": "newuser",
                    # ... user fields
                }
            }
        }
    }
}

USER_CREATE_ERROR = {
    "data": {
        "admin": {
            "user": {
                "create": {
                    "__typename": "InvalidInput",
                    "errors": [
                        {
                            "path": ["email"],
                            "message": "Invalid email format",
                            "name": "ValidationError"
                        }
                    ]
                }
            }
        }
    }
}

# Role operations
ROLES_LIST_RESPONSE = { ... }

# SSO config operations  
SSO_CONFIG_GET_RESPONSE = { ... }

# Tabulator operations
TABULATOR_TABLES_LIST_RESPONSE = { ... }

# Error responses
NETWORK_ERROR = { ... }
AUTH_ERROR = { ... }
```

### 3. Create Test Utilities

**File**: `/api/python/tests/conftest.py`

Pytest fixtures for easy test setup:
```python
import pytest
from unittest.mock import patch
from .graphql_mock_server import GraphQLMockServer
from .fixtures.admin_graphql_responses import *

@pytest.fixture
def graphql_mock():
    """Provide a configured GraphQL mock server."""
    mock = GraphQLMockServer()
    
    # Pre-configure common responses
    mock.add_response("usersList", USERS_LIST_RESPONSE)
    mock.add_response("rolesList", ROLES_LIST_RESPONSE)
    # ... add all admin operations
    
    return mock

@pytest.fixture
def mock_admin_client(graphql_mock):
    """Provide admin client with mocked GraphQL calls."""
    with patch('quilt3.admin._graphql_client.Client') as mock_client:
        # Configure mock client to use our GraphQL mock
        mock_client.return_value.execute.side_effect = graphql_mock.handle_request
        yield mock_client
```

### 4. Enhanced Admin Tests

**File**: `/api/python/tests/test_admin_api.py`

Comprehensive test coverage using mock server:
```python
import pytest
from quilt3 import admin
from .fixtures.admin_graphql_responses import *

class TestUserOperations:
    """Test all user-related admin operations."""
    
    def test_users_list(self, mock_admin_client, graphql_mock):
        """Test listing users."""
        graphql_mock.add_response("usersList", USERS_LIST_RESPONSE)
        
        users = admin.users.list()
        
        assert len(users) == 1
        assert users[0].name == "testuser"
        assert users[0].email == "test@example.com"
    
    def test_user_create_success(self, mock_admin_client, graphql_mock):
        """Test successful user creation."""
        graphql_mock.add_response("usersCreate", USER_CREATE_SUCCESS)
        
        user = admin.users.create(
            name="newuser",
            email="new@example.com", 
            role="basic"
        )
        
        assert user.name == "newuser"
    
    def test_user_create_validation_error(self, mock_admin_client, graphql_mock):
        """Test user creation with validation errors."""
        graphql_mock.add_response("usersCreate", USER_CREATE_ERROR)
        
        with pytest.raises(admin.exceptions.QuiltAdminError) as exc_info:
            admin.users.create(
                name="newuser",
                email="invalid-email",
                role="basic"
            )
        
        assert "Invalid email format" in str(exc_info.value)

class TestRoleOperations:
    """Test role-related admin operations."""
    # ... comprehensive role tests

class TestSSOConfig:
    """Test SSO configuration operations.""" 
    # ... SSO tests

class TestTabulatorOperations:
    """Test tabulator-related operations."""
    # ... tabulator tests

class TestErrorHandling:
    """Test error scenarios and edge cases."""
    
    def test_network_error(self, mock_admin_client, graphql_mock):
        """Test handling of network errors."""
        pass
        
    def test_authentication_error(self, mock_admin_client, graphql_mock):
        """Test handling of auth errors."""
        pass
        
    def test_invalid_graphql_response(self, mock_admin_client, graphql_mock):
        """Test handling of malformed responses."""
        pass
```

### 5. Schema Validation Helpers

**File**: `/api/python/tests/fixtures/graphql_schema_fragments.py`

Utilities to validate GraphQL responses match expected schema:
```python
def validate_user_response(response_data):
    """Validate user response matches expected schema."""
    pass

def validate_role_response(response_data):
    """Validate role response matches expected schema."""
    pass
```

## Testing Strategy

### Coverage Areas

1. **All Admin Operations**:
   - Users: list, get, create, delete, update (email, admin, active, role)
   - Roles: list
   - SSO Config: get, set
   - Tabulator: list tables, set table, rename table, open query

2. **Error Scenarios**:
   - Invalid input validation
   - Network failures
   - Authentication errors
   - Malformed GraphQL responses
   - Server errors

3. **Edge Cases**:
   - Empty responses
   - Large datasets
   - Unicode/special characters
   - Concurrent operations

### Test Categories

- **Unit Tests**: Individual admin functions with mocked responses
- **Integration Tests**: Full admin workflows using mock server
- **Error Tests**: Comprehensive error handling validation
- **Performance Tests**: Response time and memory usage with large datasets

## Benefits

1. **Safety Net**: Comprehensive tests before any refactoring
2. **Documentation**: Tests serve as living documentation of admin behavior
3. **Regression Prevention**: Catch any changes to existing functionality
4. **Development Speed**: Fast, reliable tests with no external dependencies
5. **Foundation**: Testing patterns ready for future GraphQL features

## Success Criteria

1. **100% Admin Coverage**: All existing admin operations tested
2. **Error Handling**: All error scenarios covered
3. **Fast Tests**: Test suite runs in <30 seconds
4. **Reliable**: No flaky tests, deterministic results
5. **Maintainable**: Clear test structure and good documentation

## Files Changed

```
# New test infrastructure
api/python/tests/graphql_mock_server.py           # New
api/python/tests/fixtures/admin_graphql_responses.py  # New
api/python/tests/fixtures/graphql_schema_fragments.py  # New
api/python/tests/conftest.py                     # Enhanced

# Enhanced tests
api/python/tests/test_admin_api.py               # Enhanced with comprehensive coverage

# No changes to admin code
api/python/quilt3/admin/                         # Unchanged
```

## Dependencies

- Existing admin package (unchanged)
- pytest and mock libraries
- Current GraphQL schema for response validation

## Next Steps

After PR0 is merged:
- **PR1**: Refactor GraphQL infrastructure (with safety net in place)
- **PR2**: Implement package search (using established testing patterns)