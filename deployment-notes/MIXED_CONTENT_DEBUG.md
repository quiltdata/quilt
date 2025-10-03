# Mixed Content Error Analysis

## 🎯 Key Finding: HTTP/HTTPS Mismatch

Your diagnostic showed this critical error:

```
Mixed Content: The page at 'https://demo.quiltdata.com/' was loaded over HTTPS, 
but requested an insecure resource 'http://demo.quiltdata.com/mcp/?t=1759404707288'. 
This request has been blocked; the content must be served over HTTPS.
```

## ✅ What We Know

### ECS Task Definition Is Correct
```bash
aws ecs describe-task-definition --task-definition sales-prod-nginx_catalog:117
```

Shows:
```json
{
  "name": "MCP_ENDPOINT",
  "value": "https://demo.quiltdata.com/mcp"  // ✅ Correct
}
```

### But Browser Is Requesting HTTP
The diagnostic network test tried to fetch:
```
http://demo.quiltdata.com/mcp/?t=1759404707288  // ❌ HTTP, not HTTPS!
```

---

## 🔍 Root Cause Analysis

### Possible Causes:

#### 1. **Browser Cache (Most Likely)**
The browser may have cached the old `config.js` with HTTP endpoint:
- Old cached config: `mcpEndpoint: "http://demo.quiltdata.com/mcp"`
- New deployed config: `mcpEndpoint: "https://demo.quiltdata.com/mcp"`
- Browser serving old cached version

#### 2. **CDN/Proxy Cache**
If there's a CDN or proxy in front:
- Old config cached at CDN layer
- Not yet updated from origin

#### 3. **Client-Side Code Override**
Some code might be stripping HTTPS:
- URL normalization bug
- Incorrect string replacement
- Environment-specific override

---

## 🔧 Immediate Fixes to Try

### Fix 1: Hard Browser Refresh

**In browser console, run:**
```javascript
// Clear all caches and reload
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key))
  console.log('✅ Service worker caches cleared')
  location.reload(true)
})
```

**Or keyboard shortcut:**
- **Chrome/Edge**: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
- **Firefox**: `Ctrl+F5` / `Cmd+Shift+R`

### Fix 2: Check Browser DevTools

1. Open DevTools (F12)
2. Go to **Network** tab
3. Filter for `config.js`
4. Look at the response
5. Check if `mcpEndpoint` is HTTP or HTTPS

### Fix 3: Bypass Cache with Query Param

**In browser console:**
```javascript
// Force fetch fresh config
fetch(`/config.js?nocache=${Date.now()}`)
  .then(r => r.text())
  .then(text => {
    console.log('Fresh config.js:', text)
    // Look for mcpEndpoint value
    const match = text.match(/mcpEndpoint.*?["']([^"']+)["']/)
    if (match) {
      console.log('MCP Endpoint:', match[1])
      console.log('Is HTTPS?', match[1].startsWith('https://'))
    }
  })
```

---

## 🔍 Diagnostic Commands

### Check What Browser Has Loaded

**Run in browser console:**
```javascript
console.log('='.repeat(80))
console.log('🔍 MCP Endpoint Diagnostic')
console.log('='.repeat(80))
console.log('')

// Check config object
const config = window.QUILT_CATALOG_CONFIG
console.log('1. Window config object:')
console.log('   mcpEndpoint:', config?.mcpEndpoint)
console.log('   Full config:', config)
console.log('')

// Check MCP client
if (window.mcpClient) {
  console.log('2. MCP Client:')
  // The baseUrl is private, but we can check what it uses
  window.mcpClient.getHeaders().then(async headers => {
    console.log('   Will try to make a request to see endpoint...')
    
    // Make a test request and see where it goes
    try {
      const response = await fetch('/config.js?t=' + Date.now())
      const text = await response.text()
      console.log('3. Fresh config.js from server:', text)
    } catch (e) {
      console.error('   Failed to fetch:', e)
    }
  })
}
console.log('')
console.log('='.repeat(80))
```

### Check Network Request

**In browser DevTools:**
1. Open **Network** tab
2. Click **Preserve log**
3. Try to use Qurator (ask a question)
4. Look for requests to `/mcp` or MCP endpoint
5. Check if they're HTTP or HTTPS
6. Look at **Request Headers** → see the full URL

---

## 🎯 Expected Results

### If It's a Cache Issue:
```
Window config: http://demo.quiltdata.com/mcp  ❌
Fresh config from server: https://demo.quiltdata.com/mcp  ✅
→ Solution: Hard refresh + clear cache
```

### If It's Deployed Correctly:
```
Window config: https://demo.quiltdata.com/mcp  ✅
Fresh config from server: https://demo.quiltdata.com/mcp  ✅
Network request: https://demo.quiltdata.com/mcp  ✅
→ JWT should work now!
```

### If There's a Code Bug:
```
Window config: https://demo.quiltdata.com/mcp  ✅
Network request: http://demo.quiltdata.com/mcp  ❌
→ Something in code is changing HTTPS to HTTP
→ Need to check MCP client URL handling
```

---

## 🐛 If Hard Refresh Doesn't Work

### Check MCP Client URL Processing

The MCP client constructor processes the endpoint URL:

```typescript
// In Client.ts
constructor() {
  const endpoint = cfg.mcpEndpoint && cfg.mcpEndpoint.trim() 
    ? cfg.mcpEndpoint 
    : DEFAULT_BASE_URL
  this.baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`
  // ...
}
```

**Potential issue**: Check if `DEFAULT_BASE_URL` is HTTP

**To check:**
```javascript
// In browser console
window.mcpClient.getHeaders().then(() => {
  // This will log the baseUrl if debugging is on
  console.log('Check console for "MCP Client Configuration" logs')
})
```

---

## 📋 Action Plan

### Step 1: Verify Current State ✅
```bash
# Already done - ECS has HTTPS in config
aws ecs describe-task-definition --task-definition sales-prod-nginx_catalog:117 \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`MCP_ENDPOINT`]'
```

Result: ✅ **HTTPS is configured**

### Step 2: Check Browser Cache 🔍
**User Action Required:**
1. Hard refresh browser: `Ctrl+Shift+R` / `Cmd+Shift+R`
2. Or open in **Incognito/Private** window
3. Check if MCP works

### Step 3: Verify Fresh Config 🔍
**Run in browser console:**
```javascript
fetch('/config.js?t=' + Date.now())
  .then(r => r.text())
  .then(text => {
    const match = text.match(/mcpEndpoint.*?["']([^"']+)["']/)
    console.log('Server mcpEndpoint:', match ? match[1] : 'not found')
    console.log('Browser mcpEndpoint:', window.QUILT_CATALOG_CONFIG?.mcpEndpoint)
    console.log('Match?', match && match[1] === window.QUILT_CATALOG_CONFIG?.mcpEndpoint)
  })
```

### Step 4: Test MCP Request 🧪
**After clearing cache, run:**
```javascript
// Test MCP request
const mcpEndpoint = window.QUILT_CATALOG_CONFIG?.mcpEndpoint || 'https://demo.quiltdata.com/mcp'
console.log('Testing with endpoint:', mcpEndpoint)

fetch(`${mcpEndpoint}?t=${Date.now()}`, {
  method: 'POST',
  headers: await window.mcpClient.getHeaders(),
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 'test-' + Date.now(),
    method: 'tools/list',
    params: {}
  })
})
.then(r => {
  console.log('Response status:', r.status)
  return r.json()
})
.then(data => console.log('Response data:', data))
.catch(err => console.error('Error:', err))
```

---

## ✅ Summary

### The Problem:
- Browser is trying to fetch **HTTP** from **HTTPS** page
- Blocked by Mixed Content security policy
- JWT never reaches server

### Most Likely Cause:
- **Browser cache** serving old `config.js` with HTTP endpoint

### Quick Fix:
1. **Hard refresh**: `Ctrl+Shift+R` / `Cmd+Shift+R`
2. **Or try Incognito mode** to bypass cache
3. **Then test MCP** again

### If That Doesn't Work:
- Run the diagnostic commands above
- Check if there's a code bug stripping HTTPS
- Verify CDN/proxy isn't caching old config

---

## 🎯 Next Steps

**USER: Please try these in order:**

1. **Hard refresh the browser** (Ctrl+Shift+R / Cmd+Shift+R)
2. **Run this in console:**
   ```javascript
   console.log('MCP Endpoint:', window.QUILT_CATALOG_CONFIG?.mcpEndpoint)
   ```
3. **Try Qurator again** - ask it a question
4. **Report back:** Does it work? What's the endpoint now?

If it still shows HTTP after hard refresh, we have a different issue to investigate!

