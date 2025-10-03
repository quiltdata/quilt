# 🔧 Backend MCP Server Fix Instructions

## 🚨 Critical Issues Identified

### Frontend JWT System Status: ✅ **WORKING PERFECTLY**
- JWT tokens are being generated correctly
- JWT tokens are being sent in Authorization headers
- JWT authentication is working flawlessly
- **No frontend changes needed**

### Backend MCP Server Issues: ❌ **NEEDS FIXING**

## 📊 Diagnostic Results

### 1. JWT Token Content (Frontend - Working)
```json
{
  "roles": ["ReadWriteQuiltV2-sales-prod"],
  "permissions": [
    "s3:PutObject", "s3:DeleteObject", "s3:GetObject", 
    "s3:ListBucket", "s3:AbortMultipartUpload", "s3:PutObjectAcl"
  ],
  "buckets": 32,
  "exp": 1735481931
}
```

### 2. MCP Server Response (Backend - Broken)
```json
{
  "bucket_name": "quilt-sandbox-bucket",
  "permission_level": "no_access",  // ❌ WRONG!
  "total_writable_buckets": 0,      // ❌ WRONG!
  "success": true
}
```

### 3. Backend Error (Critical Bug)
```
"Failed to list roles: unsupported operand type(s) for +: 'NoneType' and 'str'"
```

---

## 🔧 Required Backend Fixes

### Fix 1: JWT Permission Parsing Logic

**Problem**: MCP Server is not properly parsing JWT token permissions.

**Current Behavior**:
- Receives JWT token with `s3:PutObject`, `s3:DeleteObject` permissions
- Incorrectly determines `permission_level: 'no_access'`

**Required Fix**:
```python
def parse_jwt_permissions(jwt_token):
    """Parse JWT token and extract S3 permissions"""
    try:
        payload = jwt.decode(jwt_token, verify=False)  # Don't verify signature for now
        
        # Extract permissions from JWT payload
        permissions = payload.get('permissions', [])
        roles = payload.get('roles', [])
        
        # Check for write permissions
        write_permissions = [
            's3:PutObject',
            's3:DeleteObject', 
            's3:PutObjectAcl',
            's3:AbortMultipartUpload'
        ]
        
        has_write = any(perm in permissions for perm in write_permissions)
        has_read = any(perm in permissions for perm in ['s3:GetObject', 's3:ListBucket'])
        
        # Determine access level
        if has_write and has_read:
            return 'read_write'
        elif has_read:
            return 'read_only'
        else:
            return 'no_access'
            
    except Exception as e:
        logger.error(f"JWT permission parsing failed: {e}")
        return 'no_access'
```

### Fix 2: Bucket Access Validation

**Problem**: MCP Server incorrectly validates bucket access.

**Current Behavior**:
- Returns `permission_level: 'no_access'` for buckets with valid permissions

**Required Fix**:
```python
def validate_bucket_access(bucket_name, jwt_token):
    """Validate if user has access to specific bucket"""
    try:
        payload = jwt.decode(jwt_token, verify=False)
        permissions = payload.get('permissions', [])
        roles = payload.get('roles', [])
        
        # Check if role indicates write access
        if any('ReadWrite' in role for role in roles):
            return {
                'bucket_name': bucket_name,
                'permission_level': 'read_write',
                'can_read': True,
                'can_write': True,
                'can_list': True
            }
        elif any('Read' in role for role in roles):
            return {
                'bucket_name': bucket_name,
                'permission_level': 'read_only',
                'can_read': True,
                'can_write': False,
                'can_list': True
            }
        else:
            return {
                'bucket_name': bucket_name,
                'permission_level': 'no_access',
                'can_read': False,
                'can_write': False,
                'can_list': False
            }
            
    except Exception as e:
        logger.error(f"Bucket access validation failed: {e}")
        return {
            'bucket_name': bucket_name,
            'permission_level': 'no_access',
            'error': str(e)
        }
```

### Fix 3: Role Processing Bug

**Problem**: Python string concatenation error in role processing.

**Current Error**:
```
"Failed to list roles: unsupported operand type(s) for +: 'NoneType' and 'str'"
```

**Required Fix**:
```python
def list_available_roles():
    """List available roles with proper null handling"""
    try:
        roles = []
        
        # Get roles from database/configuration
        raw_roles = get_roles_from_config()  # This might return None
        
        if raw_roles is None:
            raw_roles = []
        
        # Ensure raw_roles is a list
        if not isinstance(raw_roles, list):
            raw_roles = []
        
        # Process roles safely
        for role in raw_roles:
            if role is not None:  # Check for None before processing
                role_name = str(role) if role else "Unknown"
                roles.append({
                    'name': role_name,
                    'permissions': get_role_permissions(role_name)
                })
        
        return {
            'success': True,
            'roles': roles,
            'count': len(roles)
        }
        
    except Exception as e:
        logger.error(f"Role listing failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'roles': [],
            'count': 0
        }
```

### Fix 4: Bucket Discovery Logic

**Problem**: MCP Server returns 0 writable buckets despite valid permissions.

**Required Fix**:
```python
def discover_available_buckets(jwt_token):
    """Discover buckets user has access to based on JWT permissions"""
    try:
        payload = jwt.decode(jwt_token, verify=False)
        permissions = payload.get('permissions', [])
        roles = payload.get('roles', [])
        
        # Check if user has S3 permissions
        has_s3_permissions = any(perm.startswith('s3:') for perm in permissions)
        
        if not has_s3_permissions:
            return {
                'writable_buckets': [],
                'readable_buckets': [],
                'total_buckets': 0
            }
        
        # Determine access level based on permissions
        write_permissions = ['s3:PutObject', 's3:DeleteObject', 's3:PutObjectAcl']
        read_permissions = ['s3:GetObject', 's3:ListBucket']
        
        has_write = any(perm in permissions for perm in write_permissions)
        has_read = any(perm in permissions for perm in read_permissions)
        
        # Get available buckets (this would need to be implemented based on your bucket discovery logic)
        available_buckets = get_available_buckets_from_aws()
        
        writable_buckets = []
        readable_buckets = []
        
        for bucket in available_buckets:
            if has_write:
                writable_buckets.append(bucket)
            if has_read:
                readable_buckets.append(bucket)
        
        return {
            'writable_buckets': writable_buckets,
            'readable_buckets': readable_buckets,
            'total_buckets': len(available_buckets)
        }
        
    except Exception as e:
        logger.error(f"Bucket discovery failed: {e}")
        return {
            'writable_buckets': [],
            'readable_buckets': [],
            'total_buckets': 0,
            'error': str(e)
        }
```

---

## 🧪 Testing Instructions

### 1. Test JWT Permission Parsing
```python
# Test with actual JWT token from frontend
jwt_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI..."  # From frontend logs
result = parse_jwt_permissions(jwt_token)
assert result == 'read_write'
```

### 2. Test Bucket Access Validation
```python
# Test bucket access validation
bucket_name = "quilt-sandbox-bucket"
result = validate_bucket_access(bucket_name, jwt_token)
assert result['permission_level'] == 'read_write'
assert result['can_write'] == True
```

### 3. Test Role Processing
```python
# Test role listing
result = list_available_roles()
assert result['success'] == True
assert len(result['roles']) > 0
```

### 4. Test Bucket Discovery
```python
# Test bucket discovery
result = discover_available_buckets(jwt_token)
assert result['total_buckets'] > 0
assert len(result['writable_buckets']) > 0
```

---

## 📋 Implementation Checklist

- [ ] **Fix JWT permission parsing logic** to properly extract S3 permissions
- [ ] **Fix bucket access validation** to correctly determine access levels
- [ ] **Fix role processing bug** with proper null handling
- [ ] **Fix bucket discovery logic** to return correct bucket counts
- [ ] **Add proper error handling** for JWT parsing failures
- [ ] **Add logging** for debugging permission validation
- [ ] **Test with actual JWT tokens** from frontend
- [ ] **Verify all MCP tools** return correct permission information

---

## 🎯 Expected Results After Fix

### Before Fix (Current):
```json
{
  "bucket_name": "quilt-sandbox-bucket",
  "permission_level": "no_access",
  "total_writable_buckets": 0
}
```

### After Fix (Expected):
```json
{
  "bucket_name": "quilt-sandbox-bucket", 
  "permission_level": "read_write",
  "can_read": true,
  "can_write": true,
  "can_list": true,
  "total_writable_buckets": 32
}
```

---

## 🚀 Summary

**Frontend JWT System**: ✅ **WORKING PERFECTLY** - No changes needed

**Backend MCP Server**: ❌ **NEEDS FIXING** - Permission parsing and validation logic needs to be updated to properly handle the JWT tokens being sent by the frontend.

The JWT authentication system is working correctly. The issue is in the backend's ability to parse and validate the permissions contained in the JWT tokens.







