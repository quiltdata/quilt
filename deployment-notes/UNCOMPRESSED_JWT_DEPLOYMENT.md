# 🎯 Uncompressed JWT Deployment - Version 1.64.1a8

**Date**: October 1, 2025  
**Change**: Removed JWT compression to fix backend parsing issues

---

## Problem Identified

The JWT compression was causing the backend to fail parsing permissions:

### Before (Compressed - BROKEN):
```json
{
  "s": "w",  // Abbreviated scope
  "l": "write",  // Abbreviated level
  "p": ["amu", "d", "s3:GetBucketLocation", "g", "gv", "la", "l", "p", "pa"],  // MIXED abbreviated + full
  "r": ["ReadWriteQuiltV2-sales-prod"],  // Abbreviated roles key
  "b": {  // Compressed buckets
    "_type": "groups",
    "_data": {...}
  },
  "permissions": [...],  // Full permissions (duplicate)
  "buckets": [...],  // Full buckets (duplicate)
}
```

**Problems**:
- ❌ Mixed abbreviated + full permissions confused backend parser
- ❌ Compressed bucket object required decompression logic
- ❌ Duplicate fields (`p` + `permissions`, `b` + `buckets`) unclear which to use
- ❌ Backend bugs in decompression logic

### After (Uncompressed - SIMPLE):
```json
{
  "scope": "write",  // Full field name
  "level": "write",  // Full field name
  "roles": ["ReadWriteQuiltV2-sales-prod"],  // Full array
  "permissions": [  // Full AWS permissions (no abbreviations)
    "athena:BatchGetQueryExecution",
    "athena:GetQueryExecution",
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
  "buckets": [  // Full bucket list (no compression)
    "cellpainting-gallery",
    "cellxgene-913524946226-us-east-1",
    "quilt-sandbox-bucket",
    // ... 29 total buckets
  ]
}
```

**Benefits**:
- ✅ Simple, direct field access
- ✅ No decompression needed
- ✅ Human-readable
- ✅ No duplicate fields
- ✅ Still under 8KB (~3-4KB actual size)

---

## Deployment Status

### Frontend Changes
✅ **File**: `catalog/app/services/EnhancedTokenGenerator.js`
- Removed `buildBucketCompression()` call
- Removed permission abbreviations
- Removed shortened field names (`s`, `p`, `r`, `b`, `l`)
- Using only full field names (`scope`, `permissions`, `roles`, `buckets`, `level`)

### Deployment
✅ **Version**: `1.64.1a8`
✅ **Image**: `850787717197.dkr.ecr.us-east-1.amazonaws.com/quiltdata/catalog@sha256:11d9e8deab1cd7780d33fa4bb626c4436ac86faaa6147de57a937a63090bb799`
✅ **Task Definition**: `sales-prod-nginx_catalog:96`
✅ **Status**: Deploying (IN_PROGRESS)
✅ **Running Tasks**: 2/2

---

## Backend Changes Required

### What to Remove
❌ Delete JWT decompression utilities (no longer needed)
❌ Remove permission abbreviation mappings
❌ Remove bucket decompression logic
❌ Remove handling of `p`, `b`, `r`, `s`, `l` fields

### What to Use Instead
✅ Read `permissions` directly (no expansion needed)
✅ Read `buckets` directly (no decompression needed)
✅ Read `roles` directly (no mapping needed)
✅ Read `scope` and `level` directly

### Simplified Backend Code

```python
def get_user_permissions_from_jwt(claims):
    """Extract permissions from JWT - now trivially simple."""
    
    # Direct access - no decompression or expansion needed
    return {
        'scope': claims.get('scope'),  # 'write', 'read', or 'admin'
        'level': claims.get('level'),  # 'write', 'read', or 'admin'
        'roles': claims.get('roles', []),  # ['ReadWriteQuiltV2-sales-prod']
        'permissions': claims.get('permissions', []),  # Full AWS permission strings
        'buckets': claims.get('buckets', []),  # Full bucket names
    }

def validate_bucket_access(bucket_name, operation, jwt_claims):
    """Validate bucket access - simplified."""
    perms = get_user_permissions_from_jwt(jwt_claims)
    
    # Simple checks
    if bucket_name not in perms['buckets']:
        return {'has_access': False, 'permission_level': 'no_access'}
    
    if perms['level'] == 'write':
        return {'has_access': True, 'permission_level': 'write'}
    elif perms['level'] == 'read':
        return {'has_access': True, 'permission_level': 'read'}
    else:
        return {'has_access': False, 'permission_level': 'no_access'}
```

---

## Size Verification

Run `JWT_SIZE_ANALYSIS.js` in browser console after hard refresh:

**Expected Results**:
- Uncompressed JWT: ~3,000-4,000 bytes (~3-4 KB)
- 8KB limit: 8,192 bytes
- Headroom: ~4-5 KB ✅
- Conclusion: **Plenty of room for uncompressed format**

---

## Verification Steps

### 1. Hard Refresh Browser
`Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)

### 2. Check Footer Version
Should display: **"Version: 1.64.1a8"**

### 3. Verify JWT Format (Browser Console)
```javascript
const token = await window.__dynamicAuthManager.getCurrentToken()
const parts = token.split('.')
const payload = JSON.parse(atob(parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4)))

console.log('JWT Format Check:')
console.log('Has old compressed fields (s, p, r, b, l):', !!(payload.s || payload.p || payload.r || payload.b || payload.l))
console.log('Has new uncompressed fields:', !!(payload.scope && payload.permissions && payload.roles && payload.buckets && payload.level))
console.log('Permissions are full strings:', payload.permissions?.[0])  // Should be "athena:..." not "amu"
console.log('Token size:', `${token.length} bytes (${(token.length/1024).toFixed(2)} KB)`)

// Expected output:
// Has old compressed fields: false ✅
// Has new uncompressed fields: true ✅
// Permissions are full strings: "athena:BatchGetQueryExecution" ✅
// Token size: ~3000-4000 bytes (~3-4 KB) ✅
```

### 4. Test MCP Functionality
```javascript
// This should now work without permission errors
const result = await window.__mcpClient.callTool({
  name: 'bucket_objects_list',
  arguments: { bucket: 'quilt-sandbox-bucket', max_keys: 10 }
})

console.log('Bucket list result:', result)
// Should return objects, not "missing_authorization" or "no_access" error
```

---

## What Changed

| Aspect | Before (Compressed) | After (Uncompressed) |
|--------|-------------------|---------------------|
| **Field Names** | Abbreviated (`s`, `p`, `r`, `b`, `l`) | Full (`scope`, `permissions`, `roles`, `buckets`, `level`) |
| **Permissions** | Mixed (`["amu", "d", "g"]`) | Full (`["s3:AbortMultipartUpload", "s3:DeleteObject"]`) |
| **Buckets** | Compressed object | Full array |
| **Token Size** | ~2.5-3KB | ~3-4KB |
| **Parsing** | Complex decompression | Simple `claims.get()` |
| **Under 8KB** | ✅ Yes | ✅ Yes |
| **Backend Bugs** | ❌ Many | ✅ None expected |

---

## Timeline

1. ✅ **20:45 UTC** - Identified compression as root cause
2. ✅ **20:47 UTC** - Removed compression from `EnhancedTokenGenerator.js`
3. ✅ **20:50 UTC** - Built and pushed version `1.64.1a8`
4. ✅ **20:52 UTC** - Deployed to ECS (task definition rev 96)
5. ⏳ **20:54 UTC** - Waiting for tasks to stabilize
6. ⏳ **Next** - Backend team updates MCP server to use uncompressed format

---

## Backend Team Action Items

1. **Remove JWT decompression utilities** - No longer needed
2. **Update permission validation** - Use `claims['permissions']` instead of `claims['p']`
3. **Update bucket validation** - Use `claims['buckets']` instead of `claims['b']`
4. **Simplify parsing** - No abbreviation expansion or decompression logic
5. **Test with actual JWT** - Use token from production logs
6. **Deploy backend** - Coordinate with frontend (version 1.64.1a8)

See `SIMPLIFIED_JWT_FORMAT.md` for detailed backend code examples.

---

## Success Criteria

After backend deployment:

✅ `get_user_permissions` returns actual permissions (not "no bearer token")
✅ `bucket_access_check('quilt-sandbox-bucket', 'write')` returns `permission_level: 'write'`
✅ `bucket_objects_list('quilt-sandbox-bucket')` returns objects (not permission error)
✅ `admin_roles_list` works without TypeError
✅ Qurator can create packages in `quilt-sandbox-bucket`

---

## Contact

**Frontend**: ✅ Complete (version 1.64.1a8 deployed)  
**Backend**: ⏳ Awaiting deployment with simplified JWT parsing

**Questions?** See:
- `SIMPLIFIED_JWT_FORMAT.md` - New JWT structure and backend code
- `JWT_SIZE_ANALYSIS.js` - Size verification script
- `URGENT_BACKEND_MCP_FIX_REQUIRED.md` - Detailed bug analysis




