# MCP Server JWT Token Implementation Guide

## 🎯 **Overview**

The frontend is now sending enhanced JWT tokens with comprehensive authorization claims. The MCP server needs to be updated to properly decode and use these tokens for authorization decisions.

## 🔍 **Current Status**

### ✅ **Frontend (Working Correctly)**
- Enhanced JWT tokens are being generated with proper permissions
- Tokens include: `permissions`, `roles`, `groups`, `scope`, `buckets`
- Tokens are being sent in `Authorization: Bearer <token>` header
- MCP server is receiving the tokens and responding

### ❌ **Backend (Needs Implementation)**
- MCP server is not properly decoding JWT tokens
- Server is not extracting authorization claims
- Server is not using claims for permission decisions
- Tool calls return `{content: Array(1), isError: true}` instead of proper results

## 🔧 **Required Backend Implementation**

### 1. **JWT Token Decoding**

The server needs to decode the JWT token from the `Authorization` header:

```python
import jwt
import json
from typing import Dict, List, Optional

def decode_jwt_token(auth_header: str, secret: str) -> Optional[Dict]:
    """
    Decode and validate the JWT token from Authorization header
    
    Args:
        auth_header: "Bearer <token>" format
        secret: JWT signing secret (mcpEnhancedJwtSecret)
    
    Returns:
        Decoded token payload or None if invalid
    """
    try:
        # Extract token from "Bearer <token>" format
        if not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        # Decode and verify the token
        payload = jwt.decode(
            token, 
            secret, 
            algorithms=['HS256'],
            options={"verify_exp": True}
        )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        print("❌ JWT token has expired")
        return None
    except jwt.InvalidTokenError as e:
        print(f"❌ Invalid JWT token: {e}")
        return None
    except Exception as e:
        print(f"❌ Error decoding JWT token: {e}")
        return None
```

### 2. **Authorization Claims Extraction**

Extract the authorization claims from the decoded token:

```python
def extract_auth_claims(token_payload: Dict) -> Dict:
    """
    Extract authorization claims from JWT token payload
    
    Args:
        token_payload: Decoded JWT token payload
    
    Returns:
        Dictionary with extracted authorization claims
    """
    return {
        'permissions': token_payload.get('permissions', []),
        'roles': token_payload.get('roles', []),
        'groups': token_payload.get('groups', []),
        'scope': token_payload.get('scope', ''),
        'buckets': token_payload.get('buckets', []),
        'user_id': token_payload.get('id', ''),
        'expires_at': token_payload.get('exp', 0)
    }
```

### 3. **Permission Validation**

Implement permission checking logic:

```python
def validate_permission(required_permission: str, user_permissions: List[str]) -> bool:
    """
    Check if user has required permission
    
    Args:
        required_permission: Permission needed (e.g., 's3:ListBucket')
        user_permissions: List of user's permissions
    
    Returns:
        True if user has permission, False otherwise
    """
    return required_permission in user_permissions

def validate_bucket_access(bucket_name: str, user_buckets: List[str]) -> bool:
    """
    Check if user has access to specific bucket
    
    Args:
        bucket_name: Name of bucket to check
        user_buckets: List of buckets user can access
    
    Returns:
        True if user has access, False otherwise
    """
    return bucket_name in user_buckets

def validate_role_access(required_roles: List[str], user_roles: List[str]) -> bool:
    """
    Check if user has any of the required roles
    
    Args:
        required_roles: List of roles that can perform action
        user_roles: List of user's roles
    
    Returns:
        True if user has any required role, False otherwise
    """
    return any(role in user_roles for role in required_roles)
```

### 4. **MCP Tool Authorization**

Implement authorization for each MCP tool:

```python
def authorize_mcp_tool(tool_name: str, tool_args: Dict, auth_claims: Dict) -> bool:
    """
    Authorize access to specific MCP tool based on user's permissions
    
    Args:
        tool_name: Name of MCP tool being called
        tool_args: Arguments passed to the tool
        auth_claims: User's authorization claims
    
    Returns:
        True if authorized, False otherwise
    """
    permissions = auth_claims.get('permissions', [])
    roles = auth_claims.get('roles', [])
    buckets = auth_claims.get('buckets', [])
    
    # Define tool-specific authorization rules
    tool_auth_rules = {
        'mcp_quilt-mcp-server_list_available_resources': {
            'required_permissions': ['s3:ListAllMyBuckets'],
            'description': 'List available S3 resources'
        },
        'mcp_quilt-mcp-server_bucket_objects_list': {
            'required_permissions': ['s3:ListBucket'],
            'required_bucket_access': True,
            'description': 'List objects in specific bucket'
        },
        'mcp_quilt-mcp-server_bucket_objects_put': {
            'required_permissions': ['s3:PutObject'],
            'required_bucket_access': True,
            'description': 'Upload objects to bucket'
        },
        'mcp_quilt-mcp-server_package_create': {
            'required_permissions': ['s3:PutObject', 's3:ListBucket'],
            'required_bucket_access': True,
            'description': 'Create Quilt packages'
        },
        'mcp_quilt-mcp-server_athena_query_execute': {
            'required_permissions': ['athena:StartQueryExecution', 'athena:GetQueryResults'],
            'description': 'Execute Athena queries'
        }
    }
    
    if tool_name not in tool_auth_rules:
        print(f"⚠️ Unknown tool: {tool_name}")
        return False
    
    rules = tool_auth_rules[tool_name]
    
    # Check required permissions
    required_perms = rules.get('required_permissions', [])
    for perm in required_perms:
        if not validate_permission(perm, permissions):
            print(f"❌ Missing permission: {perm}")
            return False
    
    # Check bucket access if required
    if rules.get('required_bucket_access', False):
        bucket_name = tool_args.get('bucket', '')
        if bucket_name and not validate_bucket_access(bucket_name, buckets):
            print(f"❌ No access to bucket: {bucket_name}")
            return False
    
    print(f"✅ Authorized for tool: {tool_name}")
    return True
```

### 5. **MCP Request Handler Integration**

Integrate authorization into your MCP request handler:

```python
def handle_mcp_request(request_data: Dict, auth_header: str) -> Dict:
    """
    Handle MCP request with JWT token authorization
    
    Args:
        request_data: MCP request data
        auth_header: Authorization header from request
    
    Returns:
        MCP response with authorization check
    """
    # Decode JWT token
    token_payload = decode_jwt_token(auth_header, MCP_ENHANCED_JWT_SECRET)
    if not token_payload:
        return {
            "jsonrpc": "2.0",
            "id": request_data.get("id"),
            "error": {
                "code": -32001,
                "message": "Invalid or expired authentication token"
            }
        }
    
    # Extract authorization claims
    auth_claims = extract_auth_claims(token_payload)
    
    # Check if this is a tool call
    if request_data.get("method") == "tools/call":
        tool_name = request_data.get("params", {}).get("name")
        tool_args = request_data.get("params", {}).get("arguments", {})
        
        # Authorize tool access
        if not authorize_mcp_tool(tool_name, tool_args, auth_claims):
            return {
                "jsonrpc": "2.0",
                "id": request_data.get("id"),
                "error": {
                    "code": -32002,
                    "message": f"Insufficient permissions for tool: {tool_name}"
                }
            }
    
    # Process the authorized request
    return process_mcp_request(request_data, auth_claims)
```

### 6. **Configuration**

Add the JWT secret to your server configuration:

```python
# Environment variables or config file
MCP_ENHANCED_JWT_SECRET = os.getenv('MCP_ENHANCED_JWT_SECRET', 'development-enhanced-jwt-secret')
MCP_ENHANCED_JWT_KID = os.getenv('MCP_ENHANCED_JWT_KID', 'frontend-enhanced')
```

## 🧪 **Testing**

### 1. **Test JWT Token Decoding**

```python
def test_jwt_decoding():
    """Test JWT token decoding functionality"""
    # Sample token from frontend (you can get this from the debug test)
    sample_token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6ImZyb250ZW5kLWVuaGFuY2VkIn0..."
    
    auth_header = f"Bearer {sample_token}"
    payload = decode_jwt_token(auth_header, MCP_ENHANCED_JWT_SECRET)
    
    if payload:
        print("✅ JWT token decoded successfully")
        print(f"Permissions: {payload.get('permissions', [])}")
        print(f"Roles: {payload.get('roles', [])}")
        print(f"Groups: {payload.get('groups', [])}")
        print(f"Scope: {payload.get('scope', '')}")
        print(f"Buckets: {payload.get('buckets', [])}")
    else:
        print("❌ Failed to decode JWT token")
```

### 2. **Test Tool Authorization**

```python
def test_tool_authorization():
    """Test tool authorization functionality"""
    # Sample auth claims from frontend
    auth_claims = {
        'permissions': [
            's3:ListAllMyBuckets', 's3:ListBucket', 's3:PutObject',
            'athena:StartQueryExecution', 'athena:GetQueryResults'
        ],
        'roles': ['ReadOnlyQuilt', 'ReadWriteQuiltV2-sales-prod'],
        'groups': ['mcp-users', 'quilt-contributors', 'quilt-users'],
        'buckets': ['quilt-sandbox-bucket', 'quilt-demo-bucket']
    }
    
    # Test various tool calls
    test_cases = [
        {
            'tool': 'mcp_quilt-mcp-server_list_available_resources',
            'args': {},
            'expected': True
        },
        {
            'tool': 'mcp_quilt-mcp-server_bucket_objects_list',
            'args': {'bucket': 'quilt-sandbox-bucket'},
            'expected': True
        },
        {
            'tool': 'mcp_quilt-mcp-server_bucket_objects_list',
            'args': {'bucket': 'unauthorized-bucket'},
            'expected': False
        }
    ]
    
    for test_case in test_cases:
        result = authorize_mcp_tool(
            test_case['tool'], 
            test_case['args'], 
            auth_claims
        )
        status = "✅" if result == test_case['expected'] else "❌"
        print(f"{status} {test_case['tool']}: {result}")
```

## 📋 **Implementation Checklist**

- [ ] **Install JWT library** (e.g., `pip install PyJWT`)
- [ ] **Add JWT secret configuration** to environment variables
- [ ] **Implement JWT token decoding** function
- [ ] **Implement authorization claims extraction** function
- [ ] **Implement permission validation** functions
- [ ] **Define tool-specific authorization rules** for each MCP tool
- [ ] **Integrate authorization** into MCP request handler
- [ ] **Add error handling** for invalid/expired tokens
- [ ] **Add logging** for authorization decisions
- [ ] **Test with real tokens** from the frontend
- [ ] **Update documentation** with new authorization requirements

## 🔍 **Debugging**

### 1. **Enable Debug Logging**

```python
import logging

# Set up debug logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def debug_auth_claims(auth_claims: Dict):
    """Log authorization claims for debugging"""
    logger.debug(f"User permissions: {auth_claims.get('permissions', [])}")
    logger.debug(f"User roles: {auth_claims.get('roles', [])}")
    logger.debug(f"User groups: {auth_claims.get('groups', [])}")
    logger.debug(f"User scope: {auth_claims.get('scope', '')}")
    logger.debug(f"User buckets: {auth_claims.get('buckets', [])}")
```

### 2. **Common Issues**

- **Token not being sent**: Check if `Authorization` header is present
- **Token decoding fails**: Verify JWT secret matches frontend configuration
- **Permissions not working**: Check if permission names match exactly
- **Bucket access denied**: Verify bucket names in token claims

## 📞 **Support**

If you need help implementing this:

1. **Check the frontend debug test results** to see exactly what tokens are being sent
2. **Verify JWT secret configuration** matches between frontend and backend
3. **Test with sample tokens** from the frontend debug output
4. **Check server logs** for authorization decision details

The frontend is working correctly and sending all the necessary authorization data. The server just needs to properly decode and use this information for authorization decisions.

## 🔍 **Sample Token Structure**

Based on the frontend debug output, here's what the JWT tokens contain:

```json
{
  "id": "8795f0cc-8deb-40dd-9132-13357c983984",
  "uuid": "b2104494-69e5-46b4-8600-fbfc05acf91d",
  "exp": 1766336083,
  "scope": "delete list read write",
  "permissions": [
    "athena:BatchGetQueryExecution",
    "athena:GetQueryExecution", 
    "athena:GetQueryResults",
    "athena:ListQueryExecutions",
    "athena:ListWorkGroups",
    "athena:StartQueryExecution",
    "athena:StopQueryExecution",
    "glue:GetDatabase",
    "glue:GetDatabases",
    "glue:GetTable",
    "glue:GetTables",
    "iam:GetPolicy",
    "iam:GetPolicyVersion",
    "iam:ListAttachedUserPolicies",
    "iam:ListUserPolicies",
    "s3:AbortMultipartUpload",
    "s3:DeleteObject",
    "s3:GetBucketLocation",
    "s3:GetObject",
    "s3:GetObjectVersion",
    "s3:ListAllMyBuckets",
    "s3:ListBucket",
    "s3:PutObject",
    "s3:PutObjectAcl"
  ],
  "roles": [
    "ReadOnlyQuilt",
    "ReadWriteQuiltV2-sales-prod"
  ],
  "groups": [
    "mcp-users",
    "quilt-contributors", 
    "quilt-users"
  ],
  "buckets": [
    "quilt-sandbox-bucket",
    "quilt-demo-bucket"
  ]
}
```

This token structure provides all the information needed for comprehensive authorization decisions.
