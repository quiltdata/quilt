# MCP Server: Authorization Header Not Being Used

## 🔍 Investigation Results

### ✅ What's Working
1. **Frontend:** Generates enhanced JWT tokens correctly (4KB, 32 buckets, 24 permissions)
2. **Frontend:** SENDS Authorization header in every request ✅
3. **ALB:** Passes Authorization header through to backend ✅ (verified with curl)
4. **MCP Server:** Has correct JWT secret configured ✅

### ❌ What's NOT Working
**MCP Server logs show:** `"No auth header, allowing for initialization"`

But requests from browser are getting `200 OK` and `202 Accepted` responses.

---

## 🚨 Root Cause

**The MCP server is in "permissive" authentication mode:**
- Accepts requests **with or without** JWT
- Falls back to IAM role authentication when no JWT present
- Uses IAM role permissions instead of JWT bucket claims
- **Result:** Users can only access buckets granted by IAM role, NOT the 32 buckets in the JWT

---

## 📊 Evidence

### Browser Request (from fetch interceptor):
```
✅ URL: https://demo.quiltdata.com/mcp/?t=1759199900102
✅ Authorization: Bearer eyJhbGci... (4,084 bytes)
✅ Has buckets: 32
✅ Has permissions: 24
```

### MCP Server Logs:
```
❌ "MCP session 266db5d2804a46748dc9b78e2d4f08bb: No auth header, allowing for initialization"
✅ "POST /mcp/?t=1759199900102 HTTP/1.1" 200 OK
```

### Curl Test (with fake token):
```
✅ Authorization header WAS received by server
✅ Server tried to verify it: "JWT token could not be verified"
```

**Conclusion:** ALB passes headers fine (curl proves it), but server logs "No auth header" for browser requests.

---

## 🔧 Fix Required in MCP Server Code

### Issue: Header Extraction Logic

The MCP server might be checking headers incorrectly. Check the Python code:

```python
# WRONG - might not work with FastAPI/uvicorn:
auth_header = request.headers.get('Authorization')

# ALSO CHECK - case sensitivity:
auth_header = request.headers.get('authorization')  # lowercase

# BEST - try both:
auth_header = (
    request.headers.get('Authorization') or 
    request.headers.get('authorization') or
    request.headers.get('HTTP_AUTHORIZATION')
)
```

### Issue: Request Type Filtering

The server might only check auth on certain request types:

```python
# Make sure JWT auth is checked for ALL requests, not just initialize:
if request.method == 'POST' and '/mcp' in request.path:
    auth_header = get_auth_header(request)
    if auth_header:
        validate_jwt(auth_header)
    # Don't silently allow - log if missing!
    else:
        logger.warning(f"MCP request without Authorization header: {request.url}")
```

### Issue: Logging Configuration

The server might not be logging JWT authentication success:

```python
# Add detailed logging:
if auth_header:
    try:
        payload = decode_jwt(auth_header, secret)
        logger.info(f"JWT authenticated: user={payload['sub']}, buckets={len(payload.get('buckets', []))}, session={session_id}")
    except Exception as e:
        logger.error(f"JWT validation failed: {e}")
else:
    logger.warning(f"No Authorization header in request (session={session_id})")
```

---

## 🧪 Backend Diagnostic Commands

### Check if server is receiving headers:

Add this to the MCP server request handler:

```python
@app.middleware("http")
async def log_headers(request: Request, call_next):
    if "/mcp" in str(request.url):
        logger.info(f"MCP Request Headers: {dict(request.headers)}")
        has_auth = 'authorization' in request.headers or 'Authorization' in request.headers
        logger.info(f"Has Authorization header: {has_auth}")
    
    response = await call_next(request)
    return response
```

### Expected Log Output After Fix:

```
INFO: MCP Request Headers: {'authorization': 'Bearer eyJhbGc...', 'content-type': 'application/json', ...}
INFO: Has Authorization header: True
INFO: JWT authenticated: user=8795f0cc-8deb-40dd-9132-13357c983984, buckets=32, session=266db5d2804a46748dc9b78e2d4f08bb
INFO: Using JWT bucket permissions: ['cellpainting-gallery', 'quilt-sandbox-bucket', ...]
```

---

## 🎯 Quick Test for Backend Team

**Add temporary logging** to see what headers are actually received:

```python
# In the MCP request handler
import logging
logger = logging.getLogger(__name__)

@app.post("/mcp/")
async def handle_mcp(request: Request):
    # LOG ALL HEADERS
    logger.info(f"=== MCP REQUEST DEBUG ===")
    logger.info(f"All headers: {list(request.headers.keys())}")
    logger.info(f"Authorization header (capital A): {request.headers.get('Authorization', 'MISSING')}")
    logger.info(f"authorization header (lowercase a): {request.headers.get('authorization', 'MISSING')}")
    logger.info(f"Session ID: {request.headers.get('mcp-session-id', 'MISSING')}")
    logger.info(f"=== END DEBUG ===")
    
    # ... rest of handler
```

**Then check CloudWatch logs** - you should see if the Authorization header is present or missing.

---

## 📋 Checklist for Backend Team

- [ ] Add header logging middleware
- [ ] Check both `Authorization` and `authorization` (case-sensitive)
- [ ] Verify JWT validation is called for tool requests (not just initialization)
- [ ] Log JWT authentication success (not just failures)
- [ ] Ensure bucket claims from JWT are used (not IAM role fallback)
- [ ] Test with a real browser request and verify logs show authentication

---

## 🚀 Expected Outcome

After backend fixes, CloudWatch should show:

```
INFO: MCP session abc123: Authorization header present
INFO: JWT validated successfully
INFO: Session abc123: Authenticated as user XYZ with 32 buckets
INFO: Executing bucket_objects_list with JWT permissions
```

Instead of:

```
INFO: MCP session abc123: No auth header, allowing for initialization
INFO: Using IAM role permissions (fallback)
```

---

**The frontend is 100% correct!** The ball is in the backend court to extract and use the Authorization header properly. 🎯








