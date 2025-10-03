# JWT Token Flow Analysis - Why Redux?

## 🔍 TL;DR - You're Right to Question This

**The answer**: We're using Redux because:
1. ✅ **Redux is the single source of truth** for the user's authentication state
2. ✅ **Automatic token refresh** - Redux saga handles token expiration
3. ✅ **Role switching** - When users switch roles, Redux updates immediately
4. ⚠️ **BUT** - We're doing it in a convoluted way

**The problem**: We're passing the token through multiple layers unnecessarily.

---

## 📊 Current Token Flow (Overcomplicated)

```
User Login
    ↓
Redux Store (auth.tokens)
    ↓
authSelectors.selectAuthToken() ← Extracts token from Redux
    ↓
MCPContextProvider useEffect() ← Sets up token getter
    ↓
mcpClient.setReduxTokenGetter() ← Callback function
    ↓
mcpClient.getAccessToken() ← Called on every request
    ↓
mcpClient.buildHeaders() ← Adds Authorization: Bearer <token>
    ↓
MCP Server
```

---

## 🤔 Why Is This Overcomplicated?

### The Issue
Instead of **directly** reading from Redux in the MCP client, we're:
1. Creating a **callback function** in `MCPContextProvider`
2. **Passing** that callback to the MCP client via `setReduxTokenGetter()`
3. Having the MCP client **call back** to that function
4. The function **reads Redux** and returns the token

### Why Was This Done?
Looking at the code, this was likely done to:
- **Decouple** the MCP client from Redux (dependency injection pattern)
- **Allow testing** without Redux
- **Support multiple auth methods** (Redux, OAuth, IAM)

### The Problem
This adds complexity without much benefit because:
- The MCP client is **tightly coupled** to the Quilt frontend anyway
- The Redux store is **always available** in the frontend
- The extra indirection makes debugging harder

---

## ✅ Better Approach - Direct Redux Access

### Simpler Flow

```typescript
// In MCP Client constructor or initialization
import { store } from 'store'
import * as authSelectors from 'containers/Auth/selectors'

class QuiltMCPClient {
  private async getAccessToken(): Promise<string | null> {
    // Direct access - no callback needed
    const state = store.getState()
    const token = authSelectors.selectAuthToken(state)
    return token
  }
}
```

### Benefits
1. **Clearer** - Token retrieval is explicit
2. **Simpler** - No callback indirection
3. **Debuggable** - Easy to trace in DevTools
4. **Still reactive** - Gets fresh token on every call

---

## 🔐 What Token Are We Actually Sending?

### Current Token Structure

```javascript
// What's in Redux auth.tokens
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",  // ← This is what we send
  "exp": 1767064650,
  "refresh_token": "..."
}
```

### The JWT Payload (Decoded)

```json
{
  "id": "8795f0cc-8deb-40dd-9132-13357c983984",
  "uuid": "71298bde-1d25-4e52-bf16-a37b8cf6284c",
  "exp": 1767064650
}
```

### What's Missing?
The token does NOT contain:
- ❌ User roles
- ❌ User permissions
- ❌ S3 bucket access
- ❌ Groups or scope

---

## ⚠️ JWT Not Being Accepted - Debugging

### Run This in Browser Console

```javascript
// 1. Check what token we're sending
const store = window.__REDUX_STORE__ || require('store').default
const authSelectors = require('containers/Auth/selectors')
const state = store.getState()
const token = authSelectors.selectAuthToken(state)

console.log('Token from Redux:', token)

// 2. Decode the JWT (without verification)
function decodeJWT(token) {
  try {
    const [header, payload, signature] = token.split('.')
    return {
      header: JSON.parse(atob(header)),
      payload: JSON.parse(atob(payload)),
      signature: signature
    }
  } catch (e) {
    return { error: e.message }
  }
}

console.log('Decoded token:', decodeJWT(token))

// 3. Check what the MCP client is actually sending
const mcpClient = window.mcpClient
const headers = await mcpClient.getHeaders()
console.log('MCP Headers:', headers)
console.log('Authorization header:', headers.Authorization)

// 4. Compare tokens
const mcpToken = headers.Authorization?.replace('Bearer ', '')
console.log('Tokens match?', token === mcpToken)
console.log('Token from Redux:', token?.substring(0, 50) + '...')
console.log('Token in MCP headers:', mcpToken?.substring(0, 50) + '...')
```

---

## 🐛 Common Issues & Fixes

### Issue 1: Token Is Undefined

**Symptom**: `Authorization: Bearer undefined`

**Cause**: Redux store not initialized or user not logged in

**Check**:
```javascript
// Is user authenticated?
const tokens = authSelectors.tokens(store.getState())
console.log('Has tokens?', !!tokens)
console.log('Tokens:', tokens)
```

**Fix**: Ensure user is logged in before MCP calls

---

### Issue 2: Token Is Expired

**Symptom**: 401 Unauthorized responses

**Cause**: Token expired, Redux saga failed to refresh

**Check**:
```javascript
const tokens = authSelectors.tokens(store.getState())
const exp = tokens?.exp
const now = Math.floor(Date.now() / 1000)
console.log('Token expires at:', new Date(exp * 1000))
console.log('Current time:', new Date(now * 1000))
console.log('Expired?', exp < now)
console.log('Time until expiration:', exp - now, 'seconds')
```

**Fix**: 
```javascript
// Force token refresh
const { actions } = require('containers/Auth/actions')
store.dispatch(actions.check({ refetch: true }))
```

---

### Issue 3: Wrong Token Type

**Symptom**: Backend rejects token (e.g., "Invalid token format")

**Cause**: Backend expects different token structure

**Check**:
```javascript
const decoded = decodeJWT(token)
console.log('Token payload:', decoded.payload)

// Does it have what backend expects?
console.log('Has user ID?', !!decoded.payload.id)
console.log('Has expiration?', !!decoded.payload.exp)
console.log('Has roles?', !!decoded.payload.roles)
console.log('Has permissions?', !!decoded.payload.permissions)
```

**Investigation Needed**: 
- Check backend MCP server logs
- See what token format it expects
- Compare with what we're sending

---

### Issue 4: Token Modified In Transit

**Symptom**: Token works in one tool but not another

**Cause**: Something modifying the token between Redux and network

**Check**:
```javascript
// Check each stage
const stage1 = authSelectors.selectAuthToken(store.getState())
const stage2 = await mcpClient.getAccessToken()
const stage3 = (await mcpClient.getHeaders()).Authorization?.replace('Bearer ', '')

console.log('Stage 1 (Redux):', stage1?.substring(0, 50))
console.log('Stage 2 (Client.getAccessToken):', stage2?.substring(0, 50))
console.log('Stage 3 (Headers):', stage3?.substring(0, 50))

console.log('All match?', stage1 === stage2 && stage2 === stage3)
```

---

## 🔧 Recommended Refactor

### Option A: Direct Redux Access (Simplest)

```typescript
// In Client.ts
import { store } from 'store'
import * as authSelectors from 'containers/Auth/selectors'

export class QuiltMCPClient implements MCPClient {
  private async getAccessToken(): Promise<string | null> {
    try {
      const state = store.getState()
      const token = authSelectors.selectAuthToken(state)
      return token
    } catch (error) {
      console.error('Failed to get token from Redux:', error)
      return null
    }
  }
  
  // Remove: setReduxTokenGetter, reduxTokenGetter property
}

// In MCPContextProvider.tsx
// Remove: entire setReduxTokenGetter useEffect
```

**Pros**:
- ✅ 40% less code
- ✅ Clearer data flow
- ✅ Easier to debug
- ✅ Still reactive (fresh token on every call)

**Cons**:
- ⚠️ Tighter coupling to Redux
- ⚠️ Harder to unit test (needs Redux mock)

---

### Option B: Keep Current (If Testing Is Priority)

If you need the dependency injection for testing, keep current approach but:

1. **Add better logging**:
```typescript
private async getAccessToken(): Promise<string | null> {
  console.log('🔍 Getting access token...')
  
  if (this.reduxTokenGetter) {
    try {
      const token = await this.reduxTokenGetter()
      console.log('✅ Got token from Redux getter:', token ? `${token.substring(0, 20)}...` : 'null')
      if (token) return token
    } catch (error) {
      console.error('❌ Redux token getter failed:', error)
    }
  } else {
    console.warn('⚠️ No Redux token getter configured!')
  }
  
  return null
}
```

2. **Add validation**:
```typescript
private async requireAccessToken(): Promise<string> {
  const token = await this.getAccessToken()
  
  if (!token) {
    console.error('❌ No token available!')
    console.error('   Redux getter configured?', !!this.reduxTokenGetter)
    throw new Error('No authentication token available')
  }
  
  // Validate token format
  if (!token.includes('.')) {
    console.error('❌ Token does not look like a JWT:', token.substring(0, 50))
    throw new Error('Invalid token format')
  }
  
  console.log('✅ Token validated:', token.substring(0, 20) + '...')
  return token
}
```

---

## 🎯 Next Steps

### 1. Diagnose Current Issue

Run the browser console commands above to find out:
- [ ] Is the token being retrieved from Redux?
- [ ] What does the token look like (decoded)?
- [ ] Is it the same token reaching the MCP server?
- [ ] What error is the backend returning?

### 2. Check Backend Logs

Look for MCP server errors related to:
- JWT validation failures
- Missing claims
- Signature verification failures
- Token format issues

### 3. Verify Token Secret

Make sure frontend and backend are using the **same JWT secret** if they're both signing/verifying tokens.

### 4. Consider Simplification

If testing isn't a priority, refactor to **Option A** (direct Redux access) for:
- Simpler code
- Easier debugging
- Less cognitive overhead

---

## 📝 Summary

### Why Redux?
- ✅ Single source of truth
- ✅ Automatic refresh
- ✅ Role switching support

### Why Callback Pattern?
- ⚠️ Dependency injection (testing)
- ⚠️ But adds complexity

### Is It "Dumb"?
- **No** - It's a valid pattern for dependency injection
- **But** - It's likely over-engineered for this use case
- **Consider** - Direct Redux access for simplicity

### What's Likely Wrong?
Most likely issues (in order):
1. **Token not in Redux** - User not authenticated
2. **Token expired** - Redux saga failed to refresh
3. **Backend expects different format** - Token structure mismatch
4. **Wrong secret** - Backend can't verify signature

**Run the diagnostic commands above to find out!** 🔍

---

**Next**: Please run the browser console diagnostics and share:
1. The output of the token checks
2. Any backend error logs
3. What error message you're seeing

This will help identify the exact issue! 🎯

