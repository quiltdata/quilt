# Shared JWT Secret - Backend Implementation Instructions

## ✅ Frontend Status: DEPLOYED AND READY

Both frontend and MCP server are now using **AWS Systems Manager Parameter Store** for the JWT secret.

---

## 🔐 The New Shared Secret

**Secret Value (alphanumeric only):**
```
QuiltMCPJWTSecret2025ProductionV1
```

**Properties:**
- Length: 33 characters
- Format: Alphanumeric only (no special characters)
- Easy to replicate on both sides
- Stored in: AWS SSM Parameter Store

---

## 📍 SSM Parameter Store Location

**Parameter Name:**
```
/quilt/mcp-server/jwt-secret
```

**Full ARN:**
```
arn:aws:ssm:us-east-1:850787717197:parameter/quilt/mcp-server/jwt-secret
```

**AWS Region:** `us-east-1`  
**Account:** `850787717197`

---

## 🔧 Backend Implementation - Option 1: Use SSM (Recommended)

### Python Code to Read from SSM:

```python
import boto3
import os

def get_jwt_secret():
    """
    Get JWT secret from SSM Parameter Store.
    Falls back to environment variable if SSM unavailable.
    """
    try:
        ssm = boto3.client('ssm', region_name='us-east-1')
        response = ssm.get_parameter(
            Name='/quilt/mcp-server/jwt-secret',
            WithDecryption=True
        )
        secret = response['Parameter']['Value']
        print(f"✅ Loaded JWT secret from SSM (length: {len(secret)})")
        return secret
    except Exception as e:
        print(f"⚠️  Failed to load from SSM: {e}")
        # Fallback to environment variable
        secret = os.getenv('MCP_ENHANCED_JWT_SECRET', '')
        if secret:
            print(f"✅ Using JWT secret from environment (length: {len(secret)})")
            return secret
        raise ValueError("JWT secret not found in SSM or environment")

# In your FastAPI/MCP server startup:
JWT_SECRET = get_jwt_secret()
JWT_KID = os.getenv('MCP_ENHANCED_JWT_KID', 'frontend-enhanced')

print(f"🔐 JWT Configuration:")
print(f"   Secret Length: {len(JWT_SECRET)}")
print(f"   Key ID: {JWT_KID}")
print(f"   Algorithm: HS256")
```

### IAM Permissions Required:

Your MCP server's **ECS Task Execution Role** needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:us-east-1:850787717197:parameter/quilt/mcp-server/jwt-secret"
    }
  ]
}
```

---

## 🔧 Backend Implementation - Option 2: Environment Variable

If you prefer not to use SSM, set this environment variable:

```bash
MCP_ENHANCED_JWT_SECRET=QuiltMCPJWTSecret2025ProductionV1
MCP_ENHANCED_JWT_KID=frontend-enhanced
```

**In your task definition:**
```json
{
  "environment": [
    {
      "name": "MCP_ENHANCED_JWT_SECRET",
      "value": "QuiltMCPJWTSecret2025ProductionV1"
    },
    {
      "name": "MCP_ENHANCED_JWT_KID",
      "value": "frontend-enhanced"
    }
  ]
}
```

---

## 🧪 Verification Steps

### Step 1: Verify Secret Loaded

Add this logging to your MCP server startup:

```python
print("=" * 80)
print("🔐 JWT AUTHENTICATION CONFIGURATION")
print("=" * 80)
print(f"Secret Source: {'SSM' if secret_from_ssm else 'Environment'}")
print(f"Secret Value: {JWT_SECRET}")  # Full value for verification
print(f"Secret Length: {len(JWT_SECRET)}")
print(f"Key ID: {JWT_KID}")
print(f"Expected: QuiltMCPJWTSecret2025ProductionV1")
print(f"Match: {JWT_SECRET == 'QuiltMCPJWTSecret2025ProductionV1'}")
print("=" * 80)
```

**Expected output:**
```
🔐 JWT AUTHENTICATION CONFIGURATION
Secret Source: SSM
Secret Value: QuiltMCPJWTSecret2025ProductionV1
Secret Length: 33
Key ID: frontend-enhanced
Expected: QuiltMCPJWTSecret2025ProductionV1
Match: True
```

### Step 2: Test JWT Verification

Use this test endpoint:

```python
@app.post("/test/jwt-verify")
async def test_jwt_verify(request: Request):
    """Test endpoint to verify JWT validation is working"""
    auth_header = request.headers.get('Authorization', '')
    
    if not auth_header.startswith('Bearer '):
        return {"error": "No Bearer token"}
    
    token = auth_header.replace('Bearer ', '')
    
    try:
        import jwt
        payload = jwt.decode(
            token, 
            JWT_SECRET,  # Use the loaded secret
            algorithms=['HS256'],
            options={'verify_signature': True}
        )
        
        return {
            "success": True,
            "message": "JWT verified successfully",
            "secret_used": JWT_SECRET,  # Show what secret was used
            "secret_length": len(JWT_SECRET),
            "payload_preview": {
                "buckets": len(payload.get('buckets', [])),
                "permissions": len(payload.get('permissions', [])),
                "iss": payload.get('iss'),
                "sub": payload.get('sub'),
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "secret_used": JWT_SECRET,  # Show what secret was used for debugging
            "secret_length": len(JWT_SECRET),
        }
```

---

## 🚀 Deployment Instructions for Backend

### Option A: Using SSM (Recommended)

1. **Update your MCP server code** to read from SSM (see Python code above)

2. **Grant IAM permissions:**
   ```bash
   aws iam put-role-policy \
     --role-name <your-ecs-task-execution-role> \
     --policy-name ReadJWTSecret \
     --policy-document '{
       "Version": "2012-10-17",
       "Statement": [{
         "Effect": "Allow",
         "Action": ["ssm:GetParameter"],
         "Resource": "arn:aws:ssm:us-east-1:850787717197:parameter/quilt/mcp-server/jwt-secret"
       }]
     }'
   ```

3. **Deploy** - Your server will automatically read the secret on startup

### Option B: Using ECS Task Definition Secrets

Add this to your task definition:

```json
{
  "secrets": [
    {
      "name": "MCP_ENHANCED_JWT_SECRET",
      "valueFrom": "arn:aws:ssm:us-east-1:850787717197:parameter/quilt/mcp-server/jwt-secret"
    }
  ]
}
```

Then in Python:
```python
JWT_SECRET = os.getenv('MCP_ENHANCED_JWT_SECRET')
```

### Option C: Hardcode (Not Recommended)

Set environment variable in task definition:

```json
{
  "environment": [
    {
      "name": "MCP_ENHANCED_JWT_SECRET",
      "value": "QuiltMCPJWTSecret2025ProductionV1"
    }
  ]
}
```

---

## 📊 Current Status

### Frontend (Catalog) - Rev 94
- **Status:** ✅ HEALTHY (2/2 tasks)
- **Secret Source:** SSM Parameter Store
- **Secret Value:** `QuiltMCPJWTSecret2025ProductionV1`
- **Container Started:** Just now (with new secret)

### MCP Server - Rev 79 (Your Side)
- **Status:** ✅ HEALTHY (1/1 task)
- **Secret Source:** SSM Parameter Store (configured)
- **Container Started:** Just now (should have new secret)
- **Action Needed:** Verify secret loaded correctly

---

## 🧪 Testing After Deployment

### Test 1: Check Secret Loaded

Look for this in your CloudWatch logs:

```
✅ Loaded JWT secret from SSM (length: 33)
🔐 JWT Configuration:
   Secret Value: QuiltMCPJWTSecret2025ProductionV1
   Secret Length: 33
   Match: True
```

### Test 2: Test JWT Verification

From browser console:

```javascript
// Get a real token
const token = await window.__dynamicAuthManager.getCurrentToken()

// Test against your endpoint
fetch('https://demo.quiltdata.com/mcp/test/jwt-verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}).then(r => r.json()).then(console.log)
```

**Expected Response:**
```json
{
  "success": true,
  "message": "JWT verified successfully",
  "secret_used": "QuiltMCPJWTSecret2025ProductionV1",
  "secret_length": 33,
  "payload_preview": {
    "buckets": 32,
    "permissions": 24,
    "iss": "quilt-frontend",
    "sub": "user-id"
  }
}
```

### Test 3: End-to-End MCP Tool

From browser:

```javascript
const result = await window.__mcpClient.callTool({
  name: 'bucket_objects_list',
  arguments: { bucket: 's3://quilt-sandbox-bucket' }
})
console.log('MCP Tool Result:', result)
```

**Should work** without "JWT authentication required" errors!

---

## 🔑 Secret Details for Your Records

**Format:**
```
Secret: QuiltMCPJWTSecret2025ProductionV1
Type: Alphanumeric only (A-Z, a-z, 0-9)
Length: 33 characters
Algorithm: HS256
Key ID: frontend-enhanced
```

**How to verify manually:**

```python
import jwt

# The secret
secret = "QuiltMCPJWTSecret2025ProductionV1"

# Decode a token from the frontend
token = "paste-token-here"

payload = jwt.decode(token, secret, algorithms=['HS256'])
print("✅ Token verified successfully!")
print(f"Buckets: {len(payload['buckets'])}")
print(f"Permissions: {len(payload['permissions'])}")
```

---

## 📋 Checklist for Backend Team

- [ ] Update MCP server to load secret from SSM or environment
- [ ] Verify secret value: `QuiltMCPJWTSecret2025ProductionV1` (length: 33)
- [ ] Deploy updated MCP server
- [ ] Check CloudWatch logs for secret loading confirmation
- [ ] Test JWT verification with frontend token
- [ ] Verify MCP tools work with authenticated requests
- [ ] Confirm bucket permissions from JWT are used (not IAM fallback)

---

## ✅ Frontend Confirmation

I can confirm the frontend is now using:

```
Secret: QuiltMCPJWTSecret2025ProductionV1
Source: arn:aws:ssm:us-east-1:850787717197:parameter/quilt/mcp-server/jwt-secret
Key ID: frontend-enhanced
Status: ✅ Deployed and running (Rev 94)
```

---

## 🆘 If Still Not Working

Run these diagnostics on backend:

```python
# 1. Print exact secret being used
print(f"Backend secret: '{JWT_SECRET}'")
print(f"Backend secret bytes: {JWT_SECRET.encode()}")
print(f"Backend secret length: {len(JWT_SECRET)}")

# 2. Compare with expected
expected = "QuiltMCPJWTSecret2025ProductionV1"
print(f"Expected: '{expected}'")
print(f"Match: {JWT_SECRET == expected}")
print(f"Difference: {set(JWT_SECRET) ^ set(expected)}")

# 3. Try to decode a token
token = "paste-real-frontend-token"
try:
    payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    print("✅ VERIFICATION SUCCESS!")
except Exception as e:
    print(f"❌ VERIFICATION FAILED: {e}")
    # Try with expected secret
    try:
        payload = jwt.decode(token, expected, algorithms=['HS256'])
        print("✅ Works with expected secret - your loaded secret is wrong!")
    except:
        print("❌ Token invalid even with expected secret")
```

---

**Both services are deployed and ready!** Once the backend confirms they're using `QuiltMCPJWTSecret2025ProductionV1`, JWT authentication will work perfectly! 🚀








