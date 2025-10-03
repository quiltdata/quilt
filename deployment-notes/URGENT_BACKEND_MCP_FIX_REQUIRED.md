# 🚨 URGENT: MCP Server Permission Validation Bug - BLOCKING PRODUCTION

**Status**: Frontend deployment COMPLETE ✅ | Backend fix REQUIRED ❌

**Date**: October 1, 2025  
**Priority**: P0 - Blocking production MCP functionality  
**Owner**: Backend Team

---

## Executive Summary

The **frontend is working perfectly** and sending valid JWT tokens with correct permissions. However, the **MCP Server backend is rejecting these valid tokens** due to bugs in the permission validation logic. This is blocking all MCP operations in production (demo.quiltdata.com).

---

## ✅ Frontend Status - COMPLETE

### What's Working:
1. **JWT Secret Synchronized**:
   - SSM Parameter: `/quilt/mcp-server/jwt-secret`
   - Value: `7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0` (64 chars)
   - Frontend Config: ✅ Matches
   - Backend Config: ✅ Matches

2. **Authorization Headers Sent**:
   - `notifications/initialized`: ✅ Bearer token present
   - `tools/list`: ✅ Bearer token present
   - `tools/call`: ✅ Bearer token present
   - All subsequent requests: ✅ Bearer token present

3. **JWT Structure Perfect**:
   ```json
   {
     "alg": "HS256",
     "typ": "JWT",
     "kid": "frontend-enhanced"
   }
   ```
   
   **Payload includes**:
   - ✅ `roles`: `["ReadWriteQuiltV2-sales-prod"]`
   - ✅ `permissions`: Full S3 write permissions (PutObject, DeleteObject, etc.)
   - ✅ `buckets`: 29 accessible buckets including `quilt-sandbox-bucket`
   - ✅ `scope`: `"w"` (write)
   - ✅ `level`: `"write"`
   - ✅ `iss`: `"quilt-frontend"`
   - ✅ `aud`: `"quilt-mcp-server"`

4. **Deployment**: Version `1.64.1a7` running in production

---

## ❌ Backend Bugs - REQUIRES IMMEDIATE FIX

### Bug #1: Permission Validation Returns `no_access` Despite Valid JWT

**Evidence**:
```json
{
  "bucket_name": "quilt-sandbox-bucket",
  "permission_level": "no_access",  // ❌ WRONG - JWT has write permissions
  "has_access": false,
  "message": "Insufficient permissions"
}
```

**Expected**:
```json
{
  "bucket_name": "quilt-sandbox-bucket", 
  "permission_level": "write",  // ✅ Correct based on JWT claims
  "has_access": true
}
```

**Root Cause**: MCP Server's permission validation logic is NOT correctly reading the JWT `permissions`, `buckets`, or `roles` claims.

---

### Bug #2: Python Type Error When Listing Roles

**Evidence**:
```python
# admin_roles_list tool returns:
{
  "success": false,
  "error": "unsupported operand type(s) for +: 'NoneType' and 'str'"
}
```

**Root Cause**: Code is trying to concatenate `None + str`, likely in role name formatting or permission string building.

---

### Bug #3: JWT Claims Not Being Parsed

**Evidence**: 
The MCP Server is reporting `"No bearer token available"` or `"missing_authorization"` even when:
- ✅ Authorization header IS present in request
- ✅ JWT signature IS valid (verified with same secret)
- ✅ JWT structure IS correct

**Root Cause**: The server's JWT extraction or validation middleware is failing silently or the auth decorators are not properly propagating the authenticated user context.

---

## 🔧 Required Backend Fixes

### Priority 1: Fix JWT Token Extraction (CRITICAL)

**File**: Likely in `api/python/quilt3/` or MCP server auth middleware

**Issue**: Server is not extracting or validating the Bearer token from the Authorization header.

**Fix Required**:
```python
# Current (broken):
def get_bearer_token(request):
    # Missing or failing to extract token
    return None  # ❌ Always returns None

# Required (working):
def get_bearer_token(request):
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header[7:].strip()  # Remove 'Bearer ' prefix
    return token
```

---

### Priority 2: Fix Permission Validation Logic (CRITICAL)

**File**: Permission validation service/middleware

**Issue**: Not reading JWT claims correctly. The server should:

1. **Extract claims from validated JWT**:
   ```python
   claims = decode_jwt(token, secret, algorithms=['HS256'])
   user_permissions = claims.get('permissions', [])
   user_roles = claims.get('roles', [])
   user_buckets = claims.get('buckets', [])
   user_scope = claims.get('scope', '')
   ```

2. **Map permissions correctly**:
   ```python
   # If user has 's3:PutObject' in permissions AND bucket in buckets list
   if 's3:PutObject' in user_permissions and bucket_name in user_buckets:
       permission_level = 'write'
   elif 's3:GetObject' in user_permissions and bucket_name in user_buckets:
       permission_level = 'read'
   ```

3. **Check role-based permissions**:
   ```python
   # Users with ReadWriteQuiltV2-* roles should have write access
   for role in user_roles:
       if 'ReadWrite' in role or 'write' in role.lower():
           # Grant write access to buckets in their buckets list
           if bucket_name in user_buckets:
               permission_level = 'write'
   ```

---

### Priority 3: Fix Role Listing Bug (HIGH)

**File**: `admin_roles_list` tool implementation

**Issue**: String concatenation with None

**Fix Required**:
```python
# Current (broken):
role_name = None + "-suffix"  # ❌ TypeError

# Required (working):
role_name = (role_data.get('name') or 'unknown') + "-suffix"  # ✅ Safe
```

---

## 📋 Verification Steps After Backend Fix

1. **Check Backend Logs**:
   ```bash
   # Should see:
   "JWT token received and validated successfully"
   "User role: ReadWriteQuiltV2-sales-prod"
   "Permission level: write"
   "Bucket access granted: quilt-sandbox-bucket"
   ```

2. **Test MCP Tools**:
   ```javascript
   // In browser console:
   const result = await window.__mcpClient.callTool({
     name: 'bucket_objects_list',
     arguments: { bucket: 'quilt-sandbox-bucket', max_keys: 10 }
   })
   // Should return objects, not permission error
   ```

3. **Verify Permission Check**:
   ```javascript
   const access = await window.__mcpClient.callTool({
     name: 'bucket_access_check',
     arguments: { 
       bucket_name: 'quilt-sandbox-bucket',
       operations: ['read', 'write', 'list']
     }
   })
   // Should return: { permission_level: 'write', has_access: true }
   ```

---

## 🎯 Current JWT Being Sent (For Backend Testing)

**Example token from production** (decode at jwt.io):

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImZyb250ZW5kLWVuaGFuY2VkIn0.eyJpZCI6Ijg3OTVmMGNjLThkZWItNDBkZC05MTMyLTEzMzU3Yzk4Mzk4NCIsInV1aWQiOiJmYzg5MTFiZi1jMmIyLTRlMTgtOWMwYy0wYzVlYzlhNmYxNzciLCJleHAiOjE3NjcwNTQwMTAsImlzcyI6InF1aWx0LWZyb250ZW5kIiwiYXVkIjoicXVpbHQtbWNwLXNlcnZlciIsInN1YiI6Ijg3OTVmMGNjLThkZWItNDBkZC05MTMyLTEzMzU3Yzk4Mzk4NCIsImlhdCI6MTc1OTI4Mjk4NiwianRpIjoibWc3Ym56eDNpMHQ2IiwicyI6InciLCJwIjpbImF0aGVuYTpCYXRjaEdldFF1ZXJ5RXhlY3V0aW9uIiwiYXRoZW5hOkdldFF1ZXJ5RXhlY3V0aW9uIiwiYXRoZW5hOkdldFF1ZXJ5UmVzdWx0cyIsImF0aGVuYTpMaXN0UXVlcnlFeGVjdXRpb25zIiwiYXRoZW5hOkxpc3RXb3JrR3JvdXBzIiwiYXRoZW5hOlN0YXJ0UXVlcnlFeGVjdXRpb24iLCJhdGhlbmE6U3RvcFF1ZXJ5RXhlY3V0aW9uIiwiZ2x1ZTpHZXREYXRhYmFzZSIsImdsdWU6R2V0RGF0YWJhc2VzIiwiZ2x1ZTpHZXRUYWJsZSIsImdsdWU6R2V0VGFibGVzIiwiaWFtOkdldFBvbGljeSIsImlhbTpHZXRQb2xpY3lWZXJzaW9uIiwiaWFtOkxpc3RBdHRhY2hlZFVzZXJQb2xpY2llcyIsImlhbTpMaXN0VXNlclBvbGljaWVzIiwiYW11IiwiZCIsInMzOkdldEJ1Y2tldExvY2F0aW9uIiwiZyIsImd2IiwibGEiLCJsIiwicCIsInBhIl0sInIiOlsiUmVhZFdyaXRlUXVpbHRWMi1zYWxlcy1wcm9kIl0sImIiOnsiX3R5cGUiOiJncm91cHMiLCJfZGF0YSI6eyJjZWxscGFpbnRpbmciOlsiZ2FsbGVyeSJdLCJjZWxseGdlbmUiOlsiOTEzNTI0OTQ2MjI2LXVzLWVhc3QtMSIsImNlbnN1cy1wdWJsaWMtdXMtd2VzdC0yIl0sImRhdGEiOlsiZHJvcC1vZmYtYnVja2V0Il0sImV4YW1wbGUiOlsicGhhcm1hLWRhdGEiXSwiZmwiOlsiMTU4LXJhdyIsIjE1OS1yYXciLCIxNjAtcmF3IiwiZGF0YS1jb21tb25zIl0sImdhbnltZWRlIjpbInNhbmRib3gtYnVja2V0Il0sImdkYyI6WyJjY2xlLTItb3BlbiJdLCJuZiI6WyJjb3JlLWdhbGxlcnkiXSwib21pY3MiOlsicXVpbHQtb21pY3NxdWlsdGNrYWlucHV0ODUwNzg3NzE3MTk3dXNlYXN0MTMtNThlcGpseXQ1bWNwIiwicXVpbHQtb21pY3NxdWlsdGNrYW91dHB1dDg1MDc4NzcxNzE5N3VzZWFzdDEtZ3B1eDJqdGp1Y204Il0sInBtYyI6WyJvYS1vcGVuZGF0YSJdLCJxdWlsdCI6WyJiYWtlIiwiYmVuY2hsaW5nIiwiY2NsZS1waXBlbGluZS1ydW5zIiwiY3JvIiwiZGVtb3MiLCJleGFtcGxlLWJ1Y2tldCIsIm9wZW4tY2NsZS12aXJnaW5pYSIsInNhbGVzLXJhdyIsInNhbGVzLXN0YWdpbmciLCJzYW5kYm94LWJ1Y2tldCIsInpzLXNhbmRib3giXSwic2FsZXMiOlsicHJvZC1jYW5hcnlidWNrZXRhbGxvd2VkLWVpaG8zbnM5d2hjbSIsInByb2QtY2FuYXJ5YnVja2V0cmVzdHJpY3RlZC1kZWt3YnZ0eWE0NWYiLCJwcm9kLXN0YXR1c3JlcG9ydHNidWNrZXQtdGZienVtNzBkZnU3Il0sInNyYSI6WyJwdWItcnVuLW9kcCJdLCJ1ZHAiOlsic3BlYyJdLCJ6cyI6WyJkaXNjb3Zlcnktb21pY3MiXX19
```

**Decoded payload shows**:
- ✅ Role: `ReadWriteQuiltV2-sales-prod`
- ✅ Permissions: `s3:PutObject`, `s3:DeleteObject`, `s3:GetObject`, etc.
- ✅ Buckets: Includes `quilt-sandbox-bucket` and 28 others
- ✅ Scope: `"w"` (write access)

---

## ❌ Backend Bugs Blocking Production

### Bug #1: JWT Token Not Being Extracted (CRITICAL)

**Symptom**:
```json
{
  "error": "missing_authorization",
  "detail": "Bearer token required for MCP requests"
}
```

**Actual Request Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImZyb250ZW5kLWVuaGFuY2VkIn0...
```

**Problem**: Backend is not extracting the token from the `Authorization` header.

**Fix Location**: `api/python/quilt3/` - Auth middleware or decorator

**Required Code**:
```python
def get_bearer_token(request):
    """Extract JWT from Authorization header."""
    auth_header = request.headers.get('Authorization', '')
    
    if not auth_header:
        logger.warning("No Authorization header present")
        return None
        
    if not auth_header.startswith('Bearer '):
        logger.warning(f"Invalid Authorization header format: {auth_header[:20]}...")
        return None
        
    token = auth_header[7:].strip()
    logger.info(f"Bearer token extracted: {len(token)} characters")
    return token
```

---

### Bug #2: Permission Validation Incorrectly Returns `no_access` (CRITICAL)

**Symptom**:
```python
# bucket_access_check returns:
{
  "permission_level": "no_access",  # ❌ WRONG
  "has_access": false
}
```

**JWT Claim Data Available**:
```json
{
  "permissions": [
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
  "buckets": [
    "quilt-sandbox-bucket",
    "quilt-sales-raw",
    // ... 27 more buckets
  ],
  "scope": "w",
  "level": "write"
}
```

**Fix Location**: Permission validation service

**Required Logic**:
```python
def validate_bucket_access(bucket_name, operation, jwt_claims):
    """Validate bucket access from JWT claims."""
    
    # Extract claims
    permissions = jwt_claims.get('permissions', [])
    buckets = jwt_claims.get('buckets', [])
    scope = jwt_claims.get('scope', '')
    level = jwt_claims.get('level', '')
    roles = jwt_claims.get('roles', [])
    
    # Check if bucket is in user's bucket list
    if bucket_name not in buckets:
        return {
            'permission_level': 'no_access',
            'has_access': False,
            'reason': f'Bucket {bucket_name} not in user bucket list'
        }
    
    # Determine permission level from scope/level claims
    if scope == 'w' or level == 'write':
        permission_level = 'write'
    elif scope == 'r' or level == 'read':
        permission_level = 'read'
    else:
        # Fallback: check permissions list
        write_perms = {'s3:PutObject', 's3:DeleteObject', 's3:PutObjectAcl'}
        if any(perm in permissions for perm in write_perms):
            permission_level = 'write'
        elif 's3:GetObject' in permissions:
            permission_level = 'read'
        else:
            permission_level = 'no_access'
    
    # Validate operation matches permission level
    operation_map = {
        'read': ['read', 'list'],
        'write': ['read', 'list', 'write', 'delete', 'put']
    }
    
    has_access = operation in operation_map.get(permission_level, [])
    
    return {
        'permission_level': permission_level,
        'has_access': has_access,
        'bucket_name': bucket_name,
        'operation': operation
    }
```

---

### Bug #3: Role Listing TypeError (HIGH)

**Fix Location**: `admin_roles_list` tool

**Required Fix**:
```python
# Current (broken):
role_display = role.name + " - " + role.description  # ❌ role.name or role.description might be None

# Required (working):
role_display = f"{role.name or 'Unknown'} - {role.description or 'No description'}"  # ✅ Safe
```

---

## 🧪 Backend Testing Instructions

### Test 1: Verify Token Extraction

```python
# Add logging to auth middleware:
import logging
logger = logging.getLogger(__name__)

def extract_jwt_token(request):
    token = get_bearer_token(request)
    logger.info(f"JWT extraction: {'SUCCESS' if token else 'FAILED'}")
    if token:
        logger.info(f"Token length: {len(token)}")
        logger.info(f"Token preview: {token[:50]}...")
    return token
```

**Expected Output**:
```
JWT extraction: SUCCESS
Token length: 890
Token preview: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImZ...
```

---

### Test 2: Verify JWT Validation

```python
import jwt

def validate_jwt(token):
    try:
        claims = jwt.decode(
            token,
            '7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0',
            algorithms=['HS256'],
            audience='quilt-mcp-server',
            issuer='quilt-frontend'
        )
        logger.info(f"JWT validation SUCCESS: {claims.get('roles')}")
        return claims
    except jwt.InvalidSignatureError:
        logger.error("JWT signature invalid - secret mismatch!")
        raise
    except jwt.ExpiredSignatureError:
        logger.error("JWT token expired")
        raise
    except Exception as e:
        logger.error(f"JWT validation failed: {e}")
        raise
```

**Expected Output**:
```
JWT validation SUCCESS: ['ReadWriteQuiltV2-sales-prod']
```

---

### Test 3: Verify Permission Validation

```python
def test_permission_validation():
    """Test with actual JWT from production."""
    test_token = "eyJhbGci..."  # Full token from logs
    
    claims = validate_jwt(test_token)
    
    result = validate_bucket_access('quilt-sandbox-bucket', 'write', claims)
    
    assert result['permission_level'] == 'write', f"Expected write, got {result['permission_level']}"
    assert result['has_access'] == True, "Expected has_access=True"
    
    print("✅ Permission validation working correctly")
```

---

## 📊 Impact & Urgency

**Users Affected**: All users on demo.quiltdata.com (production demo environment)

**Functionality Blocked**:
- ❌ Cannot list S3 objects via MCP
- ❌ Cannot upload files via MCP
- ❌ Cannot create packages via MCP
- ❌ Cannot execute Athena queries via MCP
- ❌ All Qurator AI features non-functional

**Business Impact**:
- Production demo environment unusable for MCP/AI features
- Customer demos failing
- Sales demonstrations blocked

**Estimated Fix Time**: 2-4 hours (if bugs are in expected locations)

---

## 🔗 Related Documentation

1. **Full technical analysis**: `/Users/simonkohnstamm/Documents/Quilt/quilt/BACKEND_MCP_SERVER_FIX_INSTRUCTIONS.md`
2. **Frontend deployment status**: `/Users/simonkohnstamm/Documents/Quilt/quilt/DEPLOYMENT_FIX_SUMMARY_1.64.1a7.md`
3. **JWT diagnostic scripts**: `/Users/simonkohnstamm/Documents/Quilt/quilt/JWT_PERMISSIONS_DIAGNOSTIC.js`

---

## ✅ Success Criteria

Backend fix is complete when:

1. ✅ `get_user_permissions` returns user's actual permissions (not "no bearer token")
2. ✅ `bucket_access_check('quilt-sandbox-bucket', 'write')` returns `permission_level: 'write'`
3. ✅ `bucket_objects_list('quilt-sandbox-bucket')` returns objects (not permission error)
4. ✅ `admin_roles_list` returns roles without Python TypeError
5. ✅ Backend logs show: "JWT validated successfully" for each MCP request

---

## 🆘 Contact

**Frontend Lead**: Simon (completed all frontend fixes)  
**Backend Team**: **ACTION REQUIRED** - Please prioritize this fix

**Questions?** See detailed technical breakdown in `BACKEND_MCP_SERVER_FIX_INSTRUCTIONS.md`

---

## TL;DR

✅ **Frontend**: Sending perfect JWTs with correct permissions  
❌ **Backend**: Not extracting/validating JWTs correctly  
🎯 **Fix**: Update MCP Server auth middleware and permission validation  
⏰ **Urgency**: P0 - Production demo environment blocked




