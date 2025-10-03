# 🎯 Simplified JWT Format - NO COMPRESSION

**Date**: October 1, 2025  
**Change**: Removed all JWT compression to fix backend parsing issues

---

## Why We Removed Compression

The compressed JWT format was causing backend parsing failures:

1. **Mixed abbreviated + full permissions** confused the parser
2. **Compressed bucket claims** required complex decompression logic
3. **Abbreviated field names** (`s`, `p`, `r`, `b`, `l`) required mapping
4. **Backend bugs** in decompression causing `no_access` errors

**Size Analysis**: Uncompressed JWT is **~3-4KB**, well under the **8KB limit** ✅

---

## New Simplified JWT Format

### Header
```json
{
  "alg": "HS256",
  "typ": "JWT",
  "kid": "frontend-enhanced"
}
```

### Payload (UNCOMPRESSED - Easy to Parse)
```json
{
  // Standard JWT claims
  "iss": "quilt-frontend",
  "aud": "quilt-mcp-server",
  "sub": "87951f0cc-8deb-40dd-9132-13357c983984",
  "id": "87951f0cc-8deb-40dd-9132-13357c983984",
  "uuid": "fc8911bf-c2b2-4e18-9c0c-0c5ec9a6f177",
  "iat": 1759282986,
  "exp": 1767054010,
  "jti": "mg7bnzx3i0t6",
  
  // Authorization claims - ALL UNCOMPRESSED, FULL VALUES
  "scope": "write",
  "level": "write",
  
  "roles": [
    "ReadWriteQuiltV2-sales-prod"
  ],
  
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
  
  "buckets": [
    "cellpainting-gallery",
    "cellxgene-913524946226-us-east-1",
    "cellxgene-census-public-us-west-2",
    "data-drop-off-bucket",
    "example-pharma-data",
    "fl-158-raw",
    "fl-159-raw",
    "fl-160-raw",
    "fl-data-commons",
    "ganymede-sandbox-bucket",
    "gdc-ccle-2-open",
    "nf-core-gallery",
    "omics-quilt-omicsquiltckainput850787717197useast13-58epjlyt5mcp",
    "omics-quilt-omicsquiltckaoutput850787717197useast1-gpux2jtjucm8",
    "pmc-oa-opendata",
    "quilt-bake",
    "quilt-benchling",
    "quilt-ccle-pipeline-runs",
    "quilt-cro",
    "quilt-demos",
    "quilt-example-bucket",
    "quilt-open-ccle-virginia",
    "quilt-sales-raw",
    "quilt-sales-staging",
    "quilt-sandbox-bucket",
    "quilt-zs-sandbox",
    "sales-prod-canarybucketallowed-eiho3ns9whcm",
    "sales-prod-canarybucketrestricted-dekwbvtya45f",
    "sales-prod-statusreportsbucket-tfbzum70dfu7",
    "sra-pub-run-odp",
    "udp-spec",
    "zs-discovery-omics"
  ]
}
```

---

## Backend Parsing - SIMPLIFIED

### Step 1: Extract Token from Header
```python
def get_bearer_token(request):
    """Extract JWT from Authorization header."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    return auth_header[7:].strip()
```

### Step 2: Decode JWT
```python
import jwt

def decode_jwt_token(token):
    """Decode and validate JWT."""
    claims = jwt.decode(
        token,
        '7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0',
        algorithms=['HS256'],
        audience='quilt-mcp-server',
        issuer='quilt-frontend'
    )
    return claims
```

### Step 3: Extract Permissions - NO DECOMPRESSION NEEDED
```python
def get_user_permissions(claims):
    """Extract permissions from JWT claims - ALL fields are now full/uncompressed."""
    
    # Simple direct access - no abbreviations to decode
    scope = claims.get('scope')  # 'write', 'read', or 'admin'
    level = claims.get('level')  # 'write', 'read', or 'admin'
    roles = claims.get('roles', [])  # ['ReadWriteQuiltV2-sales-prod']
    permissions = claims.get('permissions', [])  # Full AWS permission strings
    buckets = claims.get('buckets', [])  # Full bucket name list
    
    return {
        'scope': scope,
        'level': level,
        'roles': roles,
        'permissions': permissions,
        'buckets': buckets,
    }
```

### Step 4: Validate Bucket Access - STRAIGHTFORWARD
```python
def validate_bucket_access(bucket_name, operation, claims):
    """Validate bucket access - simplified with uncompressed claims."""
    
    user_perms = get_user_permissions(claims)
    
    # Check if bucket is in user's list
    if bucket_name not in user_perms['buckets']:
        return {
            'has_access': False,
            'permission_level': 'no_access',
            'reason': f'Bucket {bucket_name} not in user bucket list'
        }
    
    # Determine permission level from scope/level
    level = user_perms.get('level') or user_perms.get('scope')
    
    if level == 'write':
        permission_level = 'write'
        allowed_ops = ['read', 'write', 'list', 'delete', 'put']
    elif level == 'read':
        permission_level = 'read'
        allowed_ops = ['read', 'list']
    else:
        permission_level = 'no_access'
        allowed_ops = []
    
    has_access = operation in allowed_ops
    
    return {
        'has_access': has_access,
        'permission_level': permission_level,
        'bucket_name': bucket_name,
        'operation': operation,
    }
```

---

## Benefits of Uncompressed Format

1. ✅ **Simple parsing** - No decompression logic needed
2. ✅ **No abbreviation mapping** - Direct field access
3. ✅ **Clear debugging** - Human-readable JWT payload
4. ✅ **Fewer bugs** - Less complex code = fewer errors
5. ✅ **Still under 8KB** - ~3-4KB with full claims
6. ✅ **Future-proof** - Easy to add more fields

---

## Migration Notes

### Frontend Changes
- ✅ **DONE**: Removed compression in `EnhancedTokenGenerator.js`
- ✅ **DONE**: Removed abbreviated field names (`s`, `p`, `r`, `b`, `l`)
- ✅ **DONE**: Using only full field names (`scope`, `permissions`, `roles`, `buckets`, `level`)

### Backend Changes Required
- ❌ **TODO**: Remove JWT decompression utilities (no longer needed)
- ❌ **TODO**: Update permission validation to read `permissions` (not `p`)
- ❌ **TODO**: Update bucket validation to read `buckets` (not `b`)
- ❌ **TODO**: Update role validation to read `roles` (not `r`)
- ❌ **TODO**: Remove abbreviation expansion logic

---

## Backward Compatibility

**NOT REQUIRED** - This is a breaking change, but:
- Old tokens will expire in 24 hours
- Only affects demo.quiltdata.com (not production)
- Can coordinate frontend + backend deployment

**Deployment Strategy**:
1. Deploy frontend with uncompressed JWTs (now)
2. Deploy backend with simplified parsing (ASAP)
3. No backward compatibility needed (demo environment)

---

## Verification

After backend deployment, run this in browser console:

```javascript
// Decode current JWT to verify format
const token = await window.__dynamicAuthManager.getCurrentToken()
const parts = token.split('.')
const payload = JSON.parse(atob(parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4)))

console.log('JWT Format Verification:')
console.log('Has compressed claims (b, p, r, s, l):', !!(payload.b || payload.p || payload.r || payload.s || payload.l))
console.log('Has uncompressed claims:', !!(payload.buckets && payload.permissions && payload.roles && payload.scope && payload.level))
console.log('Permissions format:', payload.permissions?.[0])  // Should be "athena:BatchGetQueryExecution" not "g"
console.log('Buckets format:', payload.buckets?.[0])  // Should be "cellpainting-gallery" not compressed object
console.log('Token size:', `${token.length} bytes (${(token.length/1024).toFixed(2)} KB)`)

// Should see:
// Has compressed claims: false ✅
// Has uncompressed claims: true ✅
// Permissions format: "athena:BatchGetQueryExecution" ✅
// Buckets format: "cellpainting-gallery" ✅
// Token size: ~3000-4000 bytes (~3-4 KB) ✅
```

---

## Success Criteria

✅ JWT payload contains ONLY these fields:
- `iss`, `aud`, `sub`, `id`, `uuid`, `iat`, `exp`, `jti` (standard claims)
- `scope` (NOT `s`)
- `level` (NOT `l`)
- `roles` (NOT `r`)
- `permissions` (NOT `p` - full AWS permission strings)
- `buckets` (NOT `b` - full array, not compressed object)

✅ No fields with abbreviated names
✅ No compressed bucket objects
✅ No permission abbreviations
✅ Token size < 8KB
✅ Backend can parse with simple `claims.get('buckets')` - no decompression




