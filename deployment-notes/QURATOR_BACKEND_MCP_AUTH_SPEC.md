# Qurator Backend MCP Server Authentication Specification

**Date:** October 1, 2025  
**Author:** Based on recommendations from Alexei Mochalov (nl_0@quiltdata.io)  
**Purpose:** Refactor backend MCP server to properly handle authentication tokens without state

---

## Executive Summary

The backend MCP server must be **completely stateless** for authentication. It should accept auth tokens from the frontend with each request, forward them to the registry/GraphQL endpoints, and never cache or store authentication state. All Quilt3 calls should be replaced with direct GraphQL/HTTP API calls to avoid stateful authentication issues.

---

## Core Principles

### 1. **Complete Statelessness**
- **NO** authentication state stored in memory
- **NO** authentication state stored on disk
- **NO** global authentication context
- Each request is independent and atomic

### 2. **Token Forwarding**
- Accept auth token from frontend in request headers
- Forward token to registry/GraphQL endpoints
- Do not modify, cache, or validate tokens (let registry handle it)

### 3. **Replace Quilt3 with Direct API Calls**
- Eliminate all Quilt3 library usage
- Use GraphQL and REST API calls directly
- Avoid stateful credential management

---

## Request Flow

### Incoming Request Structure

#### HTTP Headers
```
Authorization: Bearer <quilt-auth-token>
Content-Type: application/json
```

#### Request Body
```json
{
  "tool": "package_browse",
  "params": {
    "package_name": "user/dataset",
    "registry": "s3://bucket"
  }
}
```

### Token Extraction
```python
# Example Python pseudocode
def handle_mcp_request(request):
    # Extract token from Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return error_response('Missing or invalid Authorization header')
    
    token = auth_header[7:]  # Remove 'Bearer ' prefix
    
    # Pass token to tool handler
    result = execute_tool(
        tool=request.json['tool'],
        params=request.json['params'],
        auth_token=token  # Pass explicitly, don't store
    )
    
    return result
```

---

## Authentication Token Handling

### What the Token Is
- **Quilt registry authentication token** (not an AWS STS token)
- Identifies the user against the Quilt registry
- Contains user role and permission information
- Is role-specific (changes when user switches roles)

### What the Token Is NOT
- Not an AWS credential
- Not a JWT that you create or sign
- Not stored or cached anywhere

### Token Lifecycle (Per Request)
1. **Receive:** Extract from Authorization header
2. **Validate:** Let registry validate (don't validate yourself)
3. **Use:** Pass to registry/GraphQL endpoints
4. **Discard:** Forget after request completes

---

## Critical: No State Storage

### What NOT to Do

❌ **DO NOT** store auth tokens globally:
```python
# BAD - Don't do this!
global_auth_token = None

def set_auth(token):
    global global_auth_token
    global_auth_token = token  # WRONG!

def make_api_call():
    # Uses global token - will cause cross-user issues
    return call_api(global_auth_token)
```

❌ **DO NOT** cache credentials:
```python
# BAD - Don't do this!
credential_cache = {}

def get_credentials(token):
    if token in credential_cache:
        return credential_cache[token]  # WRONG!
```

❌ **DO NOT** use Quilt3 stateful methods:
```python
# BAD - Quilt3 stores auth state internally
import quilt3
quilt3.login()  # WRONG - stores state on disk/memory
pkg = quilt3.Package.browse()  # Uses stored credentials
```

### What TO Do

✅ **DO** pass token explicitly with every call:
```python
# GOOD - Stateless pattern
def handle_tool_request(tool_name, params, auth_token):
    # Pass token to each API call
    result = make_graphql_call(
        query=build_query(tool_name, params),
        auth_token=auth_token  # Explicit token per request
    )
    return result
```

✅ **DO** make direct API calls:
```python
# GOOD - Direct GraphQL call
def package_browse(package_name, registry, auth_token):
    query = """
    query GetPackage($name: String!, $registry: String!) {
      package(name: $name, registry: $registry) {
        name
        modified
        metadata
      }
    }
    """
    
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.post(
        f'{registry_url}/graphql',
        json={'query': query, 'variables': {...}},
        headers=headers
    )
    
    return response.json()
```

---

## Replacing Quilt3 Calls

### Why Replace Quilt3

Quilt3 is **inherently stateful**:
- Stores authentication state on disk (`~/.quilt/`)
- Caches credentials in memory
- Global configuration affects all operations
- Multiple concurrent requests with different users will conflict

### Migration Strategy

#### For Package Operations
| Quilt3 Call | Replace With |
|-------------|--------------|
| `quilt3.Package.browse()` | GraphQL query for package contents |
| `quilt3.Package.install()` | GraphQL mutation + direct S3 operations |
| `quilt3.Package()` | GraphQL query for package metadata |
| `quilt3.list_packages()` | GraphQL query for package list |

#### For Bucket Operations
| Quilt3 Call | Replace With |
|-------------|--------------|
| `quilt3.list_objects()` | Direct S3 API call or GraphQL query |
| `quilt3.get_bytes()` | Direct S3 API call with presigned URL |
| `quilt3.put()` | Direct S3 API call |

#### For Admin Operations
| Quilt3 Admin Call | Replace With |
|-------------------|--------------|
| `quilt3.admin.list_users()` | HTTP API call to `/api/users` |
| `quilt3.admin.create_user()` | HTTP API call to `/api/users` (POST) |
| `quilt3.admin.set_role()` | HTTP API call to `/api/users/{id}/role` |

### GraphQL Example

```python
# Instead of: pkg = quilt3.Package.browse('user/dataset')
# Do this:

def browse_package_via_graphql(package_name, registry, auth_token):
    """
    Retrieve package contents using direct GraphQL call.
    Completely stateless - token passed explicitly.
    """
    graphql_endpoint = f"{get_registry_url(registry)}/graphql"
    
    query = """
    query BrowsePackage($name: String!, $registry: String!) {
      package(name: $name, registry: $registry) {
        name
        hash
        modified
        metadata
        entries {
          logicalKey
          physicalKey
          size
          hash
        }
      }
    }
    """
    
    variables = {
        "name": package_name,
        "registry": registry
    }
    
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.post(
        graphql_endpoint,
        json={'query': query, 'variables': variables},
        headers=headers,
        timeout=30
    )
    
    response.raise_for_status()
    return response.json()['data']['package']
```

### REST API Example

```python
# Instead of: quilt3.admin.list_users()
# Do this:

def list_users_via_api(registry_url, auth_token):
    """
    List users using direct HTTP API call.
    Token passed explicitly in headers.
    """
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(
        f'{registry_url}/api/users',
        headers=headers,
        timeout=30
    )
    
    response.raise_for_status()
    return response.json()
```

---

## Concurrent User Handling

### The Problem
If two users make requests simultaneously, and you use Quilt3 or cache credentials:

```
User A (Role: Admin) → Request 1 → Sets global credentials to Admin
User B (Role: User)  → Request 2 → Sets global credentials to User
User A's request continues → Uses User credentials → WRONG!
```

### The Solution
Pass token explicitly with every operation:

```python
def execute_tool(tool_name, params, auth_token):
    """
    Each request is independent.
    No shared state between users.
    """
    if tool_name == 'package_browse':
        return browse_package(
            params['package_name'],
            params['registry'],
            auth_token  # Scoped to this request only
        )
    elif tool_name == 'list_users':
        return list_users(
            params['registry'],
            auth_token  # Scoped to this request only
        )
    # ... etc
```

### Thread Safety
- Each request handler should operate independently
- No shared authentication context between threads/processes
- Token is the only authentication mechanism needed

---

## Error Handling

### Authentication Errors

#### Missing Token
```python
if not auth_token:
    return {
        'error': 'AUTHENTICATION_REQUIRED',
        'message': 'Authorization header with Bearer token required',
        'code': 401
    }
```

#### Invalid Token (from registry)
```python
# Let the registry validate tokens
# If registry returns 401/403, pass that back to client
try:
    result = make_api_call(auth_token=auth_token)
except requests.HTTPError as e:
    if e.response.status_code == 401:
        return {
            'error': 'INVALID_TOKEN',
            'message': 'Authentication token is invalid or expired',
            'code': 401
        }
    elif e.response.status_code == 403:
        return {
            'error': 'INSUFFICIENT_PERMISSIONS',
            'message': 'Token does not have required permissions',
            'code': 403
        }
    raise
```

#### Token Expiration
- The catalog handles token refresh automatically
- Backend should just return 401 errors
- Frontend will retry with refreshed token

---

## API Endpoint Structure

### Registry Endpoints to Call

#### GraphQL
- **URL:** `{registry_url}/graphql`
- **Method:** POST
- **Headers:** `Authorization: Bearer {token}`
- **Body:** GraphQL query and variables

#### REST API
- **Users:** `{registry_url}/api/users`
- **Packages:** `{registry_url}/api/packages`
- **Buckets:** `{registry_url}/api/buckets`
- **Admin:** `{registry_url}/api/admin/*`

### Header Forwarding
Always forward the Authorization header:

```python
def forward_auth_header(auth_token):
    """Build headers dict for registry API calls."""
    return {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'Quilt-MCP-Server/1.0'
    }
```

---

## Deployment Considerations

### Docker Container
- No persistent storage needed for auth
- No volume mounts for credentials
- Stateless containers can scale horizontally

### Environment Variables
- **REMOVE:** JWT signing secrets
- **KEEP:** Registry URL configuration
- **KEEP:** Service configuration (ports, etc.)

### Secret Management
- **NO secrets needed** for authentication
- Tokens come from client requests
- Registry handles all auth validation

---

## Testing Requirements

### Unit Tests
- [ ] Token extraction from Authorization header
- [ ] GraphQL calls with token forwarding
- [ ] REST API calls with token forwarding
- [ ] Error handling for missing/invalid tokens

### Integration Tests
- [ ] End-to-end request with valid token
- [ ] Request with invalid token returns 401
- [ ] Request with expired token returns 401
- [ ] Concurrent requests from different users
- [ ] Role switching mid-session

### Load Tests
- [ ] Multiple concurrent users
- [ ] No memory leaks from token handling
- [ ] No state pollution between requests

### Security Tests
- [ ] No tokens logged or stored
- [ ] No credentials in error messages
- [ ] No cross-user data leakage
- [ ] Token properly discarded after request

---

## Migration Checklist

### Phase 1: Audit Current Code
- [ ] Identify all Quilt3 calls
- [ ] Identify all credential storage locations
- [ ] Map Quilt3 calls to GraphQL/REST equivalents
- [ ] Document current authentication flow

### Phase 2: Implement Stateless Pattern
- [ ] Create token extraction utility
- [ ] Create GraphQL call wrapper with token parameter
- [ ] Create REST API call wrapper with token parameter
- [ ] Update all tool handlers to accept token parameter

### Phase 3: Replace Quilt3
- [ ] Replace package operations with GraphQL
- [ ] Replace bucket operations with S3/GraphQL
- [ ] Replace admin operations with REST API
- [ ] Remove Quilt3 imports and dependencies

### Phase 4: Remove State
- [ ] Remove global credential variables
- [ ] Remove credential caching
- [ ] Remove Quilt3 login/config code
- [ ] Remove JWT signing code

### Phase 5: Validate
- [ ] Test with multiple concurrent users
- [ ] Test role switching
- [ ] Load test with many requests
- [ ] Security review

---

## Code Structure Recommendation

### Suggested Organization

```
backend/
├── mcp_server.py          # Main HTTP server
├── auth/
│   ├── token_extractor.py # Extract token from headers
│   └── validator.py       # Token validation helpers
├── api/
│   ├── graphql_client.py  # GraphQL wrapper
│   ├── rest_client.py     # REST API wrapper
│   └── s3_client.py       # Direct S3 operations
├── tools/
│   ├── package_tools.py   # Package operations
│   ├── bucket_tools.py    # Bucket operations
│   ├── admin_tools.py     # Admin operations
│   └── search_tools.py    # Search operations
└── utils/
    ├── errors.py          # Error handling
    └── config.py          # Configuration
```

### Example Tool Implementation

```python
# tools/package_tools.py

from api.graphql_client import execute_graphql
from auth.token_extractor import require_auth

@require_auth  # Decorator ensures token is present
def browse_package(package_name, registry, auth_token):
    """
    Browse package contents.
    
    Args:
        package_name: Package identifier
        registry: Registry URL
        auth_token: User's auth token (passed explicitly)
    
    Returns:
        Package contents
    """
    query = """
    query BrowsePackage($name: String!) {
      package(name: $name) {
        entries {
          logicalKey
          physicalKey
          size
        }
      }
    }
    """
    
    # Token passed explicitly to API client
    return execute_graphql(
        query=query,
        variables={'name': package_name},
        registry=registry,
        auth_token=auth_token  # Never cached or stored
    )
```

---

## Performance Considerations

### Avoiding Unnecessary Calls
- Cache GraphQL query strings (not results)
- Batch multiple operations when possible
- Use connection pooling for HTTP clients

### Request Timeout
- Set reasonable timeouts (30s default)
- Handle timeout errors gracefully
- Don't let one slow request block others

---

## Monitoring and Logging

### What to Log
- Request tool name and timestamp
- Response status codes
- Error messages (sanitized)
- Request duration

### What NOT to Log
- ❌ Auth tokens (even partial)
- ❌ User credentials
- ❌ Full error responses that might contain tokens

### Example Logging
```python
import logging

logger = logging.getLogger(__name__)

def handle_request(request, auth_token):
    tool = request.json['tool']
    start_time = time.time()
    
    # Safe logging - no token exposure
    logger.info(f"MCP tool request: {tool}")
    
    try:
        result = execute_tool(tool, request.json['params'], auth_token)
        duration = time.time() - start_time
        logger.info(f"MCP tool completed: {tool} in {duration:.2f}s")
        return result
    except Exception as e:
        duration = time.time() - start_time
        # Log error without exposing sensitive data
        logger.error(f"MCP tool failed: {tool} after {duration:.2f}s - {type(e).__name__}")
        raise
```

---

## Security Best Practices

### Token Handling
1. Extract from header immediately
2. Pass as parameter, never store
3. Don't log or print tokens
4. Discard after request completes

### Registry Communication
1. Always use HTTPS
2. Validate SSL certificates
3. Set reasonable timeouts
4. Handle auth errors gracefully

### Error Messages
1. Don't expose token in errors
2. Don't expose internal paths
3. Return appropriate HTTP status codes
4. Log details server-side only

---

## Success Criteria

✅ No Quilt3 usage in MCP server code  
✅ All tools use GraphQL or REST API directly  
✅ Auth token extracted from Authorization header  
✅ Token passed explicitly to all API calls  
✅ No authentication state stored anywhere  
✅ Concurrent users work correctly  
✅ Role switching works automatically  
✅ All tests pass  
✅ Security review approved  

---

## Questions for Resolution

1. What is the exact GraphQL endpoint URL for the registry?
2. What is the REST API endpoint structure?
3. Are there rate limits to consider?
4. What monitoring/metrics should be exposed?
5. What's the expected request concurrency?

---

## References

- Quilt Registry GraphQL Schema
- Quilt Registry REST API Documentation
- MCP Protocol Specification
- Existing Catalog Authentication Implementation


