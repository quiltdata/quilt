# 🚀 Automatic JWT Refresh Implementation - Complete

> **Note**: Client-managed JWT regeneration has been deprecated. The frontend
> now relies on the catalog's existing authentication lifecycle and simply
> forwards the Redux token to the MCP server.

## 📋 Overview

This implementation provides **automatic JWT token validation and refresh** to seamlessly handle JWT secret changes without requiring manual browser refreshes. When the backend JWT secret is updated, the frontend will automatically detect validation failures and regenerate tokens with the new secret.

## ✅ What Was Implemented

### 1. **JWTValidator Service** (`services/JWTValidator.js`)

**Purpose**: Automatic JWT validation and refresh handler

**Key Features**:

- ✅ Validates JWT token structure and expiration
- ✅ Detects JWT validation errors from API responses
- ✅ Automatically refreshes tokens when validation fails
- ✅ Retry logic with configurable max retries (default: 3)
- ✅ Tracks validation failure statistics
- ✅ Prevents excessive retry loops

**How It Works**:

```javascript
// Detects JWT errors from various sources
isJWTValidationError(error) {
  // Checks for:
  // - 401/403 status codes
  // - JWT-related error messages
  // - Token verification failures
  // - Signature errors
}

// Handles failures with automatic refresh
handleValidationFailure(error, options) {
  // 1. Clears cached token
  // 2. Waits briefly to avoid race conditions
  // 3. Generates new token
  // 4. Validates new token
  // 5. Returns success/failure with retry flag
}
```

### 2. **Enhanced DynamicAuthManager** (`services/DynamicAuthManager.js`)

**New Features**:

- ✅ Integrated JWTValidator for all token operations
- ✅ Automatic token validation before returning cached tokens
- ✅ Token refresh when validation fails
- ✅ Public API for error handling: `handleJWTValidationError()`
- ✅ Public API for ensuring valid token: `ensureValidToken()`
- ✅ Configuration option: `autoRefreshOnError` (default: true)

**Token Validation Flow**:

```javascript
async getCurrentToken() {
  // 1. Check if cached token exists
  // 2. Validate cached token (expiration, structure)
  // 3. If valid and not expired, return cached token
  // 4. If invalid/expired, generate new token
  // 5. Validate new token before returning
  // 6. Fall back to original token if enhancement fails
}
```

### 3. **Smart MCP Client** (`MCP/Client.ts`)

**New Features**:

- ✅ Automatic JWT error detection in API responses
- ✅ Retry logic with token refresh on JWT errors
- ✅ Detects errors in both HTTP status and response payload
- ✅ Max 2 retries to prevent infinite loops
- ✅ Detailed logging for debugging

**Error Detection**:

```typescript
// Detects JWT errors from:
// - HTTP 401/403 status codes
// - Error messages containing: jwt, token, unauthorized, authentication, signature
// - Response payload error messages
```

**Automatic Retry Flow**:

```typescript
async callTool(toolCall, retryCount = 0) {
  try {
    // Make API call
    const response = await fetch(...)

    if (JWT_ERROR && retryCount < MAX_RETRIES) {
      // 1. Get auth manager
      // 2. Call handleJWTValidationError()
      // 3. If refresh successful, retry callTool()
      // 4. If refresh failed, throw error
    }
  } catch (error) {
    // Handle and rethrow
  }
}
```

### 4. **JWTConfigValidator Service** (`services/JWTConfigValidator.js`)

**Purpose**: Validates JWT configuration at startup

**Features**:

- ✅ Checks if JWT secret is configured
- ✅ Validates secret length (warns if < 32 chars)
- ✅ Compares with expected production secret
- ✅ Validates JWT Key ID configuration
- ✅ Checks MCP endpoint configuration
- ✅ Prints comprehensive validation report to console
- ✅ Categorizes issues (errors, warnings, info)

**Validation Report**:

```
================================================================================
🔐 JWT CONFIGURATION VALIDATION
================================================================================
✅ JWT configuration is valid and ready

ℹ️  INFORMATION:
   JWT secret configured (33 characters)
   Secret: QuiltMCPJWT...
   ✅ Using correct production JWT secret
   Backend and frontend secrets match
   JWT Key ID configured: frontend-enhanced
   MCP endpoint configured: https://demo.quiltdata.com/mcp/
================================================================================
```

### 5. **User-Friendly Notification** (`UI/JWTRefreshNotification.tsx`)

**Purpose**: Notify users of JWT validation errors and provide solutions

**Features**:

- ✅ Automatic detection of JWT validation failures
- ✅ Visual notification with warning styling
- ✅ One-click token refresh button
- ✅ Hard page refresh option
- ✅ Expandable "More Information" section
- ✅ Auto-dismiss after successful refresh
- ✅ Shows refresh status (loading, success, error)

**User Actions**:

1. **Refresh Token** - Automatically regenerates token with new secret
2. **Hard Refresh Page** - Reloads entire application
3. **Dismiss** - Hides notification (can reappear if errors continue)

### 6. **Integrated Chat UI** (`UI/Chat/Chat.tsx`)

**Integration**:

- ✅ JWT error detection hook: `useJWTErrorDetection()`
- ✅ Automatic notification display when errors detected
- ✅ Checks validation failures every 5 seconds
- ✅ Shows notification above chat messages
- ✅ Doesn't block chat functionality

## 🔄 Complete Flow: JWT Secret Change Handling

### Before (Manual Browser Refresh Required):

```
1. Backend updated with new JWT secret ❌
2. Frontend still uses old token signed with old secret ❌
3. Backend rejects token: "Signature verification failed" ❌
4. User sees error: "JWT token could not be verified" ❌
5. User must manually refresh browser ❌
6. New token generated with new secret ✅
```

### After (Automatic Handling):

```
1. Backend updated with new JWT secret ✅
2. Frontend uses old token (first request) ⚠️
3. Backend rejects token: "Signature verification failed" ⚠️
4. MCP Client detects JWT error ✅
5. MCP Client calls authManager.handleJWTValidationError() ✅
6. Auth manager clears cache and generates new token ✅
7. New token validated successfully ✅
8. MCP Client retries original request with new token ✅
9. Request succeeds ✅
10. User sees notification explaining what happened ℹ️
```

**Result**: Zero downtime, automatic recovery, user informed but not blocked

## 📊 Error Detection Patterns

The system detects JWT validation failures from multiple sources:

### HTTP Response Errors

- Status code 401 (Unauthorized)
- Status code 403 (Forbidden)
- Error text contains: "jwt", "token", "unauthorized", "authentication"

### Response Payload Errors

- Error message contains: "jwt", "token", "signature"
- Error message: "JWT token could not be verified"
- Error message: "Signature verification failed"

### Token Validation Errors

- Token expired (exp claim in past)
- Token expires soon (within 60 seconds)
- Invalid token structure
- Missing required claims

## 🧪 How to Test

### Test 1: Simulate JWT Secret Mismatch

```javascript
// In browser console:

// 1. Get current auth manager
const authManager = window.__dynamicAuthManager

// 2. Check current token
const oldToken = await authManager.getCurrentToken()
console.log('Old token length:', oldToken.length)

// 3. Clear cache
authManager.clearCache()

// 4. Make MCP tool call (should auto-refresh if backend secret changed)
const result = await window.__mcpClient.callTool({
  name: 'bucket_objects_list',
  arguments: { bucket: 's3://quilt-sandbox-bucket' },
})

console.log('Result:', result)
```

### Test 2: Check Validation Stats

```javascript
// Check JWT validation statistics
const stats = window.__dynamicAuthManager.getJWTValidationStats()
console.log('Validation stats:', stats)
// Output:
// {
//   validationFailureCount: 0,
//   lastValidationError: null,
//   autoRefreshEnabled: true,
//   maxRetries: 3
// }
```

### Test 3: Force Token Refresh

```javascript
// Manually trigger token refresh
const result = await window.__dynamicAuthManager.ensureValidToken()
console.log('Token validation result:', result)
// Output:
// {
//   valid: true,
//   token: "eyJhbGc...",
//   expiresIn: 86400
// }
```

### Test 4: Configuration Validation

```javascript
// Check JWT configuration
import { jwtConfigValidator } from 'components/Assistant/MCP/services/JWTConfigValidator'

const validation = jwtConfigValidator.validateConfig()
console.log('Configuration validation:', validation)
```

## 📈 Success Metrics

### Before Implementation:

- ❌ Manual browser refresh required after backend JWT secret change
- ❌ Users see cryptic "JWT verification failed" errors
- ❌ No automatic recovery
- ❌ Downtime during secret rotation

### After Implementation:

- ✅ Automatic token refresh on validation failures
- ✅ Zero-downtime JWT secret rotation
- ✅ User-friendly error notifications
- ✅ Automatic retry with exponential backoff
- ✅ Detailed logging for debugging
- ✅ Configuration validation at startup

## 🔧 Configuration

### Required Configuration (already set):

```json
{
  "mcpEnhancedJwtSecret": "QuiltMCPJWTSecret2025ProductionV1",
  "mcpEnhancedJwtKid": "frontend-enhanced"
}
```

### Optional Configuration:

```javascript
// Disable auto-refresh (not recommended)
window.__dynamicAuthManager.updateConfig({
  autoRefreshOnError: false,
})

// Change retry settings
window.__dynamicAuthManager.jwtValidator.maxRetries = 5
window.__dynamicAuthManager.jwtValidator.setAutoRefresh(true)
```

## 🐛 Debugging

### Enable Debug Logging:

```javascript
// In browser console
localStorage.setItem('debug', 'quilt:mcp:*')
```

### Check Auth Manager State:

```javascript
const authManager = window.__dynamicAuthManager

// Check initialization
console.log('Initialized:', authManager.isInitialized)

// Check current token
const token = await authManager.getCurrentToken()
console.log('Current token length:', token?.length)

// Check validation stats
const stats = authManager.getJWTValidationStats()
console.log('Validation stats:', stats)

// Check configuration
const config = authManager.getConfig()
console.log('Configuration:', config)
```

### Inspect Token:

```javascript
import { decodeJwt } from 'components/Assistant/MCP/decode-token'

const token = await window.__dynamicAuthManager.getCurrentToken()
const { header, payload } = decodeJwt(token)

console.log('Token header:', header)
console.log('Token payload:', payload)
console.log('Token expires:', new Date(payload.exp * 1000))
```

## 📝 Key Files

| File                             | Purpose                                   |
| -------------------------------- | ----------------------------------------- |
| `services/JWTValidator.js`       | JWT validation and refresh logic          |
| `services/DynamicAuthManager.js` | Enhanced with validation and auto-refresh |
| `services/JWTConfigValidator.js` | Startup configuration validation          |
| `MCP/Client.ts`                  | Automatic retry logic for MCP tool calls  |
| `UI/JWTRefreshNotification.tsx`  | User notification component               |
| `UI/Chat/Chat.tsx`               | Integrated notification display           |

## 🎯 Summary

The automatic JWT refresh implementation provides:

1. **Zero-Downtime Secret Rotation**: Backend can update JWT secret without breaking frontend
2. **Automatic Recovery**: Detects JWT validation failures and automatically refreshes tokens
3. **User-Friendly Experience**: Clear notifications and one-click resolution
4. **Developer-Friendly**: Comprehensive logging and debugging tools
5. **Production-Ready**: Configuration validation and error handling

**No more manual browser refreshes required!** 🚀

## 🔜 Future Enhancements

- [ ] JWT key rotation support (multiple keys with key IDs)
- [ ] Automatic secret refresh from SSM Parameter Store
- [ ] Token refresh scheduling (before expiration)
- [ ] Metrics collection for validation failures
- [ ] Admin dashboard for JWT statistics
