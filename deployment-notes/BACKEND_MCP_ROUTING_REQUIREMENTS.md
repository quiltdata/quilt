# Backend Team: MCP Routing Configuration Required

## 🚨 Critical Issue Found

**Frontend Status:** ✅ FULLY WORKING  
**MCP Server Status:** ✅ HEALTHY (Rev 70)  
**JWT Configuration:** ✅ MATCHING SECRETS  
**Problem:** ❌ **ROUTING - 405 Method Not Allowed**

---

## 🔍 Root Cause Analysis

### What's Working ✅
1. **Frontend generates enhanced JWT tokens correctly:**
   - 4,084 bytes
   - Includes 32 buckets
   - Includes 24 AWS permissions
   - Signed with `quilt-sales-prod-mcp-jwt-secret-2025-enhanced-tokens-v2`
   - Key ID: `frontend-enhanced`

2. **MCP Server is deployed and healthy:**
   - Task Definition: `quilt-mcp-server:70`
   - JWT secret matches frontend
   - Health checks passing
   - Listening on port 8000

### What's NOT Working ❌

**Requests to `https://demo.quiltdata.com/mcp` return:**
```
HTTP 405 Method Not Allowed
Response: <html>... (HTML error page, not JSON)
```

**This means:** The ALB/nginx reverse proxy is **NOT configured to route `/mcp` to the MCP server**.

---

## 🎯 What Backend Needs to Configure

### Option 1: ALB Target Group Routing (Recommended)

Configure the Application Load Balancer to route `/mcp*` paths to the MCP server target group.

**ALB Information:**
- ALB DNS: `sales--LoadB-nGDYylEerIKm-1431252539.us-east-1.elb.amazonaws.com`
- MCP Target Group: `sales-prod-mcp-server`
- MCP Container: Port 8000

**Required ALB Listener Rule:**
```
Priority: 10 (or appropriate)
Conditions:
  - Path pattern: /mcp*
Actions:
  - Forward to: sales-prod-mcp-server target group
```

**Testing:**
```bash
# Should return JSON, not HTML
curl -X POST https://demo.quiltdata.com/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <test-token>" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
```

### Option 2: Nginx Reverse Proxy (Alternative)

If there's an nginx proxy in front of the ALB, add this location block:

```nginx
location /mcp {
    # Proxy to MCP server target group through ALB
    proxy_pass http://sales--LoadB-nGDYylEerIKm-1431252539.us-east-1.elb.amazonaws.com;
    
    # OR if using service discovery:
    # proxy_pass http://sales-prod-mcp-server.local:8000;
    
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Critical: Pass through Authorization header
    proxy_pass_request_headers on;
    
    # Support SSE (Server-Sent Events) for streaming responses
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
    
    # Timeouts for MCP operations
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 300s;
    
    # CORS headers if needed
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, mcp-protocol-version, mcp-session-id' always;
    
    # Handle preflight
    if ($request_method = 'OPTIONS') {
        return 204;
    }
}
```

### Option 3: API Gateway (If Using)

If there's an API Gateway in front, add a resource:

```
Resource: /mcp/{proxy+}
Methods: ANY
Integration: HTTP Proxy to MCP server ALB
Pass Authorization headers: Yes
```

---

## 🧪 Current Test Results

From browser console:
```javascript
✅ MCP Client generates enhanced token: 4,084 bytes
✅ Token has 32 buckets
✅ Token has 24 permissions  
✅ Token is properly signed with HS256
❌ POST to /mcp returns: 405 Method Not Allowed (HTML response)
```

The frontend is doing everything correctly. It just needs the backend routing to be configured.

---

## 📋 Backend Action Items

1. **Identify the routing layer:**
   - Is there an ALB listener rule?
   - Is there an nginx reverse proxy?
   - Is there an API Gateway?

2. **Add `/mcp` route** to forward to:
   - Target Group: `sales-prod-mcp-server`
   - Backend: Port 8000
   - Protocol: HTTP (or HTTPS if TLS on backend)

3. **Ensure headers are passed through:**
   - `Authorization: Bearer <jwt>`
   - `Content-Type: application/json`
   - `mcp-protocol-version`
   - `mcp-session-id`

4. **Test the route:**
   ```bash
   curl -X POST https://demo.quiltdata.com/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":"test","method":"ping"}'
   
   # Should return JSON, NOT HTML
   ```

5. **Verify JWT flow:**
   ```bash
   # Get a real JWT from the browser console:
   # await window.__dynamicAuthManager.getCurrentToken()
   
   curl -X POST https://demo.quiltdata.com/mcp \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <paste-jwt-here>" \
     -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
   
   # Should return list of 97 tools
   ```

---

## 🎯 Expected Behavior After Fix

**Before (current):**
```
POST /mcp → 405 Method Not Allowed (HTML)
```

**After (correct):**
```
POST /mcp → Proxied to MCP server → 200 OK (JSON with tools list)
```

---

## 📊 Service Discovery Info

**MCP Server Service:**
- Cluster: `sales-prod`
- Service: `sales-prod-mcp-server-production`
- Task Definition: `quilt-mcp-server:70`
- Port: 8000
- Protocol: HTTP
- Health Check: `GET /healthz`

**Load Balancer:**
- DNS: `sales--LoadB-nGDYylEerIKm-1431252539.us-east-1.elb.amazonaws.com`
- Target Group: `sales-prod-mcp-server`
- Port: 8000

---

## ⏱️ Timeline

**Once routing is configured:**
- MCP tools will work immediately
- No frontend changes needed
- No MCP server restart needed
- Just need to refresh the browser

---

## 💡 Quick Test

Backend team can test if the MCP server is accessible internally:

```bash
# From within the VPC:
curl -X POST http://sales--LoadB-nGDYylEerIKm-1431252539.us-east-1.elb.amazonaws.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"ping"}'

# Should return successful JSON response
```

If this works, then the issue is definitely just the public routing configuration.

---

## 📞 Questions for Backend Team

1. **What's handling requests to `https://demo.quiltdata.com`?**
   - CloudFront?
   - ALB directly?
   - API Gateway?
   - Nginx proxy?

2. **How are other backend services routed?**
   - e.g., `/graphql`, `/api/`, etc.
   - We need the same pattern for `/mcp`

3. **Is there a CloudFormation/Terraform config** for the routing?
   - We can add the MCP route there

---

**Bottom Line:** Frontend is 100% ready. Just need backend routing for `/mcp` to reach the MCP server! 🚀








