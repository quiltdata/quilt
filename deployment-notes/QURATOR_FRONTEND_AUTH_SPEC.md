# Qurator Frontend Authentication Specification

**Date:** October 1, 2025  
**Author:** Based on recommendations from Alexei Mochalov (nl_0@quiltdata.io)  
**Purpose:** Refactor frontend authentication to properly handle JWT tokens for MCP integration

---

## Executive Summary

The frontend authentication approach needs to be simplified by **reusing existing catalog authentication tokens** rather than creating new JWT tokens in the browser. The current implementation is fundamentally flawed because it stores secrets in the browser and signs tokens client-side.

---

## Core Principles

### 1. **Never Create JWT Tokens in the Browser**
- **REMOVE:** All JWT token creation/signing logic from frontend code
- **REMOVE:** Any JWT signing secrets from frontend environment variables
- **REASON:** Keeping secrets in the browser is a security vulnerability

### 2. **Reuse Existing Catalog Auth Token**
- The catalog already maintains an authentication token in local storage
- This token is sufficient for all MCP server communication
- No new tokens need to be created

### 3. **Stateless Request Pattern**
- Send the auth token with **every request** to the MCP server
- Do NOT cache or store authentication state on the backend
- Each request must be atomic and self-contained

---

## Implementation Details

### Token Retrieval

#### Current State
The catalog stores an authentication token in **local storage** that:
- Identifies the user against the Quilt registry
- Contains user role and permission information
- Updates automatically when users switch roles
- Is managed by the catalog's Redux state

#### Access Pattern
```typescript
// DO NOT access local storage directly
// Instead, subscribe to Redux state to get fresh token

import { selectors } from 'utils/reduxTools'

// Get current auth token from Redux state
const authToken = useSelector(selectors.selectAuthToken)

// This ensures you always have the fresh token, 
// including after role switches
```

#### Key Methods
Look for existing catalog methods that:
- Retrieve the current authentication token
- Subscribe to token updates
- Handle token refresh automatically

**Action Item:** Identify and document the specific Redux selectors/hooks used for auth token retrieval.

---

### MCP Request Flow

#### Request Structure
Every request to the MCP server must include the auth token:

```typescript
// Pseudo-code for MCP requests
async function sendMCPRequest(tool: string, params: object) {
  const authToken = getAuthTokenFromRedux(); // Always get fresh token
  
  const response = await fetch('/mcp/endpoint', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tool,
      params
    })
  });
  
  return response.json();
}
```

#### Token Transmission
- **Header Name:** `Authorization`
- **Format:** `Bearer <token>`
- **Frequency:** Include with EVERY request
- **Source:** Always retrieve from Redux state, never cache locally

---

### Role Switching Behavior

#### Requirements
When a user switches roles in the catalog:
1. Redux state updates with new token
2. Subsequent MCP requests automatically use the new token
3. No manual token refresh or re-initialization required

#### Implementation Notes
- Token is **role-specific** - switching roles generates a new token
- By always reading from Redux state, role switches are handled automatically
- The catalog state remains consistent across role changes

---

## What to Remove

### Delete Immediately
1. **JWT Creation Logic**
   - Any `jwt.sign()` or similar token creation calls
   - JWT library imports used for token creation
   - Token signing secret retrieval from SSM or environment

2. **Custom Token Storage**
   - Any custom auth token caching
   - Session-based token storage
   - Backend state for authentication

3. **Token Initialization**
   - `initializeSession()` or similar methods
   - Any "get credentials" calls that create new tokens
   - OAuth token creation/wrapping code

### Keep and Refactor
1. **Redux Integration**
   - Maintain subscription to catalog Redux state
   - Use existing auth token selectors
   - Preserve token refresh mechanisms

2. **Request Middleware**
   - Keep HTTP request middleware
   - Refactor to inject auth token from Redux state
   - Ensure token is added to every MCP request

---

## Testing Checklist

### Functional Tests
- [ ] Auth token is retrieved from Redux state, not local storage directly
- [ ] Token is included in Authorization header for all MCP requests
- [ ] Role switching updates the token in subsequent requests
- [ ] Multiple concurrent requests from same user work correctly
- [ ] Multiple users can make requests simultaneously without conflicts

### Security Tests
- [ ] No JWT secrets are present in frontend code
- [ ] No token creation happens in the browser
- [ ] Tokens are transmitted securely (HTTPS)
- [ ] No authentication state is persisted on backend

### Edge Cases
- [ ] Expired token handling
- [ ] Missing token scenarios
- [ ] Network failures during token refresh
- [ ] Rapid role switching

---

## Migration Path

### Phase 1: Setup
1. Identify existing catalog methods for token retrieval
2. Document Redux selectors/hooks for auth token
3. Review current MCP request flow

### Phase 2: Refactor
1. Remove all JWT creation code
2. Remove signing secret from frontend config
3. Update MCP request middleware to use Redux auth token
4. Ensure token is passed with every request

### Phase 3: Cleanup
1. Delete unused JWT libraries from package.json
2. Remove test code related to token creation
3. Update documentation

### Phase 4: Validation
1. Test with multiple users
2. Test role switching
3. Verify no backend state issues
4. Performance test concurrent requests

---

## Integration Notes

### MCP Middleware Requirements
The frontend middleware that handles MCP communication must:
- Accept the auth token as a parameter or retrieve from Redux
- Add token to request headers
- NOT cache the token between requests
- Handle token refresh/expiration errors gracefully

### Backend Expectations
The backend MCP server will:
- Receive the auth token in the Authorization header
- Forward this token to registry/GraphQL endpoints
- NOT store any authentication state
- Return appropriate errors for invalid/expired tokens

---

## Security Considerations

### What Makes This Secure
1. **No secrets in browser:** Tokens are created by backend, not frontend
2. **Consistent with catalog:** Uses same auth pattern as existing catalog
3. **Stateless backend:** No cross-user authentication leakage
4. **Role-aware:** Tokens reflect current user role automatically

### What to Avoid
1. **Never** store JWT signing secrets in frontend
2. **Never** create tokens in JavaScript
3. **Never** cache tokens on backend
4. **Never** share tokens between users

---

## Questions for Clarification

1. What is the exact Redux selector path for the auth token?
2. How are token expiration/refresh handled in the catalog currently?
3. Are there existing error codes for authentication failures to handle?
4. What logging/monitoring should be added for auth failures?

---

## References

- Catalog Redux state management
- Existing GraphQL request authentication
- MCP protocol specification
- Quilt registry authentication documentation

---

## Success Criteria

✅ No JWT creation in frontend code  
✅ All MCP requests include auth token from Redux  
✅ Role switching automatically updates token in requests  
✅ Multiple users can use MCP simultaneously  
✅ No authentication state stored on backend  
✅ Security review passes  


