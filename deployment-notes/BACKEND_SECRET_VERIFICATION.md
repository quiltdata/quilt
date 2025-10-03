# 🔍 Backend JWT Secret Verification - URGENT

**Issue**: Backend reports "Signature verification failed" despite using the same 64-character secret.

---

## Current Status

### Frontend (VERIFIED ✅)
```bash
curl -s https://demo.quiltdata.com/config.js | grep mcpEnhancedJwtSecret
```

**Result**:
```json
"mcpEnhancedJwtSecret": "7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0"
```

**Length**: 64 characters ✅

### Backend (TO VERIFY ❌)

**SSM Parameter**:
```bash
aws ssm get-parameter \
  --name /quilt/mcp-server/jwt-secret \
  --region us-east-1 \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text
```

**Result**:
```
7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0
```

**Length**: 64 characters ✅

---

## Problem: Secrets Match But Signature Fails

If both frontend and backend have the **exact same 64-character secret**, but signature verification still fails, the issue must be:

### Possibility #1: Backend Using Wrong Secret Source

**Check**: Is the backend MCP server actually reading from SSM?

```python
# Backend should be doing:
import os
import boto3

def get_jwt_secret():
    # Option 1: Read from environment variable (set by ECS from SSM)
    secret_from_env = os.environ.get('MCP_ENHANCED_JWT_SECRET')
    if secret_from_env:
        print(f"✅ Secret from env: {len(secret_from_env)} chars")
        return secret_from_env
    
    # Option 2: Read directly from SSM (if env var not set)
    ssm = boto3.client('ssm', region_name='us-east-1')
    response = ssm.get_parameter(
        Name='/quilt/mcp-server/jwt-secret',
        WithDecryption=True
    )
    secret_from_ssm = response['Parameter']['Value']
    print(f"✅ Secret from SSM: {len(secret_from_ssm)} chars")
    return secret_from_ssm
```

**CRITICAL**: Verify the backend is actually getting this secret, not falling back to a hardcoded one!

---

### Possibility #2: Encoding Issue

The secret might have invisible characters or encoding issues.

**Verify on backend**:
```python
secret = get_jwt_secret()
print(f"Secret length: {len(secret)}")
print(f"Secret bytes: {secret.encode('utf-8')}")
print(f"Secret hex: {secret.encode('utf-8').hex()}")
print(f"Expected: 7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0")

# Should be exactly 64 bytes, no trailing newlines or spaces
assert len(secret) == 64, f"Expected 64 chars, got {len(secret)}"
assert secret == "7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0"
```

---

### Possibility #3: Algorithm Mismatch

**Frontend uses**: HS256 (HMAC SHA-256)

**Backend must use**: HS256 (same)

```python
import jwt

def verify_jwt_token(token):
    secret = get_jwt_secret()
    
    try:
        # MUST use HS256, NOT RS256 or other algorithms
        claims = jwt.decode(
            token,
            secret,
            algorithms=['HS256'],  # ✅ MUST be HS256
            audience='quilt-mcp-server',
            issuer='quilt-frontend',
            options={
                'verify_signature': True,
                'verify_aud': True,
                'verify_iss': True,
                'verify_exp': True,
            }
        )
        print(f"✅ JWT signature verified successfully")
        return claims
    except jwt.InvalidSignatureError as e:
        print(f"❌ Signature verification failed: {e}")
        print(f"   Secret used: {len(secret)} chars")
        print(f"   Secret preview: {secret[:10]}...{secret[-10:]}")
        raise
```

---

### Possibility #4: Backend Using Old Cached Secret

**Check if backend is caching the secret**:

```python
# BAD - Cached at module load time:
JWT_SECRET = os.environ.get('MCP_ENHANCED_JWT_SECRET')  # ❌ Never updates

# GOOD - Fetched per request:
def get_current_jwt_secret():
    return os.environ.get('MCP_ENHANCED_JWT_SECRET')  # ✅ Always fresh
```

**If backend caches the secret**, it needs to **restart** to pick up the new value from SSM.

---

## Diagnostic Test for Backend

### Test 1: Verify Secret Value

```python
import os

# In backend MCP server startup:
secret = os.environ.get('MCP_ENHANCED_JWT_SECRET')
print(f"\n{'='*70}")
print(f"MCP Server JWT Secret Diagnostic")
print(f"{'='*70}")
print(f"Secret from environment: {secret is not None}")
print(f"Secret length: {len(secret) if secret else 'N/A'}")
print(f"Secret value: {secret}")
print(f"Expected: 7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0")
print(f"Match: {secret == '7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0'}")
print(f"{'='*70}\n")

if secret != '7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0':
    print("❌ SECRET MISMATCH - Backend is using WRONG secret!")
    print(f"   Backend has: {secret}")
    print(f"   Should have: 7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0")
```

---

### Test 2: Test with Known-Good JWT

**Get a fresh JWT from production frontend**:
```javascript
// Run in browser console on demo.quiltdata.com:
const token = await window.__dynamicAuthManager.getCurrentToken()
console.log('Test token for backend:', token)
```

**Then test on backend**:
```python
def test_jwt_verification():
    # Paste the token from browser console
    test_token = "eyJhbGci..."  # Full token from frontend
    
    secret = "7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0"
    
    try:
        claims = jwt.decode(
            test_token,
            secret,
            algorithms=['HS256'],
            audience='quilt-mcp-server',
            issuer='quilt-frontend'
        )
        print("✅ Token verified successfully!")
        print(f"   Roles: {claims.get('roles')}")
        print(f"   Buckets: {len(claims.get('buckets', []))}")
        print(f"   Permissions: {len(claims.get('permissions', []))}")
        return True
    except jwt.InvalidSignatureError:
        print("❌ Signature verification FAILED")
        print("   This means:")
        print("   1. Backend is using different secret, OR")
        print("   2. Frontend is signing with different secret, OR")  
        print("   3. Encoding issue (UTF-8 vs ASCII)")
        return False
    except Exception as e:
        print(f"❌ Other error: {e}")
        return False

test_jwt_verification()
```

---

### Test 3: Generate Test JWT on Backend

**Have backend generate a test JWT**:
```python
import jwt
import json

def generate_test_jwt():
    secret = "7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0"
    
    payload = {
        'iss': 'quilt-frontend',
        'aud': 'quilt-mcp-server',
        'sub': 'test-user',
        'scope': 'write',
        'level': 'write',
        'roles': ['ReadWriteQuiltV2-sales-prod'],
        'permissions': ['s3:GetObject', 's3:PutObject'],
        'buckets': ['quilt-sandbox-bucket'],
        'iat': int(time.time()),
        'exp': int(time.time()) + 3600,
    }
    
    token = jwt.encode(
        payload,
        secret,
        algorithm='HS256',
        headers={'kid': 'frontend-enhanced'}
    )
    
    print("Backend-generated test JWT:")
    print(token)
    
    # Verify it immediately
    decoded = jwt.decode(
        token,
        secret,
        algorithms=['HS256'],
        audience='quilt-mcp-server',
        issuer='quilt-frontend'
    )
    print("✅ Backend can generate and verify its own JWTs")
    
    return token
```

**Then test this token on frontend**:
```javascript
// In browser console:
const backendToken = "eyJhbGci..."  // Paste backend-generated token

// Try to verify with frontend secret
const config = window.QUILT_CATALOG_CONFIG
const parts = backendToken.split('.')
const header = JSON.parse(atob(parts[0]))
const payload = JSON.parse(atob(parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4)))

console.log('Backend-generated token:')
console.log('  Header:', header)
console.log('  Payload:', payload)
console.log('  Can we verify this? Need to test signature...')
```

---

## Most Likely Culprit

Based on "Signature verification failed (secret_length=64, kid=frontend-enhanced)", the backend:
- ✅ Has the correct secret length (64)
- ✅ Sees the correct kid (frontend-enhanced)
- ❌ Signature still doesn't match

**This suggests**:

1. **Backend might be reading from wrong environment variable**
   - Check: Is it reading `MCP_ENHANCED_JWT_SECRET` or something else?
   - Verify: `print(os.environ.keys())` in backend startup

2. **Backend might have the secret but with different encoding**
   - Secret as string: `"7nzzo8v..."`
   - Secret as bytes: `b"7nzzo8v..."`
   - PyJWT requires string, not bytes

3. **Backend might be using a different JWT library**
   - Frontend: Custom HS256 implementation
   - Backend: PyJWT or jose or something else
   - Different libraries might produce different signatures

---

## Immediate Action for Backend Team

1. **Add extensive logging** to JWT verification:
   ```python
   def decode_jwt(token):
       secret = os.environ.get('MCP_ENHANCED_JWT_SECRET')
       print(f"🔍 JWT Decode Debug:")
       print(f"   Secret source: environment variable MCP_ENHANCED_JWT_SECRET")
       print(f"   Secret present: {secret is not None}")
       print(f"   Secret length: {len(secret) if secret else 'N/A'}")
       print(f"   Secret matches expected: {secret == '7nzzo8vskFWWUrFT2gWq9FhYJmJexXnETFvrzYOtihYXWHW5Ns2VgI6N8lYDxpk0'}")
       print(f"   Token length: {len(token)}")
       print(f"   Token preview: {token[:50]}...")
       
       try:
           claims = jwt.decode(token, secret, algorithms=['HS256'])
           print(f"   ✅ Signature verified!")
           return claims
       except jwt.InvalidSignatureError as e:
           print(f"   ❌ Signature verification FAILED: {e}")
           print(f"   Using algorithm: HS256")
           print(f"   Using secret: {secret[:10]}...{secret[-10:]}")
           raise
   ```

2. **Restart backend service** after verifying secret is correct:
   ```bash
   # Backend might be caching old secret
   # Force restart to reload from environment
   ```

3. **Test with actual frontend JWT**:
   - Get token from browser console (use `JWT_SIGNATURE_DIAGNOSTIC.js`)
   - Attempt to decode on backend
   - Compare results

---

## Success Criteria

Backend logs should show:
```
🔍 JWT Decode Debug:
   Secret source: environment variable MCP_ENHANCED_JWT_SECRET
   Secret present: True
   Secret length: 64
   Secret matches expected: True
   Token length: 3456
   Token preview: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImZ...
   ✅ Signature verified!
   ✅ JWT authentication succeeded
   User role: ReadWriteQuiltV2-sales-prod
   Permission level: write
```

If secret matches but signature still fails:
- Check PyJWT version (should be recent, 2.x)
- Check if secret has encoding issues (should be string, not bytes)
- Verify HS256 algorithm is used (not RS256 or other)




